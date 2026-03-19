/**
 * @fileoverview Admin user management routes.
 * All routes require admin authentication.
 */

import Elysia, { t } from "elysia";
import { db } from "../../db";
import { adminMiddleware } from "../../auth/middleware";

function parseOptionalBooleanFilter(value?: string) {
  if (value === "true") return true;
  if (value === "false") return false;
  return undefined;
}

function serializeAdminUser(user: {
  id: string;
  login: string;
  balance: number;
  referralBalance: number;
  isBanned: boolean;
  hideAiMenu: boolean;
  joinedAt: Date;
  subscription: {
    planId: string;
    activeUntil: Date;
  } | null;
  _count: {
    devices: number;
  };
}) {
  return {
    id: user.id,
    login: user.login,
    balance: user.balance,
    referralBalance: user.referralBalance,
    isBanned: user.isBanned,
    hideAiMenu: user.hideAiMenu,
    plan: user.subscription?.planId ?? null,
    activeUntil: user.subscription?.activeUntil.toISOString() ?? null,
    joinedAt: user.joinedAt.toISOString(),
    deviceCount: user._count.devices,
  };
}

/**
 * Admin users routes group.
 * Provides user listing, ban toggle, and subscription management.
 */
export const adminUserRoutes = new Elysia({ prefix: "/admin/users" })
  .use(adminMiddleware)
  .get(
    "/",
    async ({ query, set }) => {
      try {
        const page = parseInt(query.page ?? "1");
        const pageSize = parseInt(query.pageSize ?? "8");
        const skip = (page - 1) * pageSize;
        const search = query.search?.trim() ?? "";
        const isBanned = parseOptionalBooleanFilter(query.isBanned);
        const hasSubscription = parseOptionalBooleanFilter(query.hasSubscription);
        const hideAiMenu = parseOptionalBooleanFilter(query.hideAiMenu);
        const plan = query.plan?.trim() || undefined;

        const where = {
          ...(search
            ? {
                OR: [
                  { login: { contains: search, mode: "insensitive" as const } },
                  { id: { equals: search } },
                ],
              }
            : {}),
          ...(typeof isBanned === "boolean" ? { isBanned } : {}),
          ...(typeof hideAiMenu === "boolean" ? { hideAiMenu } : {}),
          ...(typeof hasSubscription === "boolean"
            ? {
                subscription: hasSubscription
                  ? { isNot: null }
                  : { is: null },
              }
            : {}),
          ...(plan ? { subscription: { is: { planId: plan } } } : {}),
        };

        const [users, total] = await Promise.all([
          db.user.findMany({
            where,
            include: {
              subscription: true,
              _count: { select: { devices: true } },
            },
            orderBy: { joinedAt: "desc" },
            skip,
            take: pageSize,
          }),
          db.user.count({ where }),
        ]);

        return {
          items: users.map(serializeAdminUser),
          total,
          page,
          pageSize,
          totalPages: Math.ceil(total / pageSize),
        };
      } catch (err) {
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    {
      query: t.Object({
        page: t.Optional(t.String()),
        pageSize: t.Optional(t.String()),
        search: t.Optional(t.String()),
        isBanned: t.Optional(t.String()),
        hasSubscription: t.Optional(t.String()),
        hideAiMenu: t.Optional(t.String()),
        plan: t.Optional(t.String()),
      }),
    },
  )
  .patch(
    "/:id/ban",
    async ({ params, body, set }) => {
      try {
        const updated = await db.user.update({
          where: { id: params.id },
          data: { isBanned: body.isBanned },
          include: {
            subscription: true,
            _count: { select: { devices: true } },
          },
        });

        return serializeAdminUser(updated);
      } catch (err) {
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ isBanned: t.Boolean() }),
    },
  )
  .patch(
    "/:id/preferences",
    async ({ params, body, set }) => {
      try {
        const updated = await db.user.update({
          where: { id: params.id },
          data: { hideAiMenu: body.hideAiMenu },
          include: {
            subscription: true,
            _count: { select: { devices: true } },
          },
        });

        return serializeAdminUser(updated);
      } catch (err) {
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({ hideAiMenu: t.Boolean() }),
    },
  )
  .patch(
    "/:id/subscription",
    async ({ params, body, set }) => {
      try {
        if (body.plan === null) {
          await db.subscription.deleteMany({
            where: { userId: params.id },
          });
        } else {
          const plan = await db.subscriptionPlan.findUnique({
            where: { slug: body.plan },
            select: { slug: true, name: true, isActive: true },
          });

          if (!plan || !plan.isActive) {
            set.status = 400;
            return { message: "Plan not found or inactive" };
          }

          const activeUntil = body.activeUntil
            ? new Date(body.activeUntil)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

          if (Number.isNaN(activeUntil.getTime())) {
            set.status = 400;
            return { message: "Invalid activeUntil datetime" };
          }

          await db.subscription.upsert({
            where: { userId: params.id },
            update: {
              planId: plan.slug,
              planName: plan.name,
              activeUntil,
            },
            create: {
              userId: params.id,
              planId: plan.slug,
              planName: plan.name,
              activeUntil,
            },
          });
        }

        const updated = await db.user.findUnique({
          where: { id: params.id },
          include: {
            subscription: true,
            _count: { select: { devices: true } },
          },
        });

        if (!updated) {
          set.status = 404;
          return { message: "User not found" };
        }

        return serializeAdminUser(updated);
      } catch (err) {
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        plan: t.Union([t.String(), t.Null()]),
        activeUntil: t.Union([t.String(), t.Null()]),
      }),
    },
  )
  .patch(
    "/:id/balance",
    async ({ params, body, set }) => {
      try {
        const updated = await db.user.update({
          where: { id: params.id },
          data: {
            balance: body.balance,
            referralBalance: body.referralBalance,
          },
          include: {
            subscription: true,
            _count: { select: { devices: true } },
          },
        });

        return serializeAdminUser(updated);
      } catch (err) {
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Object({
        balance: t.Number(),
        referralBalance: t.Number(),
      }),
    },
  )
  .get(
    "/:id/stats",
    async ({ params, query, set }) => {
      try {
        const userId = params.id;
        const startDate = query.startDate
          ? new Date(query.startDate)
          : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = query.endDate ? new Date(query.endDate) : new Date();

        const user = await db.user.findUnique({
          where: { id: userId },
          include: {
            subscription: true,
            _count: { select: { referrals: true, devices: true } },
          },
        });

        if (!user) {
          set.status = 404;
          return { message: "User not found" };
        }

        const referrals = await db.user.findMany({
          where: {
            referredById: userId,
            joinedAt: { gte: startDate, lte: endDate },
          },
          select: { joinedAt: true },
        });

        const transactions = await db.transaction.findMany({
          where: {
            userId,
            createdAt: { gte: startDate, lte: endDate },
          },
          orderBy: { createdAt: "desc" },
        });

        const dailyStats: Record<
          string,
          { referrals: number; referralEarnings: number; topups: number }
        > = {};

        const curr = new Date(startDate);
        while (curr <= endDate) {
          const day = curr.toISOString().split("T")[0];
          dailyStats[day] = { referrals: 0, referralEarnings: 0, topups: 0 };
          curr.setDate(curr.getDate() + 1);
        }

        referrals.forEach((r) => {
          const day = r.joinedAt.toISOString().split("T")[0];
          if (dailyStats[day]) dailyStats[day].referrals++;
        });

        transactions.forEach((transaction) => {
          const day = transaction.createdAt.toISOString().split("T")[0];
          if (dailyStats[day]) {
            if (transaction.type === "referral_earning") {
              dailyStats[day].referralEarnings += transaction.amount;
            }
            if (transaction.type === "topup") {
              dailyStats[day].topups += transaction.amount;
            }
          }
        });

        return {
          user: {
            id: user.id,
            login: user.login,
            balance: user.balance,
            referralBalance: user.referralBalance,
            isBanned: user.isBanned,
            hideAiMenu: user.hideAiMenu,
            plan: user.subscription?.planId ?? null,
            activeUntil: user.subscription?.activeUntil.toISOString() ?? null,
            joinedAt: user.joinedAt.toISOString(),
            referralCount: user._count.referrals,
            deviceCount: user._count.devices,
          },
          dailyStats: Object.entries(dailyStats)
            .map(([date, stats]) => ({
              date,
              ...stats,
            }))
            .sort((a, b) => a.date.localeCompare(b.date)),
          transactions: transactions.map((transaction) => ({
            id: transaction.id,
            type: transaction.type,
            amount: transaction.amount,
            title: transaction.title,
            createdAt: transaction.createdAt.toISOString(),
          })),
        };
      } catch (err) {
        console.error("[AdminUserStats] Error:", err);
        set.status = 500;
        return { message: "Internal server error" };
      }
    },
    {
      params: t.Object({ id: t.String() }),
      query: t.Object({
        startDate: t.Optional(t.String()),
        endDate: t.Optional(t.String()),
      }),
    },
  );
