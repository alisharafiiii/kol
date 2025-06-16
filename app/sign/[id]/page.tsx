'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { TwitterSigningFlow } from '@/modules/onchain-contracts/components/TwitterSigningFlow'
import { useSession, signOut } from 'next-auth/react'

interface Contract {
  id: string
  title: string
  body: {
    title: string
    role: string
    walletAddress: string
    startDate: string
    endDate: string
    terms: string
    compensation?: string
    deliverables?: string[]
  }
  status: string
  adminSignature?: string
  userSignature?: string
  signerAddress?: string
}

export default function SignContractPage() {
  const params = useParams()
  const contractId = params.id as string
  // Handle both formats: "contract:test123" and "test123"
  const normalizedId = contractId.includes(':') ? contractId : `contract:${contractId}`
  const [contract, setContract] = useState<Contract | null>(null)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [twitterHandle, setTwitterHandle] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  
  // Get session status
  const { data: session, status: sessionStatus } = useSession()

  useEffect(() => {
    // Check if contracts feature is enabled
    if (process.env.NEXT_PUBLIC_ENABLE_CONTRACTS !== 'true') {
      setError('Contracts feature is disabled')
      setLoading(false)
      return
    }

    fetchContract()
  }, [normalizedId])

  const fetchContract = async () => {
    try {
      const res = await fetch(`/api/contracts/${normalizedId}`)
      if (res.ok) {
        const data = await res.json()
        setContract(data)
      } else if (res.status === 404) {
        // If contract not found, show a demo contract for testing
        if (normalizedId === 'contract:test123') {
          setContract({
            id: 'contract:test123',
            title: 'Demo KOL Agreement',
            body: {
              title: 'Demo KOL Agreement',
              role: 'Key Opinion Leader',
              walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f6E123',
              startDate: '2024-01-01',
              endDate: '2024-12-31',
              terms: 'This is a demo contract for testing wallet connection.\n\nThe KOL agrees to:\n- Create content about the project\n- Engage with the community\n- Maintain professional standards',
              compensation: '$5000 USD per month',
              deliverables: ['5 tweets per week', '2 long-form posts per month', '1 community AMA per quarter']
            },
            status: 'draft'
          })
        } else {
          setError('Contract not found')
        }
      } else {
        setError('Failed to load contract')
      }
    } catch (error) {
      console.error('Error fetching contract:', error)
      // Show demo contract on error for testing
      if (normalizedId === 'contract:test123') {
        setContract({
          id: 'contract:test123',
          title: 'Demo KOL Agreement',
          body: {
            title: 'Demo KOL Agreement',
            role: 'Key Opinion Leader',
            walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f6E123',
            startDate: '2024-01-01',
            endDate: '2024-12-31',
            terms: 'This is a demo contract for testing wallet connection.\n\nThe KOL agrees to:\n- Create content about the project\n- Engage with the community\n- Maintain professional standards',
            compensation: '$5000 USD per month',
            deliverables: ['5 tweets per week', '2 long-form posts per month', '1 community AMA per quarter']
          },
          status: 'draft'
        })
      } else {
        setError('Failed to load contract')
      }
    } finally {
      setLoading(false)
    }
  }

  const handleWalletConnect = (address: string, handle: string) => {
    setWalletAddress(address)
    setTwitterHandle(handle)
    setError('')
  }

  const handleWalletDisconnect = () => {
    setWalletAddress('')
    setTwitterHandle('')
    setSuccess(false)
  }

  const signContract = async () => {
    if (!walletAddress) {
      setError('Please connect your wallet first')
      return
    }

    setSigning(true)
    setError('')

    try {
      // In production, this would use EIP-712 signing
      const mockSignature = '0x' + Math.random().toString(16).substr(2, 130)
      
      const res = await fetch(`/api/contracts/${normalizedId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: mockSignature,
          signerAddress: walletAddress,
          twitterHandle,
          nonce: Date.now()
        })
      })

      if (res.ok) {
        const data = await res.json()
        setContract(data.contract)
        setSuccess(true)
      } else {
        const error = await res.json()
        setError(error.error || 'Failed to sign contract')
      }
    } catch (error) {
      console.error('Error signing contract:', error)
      setError('Failed to sign contract')
    } finally {
      setSigning(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-green-300 p-6">
        <div className="max-w-4xl mx-auto">
          <p>Loading contract...</p>
        </div>
      </div>
    )
  }

  if (error && !contract) {
    return (
      <div className="min-h-screen bg-black text-green-300 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900/20 border border-red-500 p-4 rounded">
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      </div>
    )
  }

  if (!contract) return null

  const isFullySigned = contract.adminSignature && contract.userSignature

  return (
    <div className="min-h-screen bg-black text-green-300 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Debug Section */}
        <div className="mb-6 p-4 bg-gray-900 border border-gray-700 rounded text-sm">
          <div className="flex items-center justify-between">
            <div>
              <p>Session Status: <span className="font-mono">{sessionStatus}</span></p>
              {session && (
                <p>Logged in as: <span className="font-mono">@{(session as any)?.twitterHandle || session?.user?.name || 'Unknown'}</span></p>
              )}
            </div>
            {session && (
              <button
                onClick={() => signOut({ callbackUrl: window.location.href })}
                className="px-3 py-1 bg-red-900 border border-red-500 hover:bg-red-800 rounded text-xs"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>

        <h1 className="text-2xl font-bold mb-6">Contract Signing</h1>

        {/* Contract Details */}
        <div className="bg-gray-900 border border-green-900 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">{contract.body.title}</h2>
          
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-gray-400">Role:</span>
              <span className="ml-2">{contract.body.role}</span>
            </div>
            
            <div>
              <span className="text-gray-400">Contract Period:</span>
              <span className="ml-2">
                {new Date(contract.body.startDate).toLocaleDateString()} - {new Date(contract.body.endDate).toLocaleDateString()}
              </span>
            </div>
            
            <div>
              <span className="text-gray-400">Wallet Address:</span>
              <span className="ml-2 font-mono text-xs">{contract.body.walletAddress}</span>
            </div>
            
            {contract.body.compensation && (
              <div>
                <span className="text-gray-400">Compensation:</span>
                <span className="ml-2">{contract.body.compensation}</span>
              </div>
            )}
            
            <div className="mt-4">
              <p className="text-gray-400 mb-2">Terms:</p>
              <p className="whitespace-pre-wrap bg-black p-3 rounded border border-gray-700">
                {contract.body.terms}
              </p>
            </div>
            
            {contract.body.deliverables && contract.body.deliverables.length > 0 && (
              <div className="mt-4">
                <p className="text-gray-400 mb-2">Deliverables:</p>
                <ul className="list-disc list-inside space-y-1">
                  {contract.body.deliverables.map((deliverable, index) => (
                    <li key={index}>{deliverable}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Signature Status */}
        <div className="bg-gray-900 border border-green-900 rounded-lg p-6 mb-6">
          <h3 className="font-bold mb-4">Signature Status</h3>
          
          <div className="space-y-2 text-sm">
            <div className="flex items-center justify-between">
              <span>Admin Signature:</span>
              <span className={contract.adminSignature ? 'text-green-400' : 'text-gray-500'}>
                {contract.adminSignature ? '✓ Signed' : 'Pending'}
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <span>User Signature:</span>
              <span className={contract.userSignature ? 'text-green-400' : 'text-gray-500'}>
                {contract.userSignature ? '✓ Signed' : 'Pending'}
              </span>
            </div>
            
            {contract.signerAddress && (
              <div className="mt-2 text-xs">
                <span className="text-gray-400">Signer:</span>
                <span className="ml-2 font-mono">{contract.signerAddress}</span>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        {!isFullySigned && (
          <div className="space-y-4">
            {/* Twitter Login + Wallet Connection Flow */}
            <TwitterSigningFlow 
              contractId={contractId}
              onWalletConnected={handleWalletConnect}
              onWalletDisconnected={handleWalletDisconnect}
            />
            
            {/* Sign Button - only show when wallet is connected */}
            {walletAddress && !success && (
              <button
                onClick={signContract}
                disabled={signing}
                className="w-full px-4 py-3 bg-green-900 border border-green-500 hover:bg-green-800 rounded font-medium disabled:opacity-50 transition-colors"
              >
                {signing ? 'Signing...' : 'Sign Contract'}
              </button>
            )}
            
            {success && (
              <div className="bg-green-900/20 border border-green-500 p-4 rounded">
                <p className="text-green-400 text-center">✓ Contract signed successfully!</p>
                {twitterHandle && (
                  <p className="text-sm text-gray-400 text-center mt-2">
                    Signed by @{twitterHandle} with wallet {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                  </p>
                )}
              </div>
            )}
            
            {error && (
              <div className="bg-red-900/20 border border-red-500 p-3 rounded">
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            )}
          </div>
        )}
        
        {isFullySigned && (
          <div className="bg-green-900/20 border border-green-500 p-4 rounded">
            <p className="text-green-400 text-center font-medium">
              ✓ This contract has been fully signed by both parties
            </p>
          </div>
        )}
      </div>
    </div>
  )
} 