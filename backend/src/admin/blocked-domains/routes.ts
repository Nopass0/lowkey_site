import Elysia, { t } from "elysia";
import { adminMiddleware } from "../../auth/middleware";
import { db } from "../../db";

export const adminBlockedDomainRoutes = new Elysia({ prefix: "/admin/blocked-domains" })
  .use(adminMiddleware)

  .get("/", async ({ set }) => {
    try {
      const items = await db.vpnBlockedDomain.findMany({
        orderBy: { createdAt: "desc" },
      });
      return {
        items: items.map((d: any) => ({
          ...d,
          createdAt: d.createdAt instanceof Date ? d.createdAt.toISOString() : d.createdAt,
        })),
      };
    } catch (error) {
      console.error("[BlockedDomains] List error", error);
      set.status = 500;
      return { message: "Internal server error" };
    }
  })

  .post(
    "/",
    async ({ body, adminUser, set }) => {
      try {
        const domain = body.domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
        if (!domain) {
          set.status = 400;
          return { message: "Invalid domain" };
        }

        const existing = await db.vpnBlockedDomain.findFirst({ where: { domain } });
        if (existing) {
          // Re-activate if was deactivated
          const updated = await db.vpnBlockedDomain.update({
            where: { id: existing.id },
            data: {
              reason: body.reason?.trim() || null,
              redirectUrl: body.redirectUrl?.trim() || null,
              isActive: true,
            },
          });
          return {
            ...updated,
            createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : updated.createdAt,
          };
        }

        const item = await db.vpnBlockedDomain.create({
          data: {
            domain,
            reason: body.reason?.trim() || null,
            redirectUrl: body.redirectUrl?.trim() || null,
            isActive: true,
            createdById: adminUser.userId,
          },
        });

        return {
          ...item,
          createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
        };
      } catch (error) {
        console.error("[BlockedDomains] Create error", error);
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    {
      body: t.Object({
        domain: t.String({ minLength: 1, maxLength: 253 }),
        reason: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
        redirectUrl: t.Optional(t.Nullable(t.String({ maxLength: 512 }))),
      }),
    },
  )

  .patch(
    "/:id",
    async ({ params, body, set }) => {
      try {
        const existing = await db.vpnBlockedDomain.findFirst({ where: { id: params.id } });
        if (!existing) {
          set.status = 404;
          return { message: "Not found" };
        }

        const updated = await db.vpnBlockedDomain.update({
          where: { id: params.id },
          data: {
            ...(body.reason !== undefined ? { reason: body.reason?.trim() || null } : {}),
            ...(body.redirectUrl !== undefined ? { redirectUrl: body.redirectUrl?.trim() || null } : {}),
            ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
          },
        });

        return {
          ...updated,
          createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : updated.createdAt,
        };
      } catch (error) {
        console.error("[BlockedDomains] Update error", error);
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        reason: t.Optional(t.Nullable(t.String({ maxLength: 500 }))),
        redirectUrl: t.Optional(t.Nullable(t.String({ maxLength: 512 }))),
        isActive: t.Optional(t.Boolean()),
      }),
    },
  )

  .delete(
    "/:id",
    async ({ params, set }) => {
      try {
        await db.vpnBlockedDomain.deleteMany({ where: { id: params.id } });
        return { ok: true };
      } catch (error) {
        console.error("[BlockedDomains] Delete error", error);
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    { params: t.Object({ id: t.String() }) },
  );

// Public endpoint for hysteria server to fetch active blocked domains
export const blockedDomainsPublicRoutes = new Elysia({ prefix: "/vpn" })
  .get(
    "/blocked-domains",
    async ({ headers, set }) => {
      // Validate server secret
      const secret = process.env.BACKEND_SECRET;
      if (secret && headers["x-server-secret"] !== secret) {
        set.status = 401;
        return { message: "Unauthorized" };
      }

      try {
        const items = await db.vpnBlockedDomain.findMany({
          where: { isActive: true },
        });
        return {
          domains: items.map((d: any) => ({
            domain: d.domain,
            reason: d.reason ?? null,
            redirectUrl: d.redirectUrl ?? "https://lowkey.su/blocked",
          })),
        };
      } catch (error) {
        console.error("[BlockedDomains] Public list error", error);
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
  );
