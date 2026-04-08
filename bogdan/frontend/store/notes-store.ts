import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from './utils'

export interface NoteItem {
  id: string
  title: string
  content: string
  parentId: string | null
  type: 'folder' | 'note'
  createdAt: string
  updatedAt: string
  icon?: string
}

interface NotesState {
  items: NoteItem[]
  selectedId: string | null
  expandedFolders: string[]
  searchQuery: string
  autoSaveTimeout: ReturnType<typeof setTimeout> | null
  createNote: (parentId?: string | null, title?: string) => string
  createFolder: (parentId?: string | null, title?: string) => string
  updateNote: (id: string, updates: Partial<NoteItem>) => void
  deleteItem: (id: string) => void
  setSelectedId: (id: string | null) => void
  toggleFolder: (id: string) => void
  setSearchQuery: (q: string) => void
  autoSave: (id: string, content: string) => void
}

const defaultItems: NoteItem[] = [
  {
    id: 'folder-1', title: 'Work', content: '', parentId: null, type: 'folder',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), icon: '💼',
  },
  {
    id: 'folder-2', title: 'Personal', content: '', parentId: null, type: 'folder',
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), icon: '🏠',
  },
  {
    id: 'note-1', title: 'Welcome to Notes', parentId: null, type: 'note',
    content: `# Welcome to Notes 👋

This is your personal note editor. It supports **Markdown** syntax.

## Features

- **Rich markdown editing** with syntax highlighting
- **Auto-save** as you type
- **Folder organization** — create nested folders
- **Search** across all your notes
- **Keyboard shortcuts**

## Shortcuts

| Shortcut | Action |
|----------|--------|
| \`Ctrl+N\` | New note |
| \`Ctrl+S\` | Save |
| \`Ctrl+/\` | Toggle preview |

## Code Example

\`\`\`typescript
const greeting = (name: string) => {
  return \`Hello, \${name}!\`
}
console.log(greeting('Bogdan'))
\`\`\`

> Start writing your first note!
`,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
  {
    id: 'note-2', title: 'Project Ideas', parentId: 'folder-1', type: 'note',
    content: `# Project Ideas

## Active Projects

### Bogdan Workspace
Personal workspace with email, tasks, notes, files, AI, and mind maps.

## Future Ideas

- [ ] Mobile app version
- [ ] Collaboration features
- [ ] Plugin system
- [ ] Custom themes
`,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
  },
]

export const useNotesStore = create<NotesState>()(
  persist(
    (set, get) => ({
      items: defaultItems,
      selectedId: 'note-1',
      expandedFolders: ['folder-1', 'folder-2'],
      searchQuery: '',
      autoSaveTimeout: null,
      createNote: (parentId = null, title = 'Untitled') => {
        const id = 'note-' + nanoid()
        const note: NoteItem = {
          id, title, content: `# ${title}\n\n`, parentId, type: 'note',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        }
        set(state => ({ items: [...state.items, note], selectedId: id }))
        if (parentId) {
          set(state => ({
            expandedFolders: state.expandedFolders.includes(parentId)
              ? state.expandedFolders
              : [...state.expandedFolders, parentId],
          }))
        }
        return id
      },
      createFolder: (parentId = null, title = 'New Folder') => {
        const id = 'folder-' + nanoid()
        const folder: NoteItem = {
          id, title, content: '', parentId, type: 'folder',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        }
        set(state => ({ items: [...state.items, folder] }))
        return id
      },
      updateNote: (id, updates) => set(state => ({
        items: state.items.map(item =>
          item.id === id ? { ...item, ...updates, updatedAt: new Date().toISOString() } : item
        ),
      })),
      deleteItem: (id) => {
        const { items } = get()
        const getAllDescendants = (parentId: string): string[] => {
          const children = items.filter(i => i.parentId === parentId)
          return [parentId, ...children.flatMap(c => getAllDescendants(c.id))]
        }
        const toDelete = getAllDescendants(id)
        set(state => ({
          items: state.items.filter(i => !toDelete.includes(i.id)),
          selectedId: toDelete.includes(state.selectedId || '') ? null : state.selectedId,
        }))
      },
      setSelectedId: (id) => set({ selectedId: id }),
      toggleFolder: (id) => set(state => ({
        expandedFolders: state.expandedFolders.includes(id)
          ? state.expandedFolders.filter(f => f !== id)
          : [...state.expandedFolders, id],
      })),
      setSearchQuery: (q) => set({ searchQuery: q }),
      autoSave: (id, content) => {
        const state = get()
        if (state.autoSaveTimeout) clearTimeout(state.autoSaveTimeout)
        const timeout = setTimeout(() => {
          get().updateNote(id, { content })
        }, 1000)
        set({ autoSaveTimeout: timeout })
      },
    }),
    {
      name: 'bogdan-notes',
      partialize: (state) => ({ items: state.items, selectedId: state.selectedId, expandedFolders: state.expandedFolders }),
    }
  )
)
