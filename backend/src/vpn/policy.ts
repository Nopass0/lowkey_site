import { db } from "../db";

const DEFAULT_MAX_DEVICES = 1;
const DEFAULT_MAX_CONCURRENT_CONNECTIONS = 1;
const ACTIVE_SESSION_STALE_MS = 5 * 60 * 1000;

type UserOverrideRow = {
  vpnMaxDevices?: number | null;
  vpnMaxConcurrentConnections?: number | null;
  vpnSpeedLimitUpMbps?: number | null;
  vpnSpeedLimitDownMbps?: number | null;
} | null;

export interface ResolvedVpnPolicy {
  planId: string | null;
  planDefaults: {
    maxDevices: number;
    maxConcurrentConnections: number;
    speedLimitUpMbps: number | null;
    speedLimitDownMbps: number | null;
  };
  userOverrides: {
    maxDevices: number | null;
    maxConcurrentConnections: number | null;
    speedLimitUpMbps: number | null;
    speedLimitDownMbps: number | null;
  };
  effective: {
    maxDevices: number;
    maxConcurrentConnections: number;
    speedLimitUpMbps: number | null;
    speedLimitDownMbps: number | null;
  };
}

function toOptionalNumber(value: unknown): number | null {
  if (value == null) {
    return null;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export async function resolveVpnPolicyForUser(
  userId: string,
  input?: {
    planId?: string | null;
    userOverrides?: UserOverrideRow;
  },
): Promise<ResolvedVpnPolicy> {
  const userOverrides =
    input?.userOverrides ??
    (await db.user.findUnique({
      where: { id: userId },
      select: {
        vpnMaxDevices: true,
        vpnMaxConcurrentConnections: true,
        vpnSpeedLimitUpMbps: true,
        vpnSpeedLimitDownMbps: true,
      },
    }));

  const planId =
    input?.planId ??
    (await db.subscription.findUnique({
      where: { userId },
      select: { planId: true },
    }))?.planId ??
    null;

  const plan = planId
    ? await db.subscriptionPlan.findUnique({
        where: { slug: planId },
        select: {
          maxDevices: true,
          maxConcurrentConnections: true,
          speedLimitUpMbps: true,
          speedLimitDownMbps: true,
        },
      })
    : null;

  const planDefaults = {
    maxDevices: Number(plan?.maxDevices ?? DEFAULT_MAX_DEVICES),
    maxConcurrentConnections: Number(
      plan?.maxConcurrentConnections ?? DEFAULT_MAX_CONCURRENT_CONNECTIONS,
    ),
    speedLimitUpMbps: toOptionalNumber(plan?.speedLimitUpMbps),
    speedLimitDownMbps: toOptionalNumber(plan?.speedLimitDownMbps),
  };

  const overrides = {
    maxDevices: toOptionalNumber(userOverrides?.vpnMaxDevices),
    maxConcurrentConnections: toOptionalNumber(
      userOverrides?.vpnMaxConcurrentConnections,
    ),
    speedLimitUpMbps: toOptionalNumber(userOverrides?.vpnSpeedLimitUpMbps),
    speedLimitDownMbps: toOptionalNumber(userOverrides?.vpnSpeedLimitDownMbps),
  };

  return {
    planId,
    planDefaults,
    userOverrides: overrides,
    effective: {
      maxDevices: overrides.maxDevices ?? planDefaults.maxDevices,
      maxConcurrentConnections:
        overrides.maxConcurrentConnections ??
        planDefaults.maxConcurrentConnections,
      speedLimitUpMbps:
        overrides.speedLimitUpMbps ?? planDefaults.speedLimitUpMbps,
      speedLimitDownMbps:
        overrides.speedLimitDownMbps ?? planDefaults.speedLimitDownMbps,
    },
  };
}

export async function getActiveVpnSessions(
  userId: string,
  staleMs = ACTIVE_SESSION_STALE_MS,
) {
  const cutoff = new Date(Date.now() - staleMs);
  return db.vpnSession.findMany({
    where: {
      userId,
      status: "active",
      lastSeenAt: { gte: cutoff },
    },
    orderBy: { lastSeenAt: "desc" },
  });
}

export async function getUserActiveConnectionCount(
  userId: string,
  staleMs = ACTIVE_SESSION_STALE_MS,
) {
  const sessions = await getActiveVpnSessions(userId, staleMs);
  return sessions.length;
}
