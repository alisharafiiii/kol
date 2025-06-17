'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function DevLoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Only show in development
  if (process.env.NODE_ENV === 'production') {
    return null
  }
  
  const testAccounts = [
    { handle: 'sharafi_eth', role: 'Admin', description: 'Master admin account' },
    { handle: 'nabulines', role: 'Admin', description: 'Admin account' },
    { handle: 'alinabu', role: 'Admin', description: 'Admin account' },
    { handle: 'testuser', role: 'User', description: 'Regular user account' }
  ]
  
  const handleLogin = async (handle: string) => {
    setLoading(true)
    setError('')
    
    try {
      const res = await fetch('/api/auth/dev-login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ handle })
      })
      
      const data = await res.json()
      
      if (res.ok) {
        // Redirect to home or contracts admin
        window.location.href = handle.includes('sharafi') ? '/contracts-admin' : '/'
      } else {
        setError(data.error || 'Login failed')
      }
    } catch (err) {
      setError('Failed to login')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="min-h-screen bg-black text-green-300 p-6">
      <div className="max-w-2xl mx-auto">
        <div className="bg-gray-900 border border-green-500 rounded-lg p-8">
          <h1 className="text-2xl font-bold mb-2">Development Login</h1>
          <p className="text-gray-400 mb-6">Quick login for testing (development only)</p>
          
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded">
              <p className="text-red-400">{error}</p>
            </div>
          )}
          
          <div className="space-y-3">
            {testAccounts.map((account) => (
              <button
                key={account.handle}
                onClick={() => handleLogin(account.handle)}
                disabled={loading}
                className="w-full p-4 bg-gray-800 border border-gray-700 rounded-lg hover:border-green-500 transition-colors text-left disabled:opacity-50"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-green-300">@{account.handle}</p>
                    <p className="text-sm text-gray-400">{account.description}</p>
                  </div>
                  <span className={`px-3 py-1 text-xs rounded-full ${
                    account.role === 'Admin' 
                      ? 'bg-red-900/50 text-red-300' 
                      : 'bg-gray-700 text-gray-300'
                  }`}>
                    {account.role}
                  </span>
                </div>
              </button>
            ))}
          </div>
          
          <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-700 rounded">
            <p className="text-yellow-400 text-sm">
              ⚠️ This page is only available in development mode and will not work in production.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 