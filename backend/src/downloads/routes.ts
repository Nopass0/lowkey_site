/**
 * @fileoverview Downloads routes: public app releases endpoints.
 * No authentication required.
 */

import Elysia, { t } from "elysia";
import { db } from "../db";

/**
 * Downloads routes group.
 * Provides public endpoints for fetching latest app releases.
 */
export const downloadRoutes = new Elysia({ prefix: "/downloads" })
  // ─── GET /downloads/releases ───────────────────────────
  // Returns all "latest" releases (one per platform)
  .get("/releases", async ({ set }) => {
    try {
      const releases = await db.appRelease.findMany({
        where: { isLatest: true },
        orderBy: { createdAt: "desc" },
      });

      return releases.map((r) => ({
        id: r.id,
        platform: r.platform,
        version: r.version,
        changelog: r.changelog,
        downloadUrl: r.downloadUrl,
        fileSizeMb: r.fileSizeMb,
        sha256: r.sha256 ?? "",
        downloadCount: r.downloadCount,
        isLatest: r.isLatest,
        createdAt: r.createdAt.toISOString(),
      }));
    } catch (err) {
      set.status = 500;
      return { message: "Internal server error" };
    }
  })

  // ─── GET /downloads/releases/latest/:platform ──────────
  // Used by the Tauri auto-updater to check for new Windows releases.
  // Returns the single latest release for the given platform or 404.
  .get(
    "/releases/latest/:platform",
    async ({ params, set }) => {
      try {
        const { platform } = params;

        if (!["android", "windows", "macos", "linux"].includes(platform)) {
          set.status = 400;
          return { message: "Unknown platform" };
        }

        const release = await db.appRelease.findFirst({
          where: { platform, isLatest: true },
          orderBy: { createdAt: "desc" },
        });

        if (!release) {
          set.status = 404;
          return { message: "No release found" };
        }

        // Increment download counter in background (fire-and-forget)
        db.appRelease
          .update({
            where: { id: release.id },
            data: { downloadCount: (release.downloadCount ?? 0) + 1 },
          })
          .catch(() => {});

        return {
          id: release.id,
          platform: release.platform,
          version: release.version,
          changelog: release.changelog,
          downloadUrl: release.downloadUrl,
          fileSizeMb: release.fileSizeMb,
          sha256: release.sha256 ?? "",
          downloadCount: release.downloadCount,
          isLatest: release.isLatest,
          createdAt: release.createdAt.toISOString(),
        };
      } catch (err) {
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    {
      params: t.Object({ platform: t.String() }),
    },
  );
