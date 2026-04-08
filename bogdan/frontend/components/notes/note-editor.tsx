'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Eye, Edit3, Save, Check } from 'lucide-react'
import { useNotesStore, type NoteItem } from '@/store/notes-store'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import dynamic from 'next/dynamic'
import { cn } from '@/lib/utils'

// Dynamically import the MD editor to avoid SSR issues
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false })

interface NoteEditorProps {
  note: NoteItem
}

export function NoteEditor({ note }: NoteEditorProps) {
  const { updateNote, autoSave } = useNotesStore()
  const [content, setContent] = useState(note.content)
  const [mode, setMode] = useState<'edit' | 'preview' | 'split'>('edit')
  const [saved, setSaved] = useState(true)
  const [saveTimeout, setSaveTimeout] = useState<ReturnType<typeof setTimeout> | null>(null)

  // Reset content when note changes
  useEffect(() => {
    setContent(note.content)
    setSaved(true)
  }, [note.id, note.content])

  const handleChange = useCallback((value: string | undefined) => {
    const v = value || ''
    setContent(v)
    setSaved(false)
    if (saveTimeout) clearTimeout(saveTimeout)
    const t = setTimeout(() => {
      updateNote(note.id, { content: v })
      setSaved(true)
    }, 1200)
    setSaveTimeout(t)
  }, [note.id, saveTimeout, updateNote])

  const handleManualSave = () => {
    updateNote(note.id, { content })
    setSaved(true)
    if (saveTimeout) clearTimeout(saveTimeout)
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b flex-shrink-0" style={{ borderColor: 'rgba(124,58,237,0.1)', background: 'rgba(5,0,16,0.5)' }}>
        <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(124,58,237,0.1)' }}>
          {[
            { id: 'edit', label: 'Edit', icon: Edit3 },
            { id: 'split', label: 'Split', icon: null },
            { id: 'preview', label: 'Preview', icon: Eye },
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setMode(id as any)}
              className={cn(
                'px-3 py-1 rounded-lg text-xs font-medium transition-all',
                mode === id ? 'text-violet-300' : 'text-gray-500 hover:text-gray-300',
              )}
              style={mode === id ? { background: 'rgba(124,58,237,0.15)' } : {}}
            >
              {Icon ? <span className="flex items-center gap-1"><Icon className="w-3.5 h-3.5" />{label}</span> : label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-2">
          <motion.button
            onClick={handleManualSave}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs transition-all"
            style={{
              background: saved ? 'rgba(34,197,94,0.1)' : 'rgba(124,58,237,0.12)',
              color: saved ? '#22c55e' : '#a78bfa',
              border: `1px solid ${saved ? 'rgba(34,197,94,0.2)' : 'rgba(124,58,237,0.2)'}`,
            }}
          >
            {saved ? <Check className="w-3 h-3" /> : <Save className="w-3 h-3" />}
            {saved ? 'Saved' : 'Save'}
          </motion.button>
        </div>
      </div>

      {/* Editor */}
      <div className="flex-1 overflow-hidden flex" data-color-mode="dark">
        {mode === 'preview' ? (
          <div className="flex-1 overflow-y-auto px-8 py-6 max-w-4xl mx-auto w-full">
            <div className="prose prose-invert prose-sm max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ children }) => <h1 className="text-2xl font-bold text-white mb-4 border-b border-violet-600/20 pb-2">{children}</h1>,
                  h2: ({ children }) => <h2 className="text-xl font-semibold text-gray-100 mb-3 mt-6">{children}</h2>,
                  h3: ({ children }) => <h3 className="text-lg font-semibold text-gray-200 mb-2 mt-4">{children}</h3>,
                  p: ({ children }) => <p className="text-gray-300 mb-3 leading-7">{children}</p>,
                  ul: ({ children }) => <ul className="text-gray-300 mb-3 space-y-1 list-disc list-inside">{children}</ul>,
                  ol: ({ children }) => <ol className="text-gray-300 mb-3 space-y-1 list-decimal list-inside">{children}</ol>,
                  li: ({ children }) => <li className="text-gray-300">{children}</li>,
                  blockquote: ({ children }) => (
                    <blockquote className="border-l-2 border-violet-600 pl-4 my-3 text-gray-400 italic">{children}</blockquote>
                  ),
                  code: ({ children, className }) => {
                    const isBlock = className?.startsWith('language-')
                    if (isBlock) {
                      return (
                        <pre className="rounded-xl overflow-x-auto p-4 my-3" style={{ background: '#0d0117', border: '1px solid rgba(124,58,237,0.2)' }}>
                          <code className="text-sm text-gray-200 font-mono">{children}</code>
                        </pre>
                      )
                    }
                    return <code className="text-violet-300 bg-violet-600/10 px-1.5 py-0.5 rounded text-sm font-mono">{children}</code>
                  },
                  table: ({ children }) => (
                    <div className="overflow-x-auto my-3">
                      <table className="w-full text-sm">{children}</table>
                    </div>
                  ),
                  th: ({ children }) => <th className="text-left text-violet-300 font-semibold py-2 px-3 border-b border-violet-600/20">{children}</th>,
                  td: ({ children }) => <td className="text-gray-300 py-2 px-3 border-b border-gray-800">{children}</td>,
                  a: ({ href, children }) => <a href={href} className="text-violet-400 hover:text-violet-300 underline transition-colors">{children}</a>,
                  strong: ({ children }) => <strong className="text-white font-semibold">{children}</strong>,
                  em: ({ children }) => <em className="text-gray-200">{children}</em>,
                  hr: () => <hr className="border-violet-600/20 my-6" />,
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          </div>
        ) : mode === 'split' ? (
          <div className="flex-1 flex overflow-hidden">
            <div className="flex-1 overflow-hidden" data-color-mode="dark">
              <MDEditor
                value={content}
                onChange={handleChange}
                preview="edit"
                height="100%"
                visibleDragbar={false}
                style={{ background: 'transparent' }}
              />
            </div>
            <div className="w-px bg-violet-600/20" />
            <div className="flex-1 overflow-y-auto px-6 py-4">
              <div className="prose prose-invert prose-sm max-w-none">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden" data-color-mode="dark">
            <MDEditor
              value={content}
              onChange={handleChange}
              preview="edit"
              height="100%"
              visibleDragbar={false}
            />
          </div>
        )}
      </div>
    </div>
  )
}
