'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { MiniKitWalletButton } from './MiniKitWalletButton'

interface TwitterSigningFlowProps {
  contractId: string
  onWalletConnected: (address: string, twitterHandle: string) => void
  onWalletDisconnected: () => void
}

export function TwitterSigningFlow({ 
  contractId, 
  onWalletConnected, 
  onWalletDisconnected 
}: TwitterSigningFlowProps) {
  const { data: session, status } = useSession()
  const [walletAddress, setWalletAddress] = useState('')
  const [profileUpdateStatus, setProfileUpdateStatus] = useState<'idle' | 'updating' | 'success' | 'error'>('idle')
  const [profileMessage, setProfileMessage] = useState('')

  // Debug logging
  useEffect(() => {
    console.log('TwitterSigningFlow - Session status:', status)
    console.log('TwitterSigningFlow - Session data:', session)
  }, [session, status])

  // Extract Twitter handle from session
  const twitterHandle = (session as any)?.twitterHandle || session?.user?.name || ''

  const handleTwitterLogin = () => {
    // Use the existing Twitter OAuth flow
    signIn('twitter', { 
      callbackUrl: window.location.href, // Stay on the same page after login
      redirect: true 
    })
  }

  const updateUserProfile = async (address: string) => {
    if (!twitterHandle) return

    setProfileUpdateStatus('updating')
    setProfileMessage('Updating your profile...')

    try {
      // Call the profile update API
      const response = await fetch('/api/contracts/profile-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          twitterHandle,
          walletAddress: address,
          contractId,
          contractDetails: {
            id: contractId,
            signedAt: new Date().toISOString()
          }
        })
      })

      const data = await response.json()

      if (response.ok) {
        setProfileUpdateStatus('success')
        setProfileMessage(data.message || 'Profile updated successfully!')
        onWalletConnected(address, twitterHandle)
      } else {
        throw new Error(data.error || 'Failed to update profile')
      }
    } catch (error) {
      console.error('Profile update error:', error)
      setProfileUpdateStatus('error')
      setProfileMessage('Failed to update profile, but you can still sign the contract')
      // Still allow signing even if profile update fails
      onWalletConnected(address, twitterHandle)
    }
  }

  const handleWalletConnect = async (address: string) => {
    setWalletAddress(address)
    await updateUserProfile(address)
  }

  const handleWalletDisconnect = () => {
    setWalletAddress('')
    setProfileUpdateStatus('idle')
    setProfileMessage('')
    onWalletDisconnected()
  }

  // Always render something - never return null or undefined
  const renderContent = () => {
    // Loading state
    if (status === 'loading') {
      return (
        <div className="text-center text-gray-400">
          <p>Checking authentication...</p>
        </div>
      )
    }

    // Not authenticated - show login
    if (status === 'unauthenticated' || !session) {
      return (
        <>
          <div className="bg-blue-900/20 border border-blue-500 p-4 rounded">
            <h3 className="font-bold mb-2">Step 1: Sign in with Twitter/X</h3>
            <p className="text-sm text-gray-400 mb-4">
              Please sign in with your Twitter/X account to continue with contract signing.
            </p>
            <button
              onClick={handleTwitterLogin}
              className="w-full px-4 py-3 bg-blue-900 border border-blue-500 hover:bg-blue-800 rounded font-medium transition-colors"
            >
              Sign in with Twitter/X
            </button>
          </div>
          
          {/* Debug info */}
          <div className="text-xs text-gray-500 text-center p-2 bg-gray-800 rounded mt-4">
            <p>Debug Info:</p>
            <p>Session status: {status}</p>
            <p>Session exists: {session ? 'YES' : 'NO'}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="underline hover:text-gray-400 mt-1"
            >
              Force refresh if stuck
            </button>
          </div>
        </>
      )
    }

    // Authenticated - show user info and wallet connection
    return (
      <>
        {/* Twitter Account Info */}
        <div className="bg-gray-900 border border-gray-700 rounded p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Profile Picture */}
              {session?.user?.image && (
                <img 
                  src={session.user.image} 
                  alt={twitterHandle}
                  className="w-10 h-10 rounded-full"
                />
              )}
              <div>
                <p className="text-sm text-gray-400">Signed in as</p>
                <p className="font-medium text-green-400">@{twitterHandle || 'Unknown'}</p>
              </div>
            </div>
            <button
              onClick={() => signIn('twitter')}
              className="text-sm text-gray-400 hover:text-gray-300"
            >
              Switch account
            </button>
          </div>
        </div>

        {/* Wallet Connection */}
        <div className="bg-blue-900/20 border border-blue-500 p-4 rounded">
          <h3 className="font-bold mb-2">Step 2: Connect your wallet</h3>
          <p className="text-sm text-gray-400 mb-4">
            Connect your wallet to sign the contract. Your wallet will be linked to your Twitter profile.
          </p>
          
          <MiniKitWalletButton 
            onConnect={handleWalletConnect}
            onDisconnect={handleWalletDisconnect}
          />
        </div>

        {/* Profile Update Status */}
        {profileUpdateStatus !== 'idle' && (
          <div className={`p-3 rounded border ${
            profileUpdateStatus === 'updating' ? 'bg-yellow-900/20 border-yellow-500' :
            profileUpdateStatus === 'success' ? 'bg-green-900/20 border-green-500' :
            'bg-red-900/20 border-red-500'
          }`}>
            <p className={`text-sm ${
              profileUpdateStatus === 'updating' ? 'text-yellow-400' :
              profileUpdateStatus === 'success' ? 'text-green-400' :
              'text-red-400'
            }`}>
              {profileMessage}
            </p>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="space-y-4">
      {renderContent()}
    </div>
  )
} 