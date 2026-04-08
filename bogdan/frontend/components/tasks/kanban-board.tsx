'use client'

import { useState } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, Search, Filter, X, MoreHorizontal, Pencil, Trash2 } from 'lucide-react'
import { useTasksStore, type Task, type Column, type TaskPriority } from '@/store/tasks-store'
import { TaskCard } from './task-card'
import { cn } from '@/lib/utils'

const PRIORITY_OPTIONS: TaskPriority[] = ['low', 'medium', 'high', 'urgent']
const PRIORITY_LABELS = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' }

export function KanbanBoard() {
  const {
    boards, tasks, activeBoardId, searchQuery, filterPriority,
    addTask, moveTask, addColumn, deleteColumn, updateColumn,
    setSearchQuery, setFilterPriority,
  } = useTasksStore()

  const board = boards.find(b => b.id === activeBoardId)
  const columns = board?.columns.sort((a, b) => a.order - b.order) || []

  const [newTaskColumn, setNewTaskColumn] = useState<string | null>(null)
  const [newTaskTitle, setNewTaskTitle] = useState('')
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [addingColumn, setAddingColumn] = useState(false)
  const [editingColumn, setEditingColumn] = useState<string | null>(null)
  const [editColumnTitle, setEditColumnTitle] = useState('')

  const getColumnTasks = (colId: string) => {
    let col = tasks.filter(t => t.columnId === colId)
    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      col = col.filter(t => t.title.toLowerCase().includes(q) || t.description?.toLowerCase().includes(q))
    }
    if (filterPriority) {
      col = col.filter(t => t.priority === filterPriority)
    }
    return col.sort((a, b) => a.order - b.order)
  }

  const handleDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result
    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return
    moveTask(draggableId, destination.droppableId, destination.index)
  }

  const handleAddTask = (colId: string) => {
    if (!newTaskTitle.trim()) {
      setNewTaskColumn(null)
      return
    }
    addTask({
      title: newTaskTitle.trim(),
      priority: 'medium',
      labels: [],
      columnId: colId,
      order: getColumnTasks(colId).length,
    })
    setNewTaskTitle('')
    setNewTaskColumn(null)
  }

  const handleAddColumn = () => {
    if (!newColumnTitle.trim()) return
    addColumn(activeBoardId, {
      title: newColumnTitle.trim(),
      color: '#6b7280',
      order: columns.length,
    })
    setNewColumnTitle('')
    setAddingColumn(false)
  }

  const totalTasks = tasks.filter(t => boards.find(b => b.id === activeBoardId)?.columns.some(c => c.id === t.columnId)).length

  return (
    <div className="h-full flex flex-col" style={{ background: '#030712' }}>
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b flex-shrink-0" style={{ borderColor: 'rgba(124,58,237,0.1)' }}>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-2xl">✅</span>
            {board?.title || 'Tasks'}
          </h1>
          <p className="text-gray-500 text-sm mt-0.5">{totalTasks} tasks total</p>
        </div>

        <div className="flex items-center gap-3 ml-auto">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-48 pl-9 pr-3 py-2 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-violet-600/40"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(124,58,237,0.15)' }}
            />
          </div>

          {/* Priority filter */}
          <div className="relative">
            <select
              value={filterPriority || ''}
              onChange={e => setFilterPriority((e.target.value as TaskPriority) || null)}
              className="pl-9 pr-3 py-2 rounded-xl text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-violet-600/40 cursor-pointer"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(124,58,237,0.15)' }}
            >
              <option value="">All priorities</option>
              {PRIORITY_OPTIONS.map(p => (
                <option key={p} value={p}>{PRIORITY_LABELS[p]}</option>
              ))}
            </select>
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 p-6 h-full min-w-max">
            {columns.map(col => {
              const colTasks = getColumnTasks(col.id)
              return (
                <div key={col.id} className="flex flex-col w-72 flex-shrink-0 max-h-full">
                  {/* Column header */}
                  <div className="flex items-center justify-between mb-3 px-1">
                    {editingColumn === col.id ? (
                      <input
                        type="text"
                        value={editColumnTitle}
                        onChange={e => setEditColumnTitle(e.target.value)}
                        onBlur={() => { updateColumn(col.id, { title: editColumnTitle }); setEditingColumn(null) }}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { updateColumn(col.id, { title: editColumnTitle }); setEditingColumn(null) }
                          if (e.key === 'Escape') setEditingColumn(null)
                        }}
                        className="flex-1 bg-transparent border-b border-violet-600 text-white text-sm font-semibold focus:outline-none"
                        autoFocus
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: col.color }} />
                        <span className="text-sm font-semibold text-white">{col.title}</span>
                        <span className="text-xs text-gray-500 bg-gray-800 rounded-full px-2 py-0.5">{colTasks.length}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => { setNewTaskColumn(col.id); setNewTaskTitle('') }}
                        className="p-1 rounded-lg text-gray-500 hover:text-violet-400 hover:bg-violet-600/10 transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => { setEditingColumn(col.id); setEditColumnTitle(col.title) }}
                        className="p-1 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteColumn(col.id)}
                        className="p-1 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Droppable column */}
                  <Droppable droppableId={col.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="flex-1 overflow-y-auto rounded-2xl p-2 min-h-24 transition-colors space-y-2"
                        style={{
                          background: snapshot.isDraggingOver
                            ? 'rgba(124,58,237,0.06)'
                            : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${snapshot.isDraggingOver ? 'rgba(124,58,237,0.25)' : 'rgba(255,255,255,0.04)'}`,
                        }}
                      >
                        {colTasks.map((task, index) => (
                          <Draggable key={task.id} draggableId={task.id} index={index}>
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                style={provided.draggableProps.style}
                              >
                                <TaskCard task={task} isDragging={snapshot.isDragging} />
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}

                        {/* New task input */}
                        <AnimatePresence>
                          {newTaskColumn === col.id && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              className="overflow-hidden"
                            >
                              <div className="p-3 rounded-xl" style={{ background: 'rgba(124,58,237,0.08)', border: '1px solid rgba(124,58,237,0.2)' }}>
                                <input
                                  type="text"
                                  value={newTaskTitle}
                                  onChange={e => setNewTaskTitle(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') handleAddTask(col.id)
                                    if (e.key === 'Escape') { setNewTaskColumn(null); setNewTaskTitle('') }
                                  }}
                                  placeholder="Task title..."
                                  className="w-full bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none mb-2"
                                  autoFocus
                                />
                                <div className="flex gap-2">
                                  <button
                                    onClick={() => handleAddTask(col.id)}
                                    className="px-3 py-1 rounded-lg text-xs text-white font-medium"
                                    style={{ background: '#7c3aed' }}
                                  >
                                    Add task
                                  </button>
                                  <button
                                    onClick={() => { setNewTaskColumn(null); setNewTaskTitle('') }}
                                    className="p-1 rounded-lg text-gray-500 hover:text-gray-300"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        {/* Add task button */}
                        {newTaskColumn !== col.id && (
                          <button
                            onClick={() => { setNewTaskColumn(col.id); setNewTaskTitle('') }}
                            className="w-full flex items-center gap-2 p-2 rounded-xl text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all text-sm"
                          >
                            <Plus className="w-4 h-4" />
                            Add task
                          </button>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              )
            })}

            {/* Add column */}
            <div className="flex-shrink-0 w-72">
              {addingColumn ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-4 rounded-2xl"
                  style={{ background: 'rgba(124,58,237,0.06)', border: '1px solid rgba(124,58,237,0.2)' }}
                >
                  <input
                    type="text"
                    value={newColumnTitle}
                    onChange={e => setNewColumnTitle(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddColumn()
                      if (e.key === 'Escape') setAddingColumn(false)
                    }}
                    placeholder="Column name..."
                    className="w-full bg-transparent text-sm text-white placeholder-gray-500 focus:outline-none mb-3"
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={handleAddColumn}
                      className="px-3 py-1.5 rounded-lg text-xs text-white font-medium"
                      style={{ background: '#7c3aed' }}
                    >
                      Add column
                    </button>
                    <button
                      onClick={() => setAddingColumn(false)}
                      className="p-1.5 rounded-lg text-gray-500 hover:text-gray-300"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              ) : (
                <button
                  onClick={() => setAddingColumn(true)}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-gray-500 hover:text-gray-300 transition-all text-sm border border-dashed"
                  style={{ borderColor: 'rgba(124,58,237,0.2)', background: 'rgba(124,58,237,0.03)' }}
                >
                  <Plus className="w-5 h-5" />
                  Add column
                </button>
              )}
            </div>
          </div>
        </DragDropContext>
      </div>
    </div>
  )
}
