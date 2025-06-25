'use client'

import { signIn } from 'next-auth/react'

interface AuthLoginModalProps {
  title?: string
  description?: string
  icon?: string
}

export default function AuthLoginModal({ 
  title = 'Access Required',
  description = 'Please sign in to continue',
  icon = '🚀'
}: AuthLoginModalProps) {
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono&display=swap');
        body {
          font-family: 'IBM Plex Sans', sans-serif;
        }
      `}</style>
      
      <div className="bg-black border border-green-500 rounded-lg p-8 max-w-md w-full text-center">
        <div className="w-24 h-24 mx-auto mb-6 bg-green-900/20 rounded-full flex items-center justify-center">
          <span className="text-4xl text-green-300">{icon}</span>
        </div>
        <h1 className="text-2xl font-bold text-green-300 mb-4">{title}</h1>
        <p className="text-green-400 mb-6">{description}</p>
        
        <button
          onClick={() => {
            // Use redirect: false to prevent loops on mobile
            signIn('twitter', {
              redirect: false,
              callbackUrl: window.location.href
            }).then((result) => {
              if (result?.ok) {
                window.location.reload()
              } else if (result?.error) {
                console.error('Sign in error:', result.error)
                if (result.error === 'OAuthCallback' || result.error === 'Callback') {
                  // On mobile, OAuth callbacks sometimes fail - try direct redirect
                  setTimeout(() => {
                    window.location.href = '/api/auth/signin/twitter'
                  }, 1000)
                }
              }
            }).catch((err) => {
              console.error('Sign in failed:', err)
              // Fallback to direct redirect
              window.location.href = '/api/auth/signin/twitter'
            })
          }}
          className="w-full px-6 py-3 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors flex items-center justify-center gap-3"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
          </svg>
          Sign in with X
        </button>
      </div>
    </div>
  )
} 