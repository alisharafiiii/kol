'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'

export default function ContractCreatedPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const contractId = params.id as string
  const [contract, setContract] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchContract()
  }, [contractId])

  const fetchContract = async () => {
    try {
      const res = await fetch(`/api/contracts/${contractId}`)
      if (res.ok) {
        const data = await res.json()
        setContract(data)
      }
    } catch (error) {
      console.error('Error fetching contract:', error)
    } finally {
      setLoading(false)
    }
  }

  const copyShareLink = () => {
    if (contract?.shareLink) {
      navigator.clipboard.writeText(contract.shareLink)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-green-400 flex items-center justify-center">
        <p>Loading...</p>
      </div>
    )
  }

  if (!contract) {
    return (
      <div className="min-h-screen bg-black text-green-400 flex items-center justify-center">
        <p>Contract not found</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-green-400 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-green-900/20 border border-green-500 p-6 rounded-lg mb-6">
          <h1 className="text-2xl font-bold mb-4">✓ Contract Created Successfully!</h1>
          <p className="mb-4">Your contract has been created and signed by you.</p>
          
          <div className="bg-gray-900 p-4 rounded mb-4">
            <p className="text-sm text-gray-400 mb-2">Share this link with @{contract.assignedTo}:</p>
            <div className="flex gap-2">
              <input
                type="text"
                value={contract.shareLink}
                readOnly
                className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded text-sm"
              />
              <button
                onClick={copyShareLink}
                className="px-4 py-2 bg-green-900 hover:bg-green-800 rounded text-sm"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>

          <p className="text-sm text-gray-400">
            Only @{contract.assignedTo} on {contract.assignedPlatform} will be able to view and sign this contract.
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">{contract.title}</h2>
          
          <div className="space-y-4 text-sm">
            <div>
              <span className="text-gray-400">Assigned to:</span>
              <span className="ml-2">@{contract.assignedTo} ({contract.assignedPlatform})</span>
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
              <p className="text-gray-400 mb-2">Status:</p>
              <p className="text-yellow-400">⏳ Awaiting signature from @{contract.assignedTo}</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex gap-4">
          <button
            onClick={() => router.push('/contracts')}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded"
          >
            Back to Contracts
          </button>
          <button
            onClick={() => router.push(`/contracts/${contractId}/view`)}
            className="px-4 py-2 bg-green-900 hover:bg-green-800 rounded"
          >
            View Full Contract
          </button>
        </div>
      </div>
    </div>
  )
} 