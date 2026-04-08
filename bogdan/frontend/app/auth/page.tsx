'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Send, ArrowRight, RefreshCw, CheckCircle, AlertCircle, Shield } from 'lucide-react'
import { useAuthStore } from '@/store/auth-store'
import { apiClient } from '@/lib/api'

type AuthStep = 'telegram' | 'code' | 'success'

export default function AuthPage() {
  const router = useRouter()
  const { token, setAuth } = useAuthStore()
  const [step, setStep] = useState<AuthStep>('telegram')
  const [telegramInput, setTelegramInput] = useState('')
  const [code, setCode] = useState(['', '', '', '', '', ''])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState(0)
  const codeRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (token) router.replace('/mail')
  }, [token, router])

  useEffect(() => {
    if (countdown > 0) {
      const t = setTimeout(() => setCountdown(c => c - 1), 1000)
      return () => clearTimeout(t)
    }
  }, [countdown])

  const handleRequestCode = async () => {
    if (!telegramInput.trim()) {
      setError('Enter your Telegram username or ID')
      return
    }
    setLoading(true)
    setError('')
    try {
      await apiClient.post('/api/auth/telegram/request', {
        telegram: telegramInput.trim().replace('@', ''),
      })
      setStep('code')
      setCountdown(60)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Failed to send code. Check your Telegram username.')
    } finally {
      setLoading(false)
    }
  }

  const handleCodeChange = (index: number, value: string) => {
    if (value.length > 1) {
      const digits = value.replace(/\D/g, '').slice(0, 6)
      const newCode = [...code]
      digits.split('').forEach((d, i) => {
        if (index + i < 6) newCode[index + i] = d
      })
      setCode(newCode)
      const nextIndex = Math.min(index + digits.length, 5)
      codeRefs.current[nextIndex]?.focus()
      if (digits.length === 6 - index) {
        handleVerifyCode(newCode.join(''))
      }
      return
    }
    if (!/^\d*$/.test(value)) return
    const newCode = [...code]
    newCode[index] = value
    setCode(newCode)
    if (value && index < 5) {
      codeRefs.current[index + 1]?.focus()
    }
    if (newCode.every(d => d) && newCode.join('').length === 6) {
      handleVerifyCode(newCode.join(''))
    }
  }

  const handleCodeKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeRefs.current[index - 1]?.focus()
    }
  }

  const handleVerifyCode = async (fullCode?: string) => {
    const codeStr = fullCode || code.join('')
    if (codeStr.length !== 6) {
      setError('Enter the 6-digit code')
      return
    }
    setLoading(true)
    setError('')
    try {
      const res = await apiClient.post('/api/auth/telegram/verify', {
        telegram: telegramInput.trim().replace('@', ''),
        code: codeStr,
      })
      setStep('success')
      setTimeout(() => {
        setAuth(res.data.token, res.data.user)
        router.replace('/mail')
      }, 1500)
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Invalid code. Try again.')
      setCode(['', '', '', '', '', ''])
      codeRefs.current[0]?.focus()
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (countdown > 0) return
    setLoading(true)
    setError('')
    try {
      await apiClient.post('/api/auth/telegram/request', {
        telegram: telegramInput.trim().replace('@', ''),
      })
      setCountdown(60)
      setCode(['', '', '', '', '', ''])
    } catch (err: any) {
      setError('Failed to resend code.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-mesh flex items-center justify-center p-4 overflow-hidden">
      {/* Animated background orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-40 -right-40 w-96 h-96 rounded-full opacity-20"
          style={{ background: 'radial-gradient(circle, #7c3aed 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.2, 1], x: [0, 30, 0], y: [0, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full opacity-15"
          style={{ background: 'radial-gradient(circle, #a855f7 0%, transparent 70%)' }}
          animate={{ scale: [1, 1.3, 1], x: [0, -20, 0], y: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 w-64 h-64 rounded-full opacity-10"
          style={{ background: 'radial-gradient(circle, #6d28d9 0%, transparent 70%)', transform: 'translate(-50%, -50%)' }}
          animate={{ scale: [1, 1.5, 1] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Logo / Header */}
        <div className="text-center mb-10">
          <motion.div
            className="inline-flex items-center justify-center w-20 h-20 rounded-2xl mb-6 relative"
            style={{ background: 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
            animate={{ boxShadow: ['0 0 20px rgba(124,58,237,0.3)', '0 0 40px rgba(124,58,237,0.6)', '0 0 20px rgba(124,58,237,0.3)'] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Shield className="w-10 h-10 text-white" />
            <motion.div
              className="absolute inset-0 rounded-2xl"
              style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.1), transparent)' }}
            />
          </motion.div>
          <h1 className="text-3xl font-bold text-white mb-2">
            Bogdan
            <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #a78bfa, #7c3aed)' }}> Workspace</span>
          </h1>
          <p className="text-gray-400">Sign in with your Telegram account</p>
        </div>

        {/* Card */}
        <div className="glass rounded-2xl p-8 shadow-2xl">
          <AnimatePresence mode="wait">
            {step === 'telegram' && (
              <motion.div
                key="telegram"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)' }}>
                    <span className="text-xl emoji-bounce">✈️</span>
                  </div>
                  <div>
                    <h2 className="text-white font-semibold">Enter Telegram</h2>
                    <p className="text-gray-400 text-sm">We'll send a code to your bot</p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                      Telegram Username or ID
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 text-sm">@</span>
                      <input
                        type="text"
                        value={telegramInput}
                        onChange={e => { setTelegramInput(e.target.value); setError('') }}
                        onKeyDown={e => e.key === 'Enter' && handleRequestCode()}
                        placeholder="username or 123456789"
                        className="w-full bg-gray-900/80 border border-gray-700/50 rounded-xl pl-8 pr-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-violet-600/60 focus:ring-2 focus:ring-violet-600/20 transition-all"
                        autoComplete="off"
                        autoFocus
                      />
                    </div>
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2"
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </motion.div>
                  )}

                  <motion.button
                    onClick={handleRequestCode}
                    disabled={loading || !telegramInput.trim()}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: loading ? 'rgba(124,58,237,0.5)' : 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {loading ? (
                      <RefreshCw className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <Send className="w-5 h-5" />
                        Send Code
                        <ArrowRight className="w-5 h-5" />
                      </>
                    )}
                  </motion.button>
                </div>
              </motion.div>
            )}

            {step === 'code' && (
              <motion.div
                key="code"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
              >
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ background: 'rgba(124,58,237,0.15)' }}>
                    <span className="text-xl emoji-sparkle">🔑</span>
                  </div>
                  <div>
                    <h2 className="text-white font-semibold">Check Telegram</h2>
                    <p className="text-gray-400 text-sm">Enter the 6-digit code sent to @{telegramInput.replace('@', '')}</p>
                  </div>
                </div>

                <div className="space-y-6">
                  {/* Code input */}
                  <div className="flex gap-2 justify-center">
                    {code.map((digit, i) => (
                      <motion.input
                        key={i}
                        ref={el => { codeRefs.current[i] = el }}
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={digit}
                        onChange={e => handleCodeChange(i, e.target.value)}
                        onKeyDown={e => handleCodeKeyDown(i, e)}
                        className="w-12 h-14 text-center text-xl font-bold rounded-xl border transition-all focus:outline-none"
                        style={{
                          background: digit ? 'rgba(124,58,237,0.15)' : 'rgba(15,5,30,0.8)',
                          borderColor: digit ? 'rgba(124,58,237,0.6)' : 'rgba(100,80,140,0.3)',
                          color: digit ? '#a78bfa' : '#6b7280',
                          boxShadow: digit ? '0 0 10px rgba(124,58,237,0.2)' : 'none',
                        }}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.05 }}
                      />
                    ))}
                  </div>

                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 rounded-lg px-3 py-2"
                    >
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </motion.div>
                  )}

                  <motion.button
                    onClick={() => handleVerifyCode()}
                    disabled={loading || code.some(d => !d)}
                    className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{ background: loading ? 'rgba(124,58,237,0.5)' : 'linear-gradient(135deg, #7c3aed, #a855f7)' }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <>Verify Code <ArrowRight className="w-5 h-5" /></>}
                  </motion.button>

                  <div className="flex items-center justify-between text-sm">
                    <button
                      onClick={() => { setStep('telegram'); setCode(['','','','','','']); setError('') }}
                      className="text-gray-400 hover:text-gray-200 transition-colors"
                    >
                      ← Change username
                    </button>
                    <button
                      onClick={handleResend}
                      disabled={countdown > 0}
                      className="text-violet-400 hover:text-violet-300 transition-colors disabled:text-gray-500 disabled:cursor-not-allowed"
                    >
                      {countdown > 0 ? `Resend in ${countdown}s` : 'Resend code'}
                    </button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 'success' && (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: 'spring', duration: 0.5 }}
                className="text-center py-8"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', delay: 0.1 }}
                  className="inline-flex items-center justify-center w-20 h-20 rounded-full mb-4"
                  style={{ background: 'rgba(34,197,94,0.15)' }}
                >
                  <CheckCircle className="w-10 h-10 text-green-400" />
                </motion.div>
                <h2 className="text-xl font-bold text-white mb-2">Welcome back!</h2>
                <p className="text-gray-400">Redirecting to your workspace...</p>
                <div className="mt-4 flex justify-center">
                  <div className="w-8 h-1 bg-violet-600 rounded-full animate-pulse" />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-600 text-xs mt-6">
          bogdan.lowkey.su — Personal Workspace
        </p>
      </motion.div>
    </div>
  )
}
