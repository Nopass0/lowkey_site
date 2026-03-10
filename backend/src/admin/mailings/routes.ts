import Elysia, { t } from "elysia";
import { adminMiddleware } from "../../auth/middleware";
import { db } from "../../db";
import { config } from "../../config";
import { buildTelegramPostText, sendTelegramMessage } from "../../telegram";

const mailingSelect = {
  id: true,
  title: true,
  message: true,
  buttonText: true,
  buttonUrl: true,
  targetType: true,
  selectedUserIds: true,
  status: true,
  scheduledAt: true,
  processingAt: true,
  sentAt: true,
  targetCount: true,
  sentCount: true,
  failedCount: true,
  lastError: true,
  createdAt: true,
  updatedAt: true,
  createdBy: {
    select: {
      id: true,
      login: true,
    },
  },
} as const;

function normalizeMailing(mailing: any) {
  return {
    ...mailing,
    scheduledAt: mailing.scheduledAt.toISOString(),
    processingAt: mailing.processingAt?.toISOString() ?? null,
    sentAt: mailing.sentAt?.toISOString() ?? null,
    createdAt: mailing.createdAt.toISOString(),
    updatedAt: mailing.updatedAt.toISOString(),
  };
}

function getRecipientsWhere(targetType: "all" | "selected", selectedUserIds: string[]) {
  if (targetType === "selected") {
    return {
      id: { in: selectedUserIds },
      telegramId: { not: null },
      isBanned: false,
    };
  }

  return {
    telegramId: { not: null },
    isBanned: false,
  };
}

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
      where: {
        id: mailing.id,
        status: "scheduled",
      },
      data: {
        status: "processing",
        processingAt: new Date(),
        lastError: null,
      },
    });

    if (claimed.count === 0) {
      continue;
    }

    try {
      const recipients = await db.user.findMany({
        where: getRecipientsWhere(
          mailing.targetType as "all" | "selected",
          mailing.selectedUserIds,
        ),
        select: {
          id: true,
          login: true,
          telegramId: true,
        },
      });

      const text = buildTelegramPostText({
        title: mailing.title,
        message: mailing.message,
      });

      let sentCount = 0;
      let failedCount = 0;
      let lastError: string | null = null;

      for (const recipient of recipients) {
        if (!recipient.telegramId) {
          continue;
        }

        try {
          await sendTelegramMessage({
            chatId: recipient.telegramId.toString(),
            text,
            buttonText: mailing.buttonText,
            buttonUrl: mailing.buttonUrl,
          });
          sentCount += 1;
        } catch (error) {
          failedCount += 1;
          lastError =
            error instanceof Error ? error.message.slice(0, 500) : String(error);
          console.error("[Mailing] Failed recipient", {
            mailingId: mailing.id,
            userId: recipient.id,
            login: recipient.login,
            error,
          });
        }
      }

      await db.telegramMailing.update({
        where: { id: mailing.id },
        data: {
          status: "sent",
          targetCount: recipients.length,
          sentCount,
          failedCount,
          sentAt: new Date(),
          lastError,
        },
      });
    } catch (error) {
      console.error("[Mailing] Fatal processing error", {
        mailingId: mailing.id,
        error,
      });
      await db.telegramMailing.update({
        where: { id: mailing.id },
        data: {
          status: "failed",
          lastError:
            error instanceof Error ? error.message.slice(0, 500) : String(error),
        },
      });
    }
  }
}

export const adminMailingRoutes = new Elysia({ prefix: "/admin/mailings" })
  .use(adminMiddleware)
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const page = Math.max(1, parseInt(query.page ?? "1", 10));
        const pageSize = Math.min(
          50,
          Math.max(1, parseInt(query.pageSize ?? "10", 10)),
        );
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
  .get(
    "/recipients",
    async ({ query, set }) => {
      try {
        const search = query.search?.trim() ?? "";
        const users = await db.user.findMany({
          where: {
            telegramId: { not: null },
            ...(search
              ? { login: { contains: search, mode: "insensitive" as const } }
              : {}),
          },
          select: {
            id: true,
            login: true,
            telegramId: true,
            isBanned: true,
            joinedAt: true,
          },
          orderBy: { joinedAt: "desc" },
          take: 20,
        });

        return {
          items: users.map((user) => ({
            id: user.id,
            login: user.login,
            telegramId: user.telegramId?.toString() ?? null,
            isBanned: user.isBanned,
            joinedAt: user.joinedAt.toISOString(),
          })),
        };
      } catch (error) {
        console.error("[Mailing] Recipients error", error);
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    {
      query: t.Object({
        search: t.Optional(t.String()),
      }),
    },
  )
  .post(
    "/test-send",
    async ({ body, set }) => {
      try {
        if (!config.TELEGRAM_MAILING_TEST_CHAT_ID) {
          set.status = 400;
          return { message: "Test chat is not configured" };
        }

        await sendTelegramMessage({
          chatId: config.TELEGRAM_MAILING_TEST_CHAT_ID,
          text: buildTelegramPostText({
            title: body.title,
            message: body.message,
          }),
          buttonText: body.buttonText,
          buttonUrl: body.buttonUrl,
        });

        return { ok: true };
      } catch (error) {
        console.error("[Mailing] Test send error", error);
        set.status = 500;
        return {
          message:
            error instanceof Error
              ? error.message
              : "Failed to send Telegram test message",
        };
      }
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 120 }),
        message: t.String({ minLength: 1, maxLength: 4096 }),
        buttonText: t.Optional(t.String({ maxLength: 64 })),
        buttonUrl: t.Optional(t.String({ maxLength: 512 })),
      }),
    },
  )
  .post(
    "/",
    async ({ body, adminUser, set }) => {
      try {
        if (body.targetType === "selected" && body.selectedUserIds.length === 0) {
          set.status = 400;
          return { message: "Select at least one recipient" };
        }

        if (!!body.buttonText !== !!body.buttonUrl) {
          set.status = 400;
          return { message: "Button text and URL must be filled together" };
        }

        const scheduledAt = new Date(body.scheduledAt);
        if (Number.isNaN(scheduledAt.getTime())) {
          set.status = 400;
          return { message: "Invalid scheduled time" };
        }

        const targetCount = await db.user.count({
          where: getRecipientsWhere(body.targetType, body.selectedUserIds),
        });

        const mailing = await db.telegramMailing.create({
          data: {
            title: body.title.trim(),
            message: body.message.trim(),
            buttonText: body.buttonText?.trim() || null,
            buttonUrl: body.buttonUrl?.trim() || null,
            targetType: body.targetType,
            selectedUserIds:
              body.targetType === "selected" ? body.selectedUserIds : [],
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
        buttonText: t.Optional(t.String({ maxLength: 64 })),
        buttonUrl: t.Optional(t.String({ maxLength: 512 })),
        targetType: t.Union([t.Literal("all"), t.Literal("selected")]),
        selectedUserIds: t.Array(t.String()),
        scheduledAt: t.String(),
      }),
    },
  );
