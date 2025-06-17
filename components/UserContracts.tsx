'use client'

import { useState, useEffect } from 'react'
import { FileText, Calendar, User, DollarSign } from 'lucide-react'

interface Contract {
  id: string
  title: string
  body: {
    role: string
    startDate: string
    endDate: string
    compensation?: string
  }
  status: string
  creatorTwitterHandle?: string
  recipientTwitterHandle?: string
  createdAt: string
}

interface UserContractsProps {
  twitterHandle: string
  isOwnProfile?: boolean
}

export function UserContracts({ twitterHandle, isOwnProfile = false }: UserContractsProps) {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    fetchContracts()
  }, [twitterHandle])

  const fetchContracts = async () => {
    try {
      const res = await fetch(`/api/user/contracts?handle=${twitterHandle}`)
      if (res.ok) {
        const data = await res.json()
        setContracts(data.contracts)
      } else {
        setError('Failed to load contracts')
      }
    } catch (err) {
      console.error('Error fetching contracts:', err)
      setError('Failed to load contracts')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
        <p className="text-gray-400">Loading contracts...</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
        <p className="text-red-400">{error}</p>
      </div>
    )
  }

  if (contracts.length === 0) {
    return (
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
        <p className="text-gray-400">
          {isOwnProfile ? 'You have no contracts yet.' : 'No contracts found.'}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold text-green-400 mb-4">
        Contracts ({contracts.length})
      </h3>
      
      {contracts.map((contract) => {
        const isCreator = contract.creatorTwitterHandle?.toLowerCase() === twitterHandle.toLowerCase()
        const role = isCreator ? 'Creator' : 'Recipient'
        const statusColor = {
          draft: 'text-gray-400',
          pending: 'text-yellow-400',
          signed: 'text-green-400',
          published: 'text-blue-400'
        }[contract.status] || 'text-gray-400'

        return (
          <div
            key={contract.id}
            className="bg-gray-900 border border-gray-700 rounded-lg p-4 hover:border-green-700 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-green-400" />
                <h4 className="font-medium text-green-300">{contract.title}</h4>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs bg-gray-800 px-2 py-1 rounded">
                  {role}
                </span>
                <span className={`text-xs ${statusColor}`}>
                  {contract.status}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2 text-gray-400">
                <User className="w-4 h-4" />
                <span>{contract.body.role}</span>
              </div>
              
              <div className="flex items-center gap-2 text-gray-400">
                <Calendar className="w-4 h-4" />
                <span>
                  {new Date(contract.body.startDate).toLocaleDateString()} - {new Date(contract.body.endDate).toLocaleDateString()}
                </span>
              </div>
              
              {contract.body.compensation && (
                <div className="flex items-center gap-2 text-gray-400 col-span-2">
                  <DollarSign className="w-4 h-4" />
                  <span>{contract.body.compensation}</span>
                </div>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between">
              <span className="text-xs text-gray-500">
                Created {new Date(contract.createdAt).toLocaleDateString()}
              </span>
              
              {contract.status === 'draft' || contract.status === 'pending' ? (
                <a
                  href={`/sign/${contract.id}`}
                  className="text-xs text-green-400 hover:text-green-300"
                >
                  View Contract →
                </a>
              ) : (
                <span className="text-xs text-green-400">
                  ✓ Signed
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
} 