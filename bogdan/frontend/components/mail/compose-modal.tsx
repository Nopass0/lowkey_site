'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Minimize2, Maximize2, Send, Paperclip, Bold, Italic, List, Link } from 'lucide-react'
import { useMailStore } from '@/store/mail-store'
import { nanoid } from '@/store/utils'
import type { MailMessage } from '@/store/mail-store'

interface ComposeModalProps {
  open: boolean
  onClose: () => void
  replyTo?: MailMessage
}

export function ComposeModal({ open, onClose, replyTo }: ComposeModalProps) {
  const { accounts, selectedAccount, addMessage } = useMailStore()
  const [to, setTo] = useState(replyTo ? replyTo.from.email : '')
  const [cc, setCc] = useState('')
  const [subject, setSubject] = useState(replyTo ? `Re: ${replyTo.subject}` : '')
  const [body, setBody] = useState(replyTo ? `\n\n--- Original message ---\n${replyTo.body}` : '')
  const [showCc, setShowCc] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [sending, setSending] = useState(false)
  const [fromAccount, setFromAccount] = useState(selectedAccount || accounts[0]?.id || '')

  const currentAccount = accounts.find(a => a.id === fromAccount)

  const handleSend = async () => {
    if (!to.trim() || !subject.trim()) return
    setSending(true)
    try {
      // Simulate send delay
      await new Promise(r => setTimeout(r, 800))
      const msg: MailMessage = {
        id: nanoid(),
        accountId: fromAccount,
        from: { name: currentAccount?.name || 'Me', email: currentAccount?.email || '' },
        to: to.split(',').map(e => ({ name: e.trim(), email: e.trim() })),
        cc: cc ? cc.split(',').map(e => ({ name: e.trim(), email: e.trim() })) : undefined,
        subject,
        body,
        date: new Date().toISOString(),
        read: true,
        starred: false,
        folder: 'sent',
      }
      addMessage(msg)
      onClose()
    } finally {
      setSending(false)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          className="fixed bottom-4 right-4 z-50 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col"
          style={{
            background: '#0a0014',
            border: '1px solid rgba(124,58,237,0.25)',
            height: minimized ? 'auto' : '500px',
          }}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0 cursor-pointer"
            style={{ background: 'rgba(124,58,237,0.12)', borderBottom: '1px solid rgba(124,58,237,0.15)' }}
            onClick={() => minimized && setMinimized(false)}
          >
            <span className="font-medium text-white text-sm">
              {replyTo ? `Reply to ${replyTo.from.name}` : 'New Message'}
            </span>
            <div className="flex items-center gap-1">
              <button onClick={() => setMinimized(!minimized)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-200 hover:bg-white/10 transition-all">
                {minimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
              </button>
              <button onClick={onClose} className="p-1.5 rounded-lg text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {!minimized && (
            <>
              {/* Form */}
              <div className="flex-1 overflow-y-auto">
                {/* From */}
                <div className="flex items-center gap-3 px-4 py-2 border-b" style={{ borderColor: 'rgba(124,58,237,0.1)' }}>
                  <span className="text-xs text-gray-500 w-14 flex-shrink-0">From:</span>
                  <select
                    value={fromAccount}
                    onChange={e => setFromAccount(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-gray-300 focus:outline-none"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>{acc.email}</option>
                    ))}
                  </select>
                </div>

                {/* To */}
                <div className="flex items-center gap-3 px-4 py-2 border-b" style={{ borderColor: 'rgba(124,58,237,0.1)' }}>
                  <span className="text-xs text-gray-500 w-14 flex-shrink-0">To:</span>
                  <input
                    type="text"
                    value={to}
                    onChange={e => setTo(e.target.value)}
                    placeholder="recipient@example.com"
                    className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none"
                    autoFocus={!replyTo}
                  />
                  {!showCc && (
                    <button onClick={() => setShowCc(true)} className="text-xs text-violet-400 hover:text-violet-300 flex-shrink-0">
                      +CC
                    </button>
                  )}
                </div>

                {/* CC */}
                <AnimatePresence>
                  {showCc && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="flex items-center gap-3 px-4 py-2 border-b overflow-hidden"
                      style={{ borderColor: 'rgba(124,58,237,0.1)' }}
                    >
                      <span className="text-xs text-gray-500 w-14 flex-shrink-0">CC:</span>
                      <input
                        type="text"
                        value={cc}
                        onChange={e => setCc(e.target.value)}
                        placeholder="cc@example.com"
                        className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Subject */}
                <div className="flex items-center gap-3 px-4 py-2 border-b" style={{ borderColor: 'rgba(124,58,237,0.1)' }}>
                  <span className="text-xs text-gray-500 w-14 flex-shrink-0">Subject:</span>
                  <input
                    type="text"
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    placeholder="Email subject"
                    className="flex-1 bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none font-medium"
                    autoFocus={!!replyTo}
                  />
                </div>

                {/* Body */}
                <div className="px-4 py-3 flex-1">
                  <textarea
                    value={body}
                    onChange={e => setBody(e.target.value)}
                    placeholder="Write your message..."
                    className="w-full h-40 bg-transparent text-sm text-gray-200 placeholder-gray-600 focus:outline-none resize-none leading-6"
                  />
                </div>
              </div>

              {/* Toolbar */}
              <div
                className="flex items-center justify-between px-4 py-3 border-t flex-shrink-0"
                style={{ borderColor: 'rgba(124,58,237,0.1)', background: 'rgba(124,58,237,0.03)' }}
              >
                <div className="flex items-center gap-1">
                  <button className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all">
                    <Bold className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all">
                    <Italic className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all">
                    <List className="w-4 h-4" />
                  </button>
                  <button className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all">
                    <Link className="w-4 h-4" />
                  </button>
                  <div className="w-px h-4 bg-gray-700 mx-1" />
                  <button className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all">
                    <Paperclip className="w-4 h-4" />
                  </button>
                </div>

                <motion.button
                  onClick={handleSend}
                  disabled={sending || !to.trim() || !subject.trim()}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {sending ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Send className="w-4 h-4" />
                  )}
                  {sending ? 'Sending...' : 'Send'}
                </motion.button>
              </div>
            </>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
