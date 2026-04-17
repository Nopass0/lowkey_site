import Elysia from "elysia";
import { authMiddleware } from "../auth/middleware";
import { config } from "../config";
import { db } from "../db";

export const jopaRoutes = new Elysia({ prefix: "/user/jopa-token" })
  .use(authMiddleware)
  .get("/", async ({ user, set }) => {
    let lastError: any = null;
    const urlsToTry: string[] = [config.JOPA_API_URL];

    // Dynamic discovery: find other online JOPA nodes
    try {
      const otherServers = await db.vpnServer.findMany({
        where: { status: "online", serverType: "jopa" },
        take: 5,
      });
      for (const s of otherServers) {
        const discoveredUrl = `http://${s.ip}:${s.port === 7443 ? 9109 : s.port}`; 
        if (!urlsToTry.includes(discoveredUrl)) {
          urlsToTry.push(discoveredUrl);
        }
      }
    } catch (e) {
      console.warn("[JOPA] discovery failed:", e);
    }

    for (const urlBase of urlsToTry) {
      const url = `${urlBase}/api/v1/client/bootstrap`;
      try {
        const resp = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            login: config.JOPA_LOGIN,
            password: config.JOPA_PASSWORD,
            sub_token: "auto",
            device_id: `lowkey-${user.userId}`,
            device_name: "lowkey-client",
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (!resp.ok) {
          lastError = `HTTP ${resp.status}`;
          continue;
        }

        const data = (await resp.json()) as any;
        const sub_token = data?.subscription?.token ?? data?.token ?? null;

        if (!sub_token) {
          lastError = "No sub_token in response";
          continue;
        }

        console.log(`[JOPA] Bootstrap success via ${urlBase}`);
        return { sub_token };
      } catch (err: any) {
        lastError = err.message || String(err);
        console.warn(`[JOPA] Bootstrap attempt failed for ${urlBase}:`, lastError);
      }
    }

    set.status = 502;
    return { 
      message: "JOPA bootstrap error", 
      error: lastError,
      details: `Tried ${urlsToTry.length} relay(s): ${urlsToTry.join(", ")}`
    };
  });
