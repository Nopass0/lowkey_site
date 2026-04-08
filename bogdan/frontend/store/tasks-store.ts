import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { nanoid } from './utils'

export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TaskLabel = { id: string; name: string; color: string }

export interface Task {
  id: string
  title: string
  description?: string
  priority: TaskPriority
  labels: TaskLabel[]
  dueDate?: string
  assignee?: string
  columnId: string
  order: number
  createdAt: string
  updatedAt: string
}

export interface Column {
  id: string
  title: string
  color: string
  order: number
  limit?: number
}

export interface Board {
  id: string
  title: string
  columns: Column[]
}

interface TasksState {
  boards: Board[]
  tasks: Task[]
  activeBoardId: string
  searchQuery: string
  filterPriority: TaskPriority | null
  addTask: (task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>) => string
  updateTask: (id: string, updates: Partial<Task>) => void
  deleteTask: (id: string) => void
  moveTask: (taskId: string, targetColumnId: string, order: number) => void
  addColumn: (boardId: string, column: Omit<Column, 'id'>) => void
  updateColumn: (id: string, updates: Partial<Column>) => void
  deleteColumn: (id: string) => void
  setActiveBoardId: (id: string) => void
  setSearchQuery: (q: string) => void
  setFilterPriority: (p: TaskPriority | null) => void
}

const defaultBoards: Board[] = [
  {
    id: 'board-1',
    title: 'Main Board',
    columns: [
      { id: 'col-todo', title: 'To Do', color: '#6b7280', order: 0 },
      { id: 'col-inprogress', title: 'In Progress', color: '#7c3aed', order: 1 },
      { id: 'col-review', title: 'In Review', color: '#d97706', order: 2 },
      { id: 'col-done', title: 'Done', color: '#16a34a', order: 3 },
    ],
  },
]

const defaultTasks: Task[] = [
  {
    id: 't1', title: 'Set up authentication system', description: 'Implement Telegram OTP auth flow',
    priority: 'high', labels: [{ id: 'l1', name: 'Backend', color: '#7c3aed' }],
    columnId: 'col-done', order: 0,
    createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
  },
  {
    id: 't2', title: 'Design dashboard UI', description: 'Create beautiful dark theme workspace',
    priority: 'high', labels: [{ id: 'l2', name: 'Frontend', color: '#2563eb' }],
    columnId: 'col-inprogress', order: 0,
    createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
    updatedAt: new Date().toISOString(),
    dueDate: new Date(Date.now() + 86400000 * 2).toISOString(),
  },
  {
    id: 't3', title: 'Implement email client', description: 'Multi-account email with compose modal',
    priority: 'medium', labels: [{ id: 'l2', name: 'Frontend', color: '#2563eb' }],
    columnId: 'col-inprogress', order: 1,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 't4', title: 'Add file manager', description: 'Cloud file storage with drag & drop',
    priority: 'medium', labels: [{ id: 'l2', name: 'Frontend', color: '#2563eb' }],
    columnId: 'col-todo', order: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    dueDate: new Date(Date.now() + 86400000 * 7).toISOString(),
  },
  {
    id: 't5', title: 'Integrate BitNet AI', description: 'Chat interface with streaming responses',
    priority: 'low', labels: [{ id: 'l3', name: 'AI', color: '#16a34a' }],
    columnId: 'col-todo', order: 1,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
  {
    id: 't6', title: 'Write documentation', priority: 'low', labels: [],
    columnId: 'col-todo', order: 2,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  },
]

export const useTasksStore = create<TasksState>()(
  persist(
    (set, get) => ({
      boards: defaultBoards,
      tasks: defaultTasks,
      activeBoardId: 'board-1',
      searchQuery: '',
      filterPriority: null,
      addTask: (taskData) => {
        const id = nanoid()
        const task: Task = {
          ...taskData,
          id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set(state => ({ tasks: [...state.tasks, task] }))
        return id
      },
      updateTask: (id, updates) => set(state => ({
        tasks: state.tasks.map(t => t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t),
      })),
      deleteTask: (id) => set(state => ({ tasks: state.tasks.filter(t => t.id !== id) })),
      moveTask: (taskId, targetColumnId, order) => set(state => ({
        tasks: state.tasks.map(t => t.id === taskId ? { ...t, columnId: targetColumnId, order } : t),
      })),
      addColumn: (boardId, columnData) => {
        const id = nanoid()
        set(state => ({
          boards: state.boards.map(b =>
            b.id === boardId ? { ...b, columns: [...b.columns, { ...columnData, id }] } : b
          ),
        }))
      },
      updateColumn: (id, updates) => set(state => ({
        boards: state.boards.map(b => ({
          ...b,
          columns: b.columns.map(c => c.id === id ? { ...c, ...updates } : c),
        })),
      })),
      deleteColumn: (id) => set(state => ({
        boards: state.boards.map(b => ({
          ...b,
          columns: b.columns.filter(c => c.id !== id),
        })),
        tasks: state.tasks.filter(t => t.columnId !== id),
      })),
      setActiveBoardId: (id) => set({ activeBoardId: id }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setFilterPriority: (p) => set({ filterPriority: p }),
    }),
    {
      name: 'bogdan-tasks',
    }
  )
)
