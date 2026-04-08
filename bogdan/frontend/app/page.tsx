'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/store/auth-store'

export default function RootPage() {
  const router = useRouter()
  const { token } = useAuthStore()

  useEffect(() => {
    if (token) {
      router.replace('/mail')
    } else {
      router.replace('/auth')
    }
  }, [token, router])

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-950">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-full border-2 border-violet-600 border-t-transparent animate-spin" />
        <p className="text-gray-400 text-sm">Loading workspace...</p>
      </div>
    </div>
  )
}
