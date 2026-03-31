import { existsSync, readFileSync } from "fs";
import { resolve } from "path";
import { VoidClient, parseSchemaFile } from "@voiddb/orm";
import { config } from "./config";

const SCHEMA_PATH = resolve(import.meta.dir, "../.voiddb/schema/english.schema");

function isAuthError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "");
  return /invalid or expired token|unauthorized|forbidden|401|403/i.test(message);
}

async function getSchemaClient() {
  if (config.voiddb.username && config.voiddb.password) {
    const client = VoidClient.fromEnv({ url: config.voiddb.url });
    await client.login(config.voiddb.username, config.voiddb.password);
    return client;
  }

  if (config.voiddb.token) {
    const tokenClient = VoidClient.fromEnv({
      url: config.voiddb.url,
      token: config.voiddb.token,
    });

    try {
      await tokenClient.listDatabases();
      return tokenClient;
    } catch (error) {
      if (!isAuthError(error)) {
        throw error;
      }
    }
  }

  return null;
}

export async function syncEnglishSchemaOnStartup() {
  if (!existsSync(SCHEMA_PATH)) {
    console.warn(`[voiddb] schema file not found: ${SCHEMA_PATH}`);
    return;
  }

  const client = await getSchemaClient();
  if (!client) {
    console.warn("[voiddb] schema sync skipped: missing valid auth");
    return;
  }

  const schema = readFileSync(SCHEMA_PATH, "utf8");
  const project = parseSchemaFile(schema);
  const databases = [...new Set(project.models.map((model) => model.schema.database).filter(Boolean))];

  if (databases.length === 0) {
    console.warn("[voiddb] schema sync skipped: no databases declared");
    return;
  }

  const existingDatabases = await client.listDatabases();
  for (const database of databases) {
    if (!existingDatabases.includes(database)) {
      await client.createDatabase(database);
    }
  }

  const plan = await client.schema.push(project);
  if (plan.operations.length > 0) {
    for (const operation of plan.operations) {
      console.log(`[voiddb] APPLY ${operation.summary}`);
    }
  }
}
