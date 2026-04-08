import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from './utils'

export interface MindmapNode {
  id: string
  label: string
  x: number
  y: number
  parentId: string | null
  color?: string
  emoji?: string
  notes?: string
}

export interface Mindmap {
  id: string
  title: string
  nodes: MindmapNode[]
  createdAt: string
  updatedAt: string
}

interface MindmapState {
  mindmaps: Mindmap[]
  createMindmap: (title: string) => string
  deleteMindmap: (id: string) => void
  updateMindmapTitle: (id: string, title: string) => void
  addNode: (mapId: string, node: Omit<MindmapNode, 'id'>) => string
  updateNode: (mapId: string, nodeId: string, updates: Partial<MindmapNode>) => void
  deleteNode: (mapId: string, nodeId: string) => void
  moveNode: (mapId: string, nodeId: string, x: number, y: number) => void
}

export const useMindmapStore = create<MindmapState>()(
  persist(
    (set, get) => ({
      mindmaps: [],
      createMindmap: (title) => {
        const id = 'map-' + nanoid()
        const rootNode: MindmapNode = {
          id: 'node-root', label: title, x: 400, y: 300, parentId: null, color: '#7c3aed',
        }
        const mindmap: Mindmap = {
          id, title, nodes: [rootNode],
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        }
        set(state => ({ mindmaps: [...state.mindmaps, mindmap] }))
        return id
      },
      deleteMindmap: (id) => set(state => ({ mindmaps: state.mindmaps.filter(m => m.id !== id) })),
      updateMindmapTitle: (id, title) => set(state => ({
        mindmaps: state.mindmaps.map(m => m.id === id ? { ...m, title, updatedAt: new Date().toISOString() } : m),
      })),
      addNode: (mapId, nodeData) => {
        const id = 'node-' + nanoid()
        const node: MindmapNode = { ...nodeData, id }
        set(state => ({
          mindmaps: state.mindmaps.map(m =>
            m.id === mapId ? { ...m, nodes: [...m.nodes, node], updatedAt: new Date().toISOString() } : m
          ),
        }))
        return id
      },
      updateNode: (mapId, nodeId, updates) => set(state => ({
        mindmaps: state.mindmaps.map(m =>
          m.id === mapId
            ? { ...m, nodes: m.nodes.map(n => n.id === nodeId ? { ...n, ...updates } : n), updatedAt: new Date().toISOString() }
            : m
        ),
      })),
      deleteNode: (mapId, nodeId) => {
        const map = get().mindmaps.find(m => m.id === mapId)
        if (!map) return
        const getAllDescendants = (parentId: string): string[] => {
          const children = map.nodes.filter(n => n.parentId === parentId).map(n => n.id)
          return [parentId, ...children.flatMap(id => getAllDescendants(id))]
        }
        const toDelete = getAllDescendants(nodeId)
        set(state => ({
          mindmaps: state.mindmaps.map(m =>
            m.id === mapId
              ? { ...m, nodes: m.nodes.filter(n => !toDelete.includes(n.id)), updatedAt: new Date().toISOString() }
              : m
          ),
        }))
      },
      moveNode: (mapId, nodeId, x, y) => set(state => ({
        mindmaps: state.mindmaps.map(m =>
          m.id === mapId
            ? { ...m, nodes: m.nodes.map(n => n.id === nodeId ? { ...n, x, y } : n) }
            : m
        ),
      })),
    }),
    {
      name: 'bogdan-mindmaps',
    }
  )
)
