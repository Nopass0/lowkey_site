'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Calendar, Tag, Pencil, Trash2, X, Check } from 'lucide-react'
import { useTasksStore, type Task } from '@/store/tasks-store'
import { cn, formatDate, PRIORITY_COLORS } from '@/lib/utils'

interface TaskCardProps {
  task: Task
  isDragging: boolean
}

export function TaskCard({ task, isDragging }: TaskCardProps) {
  const { updateTask, deleteTask } = useTasksStore()
  const [editing, setEditing] = useState(false)
  const [editTitle, setEditTitle] = useState(task.title)
  const [editDesc, setEditDesc] = useState(task.description || '')
  const [showMenu, setShowMenu] = useState(false)

  const priorityStyle = PRIORITY_COLORS[task.priority]

  const handleSave = () => {
    if (!editTitle.trim()) return
    updateTask(task.id, { title: editTitle.trim(), description: editDesc.trim() || undefined })
    setEditing(false)
  }

  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date()

  return (
    <motion.div
      layout
      className={cn(
        'rounded-xl p-3 cursor-grab active:cursor-grabbing group relative transition-all',
        isDragging ? 'shadow-2xl rotate-1 scale-105' : '',
      )}
      style={{
        background: isDragging ? 'rgba(20, 5, 40, 0.98)' : 'rgba(15, 5, 30, 0.9)',
        border: `1px solid ${isDragging ? 'rgba(124,58,237,0.4)' : 'rgba(124,58,237,0.12)'}`,
        boxShadow: isDragging ? '0 20px 40px rgba(124,58,237,0.2)' : '0 2px 8px rgba(0,0,0,0.3)',
      }}
      whileHover={{ boxShadow: '0 4px 16px rgba(124,58,237,0.1)' }}
    >
      {editing ? (
        <div>
          <input
            type="text"
            value={editTitle}
            onChange={e => setEditTitle(e.target.value)}
            className="w-full bg-transparent text-sm text-white focus:outline-none font-medium mb-2 border-b border-violet-600/40 pb-1"
            autoFocus
          />
          <textarea
            value={editDesc}
            onChange={e => setEditDesc(e.target.value)}
            placeholder="Description (optional)..."
            className="w-full bg-transparent text-xs text-gray-400 focus:outline-none resize-none mb-2 leading-5"
            rows={2}
          />
          <div className="flex gap-1.5">
            <button onClick={handleSave} className="p-1 rounded-lg bg-violet-600/20 text-violet-400 hover:bg-violet-600/30 transition-colors">
              <Check className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setEditing(false)} className="p-1 rounded-lg bg-gray-700/30 text-gray-400 hover:bg-gray-700/50 transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Priority badge */}
          <div className="flex items-start justify-between gap-2 mb-2">
            <span
              className="text-xs px-2 py-0.5 rounded-md font-medium flex-shrink-0"
              style={{ background: priorityStyle.bg, color: priorityStyle.text, border: `1px solid ${priorityStyle.border}` }}
            >
              {task.priority}
            </span>

            {/* Actions */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); setEditing(true) }}
                className="p-1 rounded-lg text-gray-500 hover:text-violet-400 hover:bg-violet-600/10 transition-all"
              >
                <Pencil className="w-3 h-3" />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); deleteTask(task.id) }}
                className="p-1 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Title */}
          <p className="text-sm text-white font-medium leading-snug mb-1.5">{task.title}</p>

          {/* Description */}
          {task.description && (
            <p className="text-xs text-gray-500 leading-4 mb-2 line-clamp-2">{task.description}</p>
          )}

          {/* Labels */}
          {task.labels.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {task.labels.map(label => (
                <span
                  key={label.id}
                  className="text-xs px-1.5 py-0.5 rounded-md"
                  style={{ background: `${label.color}20`, color: label.color, border: `1px solid ${label.color}40` }}
                >
                  {label.name}
                </span>
              ))}
            </div>
          )}

          {/* Footer */}
          {task.dueDate && (
            <div className={cn(
              'flex items-center gap-1 text-xs mt-1',
              isOverdue ? 'text-red-400' : 'text-gray-500',
            )}>
              <Calendar className="w-3 h-3" />
              <span>{formatDate(task.dueDate)}</span>
              {isOverdue && <span className="font-medium">· Overdue</span>}
            </div>
          )}
        </>
      )}
    </motion.div>
  )
}
