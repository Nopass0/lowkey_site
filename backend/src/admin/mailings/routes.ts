import Elysia, { t } from "elysia";
import { mkdir } from "fs/promises";
import { adminMiddleware } from "../../auth/middleware";
import { db } from "../../db";
import { config } from "../../config";
import {
  buildTelegramPostText,
  sendTelegramMessage,
  isBotBlockedError,
  type TelegramButton,
} from "../../telegram";

// ─── Types ────────────────────────────────────────────────────────────────────

type TargetType = "all" | "selected" | "group";

interface RecipientGroupCondition {
  field: "subscriptionActive" | "plan" | "hasTelegram" | "joinedAfter" | "joinedBefore" | "minBalance" | "maxBalance";
  value: string | boolean | number;
}

// ─── Mailing projection ───────────────────────────────────────────────────────

const mailingSelect = {
  id: true,
  title: true,
  message: true,
  imageUrl: true,
  buttons: true,
  targetType: true,
  recipientGroupId: true,
  selectedUserIds: true,
  status: true,
  scheduledAt: true,
  processingAt: true,
  sentAt: true,
  targetCount: true,
  sentCount: true,
  failedCount: true,
  blockedCount: true,
  clickCount: true,
  deliveredUserIds: true,
  failedUserIds: true,
  blockedUserIds: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: { id: true, login: true },
  },
} as const;

function normalizeMailing(mailing: any) {
  return {
    ...mailing,
    buttons: Array.isArray(mailing.buttons) ? mailing.buttons : [],
    selectedUserIds: Array.isArray(mailing.selectedUserIds) ? mailing.selectedUserIds : [],
    deliveredUserIds: Array.isArray(mailing.deliveredUserIds) ? mailing.deliveredUserIds : [],
    failedUserIds: Array.isArray(mailing.failedUserIds) ? mailing.failedUserIds : [],
    blockedUserIds: Array.isArray(mailing.blockedUserIds) ? mailing.blockedUserIds : [],
    scheduledAt: mailing.scheduledAt instanceof Date ? mailing.scheduledAt.toISOString() : mailing.scheduledAt,
    processingAt: mailing.processingAt instanceof Date ? mailing.processingAt.toISOString() : (mailing.processingAt ?? null),
    sentAt: mailing.sentAt instanceof Date ? mailing.sentAt.toISOString() : (mailing.sentAt ?? null),
    createdAt: mailing.createdAt instanceof Date ? mailing.createdAt.toISOString() : mailing.createdAt,
    updatedAt: mailing.updatedAt instanceof Date ? mailing.updatedAt.toISOString() : mailing.updatedAt,
  };
}

// ─── Recipient resolution ─────────────────────────────────────────────────────

async function resolveGroupConditions(conditions: RecipientGroupCondition[]) {
  const where: Record<string, any> = {
    telegramId: { not: null },
    isBanned: false,
  };

  for (const cond of conditions) {
    switch (cond.field) {
      case "subscriptionActive":
        if (cond.value === true) {
          where.subscription = { is: { activeUntil: { gt: new Date() } } };
        } else if (cond.value === false) {
          where.subscription = { is: null };
        }
        break;
      case "plan":
        if (typeof cond.value === "string" && cond.value) {
          where.subscription = { is: { planId: cond.value } };
        }
        break;
      case "joinedAfter":
        where.joinedAt = { ...where.joinedAt, gt: new Date(String(cond.value)) };
        break;
      case "joinedBefore":
        where.joinedAt = { ...where.joinedAt, lt: new Date(String(cond.value)) };
        break;
      case "minBalance":
        where.balance = { ...where.balance, gte: Number(cond.value) };
        break;
      case "maxBalance":
        where.balance = { ...where.balance, lte: Number(cond.value) };
        break;
    }
  }

  return where;
}

async function getRecipientsWhere(
  targetType: TargetType,
  selectedUserIds: string[],
  recipientGroupId?: string | null,
) {
  if (targetType === "selected") {
    return {
      id: { in: selectedUserIds },
      telegramId: { not: null },
      isBanned: false,
    };
  }

  if (targetType === "group" && recipientGroupId) {
    const group = await db.mailingRecipientGroup.findFirst({
      where: { id: recipientGroupId },
    });
    if (group) {
      const conditions = Array.isArray(group.conditions) ? group.conditions as RecipientGroupCondition[] : [];
      return resolveGroupConditions(conditions);
    }
  }

  return {
    telegramId: { not: null },
    isBanned: false,
  };
}

// ─── Mailing processor ────────────────────────────────────────────────────────

export async function processPendingMailings(): Promise<void> {
  const now = new Date();
  const pending = await db.telegramMailing.findMany({
    where: {
      status: "scheduled",
      scheduledAt: { lte: now },
    },
    orderBy: { scheduledAt: "asc" },
    take: 5,
  });

  for (const mailing of pending) {
    const claimed = await db.telegramMailing.updateMany({
      where: { id: mailing.id, status: "scheduled" },
      data: { status: "processing", processingAt: new Date(), lastError: null },
    });

    if (claimed.count === 0) continue;

    try {
      const recipientsWhere = await getRecipientsWhere(
        mailing.targetType as TargetType,
        Array.isArray(mailing.selectedUserIds) ? (mailing.selectedUserIds as string[]) : [],
        mailing.recipientGroupId as string | null,
      );

      const recipients = await db.user.findMany({
        where: recipientsWhere,
        select: { id: true, login: true, telegramId: true },
      });

      const text = buildTelegramPostText({
        title: mailing.title as string,
        message: mailing.message as string,
      });

      const buttons = Array.isArray(mailing.buttons)
        ? (mailing.buttons as TelegramButton[])
        : [];

      let sentCount = 0;
      let failedCount = 0;
      let blockedCount = 0;
      let lastError: string | null = null;
      const deliveredUserIds: string[] = [];
      const failedUserIds: string[] = [];
      const blockedUserIds: string[] = [];

      for (const recipient of recipients) {
        if (!recipient.telegramId) continue;

        try {
          await sendTelegramMessage({
            chatId: recipient.telegramId.toString(),
            text,
            imageUrl: mailing.imageUrl as string | null,
            buttons: buttons.length > 0 ? buttons : null,
          });
          sentCount++;
          deliveredUserIds.push(recipient.id as string);
        } catch (error) {
          if (isBotBlockedError(error)) {
            blockedCount++;
            blockedUserIds.push(recipient.id as string);
          } else {
            failedCount++;
            failedUserIds.push(recipient.id as string);
            lastError = error instanceof Error ? error.message.slice(0, 500) : String(error);
          }
          console.error("[Mailing] Failed recipient", {
            mailingId: mailing.id,
            userId: recipient.id,
            login: recipient.login,
            error,
          });
        }
      }

      // If at least one was sent, mark as "sent"
      const finalStatus = sentCount > 0 ? "sent" : (blockedCount === recipients.length ? "failed" : "sent");

      await db.telegramMailing.update({
        where: { id: mailing.id },
        data: {
          status: finalStatus,
          targetCount: recipients.length,
          sentCount,
          failedCount,
          blockedCount,
          deliveredUserIds,
          failedUserIds,
          blockedUserIds,
          sentAt: new Date(),
          lastError,
        },
      });
    } catch (error) {
      console.error("[Mailing] Fatal processing error", { mailingId: mailing.id, error });
      await db.telegramMailing.update({
        where: { id: mailing.id },
        data: {
          status: "failed",
          lastError: error instanceof Error ? error.message.slice(0, 500) : String(error),
        },
      });
    }
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

const buttonSchema = t.Object({
  text: t.String({ minLength: 1, maxLength: 64 }),
  url: t.Optional(t.Nullable(t.String({ maxLength: 512 }))),
});

export const adminMailingRoutes = new Elysia({ prefix: "/admin/mailings" })
  .use(adminMiddleware)

  .post(
    "/upload-image",
    async ({ request, set }) => {
      try {
        let formData: FormData;
        try {
          formData = await request.formData();
        } catch {
          set.status = 400;
          return { message: "Expected multipart/form-data" };
        }
        const file = formData.get("file") as File | null;
        if (!file || typeof file === "string") {
          set.status = 400;
          return { message: "file field is required" };
        }
        const mime = file.type ?? "";
        if (!mime.startsWith("image/")) {
          set.status = 400;
          return { message: "File must be an image" };
        }
        const rawExt = (file.name ?? "file").split(".").pop()?.toLowerCase() ?? "jpg";
        const ext = ["jpg", "jpeg", "png", "gif", "webp"].includes(rawExt) ? rawExt : "jpg";
        const filename = `${crypto.randomUUID()}.${ext}`;
        const dir = `${config.APP_FILES_DIR}/mailings`;
        await mkdir(dir, { recursive: true });
        const buffer = await file.arrayBuffer();
        await Bun.write(`${dir}/${filename}`, buffer);
        const url = `${config.SITE_URL}/api/uploads/mailings/${filename}`;
        return { url };
      } catch (err) {
        console.error("[MailingUpload] error:", err);
        set.status = 500;
        return { message: "Upload failed" };
      }
    },
  )

  // ─── List mailings ────────────────────────────────────────────────────────
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const page = Math.max(1, parseInt(query.page ?? "1", 10));
        const pageSize = Math.min(50, Math.max(1, parseInt(query.pageSize ?? "10", 10)));
        const skip = (page - 1) * pageSize;

        const [items, total] = await Promise.all([
          db.telegramMailing.findMany({
            select: mailingSelect,
            orderBy: { createdAt: "desc" },
            skip,
            take: pageSize,
          }),
          db.telegramMailing.count(),
        ]);

        return {
          items: items.map(normalizeMailing),
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      } catch (error) {
        console.error("[Mailing] List error", error);
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
      }),
    },
  )

  // ─── Get single mailing ───────────────────────────────────────────────────
  .get(
    "/:id",
    async ({ params, set }) => {
      try {
        const mailing = await db.telegramMailing.findFirst({
          where: { id: params.id },
          select: mailingSelect,
        });
        if (!mailing) {
          set.status = 404;
          return { message: "Not found" };
        }

        const result = normalizeMailing(mailing);

        // Enrich failed/blocked/delivered user details
        const allUserIds = [
          ...(result.deliveredUserIds as string[]),
          ...(result.failedUserIds as string[]),
          ...(result.blockedUserIds as string[]),
        ];

        if (allUserIds.length > 0) {
          const users = await db.user.findMany({
            where: { id: { in: allUserIds } },
            select: { id: true, login: true, telegramId: true },
          });
          const userMap = new Map(users.map((u: any) => [u.id, u]));

          return {
            ...result,
            deliveredUsers: (result.deliveredUserIds as string[]).map((id) => userMap.get(id)).filter(Boolean),
            failedUsers: (result.failedUserIds as string[]).map((id) => userMap.get(id)).filter(Boolean),
            blockedUsers: (result.blockedUserIds as string[]).map((id) => {
              const u = userMap.get(id);
              return u ? { id: u.id, login: u.login } : { id, login: "?" };
            }),
          };
        }

        return result;
      } catch (error) {
        console.error("[Mailing] Get error", error);
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // ─── Search recipients ────────────────────────────────────────────────────
  .get(
    "/recipients",
    async ({ query, set }) => {
      try {
        const search = query.search?.trim() ?? "";
        const users = await db.user.findMany({
          where: {
            telegramId: { not: null },
            ...(search ? { login: { contains: search, mode: "insensitive" as const } } : {}),
          },
          select: { id: true, login: true, telegramId: true, isBanned: true, joinedAt: true },
          orderBy: { joinedAt: "desc" },
          take: 20,
        });

        return {
          items: users.map((u: any) => ({
            id: u.id,
            login: u.login,
            telegramId: u.telegramId?.toString() ?? null,
            isBanned: u.isBanned,
            joinedAt: u.joinedAt instanceof Date ? u.joinedAt.toISOString() : u.joinedAt,
          })),
        };
      } catch (error) {
        console.error("[Mailing] Recipients error", error);
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    {
      query: t.Object({ search: t.Optional(t.String()) }),
    },
  )

  // ─── Recipient groups ─────────────────────────────────────────────────────
  .get(
    "/groups",
    async ({ set }) => {
      try {
        const groups = await db.mailingRecipientGroup.findMany({
          orderBy: { createdAt: "desc" },
        });
        return {
          items: groups.map((g: any) => ({
            ...g,
            conditions: Array.isArray(g.conditions) ? g.conditions : [],
            createdAt: g.createdAt instanceof Date ? g.createdAt.toISOString() : g.createdAt,
            updatedAt: g.updatedAt instanceof Date ? g.updatedAt.toISOString() : g.updatedAt,
          })),
        };
      } catch (error) {
        console.error("[Mailing] Groups list error", error);
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
  )

  .post(
    "/groups",
    async ({ body, adminUser, set }) => {
      try {
        // Estimate count
        const where = await resolveGroupConditions(body.conditions as RecipientGroupCondition[]);
        const estimatedCount = await db.user.count({ where });

        const group = await db.mailingRecipientGroup.create({
          data: {
            name: body.name.trim(),
            conditions: body.conditions,
            estimatedCount,
            createdById: adminUser.userId,
          },
        });

        return {
          ...group,
          conditions: Array.isArray(group.conditions) ? group.conditions : [],
          createdAt: group.createdAt instanceof Date ? group.createdAt.toISOString() : group.createdAt,
          updatedAt: group.updatedAt instanceof Date ? group.updatedAt.toISOString() : group.updatedAt,
          estimatedCount,
        };
      } catch (error) {
        console.error("[Mailing] Create group error", error);
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    {
      body: t.Object({
        name: t.String({ minLength: 1, maxLength: 120 }),
        conditions: t.Array(
          t.Object({
            field: t.String(),
            value: t.Union([t.String(), t.Boolean(), t.Number()]),
          }),
        ),
      }),
    },
  )

  .delete(
    "/groups/:id",
    async ({ params, set }) => {
      try {
        await db.mailingRecipientGroup.deleteMany({ where: { id: params.id } });
        return { ok: true };
      } catch (error) {
        console.error("[Mailing] Delete group error", error);
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    { params: t.Object({ id: t.String() }) },
  )

  // ─── Test send ────────────────────────────────────────────────────────────
  .post(
    "/test-send",
    async ({ body, set }) => {
      try {
        const chatId = config.TELEGRAM_MAILING_TEST_CHAT_ID || config.TELEGRAM_ADMIN_CHAT_ID;
        if (!chatId) {
          set.status = 400;
          return { message: "Test chat is not configured (TELEGRAM_MAILING_TEST_CHAT_ID)" };
        }

        const buttons = Array.isArray(body.buttons) && body.buttons.length > 0
          ? body.buttons as TelegramButton[]
          : null;

        await sendTelegramMessage({
          chatId,
          text: buildTelegramPostText({ title: body.title, message: body.message }),
          imageUrl: body.imageUrl ?? null,
          buttons,
        });

        return { ok: true };
      } catch (error) {
        console.error("[Mailing] Test send error", error);
        set.status = 500;
        return {
          message: error instanceof Error ? error.message : "Failed to send Telegram test message",
        };
      }
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 120 }),
        message: t.String({ minLength: 1, maxLength: 4096 }),
        imageUrl: t.Optional(t.Nullable(t.String({ maxLength: 1024 }))),
        buttons: t.Optional(t.Array(buttonSchema)),
      }),
    },
  )

  // ─── Create mailing ───────────────────────────────────────────────────────
  .post(
    "/",
    async ({ body, adminUser, set }) => {
      try {
        if (body.targetType === "selected" && (!body.selectedUserIds || body.selectedUserIds.length === 0)) {
          set.status = 400;
          return { message: "Select at least one recipient" };
        }

        if (body.targetType === "group" && !body.recipientGroupId) {
          set.status = 400;
          return { message: "Select a recipient group" };
        }

        const scheduledAt = new Date(body.scheduledAt);
        if (Number.isNaN(scheduledAt.getTime())) {
          set.status = 400;
          return { message: "Invalid scheduled time" };
        }

        const recipientsWhere = await getRecipientsWhere(
          body.targetType as TargetType,
          body.selectedUserIds ?? [],
          body.recipientGroupId ?? null,
        );
        const targetCount = await db.user.count({ where: recipientsWhere });

        const mailing = await db.telegramMailing.create({
          data: {
            title: body.title.trim(),
            message: body.message.trim(),
            imageUrl: body.imageUrl?.trim() || null,
            buttons: body.buttons ?? [],
            targetType: body.targetType,
            recipientGroupId: body.recipientGroupId ?? null,
            selectedUserIds: body.targetType === "selected" ? (body.selectedUserIds ?? []) : [],
            scheduledAt,
            targetCount,
            createdById: adminUser.userId,
          },
          select: mailingSelect,
        });

        return normalizeMailing(mailing);
      } catch (error) {
        console.error("[Mailing] Create error", error);
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 120 }),
        message: t.String({ minLength: 1, maxLength: 4096 }),
        imageUrl: t.Optional(t.Nullable(t.String({ maxLength: 1024 }))),
        buttons: t.Optional(t.Array(buttonSchema)),
        targetType: t.Union([t.Literal("all"), t.Literal("selected"), t.Literal("group")]),
        selectedUserIds: t.Optional(t.Array(t.String())),
        recipientGroupId: t.Optional(t.Nullable(t.String())),
        scheduledAt: t.String(),
      }),
    },
  )

  // ─── Delete mailing ───────────────────────────────────────────────────────
  .delete(
    "/:id",
    async ({ params, set }) => {
      try {
        const mailing = await db.telegramMailing.findFirst({ where: { id: params.id } });
        if (!mailing) {
          set.status = 404;
          return { message: "Not found" };
        }
        if (mailing.status === "processing") {
          set.status = 409;
          return { message: "Cannot delete a mailing that is currently processing" };
        }
        await db.telegramMailing.deleteMany({ where: { id: params.id } });
        return { ok: true };
      } catch (error) {
        console.error("[Mailing] Delete error", error);
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    { params: t.Object({ id: t.String() }) },
  );
