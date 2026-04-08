import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import { useAuthStore } from '@/store/auth-store'

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8090'

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor — attach auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// Response interceptor — handle 401
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout()
      if (typeof window !== 'undefined') {
        window.location.href = '/auth'
      }
    }
    return Promise.reject(error)
  }
)

// --- Auth ---
export const authApi = {
  requestCode: (telegram: string) =>
    apiClient.post('/api/auth/telegram/request', { telegram }),
  verifyCode: (telegram: string, code: string) =>
    apiClient.post<{ token: string; user: any }>('/api/auth/telegram/verify', { telegram, code }),
  me: () => apiClient.get<any>('/api/auth/me'),
  logout: () => apiClient.post('/api/auth/logout'),
}

// --- Mail ---
export const mailApi = {
  getAccounts: () => apiClient.get<any[]>('/api/mail/accounts'),
  getMessages: (accountId: string, folder: string, params?: { page?: number; limit?: number; search?: string }) =>
    apiClient.get<any[]>(`/api/mail/accounts/${accountId}/messages`, { params: { folder, ...params } }),
  getMessage: (accountId: string, messageId: string) =>
    apiClient.get<any>(`/api/mail/accounts/${accountId}/messages/${messageId}`),
  sendMessage: (accountId: string, data: { to: string[]; cc?: string[]; subject: string; body: string }) =>
    apiClient.post(`/api/mail/accounts/${accountId}/send`, data),
  markRead: (accountId: string, messageId: string) =>
    apiClient.patch(`/api/mail/accounts/${accountId}/messages/${messageId}/read`),
  toggleStar: (accountId: string, messageId: string) =>
    apiClient.patch(`/api/mail/accounts/${accountId}/messages/${messageId}/star`),
  moveToFolder: (accountId: string, messageId: string, folder: string) =>
    apiClient.patch(`/api/mail/accounts/${accountId}/messages/${messageId}/move`, { folder }),
  deleteMessage: (accountId: string, messageId: string) =>
    apiClient.delete(`/api/mail/accounts/${accountId}/messages/${messageId}`),
  addAccount: (data: { email: string; password: string; host: string; port: number; name?: string }) =>
    apiClient.post('/api/mail/accounts', data),
}

// --- Files ---
export const filesApi = {
  list: (folderId?: string | null) =>
    apiClient.get<any[]>('/api/files', { params: { folderId } }),
  upload: (formData: FormData, onProgress?: (pct: number) => void) =>
    apiClient.post<any>('/api/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      onUploadProgress: (e) => {
        if (onProgress && e.total) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      },
    }),
  createFolder: (name: string, parentId?: string | null) =>
    apiClient.post<any>('/api/files/folders', { name, parentId }),
  delete: (id: string) => apiClient.delete(`/api/files/${id}`),
  rename: (id: string, name: string) => apiClient.patch(`/api/files/${id}`, { name }),
  getDownloadUrl: (id: string) => `${API_URL}/api/files/${id}/download`,
}

// --- Notes ---
export const notesApi = {
  list: () => apiClient.get<any[]>('/api/notes'),
  get: (id: string) => apiClient.get<any>(`/api/notes/${id}`),
  create: (data: { title: string; content?: string; parentId?: string | null; type: 'note' | 'folder' }) =>
    apiClient.post<any>('/api/notes', data),
  update: (id: string, data: Partial<{ title: string; content: string }>) =>
    apiClient.patch<any>(`/api/notes/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/notes/${id}`),
}

// --- Tasks ---
export const tasksApi = {
  getBoards: () => apiClient.get<any[]>('/api/tasks/boards'),
  getTasks: (boardId: string) => apiClient.get<any[]>(`/api/tasks/boards/${boardId}/tasks`),
  createTask: (boardId: string, data: any) => apiClient.post(`/api/tasks/boards/${boardId}/tasks`, data),
  updateTask: (taskId: string, data: any) => apiClient.patch(`/api/tasks/${taskId}`, data),
  deleteTask: (taskId: string) => apiClient.delete(`/api/tasks/${taskId}`),
  moveTask: (taskId: string, columnId: string, order: number) =>
    apiClient.patch(`/api/tasks/${taskId}/move`, { columnId, order }),
}

// --- AI ---
export const aiApi = {
  chat: async (
    model: string,
    messages: { role: string; content: string }[],
    systemPrompt: string,
    onChunk: (chunk: string) => void
  ): Promise<void> => {
    const token = useAuthStore.getState().token
    const response = await fetch(`${API_URL}/api/ai/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ model, messages, systemPrompt, stream: true }),
    })

    if (!response.ok) {
      throw new Error(`AI API error: ${response.statusText}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      const chunk = decoder.decode(value)
      const lines = chunk.split('\n').filter(line => line.startsWith('data: '))
      for (const line of lines) {
        const data = line.slice(6).trim()
        if (data === '[DONE]') return
        try {
          const parsed = JSON.parse(data)
          const content = parsed.choices?.[0]?.delta?.content || parsed.content || ''
          if (content) onChunk(content)
        } catch {
          // ignore parse errors
        }
      }
    }
  },
  chatSimple: (model: string, messages: any[], systemPrompt: string) =>
    apiClient.post<{ content: string }>('/api/ai/chat', { model, messages, systemPrompt, stream: false }),
  suggestMindmapNodes: (topic: string, existingNodes: string[]) =>
    apiClient.post<{ suggestions: string[] }>('/api/ai/mindmap-suggest', { topic, existingNodes }),
}

// --- Mindmaps ---
export const mindmapApi = {
  list: () => apiClient.get<any[]>('/api/mindmaps'),
  get: (id: string) => apiClient.get<any>(`/api/mindmaps/${id}`),
  create: (title: string) => apiClient.post<any>('/api/mindmaps', { title }),
  update: (id: string, data: any) => apiClient.patch<any>(`/api/mindmaps/${id}`, data),
  delete: (id: string) => apiClient.delete(`/api/mindmaps/${id}`),
}
