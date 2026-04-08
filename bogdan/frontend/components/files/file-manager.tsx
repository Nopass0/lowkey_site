'use client'

import { useState, useCallback } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Grid3X3, List, Upload, FolderPlus, Search, Folder,
  ArrowLeft, MoreVertical, Trash2, Download, Pencil,
  X, Check, ArrowRight, ChevronRight, SortAsc, SortDesc
} from 'lucide-react'
import { useFilesStore, type FileItem } from '@/store/files-store'
import { formatFileSize, formatDate, getFileIcon, getFileColor, cn } from '@/lib/utils'

export function FileManager() {
  const {
    items, currentFolderId, selectedIds, viewMode, sortBy, sortDir,
    uploading, uploadProgress, searchQuery,
    setCurrentFolder, toggleSelected, clearSelected, setViewMode,
    setSortBy, setSortDir, createFolder, deleteItems, renameItem,
    addFile, setSearchQuery, setUploading, setUploadProgress,
  } = useFilesStore()

  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [contextMenu, setContextMenu] = useState<{ id: string; x: number; y: number } | null>(null)

  const currentItems = items.filter(i => i.parentId === currentFolderId)
  const filteredItems = searchQuery
    ? items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()))
    : currentItems

  const sortedItems = [...filteredItems].sort((a, b) => {
    // Folders first
    if (a.type === 'folder' && b.type !== 'folder') return -1
    if (b.type === 'folder' && a.type !== 'folder') return 1

    const mult = sortDir === 'asc' ? 1 : -1
    switch (sortBy) {
      case 'name': return mult * a.name.localeCompare(b.name)
      case 'date': return mult * (new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime())
      case 'size': return mult * ((a.size || 0) - (b.size || 0))
      default: return 0
    }
  })

  // Build breadcrumb
  const buildBreadcrumb = (): FileItem[] => {
    if (!currentFolderId) return []
    const path: FileItem[] = []
    let current: FileItem | undefined = items.find(i => i.id === currentFolderId)
    while (current) {
      path.unshift(current)
      current = current.parentId ? items.find(i => i.id === current!.parentId) : undefined
    }
    return path
  }
  const breadcrumb = buildBreadcrumb()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setUploading(true)
    setUploadProgress(0)
    acceptedFiles.forEach((file, i) => {
      // Simulate upload with timeout
      const fakeUrl = URL.createObjectURL(file)
      setTimeout(() => {
        addFile({
          name: file.name,
          type: 'file',
          mimeType: file.type,
          size: file.size,
          parentId: currentFolderId,
          url: fakeUrl,
        })
        setUploadProgress(((i + 1) / acceptedFiles.length) * 100)
        if (i === acceptedFiles.length - 1) {
          setTimeout(() => {
            setUploading(false)
            setUploadProgress(0)
          }, 500)
        }
      }, 500 * (i + 1))
    })
  }, [currentFolderId, addFile, setUploading, setUploadProgress])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    noClick: true,
  })

  const handleCreateFolder = () => {
    if (!newFolderName.trim()) return
    createFolder(newFolderName.trim(), currentFolderId)
    setNewFolderName('')
    setCreatingFolder(false)
  }

  const handleRename = (id: string) => {
    if (!renameValue.trim()) { setRenaming(null); return }
    renameItem(id, renameValue.trim())
    setRenaming(null)
  }

  const handleContextMenu = (e: React.MouseEvent, id: string) => {
    e.preventDefault()
    setContextMenu({ id, x: e.clientX, y: e.clientY })
  }

  const totalSize = filteredItems.filter(i => i.type === 'file').reduce((s, i) => s + (i.size || 0), 0)

  return (
    <div className="h-full flex flex-col" style={{ background: '#030712' }} {...getRootProps()}>
      <input {...getInputProps()} />

      {/* Drop overlay */}
      <AnimatePresence>
        {isDragActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center"
            style={{ background: 'rgba(7,0,18,0.9)', border: '2px dashed rgba(124,58,237,0.5)' }}
          >
            <div className="text-center">
              <Upload className="w-16 h-16 text-violet-400 mx-auto mb-4" />
              <p className="text-xl font-semibold text-violet-300">Drop files here</p>
              <p className="text-gray-400 mt-1">Files will be uploaded to the current folder</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgba(124,58,237,0.1)' }}>
        {/* Breadcrumb */}
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <button
            onClick={() => setCurrentFolder(null)}
            className={cn('flex items-center gap-1 text-sm transition-colors', !currentFolderId ? 'text-violet-300 font-medium' : 'text-gray-400 hover:text-gray-200')}
          >
            <span className="text-base">📁</span>
            <span>Files</span>
          </button>
          {breadcrumb.map((crumb, i) => (
            <div key={crumb.id} className="flex items-center gap-1">
              <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
              <button
                onClick={() => setCurrentFolder(crumb.id)}
                className={cn(
                  'text-sm transition-colors',
                  i === breadcrumb.length - 1 ? 'text-violet-300 font-medium' : 'text-gray-400 hover:text-gray-200'
                )}
              >
                {crumb.name}
              </button>
            </div>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="Search files..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-44 pl-9 pr-3 py-2 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-600/40"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(124,58,237,0.15)' }}
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1">
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="py-2 pl-2 pr-6 rounded-xl text-xs text-gray-400 focus:outline-none cursor-pointer"
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(124,58,237,0.12)' }}
          >
            <option value="name">Name</option>
            <option value="date">Date</option>
            <option value="size">Size</option>
          </select>
          <button
            onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
            className="p-2 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all"
          >
            {sortDir === 'asc' ? <SortAsc className="w-4 h-4" /> : <SortDesc className="w-4 h-4" />}
          </button>
        </div>

        {/* View mode */}
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(124,58,237,0.1)' }}>
          <button onClick={() => setViewMode('grid')} className={cn('p-1.5 rounded-lg transition-all', viewMode === 'grid' ? 'text-violet-300 bg-violet-600/15' : 'text-gray-500 hover:text-gray-300')}>
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button onClick={() => setViewMode('list')} className={cn('p-1.5 rounded-lg transition-all', viewMode === 'list' ? 'text-violet-300 bg-violet-600/15' : 'text-gray-500 hover:text-gray-300')}>
            <List className="w-4 h-4" />
          </button>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {selectedIds.length > 0 && (
            <motion.button
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              onClick={() => { deleteItems(selectedIds); clearSelected() }}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-red-400 text-sm"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}
            >
              <Trash2 className="w-4 h-4" />
              Delete ({selectedIds.length})
            </motion.button>
          )}
          <motion.button
            onClick={() => setCreatingFolder(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-gray-300 text-sm hover:bg-white/5 transition-all"
            style={{ border: '1px solid rgba(124,58,237,0.2)' }}
            whileHover={{ scale: 1.02 }}
          >
            <FolderPlus className="w-4 h-4" />
            New folder
          </motion.button>
          <label className="cursor-pointer">
            <input type="file" className="hidden" multiple onChange={e => {
              if (e.target.files) onDrop(Array.from(e.target.files))
            }} />
            <motion.div
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-white text-sm cursor-pointer"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Upload className="w-4 h-4" />
              Upload
            </motion.div>
          </label>
        </div>
      </div>

      {/* Upload progress */}
      <AnimatePresence>
        {uploading && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden flex-shrink-0"
          >
            <div className="px-6 py-2 flex items-center gap-3" style={{ background: 'rgba(124,58,237,0.06)', borderBottom: '1px solid rgba(124,58,237,0.1)' }}>
              <Upload className="w-4 h-4 text-violet-400 animate-bounce" />
              <div className="flex-1 bg-gray-800 rounded-full h-1.5">
                <motion.div
                  className="h-1.5 rounded-full"
                  style={{ background: 'linear-gradient(90deg, #7c3aed, #a855f7)', width: `${uploadProgress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
              <span className="text-xs text-violet-300">{uploadProgress}%</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats bar */}
      <div className="px-6 py-2 flex items-center gap-4 text-xs text-gray-500 border-b flex-shrink-0" style={{ borderColor: 'rgba(124,58,237,0.07)' }}>
        <span>{sortedItems.length} items</span>
        {totalSize > 0 && <span>{formatFileSize(totalSize)} total</span>}
        {selectedIds.length > 0 && (
          <span className="text-violet-400">{selectedIds.length} selected</span>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* New folder input */}
        <AnimatePresence>
          {creatingFolder && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 p-3 rounded-xl mb-3"
              style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}
            >
              <Folder className="w-5 h-5 text-violet-400 flex-shrink-0" />
              <input
                type="text"
                value={newFolderName}
                onChange={e => setNewFolderName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleCreateFolder(); if (e.key === 'Escape') setCreatingFolder(false) }}
                placeholder="Folder name..."
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none"
                autoFocus
              />
              <button onClick={handleCreateFolder} className="p-1 rounded text-green-400 hover:bg-green-500/10"><Check className="w-4 h-4" /></button>
              <button onClick={() => setCreatingFolder(false)} className="p-1 rounded text-gray-500 hover:bg-white/5"><X className="w-4 h-4" /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {sortedItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }} className="text-6xl mb-4">
              {searchQuery ? '🔍' : '📂'}
            </motion.div>
            <p className="text-gray-400 text-lg font-medium mb-1">
              {searchQuery ? 'No files found' : 'This folder is empty'}
            </p>
            <p className="text-gray-600 text-sm">
              {searchQuery ? 'Try a different search term' : 'Upload files or create a folder to get started'}
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
            {sortedItems.map(item => (
              <FileGridItem
                key={item.id}
                item={item}
                isSelected={selectedIds.includes(item.id)}
                onSelect={() => toggleSelected(item.id)}
                onOpen={() => item.type === 'folder' && setCurrentFolder(item.id)}
                onContextMenu={e => handleContextMenu(e, item.id)}
                renaming={renaming === item.id}
                renameValue={renameValue}
                onRenameChange={setRenameValue}
                onRenameSubmit={() => handleRename(item.id)}
                onRenameCancel={() => setRenaming(null)}
              />
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {/* List header */}
            <div className="grid grid-cols-12 gap-4 px-3 py-1 text-xs text-gray-600 font-medium">
              <div className="col-span-5">Name</div>
              <div className="col-span-3">Modified</div>
              <div className="col-span-2">Size</div>
              <div className="col-span-2">Type</div>
            </div>
            {sortedItems.map(item => (
              <FileListItem
                key={item.id}
                item={item}
                isSelected={selectedIds.includes(item.id)}
                onSelect={() => toggleSelected(item.id)}
                onOpen={() => item.type === 'folder' && setCurrentFolder(item.id)}
                onContextMenu={e => handleContextMenu(e, item.id)}
                renaming={renaming === item.id}
                renameValue={renameValue}
                onRenameChange={setRenameValue}
                onRenameSubmit={() => handleRename(item.id)}
                onRenameCancel={() => setRenaming(null)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Context menu */}
      <AnimatePresence>
        {contextMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setContextMenu(null)} />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed z-50 w-44 rounded-xl overflow-hidden shadow-2xl"
              style={{
                top: contextMenu.y,
                left: contextMenu.x,
                background: '#0a0014',
                border: '1px solid rgba(124,58,237,0.2)',
              }}
            >
              {[
                {
                  label: 'Rename', icon: Pencil,
                  action: () => { setRenaming(contextMenu.id); setRenameValue(items.find(i => i.id === contextMenu.id)?.name || '') },
                },
                {
                  label: 'Delete', icon: Trash2,
                  action: () => { deleteItems([contextMenu.id]); clearSelected() },
                  danger: true,
                },
              ].map(({ label, icon: Icon, action, danger }) => (
                <button
                  key={label}
                  onClick={() => { action(); setContextMenu(null) }}
                  className={cn(
                    'w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-white/5 transition-colors',
                    danger ? 'text-red-400' : 'text-gray-300',
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}

// Grid item component
function FileGridItem({
  item, isSelected, onSelect, onOpen, onContextMenu,
  renaming, renameValue, onRenameChange, onRenameSubmit, onRenameCancel,
}: {
  item: FileItem
  isSelected: boolean
  onSelect: () => void
  onOpen: () => void
  onContextMenu: (e: React.MouseEvent) => void
  renaming: boolean
  renameValue: string
  onRenameChange: (v: string) => void
  onRenameSubmit: () => void
  onRenameCancel: () => void
}) {
  const Icon = getFileIcon(item.mimeType, item.name)
  const color = getFileColor(item.mimeType, item.name)

  return (
    <motion.div
      className={cn('group flex flex-col items-center p-3 rounded-2xl cursor-pointer transition-all', isSelected && 'ring-2 ring-violet-600/50')}
      style={{
        background: isSelected ? 'rgba(124,58,237,0.12)' : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isSelected ? 'rgba(124,58,237,0.3)' : 'rgba(255,255,255,0.05)'}`,
      }}
      onClick={e => { if (e.ctrlKey || e.metaKey) { onSelect() } else if (item.type === 'folder') onOpen() else onSelect() }}
      onDoubleClick={() => item.type === 'folder' && onOpen()}
      onContextMenu={onContextMenu}
      whileHover={{ scale: 1.03, y: -2 }}
      whileTap={{ scale: 0.98 }}
    >
      {/* Icon */}
      <div className="w-14 h-14 flex items-center justify-center mb-2 rounded-2xl flex-shrink-0 relative"
        style={{ background: item.type === 'folder' ? 'rgba(124,58,237,0.12)' : `${color}15` }}>
        {item.type === 'folder' ? (
          <Folder className="w-8 h-8" style={{ color: '#7c3aed' }} />
        ) : (
          <Icon className="w-8 h-8" style={{ color }} />
        )}
        {isSelected && (
          <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-violet-600 flex items-center justify-center">
            <Check className="w-2.5 h-2.5 text-white" />
          </div>
        )}
      </div>

      {/* Name */}
      {renaming ? (
        <input
          type="text"
          value={renameValue}
          onChange={e => onRenameChange(e.target.value)}
          onBlur={onRenameSubmit}
          onKeyDown={e => { if (e.key === 'Enter') onRenameSubmit(); if (e.key === 'Escape') onRenameCancel() }}
          className="w-full text-center bg-transparent text-xs text-white focus:outline-none border-b border-violet-600"
          autoFocus
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <p className="text-xs text-gray-300 text-center truncate w-full leading-tight">{item.name}</p>
      )}

      {item.size != null && (
        <p className="text-xs text-gray-600 mt-0.5">{formatFileSize(item.size)}</p>
      )}
    </motion.div>
  )
}

// List item component
function FileListItem({
  item, isSelected, onSelect, onOpen, onContextMenu,
  renaming, renameValue, onRenameChange, onRenameSubmit, onRenameCancel,
}: {
  item: FileItem
  isSelected: boolean
  onSelect: () => void
  onOpen: () => void
  onContextMenu: (e: React.MouseEvent) => void
  renaming: boolean
  renameValue: string
  onRenameChange: (v: string) => void
  onRenameSubmit: () => void
  onRenameCancel: () => void
}) {
  const Icon = getFileIcon(item.mimeType, item.name)
  const color = getFileColor(item.mimeType, item.name)

  return (
    <motion.div
      className={cn('grid grid-cols-12 gap-4 px-3 py-2.5 rounded-xl cursor-pointer group transition-all items-center', isSelected && 'bg-violet-600/8')}
      style={{
        background: isSelected ? 'rgba(124,58,237,0.08)' : undefined,
        border: `1px solid ${isSelected ? 'rgba(124,58,237,0.2)' : 'transparent'}`,
      }}
      onClick={e => { if (e.ctrlKey || e.metaKey) onSelect(); else if (item.type === 'folder') onOpen(); else onSelect() }}
      onDoubleClick={() => item.type === 'folder' && onOpen()}
      onContextMenu={onContextMenu}
      whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
    >
      <div className="col-span-5 flex items-center gap-3 min-w-0">
        <div className="w-8 h-8 flex items-center justify-center rounded-lg flex-shrink-0"
          style={{ background: item.type === 'folder' ? 'rgba(124,58,237,0.12)' : `${color}15` }}>
          {item.type === 'folder' ? <Folder className="w-4.5 h-4.5" style={{ color: '#7c3aed' }} /> : <Icon className="w-4.5 h-4.5" style={{ color }} />}
        </div>
        {renaming ? (
          <input
            type="text"
            value={renameValue}
            onChange={e => onRenameChange(e.target.value)}
            onBlur={onRenameSubmit}
            onKeyDown={e => { if (e.key === 'Enter') onRenameSubmit(); if (e.key === 'Escape') onRenameCancel() }}
            className="flex-1 bg-transparent text-sm text-white focus:outline-none border-b border-violet-600"
            autoFocus
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <span className="text-sm text-gray-200 truncate">{item.name}</span>
        )}
      </div>
      <div className="col-span-3 text-xs text-gray-500">{formatDate(item.updatedAt)}</div>
      <div className="col-span-2 text-xs text-gray-500">{item.size != null ? formatFileSize(item.size) : '—'}</div>
      <div className="col-span-2 text-xs text-gray-500 truncate">
        {item.type === 'folder' ? 'Folder' : (item.mimeType?.split('/')[1]?.toUpperCase() || item.name.split('.').pop()?.toUpperCase() || 'File')}
      </div>
    </motion.div>
  )
}
