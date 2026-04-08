'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Plus, GitBranch, Trash2, Calendar, ArrowRight } from 'lucide-react'
import { useMindmapStore } from '@/store/mindmap-store'
import { useRouter } from 'next/navigation'
import { formatDate } from '@/lib/utils'

export default function MindmapListPage() {
  const router = useRouter()
  const { mindmaps, createMindmap, deleteMindmap } = useMindmapStore()
  const [newTitle, setNewTitle] = useState('')
  const [creating, setCreating] = useState(false)

  const handleCreate = () => {
    if (!newTitle.trim()) return
    const id = createMindmap(newTitle.trim())
    setNewTitle('')
    setCreating(false)
    router.push(`/mindmap/${id}`)
  }

  return (
    <div className="h-full overflow-auto bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <span className="text-3xl emoji-bounce">🗺️</span>
              Mind Maps
            </h1>
            <p className="text-gray-400 mt-1">{mindmaps.length} maps created</p>
          </div>
          <motion.button
            onClick={() => setCreating(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-white font-medium"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Plus className="w-5 h-5" />
            New Map
          </motion.button>
        </div>

        {/* Create form */}
        {creating && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-4 mb-6 flex gap-3"
          >
            <input
              type="text"
              value={newTitle}
              onChange={e => setNewTitle(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') setCreating(false) }}
              placeholder="Map title..."
              className="flex-1 bg-gray-900/80 border border-gray-700/50 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-violet-600/60"
              autoFocus
            />
            <button onClick={handleCreate} className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-500 transition-colors">
              Create
            </button>
            <button onClick={() => setCreating(false)} className="px-4 py-2 rounded-lg text-gray-400 hover:text-white transition-colors">
              Cancel
            </button>
          </motion.div>
        )}

        {/* Grid of maps */}
        {mindmaps.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <motion.div
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="text-7xl mb-6"
            >
              🗺️
            </motion.div>
            <h2 className="text-xl font-semibold text-gray-300 mb-2">No mind maps yet</h2>
            <p className="text-gray-500 mb-6">Create your first mind map to visually organize ideas</p>
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-white font-medium"
              style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            >
              <Plus className="w-5 h-5" />
              Create Mind Map
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {mindmaps.map((map, i) => (
              <motion.div
                key={map.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="glass rounded-xl p-5 cursor-pointer group hover:border-violet-600/30 transition-all"
                onClick={() => router.push(`/mindmap/${map.id}`)}
                whileHover={{ scale: 1.02, y: -2 }}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)' }}>
                    <GitBranch className="w-6 h-6 text-violet-400" />
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); deleteMindmap(map.id) }}
                    className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <h3 className="text-white font-semibold mb-1 group-hover:text-violet-300 transition-colors">{map.title}</h3>
                <p className="text-gray-500 text-sm mb-4">{map.nodes.length} nodes</p>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-gray-500 text-xs">
                    <Calendar className="w-3.5 h-3.5" />
                    {formatDate(map.updatedAt)}
                  </div>
                  <ArrowRight className="w-4 h-4 text-violet-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
