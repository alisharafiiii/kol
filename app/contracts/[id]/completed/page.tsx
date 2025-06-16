'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'

export default function ContractCompletedPage() {
  const params = useParams()
  const router = useRouter()
  const contractId = params.id as string
  const [contract, setContract] = useState<any>(null)
  const [loading, setLoading] = useState(true)

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
          <h1 className="text-2xl font-bold mb-4">✓ Contract Fully Executed!</h1>
          <p>This contract has been signed by all parties and is now in effect.</p>
        </div>

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
            
            <div>
              <span className="text-gray-400">Status:</span>
              <span className="ml-2 text-green-400">Active</span>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-6">
          <h3 className="font-bold mb-4">Digital Signatures</h3>
          
          <div className="space-y-4">
            {contract.creatorSignature && (
              <div className="bg-black p-4 rounded">
                <p className="text-sm text-gray-400 mb-1">Creator Signature</p>
                <p className="font-mono text-xs mb-2">@{contract.creatorSignature.handle}</p>
                <p className="font-mono text-xs text-gray-500">
                  Signed: {new Date(contract.creatorSignature.signedAt).toLocaleString()}
                </p>
              </div>
            )}
            
            {contract.assigneeSignature && (
              <div className="bg-black p-4 rounded">
                <p className="text-sm text-gray-400 mb-1">Assignee Signature</p>
                <p className="font-mono text-xs mb-2">@{contract.assigneeSignature.handle}</p>
                <p className="font-mono text-xs text-gray-500">
                  Signed: {new Date(contract.assigneeSignature.signedAt).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-4">
          <button
            onClick={() => router.push('/contracts')}
            className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded"
          >
            Back to Contracts
          </button>
          <button
            onClick={() => window.print()}
            className="px-4 py-2 bg-green-900 hover:bg-green-800 rounded"
          >
            Print Contract
          </button>
        </div>
      </div>
    </div>
  )
} 