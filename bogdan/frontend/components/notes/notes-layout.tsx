'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Plus, FolderPlus, Search, ChevronRight, ChevronDown,
  FileText, Folder, Trash2, Pencil, X, Check, MoreHorizontal
} from 'lucide-react'
import { useNotesStore, type NoteItem } from '@/store/notes-store'
import { NoteEditor } from './note-editor'
import { cn, formatRelativeDate } from '@/lib/utils'

export function NotesLayout() {
  const {
    items, selectedId, expandedFolders, searchQuery,
    createNote, createFolder, updateNote, deleteItem,
    setSelectedId, toggleFolder, setSearchQuery,
  } = useNotesStore()

  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)

  // Filter items by search
  const filteredItems = searchQuery
    ? items.filter(i => i.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (i.type === 'note' && i.content.toLowerCase().includes(searchQuery.toLowerCase())))
    : items

  const getRootItems = () => filteredItems.filter(i => i.parentId === null)
  const getChildren = (parentId: string) => filteredItems.filter(i => i.parentId === parentId)

  const handleRename = (id: string) => {
    if (!renameValue.trim()) { setRenaming(null); return }
    updateNote(id, { title: renameValue.trim() })
    setRenaming(null)
  }

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    setContextMenu({ id, x: e.clientX, y: e.clientY })
  }

  useEffect(() => {
    const close = () => setContextMenu(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const renderItem = (item: NoteItem, depth = 0) => {
    const isSelected = selectedId === item.id
    const isExpanded = expandedFolders.includes(item.id)
    const children = getChildren(item.id)

    return (
      <div key={item.id}>
        <div
          className={cn(
            'flex items-center gap-1.5 py-1.5 px-2 rounded-lg cursor-pointer group transition-all text-sm relative',
            isSelected ? 'text-violet-300' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5',
          )}
          style={{
            paddingLeft: `${8 + depth * 16}px`,
            background: isSelected ? 'rgba(124,58,237,0.1)' : undefined,
          }}
          onClick={() => {
            if (item.type === 'folder') toggleFolder(item.id)
            else setSelectedId(item.id)
          }}
          onContextMenu={e => handleContextMenu(e, item.id)}
        >
          {item.type === 'folder' ? (
            <>
              <span className="text-gray-500 flex-shrink-0" onClick={e => { e.stopPropagation(); toggleFolder(item.id) }}>
                {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              </span>
              <span className="text-base flex-shrink-0">{item.icon || '📁'}</span>
            </>
          ) : (
            <>
              <span className="w-3.5 flex-shrink-0" />
              <FileText className="w-3.5 h-3.5 flex-shrink-0 text-gray-500" />
            </>
          )}

          {renaming === item.id ? (
            <input
              type="text"
              value={renameValue}
              onChange={e => setRenameValue(e.target.value)}
              onBlur={() => handleRename(item.id)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleRename(item.id)
                if (e.key === 'Escape') setRenaming(null)
              }}
              className="flex-1 bg-transparent focus:outline-none text-white border-b border-violet-600/40"
              autoFocus
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className="flex-1 truncate text-sm leading-tight">{item.title}</span>
          )}

          {/* Hover actions */}
          <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 flex-shrink-0">
            {item.type === 'folder' && (
              <>
                <button
                  onClick={e => { e.stopPropagation(); createNote(item.id) }}
                  className="p-0.5 rounded text-gray-500 hover:text-violet-400"
                  title="New note"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <button
                  onClick={e => { e.stopPropagation(); createFolder(item.id) }}
                  className="p-0.5 rounded text-gray-500 hover:text-violet-400"
                  title="New folder"
                >
                  <FolderPlus className="w-3 h-3" />
                </button>
              </>
            )}
            <button
              onClick={e => { e.stopPropagation(); setRenaming(item.id); setRenameValue(item.title) }}
              className="p-0.5 rounded text-gray-500 hover:text-gray-300"
            >
              <Pencil className="w-3 h-3" />
            </button>
            <button
              onClick={e => { e.stopPropagation(); deleteItem(item.id) }}
              className="p-0.5 rounded text-gray-500 hover:text-red-400"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Children */}
        <AnimatePresence>
          {item.type === 'folder' && isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="overflow-hidden"
            >
              {children.map(child => renderItem(child, depth + 1))}
              {children.length === 0 && (
                <div className="text-xs text-gray-600 py-1" style={{ paddingLeft: `${24 + (depth + 1) * 16}px` }}>
                  Empty
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    )
  }

  const selectedNote = items.find(i => i.id === selectedId && i.type === 'note')

  return (
    <div className="h-full flex" style={{ background: '#030712' }}>
      {/* Sidebar */}
      <AnimatePresence initial={false}>
        {sidebarOpen && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 260, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="flex flex-col h-full border-r overflow-hidden flex-shrink-0"
            style={{ borderColor: 'rgba(124,58,237,0.1)', background: '#050010' }}
          >
            {/* Header */}
            <div className="flex items-center gap-2 px-3 py-3 border-b" style={{ borderColor: 'rgba(124,58,237,0.1)' }}>
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Search notes..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-2 py-1.5 rounded-lg text-xs text-gray-200 placeholder-gray-600 focus:outline-none"
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(124,58,237,0.12)' }}
                />
              </div>
              <button
                onClick={() => createNote(null)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-violet-400 hover:bg-violet-600/10 transition-all"
                title="New note"
              >
                <Plus className="w-4 h-4" />
              </button>
              <button
                onClick={() => createFolder(null)}
                className="p-1.5 rounded-lg text-gray-500 hover:text-violet-400 hover:bg-violet-600/10 transition-all"
                title="New folder"
              >
                <FolderPlus className="w-4 h-4" />
              </button>
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto p-2">
              {getRootItems().length === 0 ? (
                <div className="text-center py-8">
                  <p className="text-gray-600 text-sm">No notes yet</p>
                  <button
                    onClick={() => createNote(null)}
                    className="mt-2 text-xs text-violet-400 hover:text-violet-300"
                  >
                    Create your first note
                  </button>
                </div>
              ) : (
                getRootItems().map(item => renderItem(item))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main editor area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Toggle sidebar + breadcrumb */}
        <div className="flex items-center gap-3 px-4 py-2 border-b flex-shrink-0" style={{ borderColor: 'rgba(124,58,237,0.1)' }}>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          {selectedNote && (
            <div className="flex items-center gap-1.5 text-sm text-gray-400 min-w-0">
              <FileText className="w-4 h-4 text-violet-400 flex-shrink-0" />
              <span className="truncate text-gray-200">{selectedNote.title}</span>
              <span className="text-gray-600 text-xs flex-shrink-0">
                · {formatRelativeDate(selectedNote.updatedAt)}
              </span>
            </div>
          )}
        </div>

        {selectedNote ? (
          <NoteEditor note={selectedNote} />
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="text-7xl mb-6"
            >
              📝
            </motion.div>
            <h3 className="text-xl font-semibold text-gray-300 mb-2">
              {items.some(i => i.type === 'note') ? 'Select a note' : 'No notes yet'}
            </h3>
            <p className="text-gray-500 max-w-xs mb-6">
              {items.some(i => i.type === 'note')
                ? 'Choose a note from the sidebar to start editing'
                : 'Create your first note to get started'}
            </p>
            <button
              onClick={() => createNote(null)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white text-sm font-medium"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
              <Plus className="w-4 h-4" />
              New Note
            </button>
          </div>
        )}
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed z-50 w-40 rounded-xl overflow-hidden shadow-2xl"
            style={{
              top: contextMenu.y,
              left: contextMenu.x,
              background: '#0a0014',
              border: '1px solid rgba(124,58,237,0.2)',
            }}
          >
            {[
              { label: 'Rename', icon: Pencil, action: () => { setRenaming(contextMenu.id); setRenameValue(items.find(i => i.id === contextMenu.id)?.title || '') } },
              { label: 'Delete', icon: Trash2, action: () => deleteItem(contextMenu.id), danger: true },
            ].map(({ label, icon: Icon, action, danger }) => (
              <button
                key={label}
                onClick={() => { action(); setContextMenu(null) }}
                className={cn('w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-white/5 transition-colors', danger ? 'text-red-400' : 'text-gray-300')}
              >
                <Icon className="w-4 h-4" />
                {label}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
