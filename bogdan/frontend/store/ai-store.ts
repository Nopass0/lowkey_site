import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from './utils'

export type MessageRole = 'user' | 'assistant' | 'system'

export interface ChatMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: string
  model?: string
  loading?: boolean
  error?: boolean
}

export interface ChatSession {
  id: string
  title: string
  messages: ChatMessage[]
  model: string
  createdAt: string
  updatedAt: string
}

export type AIModel = {
  id: string
  name: string
  description: string
  contextWindow: number
}

const AVAILABLE_MODELS: AIModel[] = [
  { id: 'bitnet-b1.58', name: 'BitNet b1.58', description: 'Fast local 1-bit LLM', contextWindow: 4096 },
  { id: 'gpt-4o', name: 'GPT-4o', description: 'OpenAI GPT-4o (API)', contextWindow: 128000 },
  { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', description: 'Anthropic (API)', contextWindow: 200000 },
  { id: 'llama-3.1-8b', name: 'Llama 3.1 8B', description: 'Meta (local)', contextWindow: 8192 },
]

interface AIState {
  sessions: ChatSession[]
  activeSessionId: string | null
  selectedModel: string
  availableModels: AIModel[]
  streaming: boolean
  systemPrompt: string
  createSession: (title?: string) => string
  deleteSession: (id: string) => void
  setActiveSession: (id: string) => void
  addMessage: (sessionId: string, message: Omit<ChatMessage, 'id' | 'timestamp'>) => string
  updateMessage: (sessionId: string, messageId: string, updates: Partial<ChatMessage>) => void
  clearSession: (sessionId: string) => void
  setSelectedModel: (model: string) => void
  setStreaming: (streaming: boolean) => void
  setSystemPrompt: (prompt: string) => void
}

export const useAIStore = create<AIState>()(
  persist(
    (set, get) => ({
      sessions: [],
      activeSessionId: null,
      selectedModel: 'bitnet-b1.58',
      availableModels: AVAILABLE_MODELS,
      streaming: false,
      systemPrompt: 'You are a helpful AI assistant for Bogdan\'s personal workspace. Be concise, accurate, and helpful.',
      createSession: (title = 'New Chat') => {
        const id = 'session-' + nanoid()
        const session: ChatSession = {
          id, title,
          messages: [],
          model: get().selectedModel,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set(state => ({ sessions: [...state.sessions, session], activeSessionId: id }))
        return id
      },
      deleteSession: (id) => set(state => ({
        sessions: state.sessions.filter(s => s.id !== id),
        activeSessionId: state.activeSessionId === id
          ? (state.sessions.find(s => s.id !== id)?.id || null)
          : state.activeSessionId,
      })),
      setActiveSession: (id) => set({ activeSessionId: id }),
      addMessage: (sessionId, msgData) => {
        const id = 'msg-' + nanoid()
        const message: ChatMessage = { ...msgData, id, timestamp: new Date().toISOString() }
        set(state => ({
          sessions: state.sessions.map(s =>
            s.id === sessionId
              ? { ...s, messages: [...s.messages, message], updatedAt: new Date().toISOString() }
              : s
          ),
        }))
        return id
      },
      updateMessage: (sessionId, messageId, updates) => set(state => ({
        sessions: state.sessions.map(s =>
          s.id === sessionId
            ? { ...s, messages: s.messages.map(m => m.id === messageId ? { ...m, ...updates } : m) }
            : s
        ),
      })),
      clearSession: (sessionId) => set(state => ({
        sessions: state.sessions.map(s => s.id === sessionId ? { ...s, messages: [] } : s),
      })),
      setSelectedModel: (model) => set({ selectedModel: model }),
      setStreaming: (streaming) => set({ streaming }),
      setSystemPrompt: (prompt) => set({ systemPrompt: prompt }),
    }),
    {
      name: 'bogdan-ai',
      partialize: (state) => ({ sessions: state.sessions, activeSessionId: state.activeSessionId, selectedModel: state.selectedModel, systemPrompt: state.systemPrompt }),
    }
  )
)
