'use client'

import { useRouter } from 'next/navigation'
import { AlertCircle } from 'lucide-react'

export default function NotFound() {
  const router = useRouter()
  
  return (
    <div className="min-h-screen bg-black text-white flex items-center justify-center p-4">
      <div className="max-w-md w-full text-center">
        <div className="flex items-center justify-center w-20 h-20 bg-red-900/20 rounded-full mx-auto mb-6">
          <AlertCircle className="w-10 h-10 text-red-400" />
        </div>
        
        <h1 className="text-6xl font-bold text-red-500 mb-4">404</h1>
        <h2 className="text-2xl font-semibold mb-4">Page Not Found</h2>
        <p className="text-gray-400 mb-8">
          The page you're looking for doesn't exist or has been moved.
        </p>
        
        <div className="space-y-4">
          <button
            onClick={() => router.push('/')}
            className="w-full px-6 py-3 bg-green-900 text-green-100 rounded-lg hover:bg-green-800 transition-colors"
          >
            Go to Home
          </button>
          <button
            onClick={() => router.back()}
            className="w-full px-6 py-3 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-900 transition-colors"
          >
            Go Back
          </button>
        </div>
        
        <div className="mt-8 text-xs text-gray-600">
          <p>Current URL: {typeof window !== 'undefined' ? window.location.href : 'Loading...'}</p>
        </div>
      </div>
    </div>
  )
} 