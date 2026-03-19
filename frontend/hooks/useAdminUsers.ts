/**
 * @fileoverview Admin hook for managing users (list, ban, preferences, subscription edit).
 */

"use client";

import { useState, useCallback } from "react";
import { apiClient } from "@/api/client";
import { API_CONFIG } from "@/api/config";
import type {
  AdminUser,
  AdminUserStatsResponse,
  AdminUpdateSubscriptionRequest,
  AdminUserFilters,
  PaginatedResponse,
} from "@/api/types";

const MOCK_USERS: AdminUser[] = Array.from({ length: 25 }, (_, i) => {
  const names = [
    "nopass",
    "ivan123",
    "alex_vpn",
    "mashenka",
    "testuser",
    "vpnpro",
    "user_42",
    "gamer99",
    "crypto_fan",
    "darkwave",
    "speedking",
    "netrunner",
    "shadowx",
    "pulsar",
    "byte_99",
    "quantumq",
    "neonblue",
    "vortex1",
    "pixelcat",
    "irondog",
    "stormfly",
    "coldfire",
    "lunar99",
    "duskfall",
    "apex_v",
  ];
  const plans = [null, "starter", "pro", "advanced"];
  const plan = plans[i % 4];

  return {
    id: String(i + 1),
    login: names[i],
    balance: i * 50 + 100,
    referralBalance: i * 10,
    isBanned: i % 7 === 3,
    hideAiMenu: i % 5 === 0,
    plan,
    activeUntil: plan
      ? new Date(Date.now() + (i + 1) * 12 * 86400000).toISOString()
      : null,
    joinedAt: new Date(Date.now() - i * 15 * 86400000).toISOString(),
    deviceCount: (i % 4) + 1,
  };
});

function applyMockFilters(users: AdminUser[], filters: AdminUserFilters) {
  return users.filter((user) => {
    if (filters.search) {
      const search = filters.search.toLowerCase();
      if (
        !user.login.toLowerCase().includes(search) &&
        user.id.toLowerCase() !== search
      ) {
        return false;
      }
    }

    if (
      typeof filters.isBanned === "boolean" &&
      user.isBanned !== filters.isBanned
    ) {
      return false;
    }

    if (
      typeof filters.hasSubscription === "boolean" &&
      (!!user.plan !== filters.hasSubscription)
    ) {
      return false;
    }

    if (
      typeof filters.hideAiMenu === "boolean" &&
      user.hideAiMenu !== filters.hideAiMenu
    ) {
      return false;
    }

    if (filters.plan && user.plan !== filters.plan) {
      return false;
    }

    return true;
  });
}

export function useAdminUsers() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);

  const fetchUsers = useCallback(
    async (
      page = 1,
      pageSize = 8,
      filters: AdminUserFilters = {},
    ) => {
      setIsLoading(true);

      if (API_CONFIG.debug) {
        await new Promise((resolve) => setTimeout(resolve, 400));
        const filtered = applyMockFilters(MOCK_USERS, filters);
        const start = (page - 1) * pageSize;
        setUsers(filtered.slice(start, start + pageSize));
        setTotal(filtered.length);
        setIsLoading(false);
        return;
      }

      try {
        const query: Record<string, string | number> = { page, pageSize };

        if (filters.search) query.search = filters.search;
        if (typeof filters.isBanned === "boolean") {
          query.isBanned = String(filters.isBanned);
        }
        if (typeof filters.hasSubscription === "boolean") {
          query.hasSubscription = String(filters.hasSubscription);
        }
        if (typeof filters.hideAiMenu === "boolean") {
          query.hideAiMenu = String(filters.hideAiMenu);
        }
        if (filters.plan) query.plan = filters.plan;

        const data = await apiClient.get<PaginatedResponse<AdminUser>>(
          "/admin/users",
          query,
        );

        setUsers(data.items);
        setTotal(data.total);
      } catch {
        setUsers([]);
        setTotal(0);
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  const toggleBan = useCallback(
    async (id: string) => {
      const currentUser = users.find((user) => user.id === id);
      if (!currentUser) return;

      setUsers((prev) =>
        prev.map((user) =>
          user.id === id ? { ...user, isBanned: !user.isBanned } : user,
        ),
      );

      if (!API_CONFIG.debug) {
        try {
          await apiClient.patch(`/admin/users/${id}/ban`, {
            isBanned: !currentUser.isBanned,
          });
        } catch {
          setUsers((prev) =>
            prev.map((user) =>
              user.id === id
                ? { ...user, isBanned: currentUser.isBanned }
                : user,
            ),
          );
        }
      }
    },
    [users],
  );

  const updateSubscription = useCallback(
    async (id: string, plan: string | null, activeUntil: string | null) => {
      setUsers((prev) =>
        prev.map((user) =>
          user.id === id ? { ...user, plan, activeUntil } : user,
        ),
      );

      if (!API_CONFIG.debug) {
        await apiClient.patch(`/admin/users/${id}/subscription`, {
          plan,
          activeUntil,
        } satisfies AdminUpdateSubscriptionRequest);
      }
    },
    [],
  );

  const updateBalance = useCallback(
    async (id: string, balance: number, referralBalance: number) => {
      setUsers((prev) =>
        prev.map((user) =>
          user.id === id ? { ...user, balance, referralBalance } : user,
        ),
      );

      if (!API_CONFIG.debug) {
        await apiClient.patch(`/admin/users/${id}/balance`, {
          balance,
          referralBalance,
        });
      }
    },
    [],
  );

  const updatePreferences = useCallback(
    async (id: string, hideAiMenu: boolean) => {
      setUsers((prev) =>
        prev.map((user) =>
          user.id === id ? { ...user, hideAiMenu } : user,
        ),
      );

      if (!API_CONFIG.debug) {
        await apiClient.patch(`/admin/users/${id}/preferences`, {
          hideAiMenu,
        });
      }
    },
    [],
  );

  const fetchUserStats = useCallback(
    async (id: string, startDate?: string, endDate?: string) => {
      setIsLoading(true);
      try {
        const query: Record<string, string> = {};
        if (startDate) query.startDate = startDate;
        if (endDate) query.endDate = endDate;

        return await apiClient.get<AdminUserStatsResponse>(
          `/admin/users/${id}/stats`,
          query,
        );
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    users,
    total,
    isLoading,
    fetchUsers,
    toggleBan,
    updateSubscription,
    updateBalance,
    updatePreferences,
    fetchUserStats,
  };
}
