"use client";

import { useCallback, useState } from "react";
import { apiClient } from "@/api/client";
import type { AdminBlockedDomain } from "@/api/types";

export function useAdminBlockedDomains() {
  const [domains, setDomains] = useState<AdminBlockedDomain[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchDomains = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<{ items: AdminBlockedDomain[] }>(
        "/admin/blocked-domains",
      );
      setDomains(response.items);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const createDomain = useCallback(
    async (payload: {
      domain: string;
      reason?: string | null;
      redirectUrl?: string | null;
    }) => {
      setIsSubmitting(true);
      try {
        const created = await apiClient.post<AdminBlockedDomain>(
          "/admin/blocked-domains",
          payload,
        );
        setDomains((prev) => [created, ...prev]);
        return created;
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  const updateDomain = useCallback(
    async (
      id: string,
      payload: {
        reason?: string | null;
        redirectUrl?: string | null;
        isActive?: boolean;
      },
    ) => {
      const updated = await apiClient.patch<AdminBlockedDomain>(
        `/admin/blocked-domains/${id}`,
        payload,
      );
      setDomains((prev) => prev.map((d) => (d.id === id ? updated : d)));
      return updated;
    },
    [],
  );

  const deleteDomain = useCallback(async (id: string) => {
    await apiClient.delete(`/admin/blocked-domains/${id}`);
    setDomains((prev) => prev.filter((d) => d.id !== id));
  }, []);

  return {
    domains,
    isLoading,
    isSubmitting,
    fetchDomains,
    createDomain,
    updateDomain,
    deleteDomain,
  };
}
