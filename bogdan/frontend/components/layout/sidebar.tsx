'use client'

import { usePathname, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail, CheckSquare, FileText, FolderOpen, Bot, GitBranch,
  LogOut, Settings, ChevronRight, Shield
} from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import { useMailStore } from '@/store/mail-store'
import { cn, getInitials } from '@/lib/utils'
import { useState } from 'react'

const NAV_ITEMS = [
  { href: '/mail', icon: Mail, label: 'Mail', emoji: '📧' },
  { href: '/tasks', icon: CheckSquare, label: 'Tasks', emoji: '✅' },
  { href: '/notes', icon: FileText, label: 'Notes', emoji: '📝' },
  { href: '/files', icon: FolderOpen, label: 'Files', emoji: '📁' },
  { href: '/ai', icon: Bot, label: 'BitNet AI', emoji: '🤖' },
  { href: '/mindmap', icon: GitBranch, label: 'Mind Maps', emoji: '🗺️' },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { user, logout } = useAuthStore()
  const { accounts } = useMailStore()
  const [collapsed, setCollapsed] = useState(false)

  const totalUnread = accounts.reduce((sum, a) => sum + a.unread, 0)

  const handleLogout = () => {
    logout()
    router.replace('/auth')
  }

  return (
    <motion.div
      className="h-full flex flex-col border-r"
      style={{ borderColor: 'rgba(124,58,237,0.15)', background: '#070012' }}
      animate={{ width: collapsed ? 72 : 220 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
    >
      {/* Logo */}
      <div className="flex items-center px-4 py-5 mb-2">
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
        >
          <Shield className="w-5 h-5 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.15 }}
              className="ml-3 overflow-hidden"
            >
              <div className="font-bold text-white text-sm leading-tight">Bogdan</div>
              <div className="text-xs" style={{ color: '#7c3aed' }}>Workspace</div>
            </motion.div>
          )}
        </AnimatePresence>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="ml-auto p-1 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-all flex-shrink-0"
        >
          <motion.div animate={{ rotate: collapsed ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronRight className="w-4 h-4" />
          </motion.div>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, label, emoji }) => {
          const isActive = pathname.startsWith(href)
          const showBadge = href === '/mail' && totalUnread > 0

          return (
            <motion.button
              key={href}
              onClick={() => router.push(href)}
              className={cn(
                'w-full flex items-center rounded-xl px-3 py-2.5 transition-all relative group',
                isActive
                  ? 'text-violet-300'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
              )}
              style={isActive ? {
                background: 'rgba(124,58,237,0.12)',
                borderRight: '2px solid #7c3aed',
              } : {}}
              whileHover={{ x: isActive ? 0 : 2 }}
              whileTap={{ scale: 0.98 }}
            >
              <div className="relative flex-shrink-0">
                {isActive ? (
                  <span className="text-lg">{emoji}</span>
                ) : (
                  <Icon className="w-5 h-5" />
                )}
                {showBadge && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-xs flex items-center justify-center"
                    style={{ background: '#7c3aed', fontSize: '10px' }}>
                    {totalUnread > 9 ? '9+' : totalUnread}
                  </span>
                )}
              </div>

              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, x: -5 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -5 }}
                    transition={{ duration: 0.15 }}
                    className="ml-3 text-sm font-medium whitespace-nowrap"
                  >
                    {label}
                  </motion.span>
                )}
              </AnimatePresence>

              {/* Tooltip when collapsed */}
              {collapsed && (
                <div className="absolute left-full ml-2 px-2 py-1 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity"
                  style={{ background: '#1a0533', border: '1px solid rgba(124,58,237,0.3)' }}>
                  {label}
                </div>
              )}
            </motion.button>
          )
        })}
      </nav>

      {/* Divider */}
      <div className="mx-3 my-2 border-t" style={{ borderColor: 'rgba(124,58,237,0.1)' }} />

      {/* Bottom area: user + settings */}
      <div className="px-2 pb-4 space-y-1">
        <button
          className="w-full flex items-center px-3 py-2.5 rounded-xl text-gray-400 hover:text-gray-200 hover:bg-white/5 transition-all group relative"
          onClick={() => {}}
        >
          <Settings className="w-5 h-5 flex-shrink-0" />
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="ml-3 text-sm font-medium"
              >
                Settings
              </motion.span>
            )}
          </AnimatePresence>
          {collapsed && (
            <div className="absolute left-full ml-2 px-2 py-1 rounded-lg text-xs text-white opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity"
              style={{ background: '#1a0533', border: '1px solid rgba(124,58,237,0.3)' }}>
              Settings
            </div>
          )}
        </button>

        {/* User */}
        <div className="flex items-center px-3 py-2.5 rounded-xl" style={{ background: 'rgba(124,58,237,0.05)' }}>
          <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold text-white"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}>
            {user?.name ? getInitials(user.name) : 'B'}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="ml-3 flex-1 min-w-0"
              >
                <div className="text-sm font-medium text-white truncate">{user?.name || 'Bogdan'}</div>
                <div className="text-xs text-gray-500 truncate">@{user?.telegram || 'bogdan'}</div>
              </motion.div>
            )}
          </AnimatePresence>
          {!collapsed && (
            <button
              onClick={handleLogout}
              className="p-1 rounded-lg text-gray-500 hover:text-red-400 transition-colors ml-1"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}
