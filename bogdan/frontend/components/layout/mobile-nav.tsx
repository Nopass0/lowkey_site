'use client'

import { useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, CheckSquare, FileText, FolderOpen, Bot, GitBranch, LogOut, X, Shield } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import { useMailStore } from '@/store/mail-store'
import { cn, getInitials } from '@/lib/utils'

const NAV_ITEMS = [
  { href: '/mail', icon: Mail, label: 'Mail', emoji: '📧' },
  { href: '/tasks', icon: CheckSquare, label: 'Tasks', emoji: '✅' },
  { href: '/notes', icon: FileText, label: 'Notes', emoji: '📝' },
  { href: '/files', icon: FolderOpen, label: 'Files', emoji: '📁' },
  { href: '/ai', icon: Bot, label: 'AI', emoji: '🤖' },
  { href: '/mindmap', icon: GitBranch, label: 'Maps', emoji: '🗺️' },
]

export function MobileNav() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const { accounts } = useMailStore()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const totalUnread = accounts.reduce((sum, a) => sum + a.unread, 0)

  // Show 4 main items in bottom bar, rest in drawer
  const mainItems = NAV_ITEMS.slice(0, 4)

  const handleNavigate = (href: string) => {
    router.push(href)
    setDrawerOpen(false)
  }

  const handleLogout = () => {
    logout()
    router.replace('/auth')
  }

  return (
    <>
      {/* Bottom bar */}
      <div
        className="flex items-center justify-around px-2 py-2 safe-bottom"
        style={{
          background: 'rgba(7,0,18,0.95)',
          borderTop: '1px solid rgba(124,58,237,0.15)',
          backdropFilter: 'blur(12px)',
        }}
      >
        {mainItems.map(({ href, icon: Icon, label, emoji }) => {
          const isActive = pathname.startsWith(href)
          const showBadge = href === '/mail' && totalUnread > 0
          return (
            <button
              key={href}
              onClick={() => handleNavigate(href)}
              className="flex flex-col items-center gap-1 flex-1 py-1 relative"
            >
              <div className="relative">
                {isActive ? (
                  <div className="w-10 h-8 rounded-xl flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)' }}>
                    <span className="text-lg">{emoji}</span>
                  </div>
                ) : (
                  <Icon className="w-6 h-6" style={{ color: '#6b7280' }} />
                )}
                {showBadge && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-xs flex items-center justify-center"
                    style={{ background: '#7c3aed', fontSize: '9px' }}>
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </span>
                )}
              </div>
              <span className="text-xs" style={{ color: isActive ? '#a78bfa' : '#4b5563' }}>{label}</span>
            </button>
          )
        })}

        {/* More button */}
        <button
          onClick={() => setDrawerOpen(true)}
          className="flex flex-col items-center gap-1 flex-1 py-1"
        >
          <div className="w-6 h-6 flex flex-col gap-1 justify-center">
            <div className="h-0.5 w-4 mx-auto rounded-full bg-gray-500" />
            <div className="h-0.5 w-3 mx-auto rounded-full bg-gray-500" />
            <div className="h-0.5 w-4 mx-auto rounded-full bg-gray-500" />
          </div>
          <span className="text-xs text-gray-500">More</span>
        </button>
      </div>

      {/* Drawer overlay */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40"
              style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => setDrawerOpen(false)}
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl overflow-hidden"
              style={{ background: '#0a0014', border: '1px solid rgba(124,58,237,0.2)' }}
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-2">
                <div className="w-10 h-1 rounded-full bg-gray-700" />
              </div>

              {/* Header */}
              <div className="flex items-center justify-between px-5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
                    <Shield className="w-4 h-4 text-white" />
                  </div>
                  <span className="font-semibold text-white">Bogdan Workspace</span>
                </div>
                <button onClick={() => setDrawerOpen(false)} className="p-2 rounded-lg text-gray-500 hover:text-gray-300">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* All nav items grid */}
              <div className="grid grid-cols-3 gap-3 px-5 pb-4">
                {NAV_ITEMS.map(({ href, icon: Icon, label, emoji }) => {
                  const isActive = pathname.startsWith(href)
                  return (
                    <motion.button
                      key={href}
                      onClick={() => handleNavigate(href)}
                      className="flex flex-col items-center gap-2 py-4 rounded-2xl transition-all"
                      style={{
                        background: isActive ? 'rgba(124,58,237,0.15)' : 'rgba(255,255,255,0.03)',
                        border: isActive ? '1px solid rgba(124,58,237,0.3)' : '1px solid rgba(255,255,255,0.05)',
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <span className="text-2xl">{emoji}</span>
                      <span className="text-xs font-medium" style={{ color: isActive ? '#a78bfa' : '#9ca3af' }}>{label}</span>
                    </motion.button>
                  )
                })}
              </div>

              {/* Divider */}
              <div className="mx-5 border-t mb-4" style={{ borderColor: 'rgba(124,58,237,0.1)' }} />

              {/* User section */}
              <div className="px-5 pb-6">
                <div className="flex items-center gap-3 p-3 rounded-2xl mb-3" style={{ background: 'rgba(255,255,255,0.03)' }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
                    {user?.name ? getInitials(user.name) : 'B'}
                  </div>
                  <div className="flex-1">
                    <div className="text-sm font-medium text-white">{user?.name || 'Bogdan'}</div>
                    <div className="text-xs text-gray-500">@{user?.telegram || 'bogdan'}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="p-2 rounded-xl text-gray-500 hover:text-red-400 hover:bg-red-500/10 transition-all"
                  >
                    <LogOut className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
