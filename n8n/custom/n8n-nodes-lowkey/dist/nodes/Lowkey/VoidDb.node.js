"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.VoidDb = void 0;
const orm_1 = require("@voiddb/orm");

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseJsonInput(rawValue, parameterName, { allowEmpty = false, expectObject = false } = {}) {
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    if (allowEmpty) {
      return undefined;
    }

    throw new Error(`${parameterName} is required.`);
  }

  const value = typeof rawValue === "string" ? JSON.parse(rawValue) : rawValue;

  if (expectObject && !isPlainObject(value)) {
    throw new Error(`${parameterName} must be a JSON object.`);
  }

  return value;
}

function toJson(value) {
  return JSON.parse(JSON.stringify(value));
}

async function createClient(credentials) {
  const client = new orm_1.VoidClient({
    url: String(credentials.baseUrl || "").replace(/\/+$/, ""),
    token: credentials.authMode === "token" && credentials.token ? credentials.token : undefined,
    timeout: Number(credentials.timeout || 30000),
  });

  if (credentials.authMode === "password") {
    if (!credentials.username || !credentials.password) {
      throw new Error("Username and password are required when Authentication is set to Username / Password.");
    }

    await client.login(credentials.username, credentials.password);
  }

  return client;
}

class VoidDb {
  constructor() {
    this.description = {
      displayName: "VoidDB",
      name: "lowkeyVoidDb",
      icon: "file:lowkey.svg",
      group: ["input", "output", "transform"],
      version: 1,
      description: "Query and mutate data in VoidDB using the official ORM",
      defaults: {
        name: "VoidDB",
      },
      codex: {
        categories: ["Data & Storage"],
        subcategories: {
          "Data & Storage": ["Databases"],
        },
      },
      inputs: ["main"],
      outputs: ["main"],
      credentials: [
        {
          name: "lowkeyVoidDbApi",
          required: true,
        },
      ],
      properties: [
        {
          displayName: "Operation",
          name: "operation",
          type: "options",
          default: "find",
          options: [
            { name: "Count", value: "count" },
            { name: "Delete Document", value: "delete" },
            { name: "Find Documents", value: "find" },
            { name: "Find Documents With Count", value: "findWithCount" },
            { name: "Get Document", value: "get" },
            { name: "Insert Document", value: "insert" },
            { name: "List Collections", value: "listCollections" },
            { name: "List Databases", value: "listDatabases" },
            { name: "Patch Document", value: "patch" },
            { name: "Replace Document", value: "replace" },
            { name: "Upload Blob Field", value: "uploadFile" },
          ],
        },
        {
          displayName: "Database",
          name: "database",
          type: "string",
          default: "app",
          required: true,
          displayOptions: {
            show: {
              operation: [
                "count",
                "delete",
                "find",
                "findWithCount",
                "get",
                "insert",
                "listCollections",
                "patch",
                "replace",
                "uploadFile",
              ],
            },
          },
        },
        {
          displayName: "Collection",
          name: "collection",
          type: "string",
          default: "",
          required: true,
          displayOptions: {
            show: {
              operation: [
                "count",
                "delete",
                "find",
                "findWithCount",
                "get",
                "insert",
                "patch",
                "replace",
                "uploadFile",
              ],
            },
          },
        },
        {
          displayName: "Document ID",
          name: "documentId",
          type: "string",
          default: "",
          required: true,
          displayOptions: {
            show: {
              operation: ["delete", "get", "patch", "replace", "uploadFile"],
            },
          },
        },
        {
          displayName: "Query JSON",
          name: "queryJson",
          type: "string",
          default: "{\n  \"limit\": 50\n}",
          typeOptions: {
            rows: 6,
          },
          description: "Raw VoidDB query JSON. Example: {\"where\":{\"status\":\"active\"},\"limit\":25}",
          displayOptions: {
            show: {
              operation: ["count", "find", "findWithCount"],
            },
          },
        },
        {
          displayName: "Document JSON",
          name: "documentJson",
          type: "string",
          default: "{\n  \"name\": \"Alice\"\n}",
          typeOptions: {
            rows: 8,
          },
          description: "JSON object to insert or replace",
          displayOptions: {
            show: {
              operation: ["insert", "replace"],
            },
          },
        },
        {
          displayName: "Patch JSON",
          name: "patchJson",
          type: "string",
          default: "{\n  \"status\": \"active\"\n}",
          typeOptions: {
            rows: 8,
          },
          description: "JSON object with fields to patch",
          displayOptions: {
            show: {
              operation: ["patch"],
            },
          },
        },
        {
          displayName: "Blob Field",
          name: "fieldName",
          type: "string",
          default: "file",
          required: true,
          displayOptions: {
            show: {
              operation: ["uploadFile"],
            },
          },
        },
        {
          displayName: "Binary Property",
          name: "binaryPropertyName",
          type: "string",
          default: "data",
          required: true,
          description: "Binary property on the incoming item to upload",
          displayOptions: {
            show: {
              operation: ["uploadFile"],
            },
          },
        },
        {
          displayName: "File Name",
          name: "fileName",
          type: "string",
          default: "",
          description: "Optional override for the uploaded file name",
          displayOptions: {
            show: {
              operation: ["uploadFile"],
            },
          },
        },
        {
          displayName: "Content Type",
          name: "contentType",
          type: "string",
          default: "",
          description: "Optional override for the MIME type",
          displayOptions: {
            show: {
              operation: ["uploadFile"],
            },
          },
        },
      ],
    };
  }

  async execute() {
    const items = this.getInputData();
    const returnData = [];
    const credentials = await this.getCredentials("lowkeyVoidDbApi");
    const client = await createClient(credentials);

    for (let itemIndex = 0; itemIndex < items.length; itemIndex += 1) {
      try {
        const operation = this.getNodeParameter("operation", itemIndex);

        if (operation === "listDatabases") {
          const databases = await client.listDatabases();

          for (const database of databases) {
            returnData.push({
              json: { database },
              pairedItem: { item: itemIndex },
            });
          }

          continue;
        }

        const databaseName = String(this.getNodeParameter("database", itemIndex));

        if (operation === "listCollections") {
          const collections = await client.db(databaseName).listCollections();

          for (const collection of collections) {
            returnData.push({
              json: { database: databaseName, collection },
              pairedItem: { item: itemIndex },
            });
          }

          continue;
        }

        const collectionName = String(this.getNodeParameter("collection", itemIndex));
        const collection = client.db(databaseName).collection(collectionName);

        if (operation === "get") {
          const documentId = String(this.getNodeParameter("documentId", itemIndex));
          const document = await collection.get(documentId);

          returnData.push({
            json: toJson(document),
            pairedItem: { item: itemIndex },
          });
          continue;
        }

        if (operation === "find") {
          const queryJson = this.getNodeParameter("queryJson", itemIndex, "");
          const query = parseJsonInput(queryJson, "Query JSON", { allowEmpty: true });
          const rows = await collection.find(query);

          for (const row of rows) {
            returnData.push({
              json: toJson(row),
              pairedItem: { item: itemIndex },
            });
          }

          continue;
        }

        if (operation === "findWithCount") {
          const queryJson = this.getNodeParameter("queryJson", itemIndex, "");
          const query = parseJsonInput(queryJson, "Query JSON", { allowEmpty: true });
          const result = await collection.findWithCount(query);

          returnData.push({
            json: toJson(result),
            pairedItem: { item: itemIndex },
          });
          continue;
        }

        if (operation === "count") {
          const queryJson = this.getNodeParameter("queryJson", itemIndex, "");
          const query = parseJsonInput(queryJson, "Query JSON", { allowEmpty: true });
          const count = await collection.count(query);

          returnData.push({
            json: {
              database: databaseName,
              collection: collectionName,
              count,
            },
            pairedItem: { item: itemIndex },
          });
          continue;
        }

        if (operation === "insert") {
          const documentJson = this.getNodeParameter("documentJson", itemIndex);
          const document = parseJsonInput(documentJson, "Document JSON", { expectObject: true });
          const insertedId = await collection.insert(document);
          const insertedDocument = await collection.get(insertedId);

          returnData.push({
            json: toJson(insertedDocument),
            pairedItem: { item: itemIndex },
          });
          continue;
        }

        if (operation === "patch") {
          const documentId = String(this.getNodeParameter("documentId", itemIndex));
          const patchJson = this.getNodeParameter("patchJson", itemIndex);
          const patch = parseJsonInput(patchJson, "Patch JSON", { expectObject: true });
          delete patch._id;
          const updated = await collection.patch(documentId, patch);

          returnData.push({
            json: toJson(updated),
            pairedItem: { item: itemIndex },
          });
          continue;
        }

        if (operation === "replace") {
          const documentId = String(this.getNodeParameter("documentId", itemIndex));
          const documentJson = this.getNodeParameter("documentJson", itemIndex);
          const document = parseJsonInput(documentJson, "Document JSON", { expectObject: true });
          delete document._id;
          await collection.replace(documentId, document);
          const replaced = await collection.get(documentId);

          returnData.push({
            json: toJson(replaced),
            pairedItem: { item: itemIndex },
          });
          continue;
        }

        if (operation === "delete") {
          const documentId = String(this.getNodeParameter("documentId", itemIndex));
          await collection.delete(documentId);

          returnData.push({
            json: {
              _id: documentId,
              deleted: true,
              database: databaseName,
              collection: collectionName,
            },
            pairedItem: { item: itemIndex },
          });
          continue;
        }

        if (operation === "uploadFile") {
          const documentId = String(this.getNodeParameter("documentId", itemIndex));
          const fieldName = String(this.getNodeParameter("fieldName", itemIndex));
          const binaryPropertyName = String(this.getNodeParameter("binaryPropertyName", itemIndex));
          const binaryMeta = items[itemIndex].binary && items[itemIndex].binary[binaryPropertyName];

          if (!binaryMeta) {
            throw new Error(`Binary property "${binaryPropertyName}" was not found on the incoming item.`);
          }

          const buffer = await this.helpers.getBinaryDataBuffer(itemIndex, binaryPropertyName);
          const fileName =
            String(this.getNodeParameter("fileName", itemIndex, "")) ||
            binaryMeta.fileName ||
            `${fieldName}.bin`;
          const contentType =
            String(this.getNodeParameter("contentType", itemIndex, "")) ||
            binaryMeta.mimeType ||
            "application/octet-stream";
          const blob = await collection.uploadFile(documentId, fieldName, buffer, {
            filename: fileName,
            contentType,
          });
          const updated = await collection.get(documentId);

          returnData.push({
            json: {
              document: toJson(updated),
              blob: toJson(blob),
            },
            pairedItem: { item: itemIndex },
          });
          continue;
        }

        throw new Error(`Unsupported operation "${operation}".`);
      } catch (error) {
        if (this.continueOnFail()) {
          returnData.push({
            json: {
              error: error instanceof Error ? error.message : String(error),
            },
            pairedItem: { item: itemIndex },
          });
          continue;
        }

        throw error;
      }
    }

    return [returnData];
  }
}

exports.VoidDb = VoidDb;
