'use client'

import { signIn, useSession } from 'next-auth/react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Twitter } from 'lucide-react'
import { useEffect, useState, Suspense, useRef } from 'react'

function SignInContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const callbackUrl = searchParams.get('callbackUrl') || '/'
  const [isSigningIn, setIsSigningIn] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [testMode, setTestMode] = useState(false)
  const redirectAttempted = useRef(false)
  
  console.log('SignIn Page: Mounted')
  console.log('SignIn Page: Callback URL:', callbackUrl)
  console.log('SignIn Page: Full URL:', typeof window !== 'undefined' ? window.location.href : 'SSR')
  console.log('SignIn Page: Origin:', typeof window !== 'undefined' ? window.location.origin : 'SSR')
  console.log('SignIn Page: Session status on mount:', status)
  console.log('SignIn Page: Session data on mount:', session)
  
  // Check cookies on client side
  if (typeof window !== 'undefined') {
    console.log('SignIn Page: Document cookies:', document.cookie.split(';').map(c => c.trim().split('=')[0]))
  }
  
  useEffect(() => {
    // Check for any errors in URL params
    const errorParam = searchParams.get('error')
    if (errorParam) {
      console.error('SignIn Page: Auth error in URL:', errorParam)
      setError(`Authentication error: ${errorParam}`)
    }
    
    // Check if we're in a redirect loop
    const redirectCount = sessionStorage.getItem('signin_redirect_count')
    if (redirectCount && parseInt(redirectCount) > 3) {
      setError('Too many redirects. Please check your browser settings or contact support.')
      sessionStorage.removeItem('signin_redirect_count')
    }
  }, [searchParams])
  
  // If already authenticated, redirect immediately
  useEffect(() => {
    console.log('SignIn Page: Auth check effect', {
      status,
      hasSession: !!session,
      sessionData: session ? {
        user: session.user,
        expires: session.expires
      } : null,
      callbackUrl,
      redirectAttempted: redirectAttempted.current
    })
    
    if (status === 'authenticated' && session && !redirectAttempted.current) {
      console.log('SignIn Page: Already authenticated, attempting redirect to:', callbackUrl)
      redirectAttempted.current = true
      
      // Add a small delay to ensure we're not in a render cycle
      const timer = setTimeout(() => {
        console.log('SignIn Page: Executing redirect to:', callbackUrl)
        
        // Use window.location for more reliable redirect in production
        if (typeof window !== 'undefined') {
          // Clear any redirect counts
          sessionStorage.removeItem('signin_redirect_count')
          
          // Force redirect using window.location
          console.log('SignIn Page: Using window.location.href for redirect')
          window.location.href = callbackUrl
        } else {
          router.push(callbackUrl)
        }
      }, 100)
      
      return () => clearTimeout(timer)
    }
  }, [status, session, callbackUrl, router])
  
  const handleSignIn = async () => {
    try {
      setIsSigningIn(true)
      setError(null)
      console.log('SignIn Page: Initiating sign in...')
      console.log('SignIn Page: Using callback URL:', callbackUrl)
      
      // Track redirect attempts
      const currentCount = parseInt(sessionStorage.getItem('signin_redirect_count') || '0')
      sessionStorage.setItem('signin_redirect_count', (currentCount + 1).toString())
      
      // Clear the count after successful sign in (with delay)
      setTimeout(() => {
        sessionStorage.removeItem('signin_redirect_count')
      }, 5000)
      
      if (testMode) {
        console.log('SignIn Page: TEST MODE - Would sign in with:', {
          provider: 'twitter',
          callbackUrl,
          redirect: false
        })
        setTimeout(() => {
          console.log('SignIn Page: TEST MODE - Would redirect to:', callbackUrl)
          setIsSigningIn(false)
        }, 2000)
        return
      }
      
      // Use redirect: false to handle redirect manually after ensuring session is set
      const result = await signIn('twitter', {
        callbackUrl,
        redirect: false
      })
      
      console.log('SignIn Page: Sign in result:', result)
      
      if (result?.ok) {
        console.log('SignIn Page: Sign in successful, waiting for session...')
        
        // Wait for session to be established (poll for up to 5 seconds)
        let sessionCheckCount = 0
        const maxChecks = 10
        const checkInterval = 500
        
        const waitForSession = async () => {
          while (sessionCheckCount < maxChecks) {
            // Force a session refresh by calling the session endpoint
            const sessionRes = await fetch('/api/auth/session')
            const sessionData = await sessionRes.json()
            
            console.log(`SignIn Page: Session check ${sessionCheckCount + 1}/${maxChecks}:`, sessionData)
            
            if (sessionData && sessionData.user) {
              console.log('SignIn Page: Session established, redirecting to:', callbackUrl)
              
              // Clear redirect count on successful auth
              sessionStorage.removeItem('signin_redirect_count')
              
              // Use window.location for production redirect
              if (typeof window !== 'undefined') {
                window.location.href = callbackUrl
              } else {
                router.push(callbackUrl)
              }
              return
            }
            
            sessionCheckCount++
            await new Promise(resolve => setTimeout(resolve, checkInterval))
          }
          
          // If we couldn't establish session after max attempts, still redirect
          console.warn('SignIn Page: Session not established after max attempts, redirecting anyway')
          if (typeof window !== 'undefined') {
            window.location.href = callbackUrl
          } else {
            router.push(callbackUrl)
          }
        }
        
        await waitForSession()
      } else if (result?.error) {
        console.error('SignIn Page: Sign in failed:', result.error)
        setError(`Sign in failed: ${result.error}`)
        setIsSigningIn(false)
      }
    } catch (err) {
      console.error('SignIn Page: Sign in error:', err)
      setError('Failed to sign in. Please try again.')
      setIsSigningIn(false)
      sessionStorage.removeItem('signin_redirect_count')
    }
  }
  
  // Show loading state while checking authentication
  if (status === 'loading') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-gray-400">Checking authentication...</div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <div className="bg-neutral-900 rounded-lg p-8 border border-green-900">
          <h1 className="text-2xl font-bold text-green-400 mb-2 text-center">
            NABULINES
          </h1>
          <p className="text-gray-400 text-center mb-8">
            Connect your Twitter account to continue
          </p>
          
          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          
          <button
            onClick={handleSignIn}
            disabled={isSigningIn}
            className="w-full bg-green-900 text-green-100 py-3 px-4 rounded-lg font-medium hover:bg-green-800 transition-colors flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSigningIn ? (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-green-100 border-t-transparent rounded-full" />
                Signing in...
              </>
            ) : (
              <>
                <Twitter className="h-5 w-5" />
                Sign in with Twitter
              </>
            )}
          </button>
          
          <div className="mt-6 text-center">
            <p className="text-gray-500 text-xs">
              You will be redirected to Twitter to authorize the connection
            </p>
          </div>
          
          {/* Production Help */}
          {typeof window !== 'undefined' && window.location.hostname !== 'localhost' && (
            <div className="mt-6 p-4 bg-yellow-900/20 border border-yellow-700 rounded-lg">
              <p className="text-yellow-400 text-xs mb-2">Having trouble signing in?</p>
              <ul className="text-yellow-300 text-xs space-y-1">
                <li>• Clear your browser cookies</li>
                <li>• Disable ad blockers</li>
                <li>• Try a different browser</li>
              </ul>
            </div>
          )}
          
          {/* Debug info - remove in production */}
          <details className="mt-8 text-xs text-gray-600">
            <summary className="cursor-pointer hover:text-gray-400">Debug Info</summary>
            <div className="mt-2 p-2 bg-neutral-800 rounded space-y-2">
              <p>Callback URL: {callbackUrl}</p>
              <p>Current URL: {typeof window !== 'undefined' ? window.location.href : 'SSR'}</p>
              <p>Search Params: {searchParams.toString()}</p>
              <p>Auth Status: {status}</p>
              <p>Has Session: {session ? 'Yes' : 'No'}</p>
              <label className="flex items-center gap-2 mt-4 text-yellow-400">
                <input 
                  type="checkbox" 
                  checked={testMode}
                  onChange={(e) => setTestMode(e.target.checked)}
                />
                Test Mode (don't actually redirect)
              </label>
            </div>
          </details>
        </div>
      </div>
    </div>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-gray-400">Loading...</div>
      </div>
    }>
      <SignInContent />
    </Suspense>
  )
} 