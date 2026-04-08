'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { authApi, mailApi, filesApi, notesApi, tasksApi, aiApi, mindmapApi } from '@/lib/api'
import { useAuthStore } from '@/store/auth-store'

// Auth hooks
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: () => authApi.me().then(r => r.data),
    retry: false,
  })
}

// Mail hooks
export function useMailAccounts() {
  return useQuery({
    queryKey: ['mail', 'accounts'],
    queryFn: () => mailApi.getAccounts().then(r => r.data),
  })
}

export function useMailMessages(accountId?: string, folder?: string) {
  return useQuery({
    queryKey: ['mail', 'messages', accountId, folder],
    queryFn: () => mailApi.getMessages(accountId!, folder || 'inbox').then(r => r.data),
    enabled: !!accountId,
  })
}

// Files hooks
export function useFiles(folderId?: string | null) {
  return useQuery({
    queryKey: ['files', folderId],
    queryFn: () => filesApi.list(folderId).then(r => r.data),
  })
}

export function useUploadFile() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ formData, onProgress }: { formData: FormData; onProgress?: (pct: number) => void }) =>
      filesApi.upload(formData, onProgress).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['files'] })
    },
  })
}

// Notes hooks
export function useNotesList() {
  return useQuery({
    queryKey: ['notes'],
    queryFn: () => notesApi.list().then(r => r.data),
  })
}

export function useNote(id?: string) {
  return useQuery({
    queryKey: ['notes', id],
    queryFn: () => notesApi.get(id!).then(r => r.data),
    enabled: !!id,
  })
}

// Tasks hooks
export function useBoards() {
  return useQuery({
    queryKey: ['tasks', 'boards'],
    queryFn: () => tasksApi.getBoards().then(r => r.data),
  })
}

export function useTasks(boardId?: string) {
  return useQuery({
    queryKey: ['tasks', boardId],
    queryFn: () => tasksApi.getTasks(boardId!).then(r => r.data),
    enabled: !!boardId,
  })
}

// Mindmap hooks
export function useMindmaps() {
  return useQuery({
    queryKey: ['mindmaps'],
    queryFn: () => mindmapApi.list().then(r => r.data),
  })
}

export function useMindmap(id?: string) {
  return useQuery({
    queryKey: ['mindmaps', id],
    queryFn: () => mindmapApi.get(id!).then(r => r.data),
    enabled: !!id,
  })
}
