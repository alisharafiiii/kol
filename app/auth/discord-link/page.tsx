/**
 * ✅ STABLE & VERIFIED - DO NOT MODIFY WITHOUT EXPLICIT REVIEW
 * 
 * Discord OAuth linking page.
 * Last verified: December 2024
 * 
 * Key functionality:
 * - Handles Twitter OAuth flow for Discord users
 * - Auto-links accounts after authentication
 * - Shows success/error states with retry options
 * - Manages verification session lifecycle
 * 
 * CRITICAL: This page is essential for the Discord bot /connect command.
 * Changes could break the account linking flow.
 */

'use client'

import { useEffect, useState, useCallback, Suspense, useRef } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'

function DiscordLinkContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { data: session, status } = useSession()
  const [error, setError] = useState<string | null>(null)
  const [linking, setLinking] = useState(false)
  const [success, setSuccess] = useState(false)
  const linkingRef = useRef(false)
  
  const sessionId = searchParams.get('session')
  
  const linkAccounts = useCallback(async () => {
    const twitterHandle = (session as any)?.twitterHandle || (session?.user as any)?.twitterHandle || session?.user?.name
    if (!twitterHandle || !sessionId || linkingRef.current) return
    
    linkingRef.current = true
    setLinking(true)
    
    try {
      // Link the Discord account with the Twitter account
      const response = await fetch('/api/auth/discord-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          twitterHandle: twitterHandle
        })
      })
      
      const data = await response.json()
      
      if (!response.ok) {
        throw new Error(data.error || 'Failed to link accounts')
      }
      
      setSuccess(true)
      
      // Store profile info for display
      if (data.profile) {
        localStorage.setItem('linkedProfile', JSON.stringify(data.profile))
      }
    } catch (err: any) {
      console.error('Link error:', err)
      setError(err.message)
      linkingRef.current = false
      setLinking(false)
    }
  }, [session, sessionId])
  
  useEffect(() => {
    if (!sessionId) {
      setError('No verification session found')
      return
    }
    
    // If not signed in, redirect to Twitter sign in
    if (status === 'unauthenticated') {
      const callbackUrl = `/auth/discord-link?session=${sessionId}`
      console.log('Redirecting to Twitter sign in with callback:', callbackUrl)
      signIn('twitter', { callbackUrl })
    }
    
    // If signed in and haven't attempted linking yet, link the accounts
    if (status === 'authenticated' && session?.user && !linkingRef.current && !success && !error) {
      linkAccounts()
    }
  }, [status, session, sessionId, linkAccounts, success, error])
  
  // Success state
  if (success) {
    let profile = null
    try {
      const stored = localStorage.getItem('linkedProfile')
      if (stored) profile = JSON.parse(stored)
    } catch (e) {
      console.error('Error parsing profile:', e)
    }
    
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#000', 
        color: '#0f0', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontFamily: 'monospace',
        padding: '20px'
      }}>
        <div style={{ 
          maxWidth: '400px', 
          width: '100%', 
          backgroundColor: '#111', 
          border: '2px solid #0f0', 
          borderRadius: '8px', 
          padding: '32px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>✅</div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Success!</h1>
          <p style={{ color: '#ccc', marginBottom: '16px' }}>
            Your Twitter account @{(session as any)?.twitterHandle || (session?.user as any)?.twitterHandle || session?.user?.name} has been securely linked to Discord.
          </p>
          {profile?.isNewUser && (
            <p style={{ color: '#ff0', marginBottom: '16px' }}>
              ⏳ Your account is pending approval. An admin will review it soon.
            </p>
          )}
          <p style={{ fontSize: '14px', color: '#666', marginBottom: '16px' }}>
            You can close this window and return to Discord.
          </p>
          <button
            onClick={() => window.close()}
            style={{
              padding: '8px 16px',
              backgroundColor: '#0a0',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Close Window
          </button>
        </div>
      </div>
    )
  }
  
  // Error state
  if (error) {
    return (
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#000', 
        color: '#f00', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontFamily: 'monospace',
        padding: '20px'
      }}>
        <div style={{ 
          maxWidth: '400px', 
          width: '100%', 
          backgroundColor: '#111', 
          border: '2px solid #f00', 
          borderRadius: '8px', 
          padding: '32px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>❌</div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Error</h1>
          <p style={{ color: '#ccc', marginBottom: '24px' }}>{error}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <button
              onClick={() => {
                setError(null)
                linkingRef.current = false
                if (session?.user) {
                  linkAccounts()
                } else {
                  signIn('twitter', { callbackUrl: `/auth/discord-link?session=${sessionId}` })
                }
              }}
              style={{
                padding: '8px 16px',
                backgroundColor: '#00f',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => router.push('/')}
              style={{
                padding: '8px 16px',
                backgroundColor: '#333',
                color: '#0f0',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '16px'
              }}
            >
              Return Home
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  // Loading state
  return (
    <div style={{ 
      minHeight: '100vh', 
      backgroundColor: '#000', 
      color: '#0f0', 
      display: 'flex', 
      alignItems: 'center', 
      justifyContent: 'center',
      fontFamily: 'monospace',
      padding: '20px'
    }}>
      <div style={{ 
        maxWidth: '400px', 
        width: '100%', 
        backgroundColor: '#111', 
        border: '2px solid #0f0', 
        borderRadius: '8px', 
        padding: '32px',
        textAlign: 'center'
      }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🔄</div>
        <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
          {status === 'loading' ? 'Loading...' : 
           status === 'unauthenticated' ? 'Redirecting to Twitter...' :
           'Linking Accounts...'}
        </h1>
        <p style={{ color: '#ccc' }}>
          {status === 'loading' ? 'Please wait...' : 
           status === 'unauthenticated' ? 'You will be redirected to sign in with Twitter.' :
           `Linking @${(session as any)?.twitterHandle || (session?.user as any)?.twitterHandle || session?.user?.name || 'your account'} to Discord...`}
        </p>
        {status === 'unauthenticated' && (
          <button
            onClick={() => signIn('twitter', { callbackUrl: `/auth/discord-link?session=${sessionId}` })}
            style={{
              marginTop: '16px',
              padding: '8px 16px',
              backgroundColor: '#00f',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '16px'
            }}
          >
            Sign in with Twitter
          </button>
        )}
      </div>
    </div>
  )
}

export default function DiscordLinkPage() {
  return (
    <Suspense fallback={
      <div style={{ 
        minHeight: '100vh', 
        backgroundColor: '#000', 
        color: '#0f0', 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center',
        fontFamily: 'monospace'
      }}>
        <div style={{ fontSize: '48px' }}>🔄</div>
      </div>
    }>
      <DiscordLinkContent />
    </Suspense>
  )
} 