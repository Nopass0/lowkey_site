'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Inbox, Send, FileText, Trash2, AlertCircle, Star, Search,
  Plus, RefreshCw, ChevronDown, ArrowLeft, MoreVertical,
  Reply, Forward, Paperclip, Clock, Check, CheckCheck,
} from 'lucide-react'
import { useMailStore, type MailMessage, type MailFolder } from '@/store/mail-store'
import { formatDate, formatDateFull, getInitials, truncate } from '@/lib/utils'
import { ComposeModal } from './compose-modal'
import { cn } from '@/lib/utils'

const FOLDERS: { id: MailFolder; label: string; icon: any }[] = [
  { id: 'inbox', label: 'Inbox', icon: Inbox },
  { id: 'sent', label: 'Sent', icon: Send },
  { id: 'drafts', label: 'Drafts', icon: FileText },
  { id: 'starred', label: 'Starred', icon: Star },
  { id: 'trash', label: 'Trash', icon: Trash2 },
  { id: 'spam', label: 'Spam', icon: AlertCircle },
]

export function MailClient() {
  const {
    accounts, messages, selectedAccount, selectedMessage, selectedFolder,
    searchQuery, composeOpen,
    setSelectedAccount, setSelectedMessage, setSelectedFolder,
    setSearchQuery, setComposeOpen, toggleStar, moveToTrash,
  } = useMailStore()

  const [mobileView, setMobileView] = useState<'list' | 'message'>('list')
  const [accountDropdown, setAccountDropdown] = useState(false)

  const currentAccount = accounts.find(a => a.id === selectedAccount)

  const filteredMessages = useMemo(() => {
    let msgs = messages
    if (selectedAccount) msgs = msgs.filter(m => m.accountId === selectedAccount)
    if (selectedFolder === 'starred') msgs = msgs.filter(m => m.starred)
    else msgs = msgs.filter(m => m.folder === selectedFolder)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      msgs = msgs.filter(m =>
        m.subject.toLowerCase().includes(q) ||
        m.from.name.toLowerCase().includes(q) ||
        m.from.email.toLowerCase().includes(q) ||
        m.body.toLowerCase().includes(q)
      )
    }
    return msgs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [messages, selectedAccount, selectedFolder, searchQuery])

  const currentMessage = messages.find(m => m.id === selectedMessage)

  const handleSelectMessage = (id: string) => {
    setSelectedMessage(id)
    setMobileView('message')
  }

  const folderUnread = (folder: MailFolder) => {
    if (folder === 'starred') return messages.filter(m => m.starred && !m.read).length
    return messages.filter(m => m.folder === folder && !m.read && (!selectedAccount || m.accountId === selectedAccount)).length
  }

  return (
    <div className="h-full flex" style={{ background: '#030712' }}>
      {/* Left sidebar - folders + account */}
      <div className="hidden md:flex flex-col w-52 border-r flex-shrink-0" style={{ borderColor: 'rgba(124,58,237,0.1)', background: '#050010' }}>
        {/* Account switcher */}
        <div className="p-3 border-b" style={{ borderColor: 'rgba(124,58,237,0.1)' }}>
          <button
            onClick={() => setAccountDropdown(!accountDropdown)}
            className="w-full flex items-center gap-2 p-2 rounded-xl hover:bg-white/5 transition-colors text-left"
          >
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
              style={{ background: currentAccount?.color || '#7c3aed' }}
            >
              {currentAccount ? getInitials(currentAccount.name) : 'A'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm text-white truncate">{currentAccount?.name || 'All accounts'}</div>
              <div className="text-xs text-gray-500 truncate">{currentAccount?.email || `${accounts.length} accounts`}</div>
            </div>
            <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" />
          </button>

          <AnimatePresence>
            {accountDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="mt-1 rounded-xl overflow-hidden border"
                style={{ background: '#0a0014', borderColor: 'rgba(124,58,237,0.2)' }}
              >
                <button
                  onClick={() => { setSelectedAccount(null); setAccountDropdown(false) }}
                  className={cn('w-full flex items-center gap-2 p-2 text-sm hover:bg-white/5 transition-colors', !selectedAccount && 'bg-violet-600/10 text-violet-300')}
                >
                  <div className="w-6 h-6 rounded-full bg-gray-700 flex items-center justify-center text-xs">A</div>
                  All accounts
                </button>
                {accounts.map(acc => (
                  <button
                    key={acc.id}
                    onClick={() => { setSelectedAccount(acc.id); setAccountDropdown(false) }}
                    className={cn('w-full flex items-center gap-2 p-2 text-sm hover:bg-white/5 transition-colors', selectedAccount === acc.id && 'bg-violet-600/10 text-violet-300')}
                  >
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs text-white" style={{ background: acc.color }}>
                      {getInitials(acc.name)}
                    </div>
                    <span className="truncate">{acc.name}</span>
                    {acc.unread > 0 && (
                      <span className="ml-auto text-xs text-white rounded-full px-1.5 py-0.5" style={{ background: acc.color }}>
                        {acc.unread}
                      </span>
                    )}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Folders */}
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {FOLDERS.map(({ id, label, icon: Icon }) => {
            const count = folderUnread(id)
            return (
              <button
                key={id}
                onClick={() => setSelectedFolder(id)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm transition-all',
                  selectedFolder === id
                    ? 'text-violet-300'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                )}
                style={selectedFolder === id ? { background: 'rgba(124,58,237,0.12)' } : {}}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span className="flex-1 text-left">{label}</span>
                {count > 0 && (
                  <span className="text-xs text-white rounded-full px-1.5 py-0.5 font-medium" style={{ background: '#7c3aed' }}>
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Compose button */}
        <div className="p-3">
          <motion.button
            onClick={() => setComposeOpen(true)}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-white text-sm font-medium"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-4 h-4" />
            Compose
          </motion.button>
        </div>
      </div>

      {/* Message list */}
      <div className={cn(
        'flex flex-col border-r',
        'md:w-80 lg:w-96 md:flex-shrink-0',
        'w-full',
        selectedMessage && 'hidden md:flex',
      )}
        style={{ borderColor: 'rgba(124,58,237,0.1)', background: '#07000f' }}>
        {/* Search bar */}
        <div className="p-3 border-b flex gap-2" style={{ borderColor: 'rgba(124,58,237,0.1)' }}>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search mail..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-600/40"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(124,58,237,0.15)' }}
            />
          </div>
          <button className="p-2 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>

        {/* Folder title */}
        <div className="px-4 py-3 flex items-center justify-between">
          <h2 className="font-semibold text-white capitalize">{selectedFolder}</h2>
          <span className="text-xs text-gray-500">{filteredMessages.length} messages</span>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {filteredMessages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4">
              <span className="text-4xl mb-3">📭</span>
              <p className="text-gray-400 text-sm">No messages</p>
            </div>
          ) : (
            filteredMessages.map(msg => (
              <MessageItem
                key={msg.id}
                message={msg}
                isSelected={selectedMessage === msg.id}
                onSelect={() => handleSelectMessage(msg.id)}
                onStar={() => toggleStar(msg.id)}
                onTrash={() => moveToTrash(msg.id)}
              />
            ))
          )}
        </div>
      </div>

      {/* Message view */}
      <div className={cn(
        'flex-1 flex flex-col overflow-hidden',
        !selectedMessage && 'hidden md:flex',
      )}>
        {currentMessage ? (
          <MessageView
            message={currentMessage}
            onBack={() => { setSelectedMessage(null); setMobileView('list') }}
            onStar={() => toggleStar(currentMessage.id)}
            onTrash={() => { moveToTrash(currentMessage.id); setSelectedMessage(null) }}
            onReply={() => setComposeOpen(true)}
          />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <motion.div
              animate={{ y: [0, -10, 0] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="text-7xl mb-6"
            >
              📬
            </motion.div>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">Select a message</h3>
            <p className="text-gray-500 max-w-xs">Choose a message from the list to read it here</p>
          </div>
        )}
      </div>

      {/* Compose modal */}
      <ComposeModal open={composeOpen} onClose={() => setComposeOpen(false)} />
    </div>
  )
}

function MessageItem({
  message, isSelected, onSelect, onStar, onTrash,
}: {
  message: MailMessage
  isSelected: boolean
  onSelect: () => void
  onStar: () => void
  onTrash: () => void
}) {
  return (
    <motion.div
      onClick={onSelect}
      className={cn(
        'flex items-start gap-3 px-4 py-3 cursor-pointer border-b transition-all group',
        isSelected ? 'bg-violet-600/10' : 'hover:bg-white/3',
        !message.read && 'bg-violet-600/5',
      )}
      style={{ borderColor: 'rgba(124,58,237,0.08)' }}
      whileHover={{ x: 1 }}
    >
      {/* Avatar */}
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0 mt-0.5"
        style={{ background: `hsl(${message.from.email.length * 37 % 360}, 60%, 35%)` }}
      >
        {getInitials(message.from.name)}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-0.5">
          <span className={cn('text-sm truncate', message.read ? 'text-gray-400' : 'text-white font-semibold')}>
            {message.from.name}
          </span>
          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">{formatDate(message.date)}</span>
        </div>
        <div className={cn('text-sm truncate mb-0.5', message.read ? 'text-gray-500' : 'text-gray-200')}>
          {message.subject}
        </div>
        <div className="text-xs text-gray-600 truncate">{truncate(message.body, 80)}</div>

        {/* Labels */}
        {message.labels && message.labels.length > 0 && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {message.labels.slice(0, 2).map(label => (
              <span key={label} className="text-xs px-1.5 py-0.5 rounded-md" style={{ background: 'rgba(124,58,237,0.15)', color: '#a78bfa' }}>
                {label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex flex-col items-end gap-1 flex-shrink-0">
        {!message.read && <div className="w-2 h-2 rounded-full bg-violet-500" />}
        <button
          onClick={e => { e.stopPropagation(); onStar() }}
          className={cn('opacity-0 group-hover:opacity-100 transition-opacity', message.starred && 'opacity-100')}
        >
          <Star className="w-4 h-4" style={{ color: message.starred ? '#f59e0b' : '#4b5563', fill: message.starred ? '#f59e0b' : 'none' }} />
        </button>
      </div>
    </motion.div>
  )
}

function MessageView({
  message, onBack, onStar, onTrash, onReply,
}: {
  message: MailMessage
  onBack: () => void
  onStar: () => void
  onTrash: () => void
  onReply: () => void
}) {
  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgba(124,58,237,0.1)' }}>
        <button onClick={onBack} className="md:hidden p-2 rounded-lg text-gray-400 hover:text-gray-200">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-white text-lg truncate">{message.subject}</h2>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onReply} className="p-2 rounded-xl text-gray-400 hover:text-violet-400 hover:bg-violet-600/10 transition-all">
            <Reply className="w-5 h-5" />
          </button>
          <button onClick={onStar} className="p-2 rounded-xl hover:bg-yellow-500/10 transition-all">
            <Star className="w-5 h-5" style={{ color: message.starred ? '#f59e0b' : '#4b5563', fill: message.starred ? '#f59e0b' : 'none' }} />
          </button>
          <button onClick={onTrash} className="p-2 rounded-xl text-gray-400 hover:text-red-400 hover:bg-red-500/10 transition-all">
            <Trash2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Message content */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* From/To */}
        <div className="flex items-start gap-4 mb-6 p-4 rounded-2xl" style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.1)' }}>
          <div
            className="w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ background: `hsl(${message.from.email.length * 37 % 360}, 60%, 35%)` }}
          >
            {getInitials(message.from.name)}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-white">{message.from.name}</span>
                <span className="text-gray-400 text-sm ml-2">&lt;{message.from.email}&gt;</span>
              </div>
              <div className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="w-3.5 h-3.5" />
                {formatDateFull(message.date)}
              </div>
            </div>
            <div className="text-sm text-gray-400 mt-0.5">
              To: {message.to.map(t => t.name || t.email).join(', ')}
              {message.cc && message.cc.length > 0 && (
                <span> · CC: {message.cc.map(t => t.name || t.email).join(', ')}</span>
              )}
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="text-gray-300 text-sm leading-7 whitespace-pre-wrap font-sans">
          {message.body}
        </div>

        {/* Attachments */}
        {message.attachments && message.attachments.length > 0 && (
          <div className="mt-6">
            <h4 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
              <Paperclip className="w-4 h-4" />
              Attachments ({message.attachments.length})
            </h4>
            <div className="flex flex-wrap gap-2">
              {message.attachments.map((att, i) => (
                <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.15)' }}>
                  <Paperclip className="w-4 h-4 text-violet-400" />
                  <span className="text-gray-300">{att.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Reply bar */}
      <div className="px-6 py-4 border-t flex-shrink-0" style={{ borderColor: 'rgba(124,58,237,0.1)' }}>
        <button
          onClick={onReply}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-gray-400 text-sm text-left transition-all"
          style={{ background: 'rgba(124,58,237,0.05)', border: '1px solid rgba(124,58,237,0.1)' }}
        >
          <Reply className="w-5 h-5 text-violet-400" />
          <span>Reply to {message.from.name}...</span>
        </button>
      </div>
    </div>
  )
}
