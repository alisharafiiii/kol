'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'

export default function SignContractPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const contractId = params.id as string
  const [contract, setContract] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [signing, setSigning] = useState(false)
  const [error, setError] = useState('')

  const userHandle = (session as any)?.twitterHandle || session?.user?.name || ''

  useEffect(() => {
    if (status === 'authenticated') {
      fetchContract()
    }
  }, [contractId, status])

  const fetchContract = async () => {
    try {
      const res = await fetch(`/api/contracts/${contractId}`)
      if (res.ok) {
        const data = await res.json()
        setContract(data)
        
        // Check if user is authorized to view this contract
        const normalizedUserHandle = userHandle.replace('@', '').toLowerCase()
        const normalizedAssignee = data.assignedTo.replace('@', '').toLowerCase()
        
        if (normalizedUserHandle !== normalizedAssignee && data.assignedPlatform === 'twitter') {
          setError(`This contract is assigned to @${data.assignedTo}. You are signed in as @${userHandle}.`)
        }
      } else {
        setError('Contract not found')
      }
    } catch (error) {
      console.error('Error fetching contract:', error)
      setError('Failed to load contract')
    } finally {
      setLoading(false)
    }
  }

  const handleSign = async () => {
    setSigning(true)
    try {
      const res = await fetch(`/api/contracts/${contractId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: `assignee_sig_${Date.now()}`, // In production, use actual signature
          signerHandle: userHandle
        })
      })

      if (res.ok) {
        router.push(`/contracts/${contractId}/completed`)
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to sign contract')
      }
    } catch (error) {
      console.error('Error signing contract:', error)
      setError('Failed to sign contract')
    } finally {
      setSigning(false)
    }
  }

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-black text-green-400 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-black text-green-400 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-6">Sign Contract</h1>
          <p className="mb-6 text-gray-400">Please sign in to view and sign this contract</p>
          <button
            onClick={() => signIn('twitter')}
            className="px-6 py-3 bg-blue-600 hover:bg-blue-700 rounded-lg font-medium"
          >
            Sign in with X (Twitter)
          </button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-green-400 flex items-center justify-center">
        <div className="text-center">
          <div className="bg-red-900/20 border border-red-500 p-6 rounded-lg max-w-md">
            <p className="text-red-400">{error}</p>
          </div>
          <button
            onClick={() => router.push('/contracts')}
            className="mt-4 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded"
          >
            Go to Contracts
          </button>
        </div>
      </div>
    )
  }

  if (!contract) return null

  const isAlreadySigned = contract.assigneeSignature !== null

  return (
    <div className="min-h-screen bg-black text-green-400 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Contract Review & Signature</h1>

        {/* Contract Details */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-6">
          <h2 className="text-xl font-bold mb-4">{contract.title}</h2>
          
          <div className="space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <span className="text-gray-400">Created by:</span>
                <span className="ml-2">@{contract.creatorHandle}</span>
              </div>
              <div>
                <span className="text-gray-400">Assigned to:</span>
                <span className="ml-2">@{contract.assignedTo}</span>
              </div>
            </div>
            
            <div>
              <span className="text-gray-400">Period:</span>
              <span className="ml-2">
                {new Date(contract.startDate).toLocaleDateString()} - {new Date(contract.endDate).toLocaleDateString()}
              </span>
            </div>
            
            {contract.compensation && (
              <div>
                <span className="text-gray-400">Compensation:</span>
                <span className="ml-2">{contract.compensation}</span>
              </div>
            )}
            
            <div>
              <p className="text-gray-400 mb-2">Description:</p>
              <p className="bg-black p-3 rounded">{contract.description}</p>
            </div>
            
            <div>
              <p className="text-gray-400 mb-2">Terms & Conditions:</p>
              <p className="bg-black p-3 rounded whitespace-pre-wrap">{contract.terms}</p>
            </div>
            
            {contract.deliverables && contract.deliverables.length > 0 && (
              <div>
                <p className="text-gray-400 mb-2">Deliverables:</p>
                <ul className="list-disc list-inside bg-black p-3 rounded">
                  {contract.deliverables.filter((d: string) => d).map((deliverable: string, index: number) => (
                    <li key={index}>{deliverable}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {contract.attachments && contract.attachments.length > 0 && (
              <div>
                <p className="text-gray-400 mb-2">Attachments:</p>
                <div className="space-y-2">
                  {contract.attachments.map((attachment: string, index: number) => (
                    <a
                      key={index}
                      href={attachment}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-blue-400 hover:text-blue-300"
                    >
                      📎 Attachment {index + 1}
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Signature Status */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-6">
          <h3 className="font-bold mb-4">Signatures</h3>
          
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span>Creator (@{contract.creatorHandle}):</span>
              <span className="text-green-400">✓ Signed</span>
            </div>
            
            <div className="flex items-center justify-between">
              <span>Assignee (@{contract.assignedTo}):</span>
              <span className={isAlreadySigned ? 'text-green-400' : 'text-yellow-400'}>
                {isAlreadySigned ? '✓ Signed' : '⏳ Pending'}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        {!isAlreadySigned ? (
          <div className="bg-blue-900/20 border border-blue-500 p-6 rounded-lg">
            <p className="mb-4">
              By signing this contract, you agree to the terms and conditions outlined above.
            </p>
            <button
              onClick={handleSign}
              disabled={signing}
              className="w-full px-4 py-3 bg-green-900 hover:bg-green-800 disabled:opacity-50 rounded font-medium"
            >
              {signing ? 'Signing...' : 'Sign Contract'}
            </button>
          </div>
        ) : (
          <div className="bg-green-900/20 border border-green-500 p-6 rounded-lg">
            <p className="text-green-400 text-center">
              ✓ You have already signed this contract
            </p>
          </div>
        )}
      </div>
    </div>
  )
} 