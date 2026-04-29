

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useNavigate, Link } from 'react-router-dom'
import { brand } from '@/lib/branding.config'

export default function LoginPage() {
  const supabase = createClient()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      const { data } = await supabase.auth.getUser()
      if (data.user?.user_metadata?.must_change_password) {
        navigate('/change-password')
      } else {
        navigate('/')
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="text-center">
          <img
            src={brand.logoUrl}
            alt={brand.companyName}
            className="w-24 h-24 mx-auto mb-4 rounded-full object-contain bg-white p-2"
          />
          <h1 className="text-2xl font-bold text-white">{brand.appName}</h1>
          <p className="text-gray-400 text-sm mt-1">{brand.companyName}</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1">Email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)}
              placeholder={`you@${brand.domain}`} required
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-500" />
          </div>
          <div>
            <label className="block text-sm text-gray-400 mb-1">Password</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="••••••••" required
              className="w-full bg-gray-900 border border-gray-700 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-red-500" />
          </div>
          {error && (
            <div className="bg-red-900/40 border border-red-700 rounded-xl px-4 py-3 text-red-300 text-sm">{error}</div>
          )}
          <button type="submit" disabled={loading}
            className="w-full py-3 bg-red-600 hover:bg-red-700 disabled:bg-gray-700 text-white font-semibold rounded-xl transition-colors">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
        <p className="text-center text-xs text-gray-600">Contact your administrator to reset your password.</p>
        <p className="text-center text-xs text-gray-600 mt-2">
          New employee?{' '}
          <Link to="/onboard" className="text-gray-400 hover:text-white underline transition-colors">
            Complete your onboarding form →
          </Link>
        </p>
      </div>
    </div>
  )
}
