import { create } from 'zustand'
import { nanoid } from './utils'

export interface FileItem {
  id: string
  name: string
  type: 'folder' | 'file'
  mimeType?: string
  size?: number
  parentId: string | null
  url?: string
  createdAt: string
  updatedAt: string
  thumbnail?: string
}

interface FilesState {
  items: FileItem[]
  currentFolderId: string | null
  selectedIds: string[]
  viewMode: 'grid' | 'list'
  sortBy: 'name' | 'date' | 'size'
  sortDir: 'asc' | 'desc'
  uploading: boolean
  uploadProgress: number
  searchQuery: string
  setCurrentFolder: (id: string | null) => void
  toggleSelected: (id: string) => void
  clearSelected: () => void
  setViewMode: (mode: 'grid' | 'list') => void
  setSortBy: (by: 'name' | 'date' | 'size') => void
  setSortDir: (dir: 'asc' | 'desc') => void
  createFolder: (name: string, parentId?: string | null) => void
  deleteItems: (ids: string[]) => void
  renameItem: (id: string, name: string) => void
  addFile: (file: Omit<FileItem, 'id' | 'createdAt' | 'updatedAt'>) => void
  setSearchQuery: (q: string) => void
  setUploading: (uploading: boolean) => void
  setUploadProgress: (progress: number) => void
}

const defaultItems: FileItem[] = [
  { id: 'f-root-docs', name: 'Documents', type: 'folder', parentId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'f-root-photos', name: 'Photos', type: 'folder', parentId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'f-root-projects', name: 'Projects', type: 'folder', parentId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  { id: 'f-root-music', name: 'Music', type: 'folder', parentId: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  {
    id: 'f1', name: 'Resume_2024.pdf', type: 'file', mimeType: 'application/pdf',
    size: 245000, parentId: 'f-root-docs',
    createdAt: new Date(Date.now() - 86400000 * 5).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 5).toISOString(),
  },
  {
    id: 'f2', name: 'Project_Proposal.docx', type: 'file', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: 128000, parentId: 'f-root-docs',
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'f3', name: 'Budget_2024.xlsx', type: 'file', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    size: 89000, parentId: 'f-root-docs',
    createdAt: new Date(Date.now() - 86400000).toISOString(), updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 'f4', name: 'photo_vacation.jpg', type: 'file', mimeType: 'image/jpeg',
    size: 3200000, parentId: 'f-root-photos',
    createdAt: new Date(Date.now() - 86400000 * 10).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 10).toISOString(),
  },
  {
    id: 'f5', name: 'screenshot.png', type: 'file', mimeType: 'image/png',
    size: 890000, parentId: 'f-root-photos',
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 3).toISOString(),
  },
  {
    id: 'f6', name: 'lowkey-web', type: 'folder', parentId: 'f-root-projects',
    createdAt: new Date(Date.now() - 86400000 * 30).toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'f7', name: 'README.md', type: 'file', mimeType: 'text/markdown',
    size: 4500, parentId: 'f6',
    createdAt: new Date(Date.now() - 86400000 * 20).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
  },
  {
    id: 'f8', name: 'song.mp3', type: 'file', mimeType: 'audio/mpeg',
    size: 8500000, parentId: 'f-root-music',
    createdAt: new Date(Date.now() - 86400000 * 15).toISOString(), updatedAt: new Date(Date.now() - 86400000 * 15).toISOString(),
  },
]

export const useFilesStore = create<FilesState>((set, get) => ({
  items: defaultItems,
  currentFolderId: null,
  selectedIds: [],
  viewMode: 'grid',
  sortBy: 'name',
  sortDir: 'asc',
  uploading: false,
  uploadProgress: 0,
  searchQuery: '',
  setCurrentFolder: (id) => set({ currentFolderId: id, selectedIds: [] }),
  toggleSelected: (id) => set(state => ({
    selectedIds: state.selectedIds.includes(id)
      ? state.selectedIds.filter(i => i !== id)
      : [...state.selectedIds, id],
  })),
  clearSelected: () => set({ selectedIds: [] }),
  setViewMode: (mode) => set({ viewMode: mode }),
  setSortBy: (by) => set({ sortBy: by }),
  setSortDir: (dir) => set({ sortDir: dir }),
  createFolder: (name, parentId = null) => {
    const folder: FileItem = {
      id: 'f-' + nanoid(), name, type: 'folder',
      parentId: parentId !== undefined ? parentId : get().currentFolderId,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    }
    set(state => ({ items: [...state.items, folder] }))
  },
  deleteItems: (ids) => {
    const getAllDescendants = (parentIds: string[]): string[] => {
      const { items } = get()
      const children = items.filter(i => i.parentId && parentIds.includes(i.parentId)).map(i => i.id)
      if (children.length === 0) return parentIds
      return [...parentIds, ...getAllDescendants(children)]
    }
    const toDelete = getAllDescendants(ids)
    set(state => ({
      items: state.items.filter(i => !toDelete.includes(i.id)),
      selectedIds: state.selectedIds.filter(i => !toDelete.includes(i)),
    }))
  },
  renameItem: (id, name) => set(state => ({
    items: state.items.map(i => i.id === id ? { ...i, name, updatedAt: new Date().toISOString() } : i),
  })),
  addFile: (fileData) => {
    const file: FileItem = {
      ...fileData,
      id: 'f-' + nanoid(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    set(state => ({ items: [...state.items, file] }))
  },
  setSearchQuery: (q) => set({ searchQuery: q }),
  setUploading: (uploading) => set({ uploading }),
  setUploadProgress: (progress) => set({ uploadProgress: progress }),
}))
