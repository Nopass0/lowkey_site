import Elysia, { t } from "elysia";
import { db } from "../../db";
import { adminMiddleware } from "../../auth/middleware";
import { config } from "../../config";
import { deployHysteriaNode } from "./deploy";
import { decryptSecret, encryptSecret } from "./secret-box";

const MAX_DEPLOY_MESSAGE_LENGTH = 8_000;

type VpnServerRow = Awaited<ReturnType<typeof db.vpnServer.findUnique>>;

function normalizeOptionalString(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizeHostname(value?: string | null) {
  const normalized = normalizeOptionalString(value);
  return normalized ? normalized.toLowerCase() : null;
}

function normalizeConnectLinkTemplate(value?: string | null) {
  const trimmed = normalizeOptionalString(value);
  if (!trimmed) {
    return null;
  }

  if (trimmed.includes("vless://") && !trimmed.includes("type=")) {
    const [baseUrl, tag] = trimmed.split("#");
    const separator = baseUrl.includes("?") ? "&" : "?";
    return `${baseUrl}${separator}type=tcp${tag ? `#${tag}` : ""}`;
  }

  return trimmed;
}

function sanitizePm2Name(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function defaultPm2ProcessName(server: {
  ip: string;
  hostname?: string | null;
  id?: string | null;
}) {
  const suffix = sanitizePm2Name(server.hostname || server.ip || server.id || "node");
  return `${config.VPN_NODE_PM2_PREFIX}-${suffix || "node"}`;
}

function truncateDeployMessage(...parts: Array<string | null | undefined>) {
  const message = parts
    .map((part) => part?.trim())
    .filter(Boolean)
    .join("\n\n")
    .trim();

  if (!message) {
    return null;
  }

  if (message.length <= MAX_DEPLOY_MESSAGE_LENGTH) {
    return message;
  }

  return `${message.slice(0, MAX_DEPLOY_MESSAGE_LENGTH)}\n\n...[truncated]`;
}

function serializeServer(server: NonNullable<VpnServerRow>) {
  return {
    id: server.id,
    ip: String(server.ip),
    hostname: server.hostname ? String(server.hostname) : null,
    sshUsername: server.sshUsername ? String(server.sshUsername) : null,
    hasSshPassword: Boolean(server.sshPasswordEncrypted),
    port: Number(server.port ?? 443),
    status: String(server.status ?? "offline"),
    deployStatus: String(server.deployStatus ?? "not_deployed"),
    deployMessage: server.deployMessage ? String(server.deployMessage) : null,
    deployedAt: server.deployedAt ? new Date(server.deployedAt).toISOString() : null,
    pm2ProcessName: server.pm2ProcessName ? String(server.pm2ProcessName) : null,
    currentLoad: Number(server.currentLoad ?? 0),
    lastSeenAt: server.lastSeenAt ? new Date(server.lastSeenAt).toISOString() : null,
    createdAt: server.createdAt ? new Date(server.createdAt).toISOString() : null,
    serverType: String(server.serverType ?? "hysteria2"),
    supportedProtocols: Array.isArray(server.supportedProtocols)
      ? server.supportedProtocols.map((item: unknown) => String(item))
      : [],
    location: String(server.location ?? "Unknown, UN"),
    connectLinkTemplate: server.connectLinkTemplate
      ? String(server.connectLinkTemplate)
      : null,
  };
}

async function getServerOrNull(id: string) {
  return db.vpnServer.findUnique({ where: { id } });
}

async function runServerDeployment(serverId: string) {
  let currentServer = await getServerOrNull(serverId);

  try {
    if (!currentServer) {
      throw new Error("Server not found");
    }
    if (!currentServer.hostname) {
      throw new Error("Hostname is required for deployment");
    }
    if (!currentServer.sshUsername || !currentServer.sshPasswordEncrypted) {
      throw new Error("SSH credentials are not configured");
    }

    const pm2ProcessName =
      normalizeOptionalString(currentServer.pm2ProcessName) ??
      defaultPm2ProcessName(currentServer);
    const mtproto = (await db.mtprotoSettings.findFirst({})) ?? {};
    const sshPassword = decryptSecret(String(currentServer.sshPasswordEncrypted));

    const result = await deployHysteriaNode(
      {
        ip: String(currentServer.ip),
        hostname: String(currentServer.hostname),
        sshUsername: String(currentServer.sshUsername),
        sshPassword,
        pm2ProcessName,
        serverId: String(currentServer.id),
      },
      mtproto,
    );

    await db.vpnServer.update({
      where: { id: serverId },
      data: {
        pm2ProcessName,
        deployStatus: "deployed",
        deployMessage: truncateDeployMessage(result.stdout, result.stderr),
        deployedAt: new Date(),
      },
    });
  } catch (error) {
    console.error("[AdminServerDeploy] error:", error);
    currentServer = currentServer ?? (await getServerOrNull(serverId));
    const pm2ProcessName = currentServer
      ? normalizeOptionalString(currentServer.pm2ProcessName) ??
        defaultPm2ProcessName(currentServer)
      : null;

    if (currentServer) {
      await db.vpnServer.update({
        where: { id: serverId },
        data: {
          pm2ProcessName,
          deployStatus: "failed",
          deployMessage: truncateDeployMessage(
            error instanceof Error ? error.message : String(error),
          ),
        },
      });
    }
  }
}

export const adminServerRoutes = new Elysia({ prefix: "/admin/server" })
  .use(adminMiddleware)
  .get("/list", async () => {
    const servers = await db.vpnServer.findMany({
      orderBy: [{ createdAt: "desc" }, { lastSeenAt: "desc" }],
    });

    return servers.map((server) => serializeServer(server));
  })
  .post(
    "/",
    async ({ body, set }) => {
      try {
        const ip = body.ip.trim();
        const hostname = normalizeHostname(body.hostname);
        const location = normalizeOptionalString(body.location) ?? "Unknown, UN";
        const sshUsername = normalizeOptionalString(body.sshUsername);
        const pm2ProcessName =
          normalizeOptionalString(body.pm2ProcessName) ??
          defaultPm2ProcessName({ ip, hostname });

        if (!ip) {
          set.status = 400;
          return { message: "IP address is required" };
        }
        if (!hostname) {
          set.status = 400;
          return { message: "Hostname is required for TLS issuance" };
        }
        if (!sshUsername || !body.sshPassword.trim()) {
          set.status = 400;
          return { message: "SSH username and password are required" };
        }

        const existing = await db.vpnServer.findFirst({
          where: { ip },
        });

        if (existing) {
          set.status = 409;
          return { message: "Server with this IP already exists" };
        }

        const created = await db.vpnServer.create({
          data: {
            ip,
            hostname,
            sshUsername,
            sshPasswordEncrypted: encryptSecret(body.sshPassword.trim()),
            port: 443,
            status: "offline",
            deployStatus: "not_deployed",
            deployMessage: null,
            pm2ProcessName,
            currentLoad: 0,
            serverType: "hysteria2",
            supportedProtocols: ["hysteria2"],
            location,
            connectLinkTemplate: normalizeConnectLinkTemplate(
              body.connectLinkTemplate,
            ),
          },
        });

        set.status = 201;
        return serializeServer(created);
      } catch (error) {
        console.error("[AdminServerCreate] error:", error);
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    {
      body: t.Object({
        ip: t.String(),
        hostname: t.String(),
        location: t.Optional(t.String()),
        sshUsername: t.String(),
        sshPassword: t.String(),
        pm2ProcessName: t.Optional(t.String()),
        connectLinkTemplate: t.Optional(t.Nullable(t.String())),
      }),
    },
  )
  .patch(
    "/:id",
    async ({ params, body, set }) => {
      try {
        const existing = await getServerOrNull(params.id);
        if (!existing) {
          set.status = 404;
          return { message: "Server not found" };
        }

        const nextIp = body.ip?.trim();
        if (nextIp && nextIp !== existing.ip) {
          const duplicate = await db.vpnServer.findFirst({
            where: { ip: nextIp },
          });
          if (duplicate && duplicate.id !== existing.id) {
            set.status = 409;
            return { message: "Server with this IP already exists" };
          }
        }

        const updated = await db.vpnServer.update({
          where: { id: params.id },
          data: {
            ...(body.ip !== undefined ? { ip: body.ip.trim() } : {}),
            ...(body.location !== undefined
              ? {
                  location:
                    normalizeOptionalString(body.location) ?? "Unknown, UN",
                }
              : {}),
            ...(body.hostname !== undefined
              ? { hostname: normalizeHostname(body.hostname) }
              : {}),
            ...(body.connectLinkTemplate !== undefined
              ? {
                  connectLinkTemplate: normalizeConnectLinkTemplate(
                    body.connectLinkTemplate,
                  ),
                }
              : {}),
            ...(body.status !== undefined ? { status: body.status } : {}),
            ...(body.serverType !== undefined
              ? { serverType: body.serverType }
              : {}),
            ...(body.sshUsername !== undefined
              ? { sshUsername: normalizeOptionalString(body.sshUsername) }
              : {}),
            ...(body.pm2ProcessName !== undefined
              ? {
                  pm2ProcessName:
                    normalizeOptionalString(body.pm2ProcessName) ??
                    defaultPm2ProcessName({
                      id: existing.id,
                      ip: nextIp || existing.ip,
                      hostname:
                        body.hostname !== undefined
                          ? normalizeHostname(body.hostname)
                          : existing.hostname,
                    }),
                }
              : {}),
            ...(body.sshPassword !== undefined && body.sshPassword.trim()
              ? {
                  sshPasswordEncrypted: encryptSecret(body.sshPassword.trim()),
                }
              : {}),
          },
        });

        return serializeServer(updated);
      } catch (error) {
        console.error("[AdminServerUpdate] error:", error);
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    {
      body: t.Object({
        ip: t.Optional(t.String()),
        location: t.Optional(t.String()),
        hostname: t.Optional(t.Nullable(t.String())),
        connectLinkTemplate: t.Optional(t.Nullable(t.String())),
        status: t.Optional(t.String()),
        serverType: t.Optional(t.String()),
        sshUsername: t.Optional(t.Nullable(t.String())),
        sshPassword: t.Optional(t.String()),
        pm2ProcessName: t.Optional(t.Nullable(t.String())),
      }),
    },
  )
  .post("/:id/deploy", async ({ params, set }) => {
    try {
      const server = await getServerOrNull(params.id);
      if (!server) {
        set.status = 404;
        return { message: "Server not found" };
      }
      if (!server.hostname) {
        set.status = 400;
        return { message: "Hostname is required before deployment" };
      }
      if (!server.sshUsername || !server.sshPasswordEncrypted) {
        set.status = 400;
        return { message: "SSH credentials are required before deployment" };
      }
      if (server.deployStatus === "deploying") {
        set.status = 409;
        return { message: "Deployment is already in progress" };
      }

      await db.vpnServer.update({
        where: { id: params.id },
        data: {
          deployStatus: "deploying",
          deployMessage: "Deployment started",
          pm2ProcessName:
            normalizeOptionalString(server.pm2ProcessName) ??
            defaultPm2ProcessName(server),
        },
      });

      queueMicrotask(() => {
        void runServerDeployment(params.id);
      });

      set.status = 202;
      return { success: true, status: "deploying" };
    } catch (error) {
      console.error("[AdminServerDeployStart] error:", error);
      set.status = 500;
      return { message: "Internal server error" };
    }
  })
  .get("/mtproto", async ({ set }) => {
    try {
      const settings = await db.mtprotoSettings.findFirst({});
      return (
        settings ?? {
          id: "global",
          enabled: false,
          port: 443,
          secret: null,
          channelUsername: null,
          botUsername: null,
          addChannelOnConnect: false,
        }
      );
    } catch (error) {
      console.error("[AdminServerMtprotoGet] error:", error);
      set.status = 500;
      return { message: "Internal server error" };
    }
  })
  .patch(
    "/mtproto",
    async ({ body, set }) => {
      try {
        const existing = await db.mtprotoSettings.findFirst({});
        if (existing) {
          return await db.mtprotoSettings.update({
            where: { id: "global" },
            data: body,
          });
        }

        return await db.mtprotoSettings.create({
          data: { id: "global", ...body },
        });
      } catch (error) {
        console.error("[AdminServerMtprotoPatch] error:", error);
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    {
      body: t.Object({
        enabled: t.Optional(t.Boolean()),
        port: t.Optional(t.Number()),
        secret: t.Optional(t.Nullable(t.String())),
        channelUsername: t.Optional(t.Nullable(t.String())),
        botUsername: t.Optional(t.Nullable(t.String())),
        addChannelOnConnect: t.Optional(t.Boolean()),
      }),
    },
  )
  .delete("/:id", async ({ params, set }) => {
    try {
      await db.vpnServer.delete({
        where: { id: params.id },
      });
      return { success: true };
    } catch (error) {
      console.error("[AdminServerDelete] error:", error);
      set.status = 500;
      return { message: "Internal server error" };
    }
  });
