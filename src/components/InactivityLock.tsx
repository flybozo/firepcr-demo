/**
 * InactivityLock — overlay that locks the app after a period of inactivity.
 * Does NOT sign the user out (preserves offline data).
 * User unlocks by re-entering their password.
 */

import { useEffect, useState, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

const INACTIVITY_MS = 30 * 60 * 1000 // 30 minutes
const EVENTS = ['mousedown', 'touchstart', 'keydown', 'scroll'] as const

export default function InactivityLock() {
  const [locked, setLocked] = useState(false)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [unlocking, setUnlocking] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const resetTimer = useCallback(() => {
    if (locked) return // don't reset while locked
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => setLocked(true), INACTIVITY_MS)
  }, [locked])

  useEffect(() => {
    // Start the timer
    resetTimer()

    // Listen for user activity
    const handler = () => resetTimer()
    for (const evt of EVENTS) {
      window.addEventListener(evt, handler, { passive: true })
    }

    return () => {
      clearTimeout(timerRef.current)
      for (const evt of EVENTS) {
        window.removeEventListener(evt, handler)
      }
    }
  }, [resetTimer])

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password.trim()) return
    setUnlocking(true)
    setError('')

    try {
      const supabase = createClient()
      // Get the current user's email
      const { data: { user } } = await supabase.auth.getUser()
      if (!user?.email) {
        setError('Session expired. Please reload and sign in.')
        setUnlocking(false)
        return
      }

      // Re-authenticate with password
      const { error: authErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password,
      })

      if (authErr) {
        setError('Incorrect password')
        setPassword('')
        setUnlocking(false)
        return
      }

      // Success — unlock
      setLocked(false)
      setPassword('')
      setError('')
      resetTimer()
    } catch {
      setError('Unlock failed. Try again.')
    }
    setUnlocking(false)
  }

  if (!locked) return null

  return (
    <div className="fixed inset-0 z-[9999] bg-gray-950/95 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-gray-900 rounded-2xl border border-gray-700 p-6 space-y-5">
        {/* Lock icon */}
        <div className="text-center space-y-2">
          <div className="text-5xl">🔒</div>
          <h1 className="text-xl font-bold text-white">Session Locked</h1>
          <p className="text-sm text-gray-400">
            Locked due to inactivity. Enter your password to continue.
          </p>
        </div>

        <form onSubmit={handleUnlock} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={e => { setPassword(e.target.value); setError('') }}
            placeholder="Password"
            autoFocus
            autoComplete="current-password"
            className="w-full bg-gray-800 rounded-lg px-4 py-3 text-white text-sm border border-gray-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          />

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={unlocking || !password.trim()}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold rounded-xl transition-colors"
          >
            {unlocking ? 'Unlocking...' : 'Unlock'}
          </button>
        </form>

        <p className="text-xs text-gray-600 text-center">
          Your work is saved. This lock protects patient data.
        </p>
      </div>
    </div>
  )
}
