"use client";

import { useCallback, useState } from "react";
import { apiClient } from "@/api/client";
import type {
  AdminCreateMailingRequest,
  AdminMailingItem,
  AdminMailingRecipient,
  PaginatedResponse,
} from "@/api/types";

export function useAdminMailings() {
  const [mailings, setMailings] = useState<AdminMailingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchMailings = useCallback(async (page = 1, pageSize = 10) => {
    setIsLoading(true);
    try {
      const response = await apiClient.get<PaginatedResponse<AdminMailingItem>>(
        "/admin/mailings",
        { page, pageSize },
      );
      setMailings(response.items);
      setTotal(response.total);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const searchRecipients = useCallback(async (search: string) => {
    const response = await apiClient.get<{ items: AdminMailingRecipient[] }>(
      "/admin/mailings/recipients",
      search ? { search } : undefined,
    );

    return response.items;
  }, []);

  const createMailing = useCallback(
    async (payload: AdminCreateMailingRequest) => {
      setIsSubmitting(true);
      try {
        const created = await apiClient.post<AdminMailingItem>(
          "/admin/mailings",
          payload,
        );
        setMailings((prev) => [created, ...prev]);
        setTotal((prev) => prev + 1);
        return created;
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  const sendTest = useCallback(
    async (payload: Pick<AdminCreateMailingRequest, "title" | "message"> & {
      buttonText?: string;
      buttonUrl?: string;
    }) => {
      setIsSubmitting(true);
      try {
        await apiClient.post("/admin/mailings/test-send", payload);
      } finally {
        setIsSubmitting(false);
      }
    },
    [],
  );

  return {
    mailings,
    total,
    isLoading,
    isSubmitting,
    fetchMailings,
    searchRecipients,
    createMailing,
    sendTest,
  };
}
