'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { ContractsLoginModal } from '@/app/contracts/ContractsLoginModal'
import { ContractsWalletButton } from '@/app/contracts/ContractsWalletButton'

interface Contract {
  id: string
  title: string
  description: string
  creator: string
  createdAt: string
  status: 'draft' | 'pending' | 'completed'
  parties: Array<{
    address: string
    name: string
    role: 'creator' | 'signer' | 'witness'
    signed: boolean
    signedAt?: string
  }>
  files?: Array<{ url: string, name: string }>
  fileUrl?: string
  fileName?: string
  hasDisplayNameIssue?: boolean
}

export default function SignContractPage() {
  const params = useParams()
  const { data: session } = useSession()
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [walletAddress, setWalletAddress] = useState('')
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [signing, setSigning] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [walletMismatch, setWalletMismatch] = useState(false)
  const [expectedWallet, setExpectedWallet] = useState('')

  useEffect(() => {
    if (params.id) {
      fetchContract(params.id as string)
    }
  }, [params.id])

  useEffect(() => {
    if (session) {
      fetchUserProfile()
    }
  }, [session])

  useEffect(() => {
    // Check wallet match when wallet is connected
    if (walletAddress && contract && userProfile) {
      checkWalletMatch()
    }
  }, [walletAddress, contract, userProfile])

  const fetchUserProfile = async () => {
    if (!session) return
    
    // Use the Twitter handle from session, not the display name
    const twitterHandle = (session as any)?.twitterHandle || (session?.user as any)?.twitterHandle
    
    if (!twitterHandle) {
      console.log('Sign page - No Twitter handle found in session')
      return
    }
    
    try {
      const res = await fetch(`/api/user/profile?handle=${encodeURIComponent(twitterHandle)}`)
      if (res.ok) {
        const profile = await res.json()
        setUserProfile(profile)
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
    }
  }

  const fetchContract = async (id: string) => {
    try {
      const response = await fetch(`/api/contracts/${id}`)
      if (response.ok) {
        const data = await response.json()
        setContract(data)
      } else if (response.status === 404) {
        setError('Contract not found')
      } else {
        setError('Failed to load contract')
      }
    } catch (error) {
      console.error('Error fetching contract:', error)
      setError('Failed to load contract')
    } finally {
      setLoading(false)
    }
  }

  const checkWalletMatch = () => {
    if (!contract || !userProfile) return

    // Normalize the user handle
    const userHandle = userProfile.twitterHandle?.toLowerCase().replace('@', '') || (session as any)?.twitterHandle?.toLowerCase().replace('@', '') || ''
    const userParty = contract.parties.find(p => p.name === userHandle)
    
    if (userParty && userParty.address) {
      const expectedAddress = userParty.address.toLowerCase()
      const connectedAddress = walletAddress.toLowerCase()
      
      if (expectedAddress !== connectedAddress) {
        setWalletMismatch(true)
        setExpectedWallet(userParty.address)
      } else {
        setWalletMismatch(false)
        setExpectedWallet('')
      }
    }
  }

  const handleSign = async () => {
    if (!session) {
      setShowLoginModal(true)
      return
    }

    if (!walletAddress) {
      alert('Please connect your wallet first')
      return
    }

    if (walletMismatch) {
      alert(`Please connect the correct wallet: ${expectedWallet}`)
      return
    }

    if (!contract) return

    setSigning(true)
    try {
      // TODO: Implement actual wallet signing here
      // For now, we'll use a placeholder signature
      const message = `Sign contract: ${contract.id}\nTitle: ${contract.title}\nDate: ${new Date().toISOString()}`
      
      // In a real implementation, you would:
      // 1. Create a message to sign
      // 2. Request signature from wallet
      // 3. Send the signature to the backend
      
      const response = await fetch(`/api/contracts/${contract.id}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: 'wallet-signed', // This should be the actual signature
          walletAddress,
          message
        })
      })

      if (response.ok) {
        alert('Contract signed successfully!')
        // Refresh contract data
        await fetchContract(params.id as string)
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to sign contract')
      }
    } catch (error) {
      console.error('Error signing contract:', error)
      alert('Failed to sign contract')
    } finally {
      setSigning(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-xl">Loading contract...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Error</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Contract Not Found</h1>
          <p className="text-gray-400">This contract does not exist or has been removed.</p>
        </div>
      </div>
    )
  }

  const userHandle = userProfile?.twitterHandle?.toLowerCase().replace('@', '') || (session as any)?.twitterHandle?.toLowerCase().replace('@', '') || ''
  
  // Debug logging
  console.log('Debug - User handle:', userHandle)
  console.log('Debug - User profile:', userProfile)
  console.log('Debug - Contract parties:', contract.parties)
  console.log('Debug - Contract creator:', contract.creator)
  
  const userParty = contract.parties.find(p => p.name === userHandle)
  const isCreator = contract.creator === userHandle
  const canSign = userParty && !userParty.signed && userParty.role !== 'creator'
  
  // Check if user is authorized to view this contract
  const isAuthorized = isCreator || !!userParty
  
  console.log('Debug - User party found:', userParty)
  console.log('Debug - Is creator:', isCreator)
  console.log('Debug - Can sign:', canSign)
  console.log('Debug - Is authorized:', isAuthorized)

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto p-4 sm:p-6">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold mb-2">{contract.title}</h1>
          <p className="text-gray-400 text-sm sm:text-base">Created by {contract.creator} on {new Date(contract.createdAt).toLocaleDateString()}</p>
        </div>

        <div className={`bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6 ${!isAuthorized ? 'filter blur-sm pointer-events-none' : ''}`}>
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Contract Details</h2>
          <p className="text-sm sm:text-base text-gray-300 whitespace-pre-wrap break-words">{contract.description}</p>
          
          {/* Show uploaded files */}
          {contract.files && contract.files.length > 0 && (
            <div className="mt-3 sm:mt-4 space-y-2">
              <h3 className="text-sm font-medium text-gray-400">Attachments:</h3>
              <div className="grid gap-2">
                {contract.files.map((file, index) => {
                  const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name)
                  return (
                    <div key={index} className="bg-gray-800 rounded overflow-hidden">
                      {isImage && (
                        <div className="p-2">
                          <img 
                            src={file.url} 
                            alt={file.name}
                            className="w-full h-auto rounded max-h-96 object-contain"
                          />
                        </div>
                      )}
                      <div className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-lg">📎</span>
                          <p className="text-sm text-gray-300 truncate">{file.name}</p>
                        </div>
                        <a 
                          href={file.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-400 hover:text-blue-300 text-sm whitespace-nowrap"
                        >
                          {isImage ? 'View Full Size' : 'View File'}
                        </a>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          
          {/* Legacy file format support */}
          {!contract.files && contract.fileUrl && (
            <div className="mt-3 sm:mt-4">
              <h3 className="text-sm font-medium text-gray-400 mb-2">Attachment:</h3>
              <div className="bg-gray-800 rounded overflow-hidden">
                {contract.fileName && /\.(jpg|jpeg|png|gif|webp)$/i.test(contract.fileName) && (
                  <div className="p-2">
                    <img 
                      src={contract.fileUrl} 
                      alt={contract.fileName}
                      className="w-full h-auto rounded max-h-96 object-contain"
                    />
                  </div>
                )}
                <div className="p-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-lg">📎</span>
                    <p className="text-sm text-gray-300 truncate">{contract.fileName || 'Contract File'}</p>
                  </div>
                  <a 
                    href={contract.fileUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 text-sm whitespace-nowrap"
                  >
                    View File
                  </a>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className={`bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6 ${!isAuthorized ? 'filter blur-sm pointer-events-none' : ''}`}>
          <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Parties</h2>
          <div className="space-y-2">
            {contract.parties.map((party, idx) => (
              <div key={idx} className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-3 bg-gray-800 rounded gap-2">
                <div className="flex items-start sm:items-center gap-3">
                  <span className={`text-xl sm:text-2xl ${party.signed ? 'text-green-500' : 'text-gray-500'}`}>
                    {party.signed ? '✓' : '○'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium break-all text-sm sm:text-base">{party.name}</p>
                    <p className="text-xs sm:text-sm text-gray-400">{party.role}</p>
                    {party.address && (
                      <p className="text-xs text-gray-500 break-all">
                        Wallet: {party.address.slice(0, 6)}...{party.address.slice(-4)}
                      </p>
                    )}
                  </div>
                </div>
                {party.signed && party.signedAt && (
                  <p className="text-xs sm:text-sm text-gray-500 whitespace-nowrap">
                    Signed {new Date(party.signedAt).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        {!isAuthorized && session && (
          <div className="bg-red-900/20 border border-red-600 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-2 text-red-400">Access Restricted</h2>
            <p className="text-red-300 text-sm sm:text-base">
              This contract is private. You are not authorized to view or sign this contract.
            </p>
            <p className="text-red-300 text-xs sm:text-sm mt-2">
              Only the parties listed in this contract can access it.
            </p>
            {contract.hasDisplayNameIssue && (
              <div className="mt-3 pt-3 border-t border-red-700">
                <p className="text-yellow-400 text-xs sm:text-sm">
                  ⚠️ This contract may have been created with display names instead of Twitter handles. 
                  The contract creator should recreate it using Twitter handles (without spaces) for all parties.
                </p>
              </div>
            )}
          </div>
        )}

        {!session && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Sign In Required</h2>
            <p className="text-gray-400 mb-3 sm:mb-4 text-sm sm:text-base">You need to sign in with X to sign this contract.</p>
            <button
              onClick={() => setShowLoginModal(true)}
              className="bg-blue-600 hover:bg-blue-700 px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-semibold text-sm sm:text-base w-full sm:w-auto"
            >
              Sign in with X
            </button>
          </div>
        )}

        {session && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4">Your Action</h2>
            
            {/* Show current user info */}
            <div className="flex items-center gap-3 mb-3 sm:mb-4 p-3 bg-gray-800 rounded-lg">
              <img 
                src={session.user?.image || '/default-avatar.png'} 
                alt={session.user?.name || 'User'}
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-400">Signed in as:</p>
                <p className="font-medium text-sm sm:text-base truncate">{userProfile?.twitterHandle?.replace('@', '') || (session as any)?.twitterHandle?.replace('@', '') || 'Unknown'}</p>
              </div>
            </div>
            
            {isCreator && (
              <p className="text-gray-400 text-sm sm:text-base">You created this contract.</p>
            )}
            
            {userParty && userParty.signed && (
              <p className="text-green-400 text-sm sm:text-base">✓ You have already signed this contract.</p>
            )}
            
            {canSign && (
              <div className="space-y-3 sm:space-y-4">
                <p className="text-gray-400 text-sm sm:text-base">You are required to sign this contract as a {userParty.role}.</p>
                
                <ContractsWalletButton 
                  onConnect={setWalletAddress} 
                  onDisconnect={() => setWalletAddress('')} 
                />
                
                {walletAddress && walletMismatch && (
                  <div className="p-3 bg-red-900/20 border border-red-600 rounded-lg">
                    <p className="text-red-400 text-xs sm:text-sm">
                      Wrong wallet connected! Expected: {expectedWallet}
                    </p>
                    <p className="text-red-400 text-xs sm:text-sm">
                      Connected: {walletAddress}
                    </p>
                  </div>
                )}
                
                {walletAddress && !walletMismatch && (
                  <button
                    onClick={handleSign}
                    disabled={signing}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 py-2 sm:py-3 rounded-lg font-semibold text-sm sm:text-base"
                  >
                    {signing ? 'Signing...' : 'Sign Contract'}
                  </button>
                )}
              </div>
            )}
            
            {!isCreator && !userParty && (
              <div>
                <p className="text-gray-400 mb-2 text-sm sm:text-base">You are not a party to this contract.</p>
                <p className="text-xs text-gray-500">
                  Logged in as: {userProfile?.twitterHandle?.replace('@', '') || (session as any)?.twitterHandle?.replace('@', '') || 'Unknown'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <ContractsLoginModal show={showLoginModal} />
    </div>
  )
} 