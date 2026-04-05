"use client";

import { useCallback, useState } from "react";
import { apiClient } from "@/api/client";
import type {
  AdminCreateMailingRequest,
  AdminMailingItem,
  AdminMailingRecipient,
  AdminMailingRecipientGroup,
  MailingGroupCondition,
  PaginatedResponse,
} from "@/api/types";

export function useAdminMailings() {
  const [mailings, setMailings] = useState<AdminMailingItem[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [groups, setGroups] = useState<AdminMailingRecipientGroup[]>([]);

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

  const fetchMailing = useCallback(async (id: string) => {
    return apiClient.get<AdminMailingItem>(`/admin/mailings/${id}`);
  }, []);

  const searchRecipients = useCallback(async (search: string) => {
    const response = await apiClient.get<{ items: AdminMailingRecipient[] }>(
      "/admin/mailings/recipients",
      search ? { search } : undefined,
    );
    return response.items;
  }, []);

  const fetchGroups = useCallback(async () => {
    const response = await apiClient.get<{ items: AdminMailingRecipientGroup[] }>(
      "/admin/mailings/groups",
    );
    setGroups(response.items);
    return response.items;
  }, []);

  const createGroup = useCallback(
    async (name: string, conditions: MailingGroupCondition[]) => {
      const created = await apiClient.post<AdminMailingRecipientGroup>(
        "/admin/mailings/groups",
        { name, conditions },
      );
      setGroups((prev) => [created, ...prev]);
      return created;
    },
    [],
  );

  const deleteGroup = useCallback(async (id: string) => {
    await apiClient.delete(`/admin/mailings/groups/${id}`);
    setGroups((prev) => prev.filter((g) => g.id !== id));
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

  const deleteMailing = useCallback(async (id: string) => {
    await apiClient.delete(`/admin/mailings/${id}`);
    setMailings((prev) => prev.filter((m) => m.id !== id));
    setTotal((prev) => Math.max(0, prev - 1));
  }, []);

  const sendTest = useCallback(
    async (payload: {
      title: string;
      message: string;
      imageUrl?: string | null;
      buttons?: { text: string; url?: string | null }[];
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

  const uploadImage = useCallback(async (file: File): Promise<string> => {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch("/api/admin/mailings/upload-image", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${typeof window !== "undefined" ? localStorage.getItem("admin_token") ?? "" : ""}`,
      },
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error((err as any).message ?? "Upload failed");
    }
    const data = await response.json();
    return (data as any).url as string;
  }, []);

  return {
    mailings,
    total,
    isLoading,
    isSubmitting,
    groups,
    fetchMailings,
    fetchMailing,
    searchRecipients,
    fetchGroups,
    createGroup,
    deleteGroup,
    createMailing,
    deleteMailing,
    sendTest,
    uploadImage,
  };
}
