'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Send, Plus, Trash2, Bot, User, Copy, Check, ChevronDown,
  Sparkles, MessageSquare, RotateCcw, Settings, X
} from 'lucide-react'
import { useAIStore, type ChatMessage, type ChatSession } from '@/store/ai-store'
import { aiApi } from '@/lib/api'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { cn, formatDate } from '@/lib/utils'

export function AIChat() {
  const {
    sessions, activeSessionId, selectedModel, availableModels, systemPrompt,
    createSession, deleteSession, setActiveSession, addMessage, updateMessage,
    clearSession, setSelectedModel, setSystemPrompt,
  } = useAIStore()

  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [modelDropdown, setModelDropdown] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  const activeSession = sessions.find(s => s.id === activeSessionId)
  const messages = activeSession?.messages || []

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length, messages[messages.length - 1]?.content])

  const handleSend = useCallback(async () => {
    if (!input.trim() || isLoading) return

    let sessionId = activeSessionId
    if (!sessionId) {
      sessionId = createSession(input.slice(0, 40))
    }

    const userMsg = input.trim()
    setInput('')

    // Add user message
    addMessage(sessionId, { role: 'user', content: userMsg })

    // Add empty assistant message
    const assistantMsgId = addMessage(sessionId, { role: 'assistant', content: '', loading: true })

    setIsLoading(true)
    abortRef.current = new AbortController()

    try {
      const session = useAIStore.getState().sessions.find(s => s.id === sessionId)
      const msgHistory = (session?.messages || [])
        .filter(m => !m.loading && m.role !== 'system')
        .map(m => ({ role: m.role, content: m.content }))

      let fullContent = ''

      await aiApi.chat(
        selectedModel,
        msgHistory,
        systemPrompt,
        (chunk) => {
          fullContent += chunk
          updateMessage(sessionId!, assistantMsgId, { content: fullContent, loading: false })
        }
      )

      if (!fullContent) {
        // Fallback: use non-streaming
        const res = await aiApi.chatSimple(selectedModel, msgHistory, systemPrompt)
        fullContent = res.data.content
        updateMessage(sessionId!, assistantMsgId, { content: fullContent, loading: false })
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        // Mock response for demo
        const mockResponses = [
          "I'm your AI assistant running on BitNet. I can help you with tasks, answer questions, and assist with your workspace.\n\nCurrently I'm in demo mode — the backend API isn't connected. Once you connect the BitNet backend, I'll provide real responses.",
          "That's an interesting question! In demo mode, I can only provide pre-set responses. Connect the backend to get full AI capabilities.",
          "I understand. Let me help you with that once the backend connection is established. For now, I'm running in offline demo mode.",
        ]
        const mockContent = mockResponses[Math.floor(Math.random() * mockResponses.length)]
        updateMessage(sessionId!, assistantMsgId, { content: mockContent, loading: false })
      }
    } finally {
      setIsLoading(false)
      abortRef.current = null
      inputRef.current?.focus()
    }
  }, [input, isLoading, activeSessionId, createSession, addMessage, updateMessage, selectedModel, systemPrompt])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const currentModel = availableModels.find(m => m.id === selectedModel)

  return (
    <div className="h-full flex" style={{ background: '#030712' }}>
      {/* Sessions sidebar */}
      <div className="hidden md:flex flex-col w-56 border-r flex-shrink-0" style={{ borderColor: 'rgba(124,58,237,0.1)', background: '#050010' }}>
        <div className="p-3 border-b" style={{ borderColor: 'rgba(124,58,237,0.1)' }}>
          <motion.button
            onClick={() => createSession()}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-4 h-4" />
            New Chat
          </motion.button>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessions.length === 0 ? (
            <div className="text-center py-6">
              <MessageSquare className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-600">No chats yet</p>
            </div>
          ) : (
            [...sessions].reverse().map(session => (
              <div
                key={session.id}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-xl cursor-pointer group transition-all',
                  activeSessionId === session.id ? 'text-violet-300' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5',
                )}
                style={activeSessionId === session.id ? { background: 'rgba(124,58,237,0.1)' } : {}}
                onClick={() => setActiveSession(session.id)}
              >
                <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="flex-1 text-xs truncate">{session.title}</span>
                <button
                  onClick={e => { e.stopPropagation(); deleteSession(session.id) }}
                  className="opacity-0 group-hover:opacity-100 p-0.5 rounded text-gray-600 hover:text-red-400 transition-all"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Settings */}
        <div className="p-2 border-t" style={{ borderColor: 'rgba(124,58,237,0.1)' }}>
          <button
            onClick={() => setSettingsOpen(!settingsOpen)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-all text-sm"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-5 py-3 border-b flex-shrink-0" style={{ borderColor: 'rgba(124,58,237,0.1)' }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)' }}>
              <Bot className="w-5 h-5 text-violet-400" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">BitNet AI</div>
              <div className="text-xs text-gray-500">
                {messages.length} messages
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Model selector */}
            <div className="relative">
              <button
                onClick={() => setModelDropdown(!modelDropdown)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm text-gray-300 transition-all"
                style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}
              >
                <Sparkles className="w-4 h-4 text-violet-400" />
                {currentModel?.name || selectedModel}
                <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
              </button>

              <AnimatePresence>
                {modelDropdown && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setModelDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -5 }}
                      className="absolute right-0 top-full mt-1 w-64 rounded-xl overflow-hidden shadow-2xl z-20"
                      style={{ background: '#0a0014', border: '1px solid rgba(124,58,237,0.2)' }}
                    >
                      {availableModels.map(model => (
                        <button
                          key={model.id}
                          onClick={() => { setSelectedModel(model.id); setModelDropdown(false) }}
                          className={cn(
                            'w-full flex flex-col px-4 py-3 text-left hover:bg-white/5 transition-colors',
                            selectedModel === model.id && 'bg-violet-600/10',
                          )}
                        >
                          <span className={cn('text-sm font-medium', selectedModel === model.id ? 'text-violet-300' : 'text-white')}>
                            {model.name}
                          </span>
                          <span className="text-xs text-gray-500 mt-0.5">{model.description}</span>
                        </button>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Clear */}
            {messages.length > 0 && (
              <button
                onClick={() => activeSessionId && clearSession(activeSessionId)}
                className="p-2 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all"
                title="Clear chat"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center max-w-lg mx-auto">
              <motion.div
                animate={{ scale: [1, 1.05, 1], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 4, repeat: Infinity }}
                className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
                style={{ background: 'rgba(124,58,237,0.15)' }}
              >
                <Bot className="w-10 h-10 text-violet-400" />
              </motion.div>
              <h2 className="text-2xl font-bold text-white mb-2">BitNet AI Assistant</h2>
              <p className="text-gray-400 mb-8">Your personal AI assistant. Ask me anything!</p>

              <div className="grid grid-cols-2 gap-3 w-full">
                {[
                  { emoji: '💡', text: 'Brainstorm ideas for my project' },
                  { emoji: '📝', text: 'Help me write a professional email' },
                  { emoji: '🔍', text: 'Explain a complex topic simply' },
                  { emoji: '🚀', text: 'Review my code and suggest improvements' },
                ].map(({ emoji, text }) => (
                  <motion.button
                    key={text}
                    onClick={() => { setInput(text); inputRef.current?.focus() }}
                    className="flex items-start gap-3 p-4 rounded-2xl text-left text-sm transition-all"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(124,58,237,0.12)' }}
                    whileHover={{ scale: 1.02, background: 'rgba(124,58,237,0.06)' }}
                  >
                    <span className="text-xl flex-shrink-0">{emoji}</span>
                    <span className="text-gray-400">{text}</span>
                  </motion.button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onCopy={() => handleCopy(msg.content, msg.id)}
                  copied={copiedId === msg.id}
                />
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input area */}
        <div className="px-4 pb-4 flex-shrink-0">
          <div
            className="flex items-end gap-3 p-3 rounded-2xl"
            style={{ background: 'rgba(15,5,30,0.8)', border: '1px solid rgba(124,58,237,0.2)' }}
          >
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => {
                setInput(e.target.value)
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything... (Enter to send, Shift+Enter for new line)"
              className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-500 focus:outline-none resize-none min-h-[36px] max-h-30 leading-6"
              rows={1}
              disabled={isLoading}
            />
            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isLoading ? (
                <button
                  onClick={() => abortRef.current?.abort()}
                  className="p-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              ) : (
                <motion.button
                  onClick={handleSend}
                  disabled={!input.trim()}
                  className="p-2.5 rounded-xl text-white disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                  style={{ background: input.trim() ? 'linear-gradient(135deg, #7c3aed, #a855f7)' : 'rgba(124,58,237,0.2)' }}
                  whileHover={input.trim() ? { scale: 1.05 } : {}}
                  whileTap={input.trim() ? { scale: 0.95 } : {}}
                >
                  <Send className="w-4 h-4" />
                </motion.button>
              )}
            </div>
          </div>
          <p className="text-center text-xs text-gray-700 mt-2">
            {currentModel?.name} · {currentModel?.contextWindow?.toLocaleString()} context window
          </p>
        </div>
      </div>

      {/* Settings panel */}
      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-72 border-l flex-shrink-0 overflow-y-auto"
            style={{ borderColor: 'rgba(124,58,237,0.1)', background: '#050010' }}
          >
            <div className="p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white">AI Settings</h3>
                <button onClick={() => setSettingsOpen(false)} className="text-gray-500 hover:text-gray-300">
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-400 mb-2">System Prompt</label>
                <textarea
                  value={systemPrompt}
                  onChange={e => setSystemPrompt(e.target.value)}
                  className="w-full h-32 text-sm text-gray-200 placeholder-gray-600 focus:outline-none resize-none rounded-xl p-3 leading-5"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(124,58,237,0.15)' }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function MessageBubble({ message, onCopy, copied }: { message: ChatMessage; onCopy: () => void; copied: boolean }) {
  const isUser = message.role === 'user'

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('flex gap-3 max-w-4xl', isUser ? 'ml-auto flex-row-reverse' : 'mr-auto')}
    >
      {/* Avatar */}
      <div className={cn(
        'w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-1',
        isUser ? 'bg-violet-600/20' : 'bg-violet-600/15',
      )}>
        {isUser ? <User className="w-4 h-4 text-violet-400" /> : <Bot className="w-4 h-4 text-violet-400" />}
      </div>

      {/* Content */}
      <div className={cn('flex-1 max-w-prose', isUser ? 'items-end' : 'items-start')} style={{ display: 'flex', flexDirection: 'column' }}>
        <div
          className={cn('rounded-2xl px-4 py-3 text-sm leading-6 relative group', isUser ? 'rounded-tr-sm' : 'rounded-tl-sm')}
          style={{
            background: isUser ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.04)',
            border: `1px solid ${isUser ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.06)'}`,
          }}
        >
          {message.loading ? (
            <div className="flex items-center gap-1.5 py-1">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-violet-400"
                  animate={{ y: [0, -6, 0] }}
                  transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
                />
              ))}
            </div>
          ) : isUser ? (
            <p className="text-gray-200 whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  code: ({ children, className }) => {
                    const isBlock = className?.startsWith('language-')
                    if (isBlock) {
                      return (
                        <div className="relative group/code">
                          <pre className="rounded-xl p-3 overflow-x-auto text-xs leading-5 my-2" style={{ background: '#0d0117', border: '1px solid rgba(124,58,237,0.2)' }}>
                            <code className="font-mono text-gray-200">{children}</code>
                          </pre>
                        </div>
                      )
                    }
                    return <code className="text-violet-300 bg-violet-600/10 px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
                  },
                  p: ({ children }) => <p className="text-gray-200 mb-2 last:mb-0 leading-6">{children}</p>,
                  ul: ({ children }) => <ul className="text-gray-200 list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
                  ol: ({ children }) => <ol className="text-gray-200 list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
                  li: ({ children }) => <li className="text-gray-300">{children}</li>,
                  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                  blockquote: ({ children }) => <blockquote className="border-l-2 border-violet-600 pl-3 my-2 text-gray-400 italic">{children}</blockquote>,
                }}
              >
                {message.content}
              </ReactMarkdown>
            </div>
          )}

          {/* Copy button */}
          {!message.loading && (
            <button
              onClick={onCopy}
              className="absolute top-2 right-2 p-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ background: 'rgba(0,0,0,0.4)' }}
            >
              {copied ? <Check className="w-3 h-3 text-green-400" /> : <Copy className="w-3 h-3 text-gray-400" />}
            </button>
          )}
        </div>
        <span className="text-xs text-gray-600 mt-1 px-1">{formatDate(message.timestamp)}</span>
      </div>
    </motion.div>
  )
}
