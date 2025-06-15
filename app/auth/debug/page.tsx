'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AuthDebugPage() {
  const { data: session, status } = useSession()
  const [debugData, setDebugData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  
  useEffect(() => {
    // Fetch debug info from API
    const fetchDebugInfo = async () => {
      try {
        const response = await fetch('/api/auth/debug')
        const data = await response.json()
        setDebugData(data)
      } catch (error) {
        console.error('Failed to fetch debug info:', error)
      } finally {
        setLoading(false)
      }
    }
    
    fetchDebugInfo()
  }, [])
  
  // Log client-side info
  useEffect(() => {
    console.log('=== AUTH DEBUG PAGE ===')
    console.log('Session Status:', status)
    console.log('Session Data:', session)
    console.log('Window Location:', window.location.href)
    console.log('Document Cookie:', document.cookie)
    console.log('Local Storage Keys:', Object.keys(localStorage))
    console.log('Session Storage Keys:', Object.keys(sessionStorage))
  }, [session, status])
  
  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Authentication Debug Info</h1>
        
        {/* Client-side Session Info */}
        <section className="mb-8 bg-neutral-900 rounded-lg p-6 border border-neutral-800">
          <h2 className="text-xl font-semibold mb-4 text-green-400">Client-side Session</h2>
          <div className="space-y-2">
            <p><strong>Status:</strong> <span className={status === 'authenticated' ? 'text-green-400' : 'text-yellow-400'}>{status}</span></p>
            <p><strong>User:</strong> {session?.user?.name || 'Not authenticated'}</p>
            <p><strong>Email:</strong> {session?.user?.email || 'N/A'}</p>
            <details className="mt-4">
              <summary className="cursor-pointer text-blue-400">Full Session Data</summary>
              <pre className="mt-2 p-4 bg-black rounded overflow-auto text-xs">
                {JSON.stringify(session, null, 2)}
              </pre>
            </details>
          </div>
        </section>
        
        {/* Server-side Debug Info */}
        <section className="mb-8 bg-neutral-900 rounded-lg p-6 border border-neutral-800">
          <h2 className="text-xl font-semibold mb-4 text-blue-400">Server-side Debug Info</h2>
          {loading ? (
            <p className="text-gray-400">Loading...</p>
          ) : debugData ? (
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-yellow-400 mb-2">Environment</h3>
                <pre className="p-4 bg-black rounded overflow-auto text-xs">
                  {JSON.stringify(debugData.env, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="font-semibold text-yellow-400 mb-2">Headers</h3>
                <pre className="p-4 bg-black rounded overflow-auto text-xs">
                  {JSON.stringify(debugData.headers, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="font-semibold text-yellow-400 mb-2">URL Info</h3>
                <pre className="p-4 bg-black rounded overflow-auto text-xs">
                  {JSON.stringify(debugData.url, null, 2)}
                </pre>
              </div>
            </div>
          ) : (
            <p className="text-red-400">Failed to load debug data</p>
          )}
        </section>
        
        {/* Browser Info */}
        <section className="mb-8 bg-neutral-900 rounded-lg p-6 border border-neutral-800">
          <h2 className="text-xl font-semibold mb-4 text-purple-400">Browser Info</h2>
          <div className="space-y-2 text-sm">
            <p><strong>Current URL:</strong> {typeof window !== 'undefined' ? window.location.href : 'SSR'}</p>
            <p><strong>User Agent:</strong> {typeof navigator !== 'undefined' ? navigator.userAgent : 'SSR'}</p>
            <p><strong>Cookies Enabled:</strong> {typeof navigator !== 'undefined' ? navigator.cookieEnabled ? 'Yes' : 'No' : 'SSR'}</p>
            <details className="mt-4">
              <summary className="cursor-pointer text-blue-400">Document Cookies</summary>
              <pre className="mt-2 p-4 bg-black rounded overflow-auto text-xs">
                {typeof document !== 'undefined' ? document.cookie || 'No cookies' : 'SSR'}
              </pre>
            </details>
          </div>
        </section>
        
        {/* Actions */}
        <section className="bg-neutral-900 rounded-lg p-6 border border-neutral-800">
          <h2 className="text-xl font-semibold mb-4 text-orange-400">Actions</h2>
          <div className="flex flex-wrap gap-4">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              Reload Page
            </button>
            <button
              onClick={() => router.push('/auth/signin')}
              className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
            >
              Go to Sign In
            </button>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Go to Home
            </button>
            <button
              onClick={async () => {
                const { signOut } = await import('next-auth/react')
                signOut({ redirect: false })
              }}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Sign Out
            </button>
          </div>
        </section>
      </div>
    </div>
  )
} 