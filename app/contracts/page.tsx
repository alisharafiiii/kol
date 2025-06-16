'use client'

import { useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { ContractSigner } from '@/modules/onchain-contracts/components/ContractSigner'

export default function ContractsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'create' | 'sign'>('create')

  if (status === 'loading') {
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
          <h1 className="text-2xl font-bold mb-6">Contract Management</h1>
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

  const twitterHandle = (session as any)?.twitterHandle || session?.user?.name || ''
  const profileImage = session?.user?.image || ''

  return (
    <div className="min-h-screen bg-black text-green-400 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-2xl font-bold">Contract Management</h1>
          <div className="flex items-center gap-4">
            {profileImage && (
              <img 
                src={profileImage} 
                alt={twitterHandle}
                className="w-8 h-8 rounded-full"
              />
            )}
            <span className="text-sm">@{twitterHandle}</span>
            <button
              onClick={() => signOut()}
              className="text-sm text-red-400 hover:text-red-300"
            >
              Sign Out
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 mb-8">
          <button
            onClick={() => setActiveTab('create')}
            className={`px-4 py-2 rounded ${
              activeTab === 'create' 
                ? 'bg-green-900 text-green-100' 
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            Create Contract
          </button>
          <button
            onClick={() => setActiveTab('sign')}
            className={`px-4 py-2 rounded ${
              activeTab === 'sign' 
                ? 'bg-green-900 text-green-100' 
                : 'bg-gray-800 text-gray-400'
            }`}
          >
            Sign Contract
          </button>
        </div>

        {/* Content */}
        {activeTab === 'create' ? (
          <CreateContract creatorHandle={twitterHandle} />
        ) : (
          <SignContract userHandle={twitterHandle} />
        )}
      </div>
    </div>
  )
}

function CreateContract({ creatorHandle }: { creatorHandle: string }) {
  const router = useRouter()
  const [formData, setFormData] = useState({
    title: '',
    assignedTo: '',
    assignedPlatform: 'twitter' as 'twitter' | 'farcaster',
    description: '',
    terms: '',
    compensation: '',
    startDate: '',
    endDate: '',
    deliverables: ['']
  })
  const [files, setFiles] = useState<File[]>([])
  const [creating, setCreating] = useState(false)
  const [showSigner, setShowSigner] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    // Show the wallet signer modal
    setShowSigner(true)
  }

  const handleContractSign = async (signature: string, walletAddress: string) => {
    setCreating(true)
    setShowSigner(false)

    try {
      // Create form data for file upload
      const formDataToSend = new FormData()
      formDataToSend.append('contractData', JSON.stringify({
        ...formData,
        creatorHandle,
        creatorWallet: walletAddress,
        creatorSignature: signature,
        createdAt: new Date().toISOString()
      }))
      
      files.forEach((file, index) => {
        formDataToSend.append(`file-${index}`, file)
      })

      const res = await fetch('/api/contracts/create', {
        method: 'POST',
        body: formDataToSend
      })

      if (res.ok) {
        const { contractId, shareLink } = await res.json()
        router.push(`/contracts/${contractId}/created`)
      }
    } catch (error) {
      console.error('Error creating contract:', error)
    } finally {
      setCreating(false)
    }
  }

  const addDeliverable = () => {
    setFormData(prev => ({
      ...prev,
      deliverables: [...prev.deliverables, '']
    }))
  }

  const updateDeliverable = (index: number, value: string) => {
    const newDeliverables = [...formData.deliverables]
    newDeliverables[index] = value
    setFormData(prev => ({ ...prev, deliverables: newDeliverables }))
  }

  const removeDeliverable = (index: number) => {
    setFormData(prev => ({
      ...prev,
      deliverables: prev.deliverables.filter((_, i) => i !== index)
    }))
  }

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm mb-2">Contract Title</label>
          <input
            type="text"
            required
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:border-green-500 focus:outline-none"
            placeholder="e.g., KOL Partnership Agreement"
          />
        </div>

        {/* Assign To */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-2">Assign To Handle</label>
            <input
              type="text"
              required
              value={formData.assignedTo}
              onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:border-green-500 focus:outline-none"
              placeholder="@username"
            />
          </div>
          <div>
            <label className="block text-sm mb-2">Platform</label>
            <select
              value={formData.assignedPlatform}
              onChange={(e) => setFormData(prev => ({ ...prev, assignedPlatform: e.target.value as 'twitter' | 'farcaster' }))}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:border-green-500 focus:outline-none"
            >
              <option value="twitter">Twitter/X</option>
              <option value="farcaster">Farcaster</option>
            </select>
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm mb-2">Description</label>
          <textarea
            required
            value={formData.description}
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:border-green-500 focus:outline-none"
            rows={3}
            placeholder="Brief description of the contract..."
          />
        </div>

        {/* Terms */}
        <div>
          <label className="block text-sm mb-2">Terms & Conditions</label>
          <textarea
            required
            value={formData.terms}
            onChange={(e) => setFormData(prev => ({ ...prev, terms: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:border-green-500 focus:outline-none"
            rows={5}
            placeholder="Detailed terms and conditions..."
          />
        </div>

        {/* Compensation */}
        <div>
          <label className="block text-sm mb-2">Compensation</label>
          <input
            type="text"
            value={formData.compensation}
            onChange={(e) => setFormData(prev => ({ ...prev, compensation: e.target.value }))}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:border-green-500 focus:outline-none"
            placeholder="e.g., $5000 USD per month"
          />
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm mb-2">Start Date</label>
            <input
              type="date"
              required
              value={formData.startDate}
              onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:border-green-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-sm mb-2">End Date</label>
            <input
              type="date"
              required
              value={formData.endDate}
              onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
              className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:border-green-500 focus:outline-none"
            />
          </div>
        </div>

        {/* Deliverables */}
        <div>
          <label className="block text-sm mb-2">Deliverables</label>
          {formData.deliverables.map((deliverable, index) => (
            <div key={index} className="flex gap-2 mb-2">
              <input
                type="text"
                value={deliverable}
                onChange={(e) => updateDeliverable(index, e.target.value)}
                className="flex-1 px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:border-green-500 focus:outline-none"
                placeholder="e.g., 5 tweets per week"
              />
              {formData.deliverables.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDeliverable(index)}
                  className="px-3 py-2 bg-red-900 hover:bg-red-800 rounded"
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
            + Add Deliverable
          </button>
        </div>

        {/* File Upload */}
        <div>
          <label className="block text-sm mb-2">Attachments (PDF, Images)</label>
          <input
            type="file"
            multiple
            accept=".pdf,image/*"
            onChange={(e) => setFiles(Array.from(e.target.files || []))}
            className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:border-green-500 focus:outline-none"
          />
          {files.length > 0 && (
            <div className="mt-2 text-sm text-gray-400">
              {files.length} file(s) selected
            </div>
          )}
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={creating}
          className="w-full px-4 py-3 bg-green-900 hover:bg-green-800 disabled:opacity-50 rounded font-medium"
        >
          {creating ? 'Creating Contract...' : 'Create Contract'}
        </button>
      </form>

      {/* Contract Signer Modal */}
      {showSigner && (
        <ContractSigner
          contractData={formData}
          onSign={handleContractSign}
          onCancel={() => setShowSigner(false)}
          signingType="create"
        />
      )}
    </>
  )
}

function SignContract({ userHandle }: { userHandle: string }) {
  const [contractId, setContractId] = useState('')
  const router = useRouter()

  const handleSign = () => {
    if (contractId) {
      router.push(`/contracts/${contractId}/sign`)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <label className="block text-sm mb-2">Contract ID or Link</label>
        <input
          type="text"
          value={contractId}
          onChange={(e) => setContractId(e.target.value)}
          className="w-full px-3 py-2 bg-gray-900 border border-gray-700 rounded focus:border-green-500 focus:outline-none"
          placeholder="Enter contract ID or paste share link"
        />
      </div>

      <button
        onClick={handleSign}
        disabled={!contractId}
        className="w-full px-4 py-3 bg-green-900 hover:bg-green-800 disabled:opacity-50 rounded font-medium"
      >
        View & Sign Contract
      </button>

      <div className="mt-8 p-4 bg-gray-900 rounded">
        <p className="text-sm text-gray-400">
          Only contracts assigned to your handle (@{userHandle}) will be accessible to you.
        </p>
      </div>
    </div>
  )
} 