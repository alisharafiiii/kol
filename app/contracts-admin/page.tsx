'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { hasAdminAccess } from '@/lib/admin-config'

interface Contract {
  id: string
  title: string
  body: any
  status: string
  createdAt: string
  signingUrl?: string
}

export default function ContractsAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    title: '',
    role: '',
    walletAddress: '',
    recipientTwitterHandle: '',
    startDate: '',
    endDate: '',
    terms: '',
    compensation: '',
    deliverables: ['']
  })

  // Check authentication and admin access
  useEffect(() => {
    if (status === 'loading') return

    if (!session?.user?.name) {
      router.push('/auth/signin')
      return
    }

    const userRole = (session as any)?.role || (session as any)?.user?.role
    if (!hasAdminAccess(session.user.name, userRole)) {
      router.push('/')
      return
    }

    fetchContracts()
  }, [session, status, router])

  const fetchContracts = async () => {
    try {
      const res = await fetch('/api/contracts')
      if (res.ok) {
        const data = await res.json()
        setContracts(data)
      } else {
        const errorData = await res.json()
        if (errorData.error === 'Contracts feature is disabled') {
          setError('Contracts feature is disabled. Please set ENABLE_CONTRACTS=true in environment variables.')
        } else {
          setError(errorData.error || 'Failed to fetch contracts')
        }
      }
    } catch (error) {
      console.error('Error fetching contracts:', error)
      setError('Failed to fetch contracts')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          deliverables: formData.deliverables.filter(d => d.trim())
        })
      })

      if (res.ok) {
        const contract = await res.json()
        alert(`Contract created! Signing URL: ${window.location.origin}${contract.signingUrl}`)
        setShowForm(false)
        fetchContracts()
        
        // Reset form
        setFormData({
          title: '',
          role: '',
          walletAddress: '',
          recipientTwitterHandle: '',
          startDate: '',
          endDate: '',
          terms: '',
          compensation: '',
          deliverables: ['']
        })
      } else {
        const errorData = await res.json()
        console.error('Contract creation error:', errorData)
        if (errorData.error === 'Contracts feature is disabled') {
          alert('Contracts feature is disabled. Please contact the administrator to enable it.')
        } else {
          alert(`Error: ${errorData.error || 'Failed to create contract'}`)
        }
      }
    } catch (error) {
      console.error('Error creating contract:', error)
      alert('Failed to create contract')
    }
  }

  const addDeliverable = () => {
    setFormData({
      ...formData,
      deliverables: [...formData.deliverables, '']
    })
  }

  const updateDeliverable = (index: number, value: string) => {
    const newDeliverables = [...formData.deliverables]
    newDeliverables[index] = value
    setFormData({ ...formData, deliverables: newDeliverables })
  }

  const removeDeliverable = (index: number) => {
    setFormData({
      ...formData,
      deliverables: formData.deliverables.filter((_, i) => i !== index)
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-green-300 p-6">
        <div className="max-w-6xl mx-auto">
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-green-300 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Contracts Admin</h1>

        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border border-red-500 rounded-lg">
            <p className="text-red-400">{error}</p>
            {error.includes('disabled') && (
              <p className="text-sm text-red-300 mt-2">
                To enable contracts, set ENABLE_CONTRACTS=true in your environment variables and restart the application.
              </p>
            )}
          </div>
        )}

        {!showForm ? (
          <>
            <button
              onClick={() => setShowForm(true)}
              className="mb-6 px-4 py-2 bg-green-900 border border-green-500 hover:bg-green-800 rounded"
            >
              Create New Contract
            </button>

            <div className="space-y-4">
              {contracts.length === 0 ? (
                <p className="text-gray-500">No contracts yet</p>
              ) : (
                contracts.map(contract => (
                  <div
                    key={contract.id}
                    className="p-4 border border-green-900 rounded-lg"
                  >
                    <h3 className="font-bold">{contract.title}</h3>
                    <p className="text-sm text-gray-400">
                      Status: <span className="text-green-400">{contract.status}</span>
                    </p>
                    <p className="text-sm text-gray-400">
                      Created: {new Date(contract.createdAt).toLocaleString()}
                    </p>
                    <p className="text-sm mt-2">
                      Signing URL: 
                      <a
                        href={`/sign/${contract.id.replace('contract:', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-2 text-blue-400 hover:underline"
                      >
                        {window.location.origin}/sign/{contract.id.replace('contract:', '')}
                      </a>
                    </p>
                  </div>
                ))
              )}
            </div>
          </>
        ) : (
          <form onSubmit={handleSubmit} className="max-w-2xl space-y-4">
            <div>
              <label className="block text-sm mb-1">Contract Title</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-green-500 rounded focus:outline-none focus:border-green-400"
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Role</label>
              <input
                type="text"
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-green-500 rounded focus:outline-none focus:border-green-400"
                placeholder="e.g., KOL, Ambassador, Advisor"
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Wallet Address</label>
              <input
                type="text"
                value={formData.walletAddress}
                onChange={(e) => setFormData({ ...formData, walletAddress: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-green-500 rounded focus:outline-none focus:border-green-400"
                placeholder="0x..."
                pattern="^0x[a-fA-F0-9]{40}$"
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Recipient Twitter Handle</label>
              <input
                type="text"
                value={formData.recipientTwitterHandle}
                onChange={(e) => setFormData({ ...formData, recipientTwitterHandle: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-green-500 rounded focus:outline-none focus:border-green-400"
                placeholder="@username (optional)"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm mb-1">Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded focus:outline-none focus:border-green-400"
                  required
                />
              </div>
              <div>
                <label className="block text-sm mb-1">End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded focus:outline-none focus:border-green-400"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm mb-1">Terms</label>
              <textarea
                value={formData.terms}
                onChange={(e) => setFormData({ ...formData, terms: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-green-500 rounded focus:outline-none focus:border-green-400"
                rows={4}
                required
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Compensation (optional)</label>
              <input
                type="text"
                value={formData.compensation}
                onChange={(e) => setFormData({ ...formData, compensation: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-green-500 rounded focus:outline-none focus:border-green-400"
                placeholder="e.g., $5000 USD per month"
              />
            </div>

            <div>
              <label className="block text-sm mb-1">Deliverables</label>
              {formData.deliverables.map((deliverable, index) => (
                <div key={index} className="flex gap-2 mb-2">
                  <input
                    type="text"
                    value={deliverable}
                    onChange={(e) => updateDeliverable(index, e.target.value)}
                    className="flex-1 px-3 py-2 bg-black border border-green-500 rounded focus:outline-none focus:border-green-400"
                    placeholder="e.g., 5 tweets per week"
                  />
                  {formData.deliverables.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeDeliverable(index)}
                      className="px-3 py-2 bg-red-900 border border-red-500 hover:bg-red-800 rounded"
                    >
                      Remove
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addDeliverable}
                className="text-sm text-green-400 hover:text-green-300"
              >
                + Add deliverable
              </button>
            </div>

            <div className="flex gap-4">
              <button
                type="submit"
                className="px-4 py-2 bg-green-900 border border-green-500 hover:bg-green-800 rounded"
              >
                Create Contract
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 bg-gray-900 border border-gray-500 hover:bg-gray-800 rounded"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
} 