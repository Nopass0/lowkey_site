'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'

export function useAuth(redirectTo?: string) {
  const router = useRouter()
  const { token, user, logout } = useAuthStore()

  useEffect(() => {
    if (!token && redirectTo) {
      router.replace(redirectTo)
    }
  }, [token, redirectTo, router])

  return { isAuthenticated: !!token, user, token, logout }
}

export function useRequireAuth() {
  return useAuth('/auth')
}
