'use client'

import { useSession } from 'next-auth/react'
import { useState, useEffect, useRef } from 'react'
import Image from 'next/image'
import { ContractsLoginModal } from './ContractsLoginModal'
import { ContractsWalletButton } from './ContractsWalletButton'

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
  ipfsHash?: string
  chainId?: number
  files?: Array<{ url: string, name: string }>
  fileUrl?: string
  fileName?: string
}

export default function ContractsPage() {
  const { data: session } = useSession()
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState<'hub' | 'create' | 'sign' | 'my-contracts'>('hub')
  const [showLoginModal, setShowLoginModal] = useState(false)
  const [walletAddress, setWalletAddress] = useState('')
  const [userProfile, setUserProfile] = useState<any>(null)
  
  // Contract creation state
  const [contractTitle, setContractTitle] = useState('')
  const [contractDescription, setContractDescription] = useState('')
  const [contractParties, setContractParties] = useState<Array<{address: string, name: string, role: 'signer' | 'witness'}>>([])
  const [newPartyAddress, setNewPartyAddress] = useState('')
  const [newPartyName, setNewPartyName] = useState('')
  const [newPartyRole, setNewPartyRole] = useState<'signer' | 'witness'>('signer')
  const [contractFiles, setContractFiles] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // State
  const [isCreating, setIsCreating] = useState(false)
  const [shareLink, setShareLink] = useState('')
  const [showShareModal, setShowShareModal] = useState(false)

  useEffect(() => {
    console.log('Contracts page - Session status:', { session, hasSession: !!session })
    if (session) {
      fetchUserProfile()
      fetchContracts()
      setShowLoginModal(false)
    } else {
      setLoading(false)
    }
  }, [session])

  const fetchUserProfile = async () => {
    if (!session) return
    
    // Use the Twitter handle from session, not the display name
    const twitterHandle = (session as any)?.twitterHandle || (session?.user as any)?.twitterHandle
    
    if (!twitterHandle) {
      console.log('Contracts page - No Twitter handle found in session')
      return
    }
    
    try {
      console.log('Fetching profile for:', twitterHandle)
      const res = await fetch(`/api/user/profile?handle=${encodeURIComponent(twitterHandle)}`)
      if (res.ok) {
        const data = await res.json()
        console.log('Profile response:', data)
        if (data.user) {
          setUserProfile(data.user)
        } else {
          setUserProfile(data)
        }
      } else {
        console.error('Profile fetch failed:', res.status)
      }
    } catch (error) {
      console.error('Error fetching user profile:', error)
    }
  }

  const fetchContracts = async () => {
    try {
      const response = await fetch('/api/contracts')
      if (response.ok) {
        const data = await response.json()
        console.log('Fetched contracts:', data)
        setContracts(data.contracts || [])
      }
    } catch (error) {
      console.error('Failed to fetch contracts:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files) {
      const fileArray = Array.from(files)
      
      // Check total size (max 50MB for all files)
      const totalSize = fileArray.reduce((sum, file) => sum + file.size, 0)
      if (totalSize > 50 * 1024 * 1024) {
        alert('Total file size must be less than 50MB')
        return
      }
      
      // Check individual file sizes (max 10MB each)
      const oversizedFiles = fileArray.filter(file => file.size > 10 * 1024 * 1024)
      if (oversizedFiles.length > 0) {
        alert('Each file must be less than 10MB')
        return
      }
      
      setContractFiles(fileArray)
    }
  }

  const uploadFiles = async (files: File[]): Promise<{ url: string, name: string }[]> => {
    const uploadedFiles: { url: string, name: string }[] = []
    
    for (const file of files) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        
        const response = await fetch('/api/upload/contract-file', {
          method: 'POST',
          body: formData
        })
        
        if (response.ok) {
          const data = await response.json()
          uploadedFiles.push({ url: data.url, name: file.name })
        }
      } catch (error) {
        console.error('Error uploading file:', error)
      }
    }
    
    return uploadedFiles
  }

  const removeFile = (index: number) => {
    setContractFiles(contractFiles.filter((_, i) => i !== index))
  }

  const handleCreateContract = async () => {
    if (!contractTitle || !contractDescription) {
      alert('Please fill in all required fields')
      return
    }

    if (!walletAddress) {
      alert('Please connect your wallet first')
      return
    }

    setIsCreating(true)

    try {
      // Upload files if provided
      let uploadedFiles: { url: string, name: string }[] = []
      if (contractFiles.length > 0) {
        uploadedFiles = await uploadFiles(contractFiles)
      }

      // Use the actual Twitter handle from the user profile
      const creatorHandle = userProfile?.twitterHandle || (session as any)?.twitterHandle || 'unknown'

      const response = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: contractTitle,
          description: contractDescription,
          parties: contractParties,
          files: uploadedFiles,
          walletAddress,
          creatorHandle // Pass the actual handle
        })
      })

      if (response.ok) {
        const newContract = await response.json()
        console.log('Contract created:', newContract)
        
        // Generate share link
        const contractId = newContract.id.replace('contract:', '')
        const link = `${window.location.origin}/contracts/sign/${contractId}`
        setShareLink(link)
        setShowShareModal(true)
        
        setContractTitle('')
        setContractDescription('')
        setContractParties([])
        setContractFiles([])
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
        await fetchContracts() // Refresh the contracts list
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to create contract')
      }
    } catch (error) {
      console.error('Error creating contract:', error)
      alert('Failed to create contract')
    } finally {
      setIsCreating(false)
    }
  }

  const handleSignContract = async (contractId: string) => {
    if (!walletAddress) {
      alert('Please connect your wallet first')
      return
    }

    try {
      const response = await fetch(`/api/contracts/${contractId}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signature: 'wallet-signed',
          walletAddress
        })
      })

      if (response.ok) {
        alert('Contract signed successfully!')
        await fetchContracts()
      } else {
        const error = await response.json()
        alert(error.error || 'Failed to sign contract')
      }
    } catch (error) {
      console.error('Error signing contract:', error)
      alert('Failed to sign contract')
    }
  }

  const copyShareLink = (contractId: string) => {
    const id = contractId.replace('contract:', '')
    const link = `${window.location.origin}/contracts/sign/${id}`
    navigator.clipboard.writeText(link)
    alert('Share link copied to clipboard!')
  }

  const addParty = () => {
    if (!newPartyAddress || !newPartyName) {
      alert('Please enter both address and name')
      return
    }

    // Normalize Twitter handle - remove @ if present
    const normalizedName = newPartyName.startsWith('@') ? newPartyName.slice(1) : newPartyName

    setContractParties([...contractParties, {
      address: newPartyAddress,
      name: normalizedName,
      role: newPartyRole
    }])
    setNewPartyAddress('')
    setNewPartyName('')
  }

  const removeParty = (index: number) => {
    setContractParties(contractParties.filter((_, i) => i !== index))
  }

  // Filter contracts based on view - use the actual Twitter handle
  const getFilteredContracts = () => {
    const userHandle = userProfile?.twitterHandle || (session as any)?.twitterHandle
    if (!userHandle) return []
    
    // Normalize handle - remove @ and convert to lowercase
    const normalizedHandle = userHandle.toLowerCase().replace('@', '')
    
    switch (activeView) {
      case 'sign':
        // Contracts where user needs to sign
        return contracts.filter(contract => 
          contract.parties.some(party => 
            party.name === normalizedHandle && 
            !party.signed && 
            party.role !== 'creator'
          )
        )
      case 'my-contracts':
        // All contracts user is involved in
        return contracts.filter(contract =>
          contract.creator === normalizedHandle ||
          contract.parties.some(party => party.name === normalizedHandle)
        )
      default:
        return contracts
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    )
  }

  if (!session) {
    return (
      <>
        <div className="min-h-screen bg-black text-white flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-3xl font-bold mb-4">Please log in to access contracts</h1>
            <button
              onClick={() => setShowLoginModal(true)}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg font-semibold"
            >
              Log in with X
            </button>
          </div>
        </div>
        <ContractsLoginModal show={showLoginModal} />
      </>
    )
  }

  const userImage = session?.user?.image || '/default-avatar.png'
  // Always use the Twitter handle from the profile, not the display name
  const displayHandle = userProfile?.twitterHandle || (session as any)?.twitterHandle || 'Unknown'
  const userHandle = userProfile?.twitterHandle || (session as any)?.twitterHandle || 'Unknown'

  return (
    <div className="min-h-screen bg-black text-white">
      {/* Header with user info */}
      <div className="border-b border-gray-800 p-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl font-bold">Contracts</h1>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="hidden sm:block">
              <ContractsWalletButton onConnect={setWalletAddress} onDisconnect={() => setWalletAddress('')} />
            </div>
            <span className="text-gray-400 text-sm sm:text-base">{displayHandle.replace('@', '')}</span>
            <Image
              src={userImage}
              alt={displayHandle}
              width={40}
              height={40}
              className="rounded-full w-8 h-8 sm:w-10 sm:h-10"
            />
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-4 sm:p-6">
        {/* Mobile wallet button */}
        {activeView === 'hub' && (
          <div className="sm:hidden mb-4">
            <ContractsWalletButton onConnect={setWalletAddress} onDisconnect={() => setWalletAddress('')} />
          </div>
        )}

        {activeView === 'hub' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6 mt-4 sm:mt-12">
            <button
              onClick={() => setActiveView('create')}
              className="bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded-xl p-6 sm:p-8 text-center transition-all"
            >
              <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">📝</div>
              <h2 className="text-lg sm:text-xl font-bold mb-2">Create Contract</h2>
              <p className="text-gray-400 text-sm sm:text-base">Create a new contract for others to sign</p>
            </button>

            <button
              onClick={() => setActiveView('sign')}
              className="bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded-xl p-6 sm:p-8 text-center transition-all relative"
            >
              <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">✍️</div>
              <h2 className="text-lg sm:text-xl font-bold mb-2">Sign Contracts</h2>
              <p className="text-gray-400 text-sm sm:text-base">View and sign contracts waiting for you</p>
              {contracts.filter(c => {
                const normalizedHandle = userHandle.toLowerCase().replace('@', '')
                return c.parties.some(p => 
                  p.name === normalizedHandle && 
                  !p.signed && 
                  p.role !== 'creator'
                )
              }).length > 0 && (
                <div className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-red-500 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs sm:text-sm">
                  {contracts.filter(c => {
                    const normalizedHandle = userHandle.toLowerCase().replace('@', '')
                    return c.parties.some(p => 
                      p.name === normalizedHandle && 
                      !p.signed && 
                      p.role !== 'creator'
                    )
                  }).length}
                </div>
              )}
            </button>

            <button
              onClick={() => setActiveView('my-contracts')}
              className="bg-gray-900 hover:bg-gray-800 border border-gray-700 rounded-xl p-6 sm:p-8 text-center transition-all relative"
            >
              <div className="text-3xl sm:text-4xl mb-3 sm:mb-4">📁</div>
              <h2 className="text-lg sm:text-xl font-bold mb-2">My Contracts</h2>
              <p className="text-gray-400 text-sm sm:text-base">View all contracts you&apos;re involved in</p>
              {contracts.filter(c => {
                const normalizedHandle = userHandle.toLowerCase().replace('@', '')
                const isInvolved = c.creator === normalizedHandle || c.parties.some(p => p.name === normalizedHandle)
                const hasPendingSignatures = c.parties.some(p => p.role !== 'creator' && !p.signed)
                return isInvolved && hasPendingSignatures
              }).length > 0 && (
                <div className="absolute top-3 right-3 sm:top-4 sm:right-4 bg-yellow-500 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center text-xs sm:text-sm">
                  {contracts.filter(c => {
                    const normalizedHandle = userHandle.toLowerCase().replace('@', '')
                    const isInvolved = c.creator === normalizedHandle || c.parties.some(p => p.name === normalizedHandle)
                    const hasPendingSignatures = c.parties.some(p => p.role !== 'creator' && !p.signed)
                    return isInvolved && hasPendingSignatures
                  }).length}
                </div>
              )}
            </button>
          </div>
        )}

        {activeView === 'create' && (
          <div className="max-w-2xl mx-auto">
            <button
              onClick={() => setActiveView('hub')}
              className="mb-4 sm:mb-6 text-gray-400 hover:text-white flex items-center gap-2 text-sm sm:text-base"
            >
              ← Back to hub
            </button>

            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Create New Contract</h2>

            {!walletAddress && (
              <div className="mb-4 sm:mb-6 p-3 sm:p-4 bg-yellow-900/20 border border-yellow-600 rounded-lg">
                <p className="text-yellow-500 text-sm sm:text-base">Please connect your wallet to create contracts</p>
              </div>
            )}

            <div className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2">Contract Title</label>
                <input
                  type="text"
                  value={contractTitle}
                  onChange={(e) => setContractTitle(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base focus:outline-none focus:border-blue-500"
                  placeholder="Enter contract title"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Description</label>
                <textarea
                  value={contractDescription}
                  onChange={(e) => setContractDescription(e.target.value)}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 sm:px-4 py-2 h-24 sm:h-32 text-sm sm:text-base focus:outline-none focus:border-blue-500"
                  placeholder="Enter contract description and terms"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Upload Contract Files (Optional)</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  onChange={handleFileChange}
                  accept=".pdf,.doc,.docx,.txt,.jpg,.jpeg,.png"
                  multiple
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base focus:outline-none focus:border-blue-500"
                />
                {contractFiles.length > 0 && (
                  <div className="mt-2 space-y-2">
                    {contractFiles.map((file, index) => (
                      <div key={index} className="flex items-center justify-between bg-gray-800 p-2 rounded text-sm">
                        <span className="text-gray-400 truncate mr-2">
                          {file.name} ({(file.size / 1024 / 1024).toFixed(2)} MB)
                        </span>
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="text-red-500 hover:text-red-400 text-sm whitespace-nowrap"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <p className="text-xs text-gray-500">
                      Total: {contractFiles.length} file(s), {(contractFiles.reduce((sum, f) => sum + f.size, 0) / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Add Parties</label>
                <p className="text-xs text-gray-500 mb-2">Note: Parties must be logged in with their Twitter/X account to sign</p>
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                  <input
                    type="text"
                    value={newPartyName}
                    onChange={(e) => setNewPartyName(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base focus:outline-none focus:border-blue-500"
                    placeholder="Twitter handle (without @)"
                  />
                  <input
                    type="text"
                    value={newPartyAddress}
                    onChange={(e) => setNewPartyAddress(e.target.value)}
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base focus:outline-none focus:border-blue-500"
                    placeholder="Wallet address"
                  />
                  <select
                    value={newPartyRole}
                    onChange={(e) => setNewPartyRole(e.target.value as 'signer' | 'witness')}
                    className="bg-gray-900 border border-gray-700 rounded-lg px-3 sm:px-4 py-2 text-sm sm:text-base focus:outline-none focus:border-blue-500"
                  >
                    <option value="signer">Signer</option>
                    <option value="witness">Witness</option>
                  </select>
                  <button
                    onClick={addParty}
                    className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-semibold text-sm sm:text-base"
                  >
                    Add
                  </button>
                </div>

                {contractParties.length > 0 && (
                  <div className="space-y-2">
                    {contractParties.map((party, index) => (
                      <div key={index} className="flex flex-col sm:flex-row sm:items-center justify-between bg-gray-900 border border-gray-700 rounded-lg p-3 sm:px-4 sm:py-2 gap-2">
                        <div className="flex-1">
                          <span className="font-medium text-sm sm:text-base">{party.name}</span>
                          <span className="text-gray-400 ml-2 text-sm">({party.role})</span>
                          <div className="text-gray-500 text-xs sm:text-sm mt-1 sm:mt-0 sm:inline sm:ml-2 break-all">{party.address}</div>
                        </div>
                        <button
                          onClick={() => removeParty(index)}
                          className="text-red-500 hover:text-red-400 text-sm self-end sm:self-auto"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleCreateContract}
                disabled={isCreating || !walletAddress}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 py-3 rounded-lg font-semibold text-sm sm:text-base"
              >
                {isCreating ? 'Creating Contract...' : 'Create Contract'}
              </button>
            </div>
          </div>
        )}

        {activeView === 'sign' && (
          <div>
            <button
              onClick={() => setActiveView('hub')}
              className="mb-4 sm:mb-6 text-gray-400 hover:text-white flex items-center gap-2 text-sm sm:text-base"
            >
              ← Back to hub
            </button>

            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">Contracts Waiting for Your Signature</h2>

            {getFilteredContracts().length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-gray-400">
                <p className="text-sm sm:text-base">No contracts waiting for your signature</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:gap-4">
                {getFilteredContracts().map((contract) => {
                  // Calculate signing progress
                  const totalParties = contract.parties.filter(p => p.role !== 'creator').length
                  const signedParties = contract.parties.filter(p => p.role !== 'creator' && p.signed).length
                  const signingProgress = totalParties > 0 ? (signedParties / totalParties) * 100 : 0
                  
                  return (
                    <div key={contract.id} className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 sm:mb-4 gap-2">
                        <div className="flex-1">
                          <h3 className="text-lg sm:text-xl font-bold">{contract.title}</h3>
                          <p className="text-gray-400 mt-1 text-sm">Created by {contract.creator}</p>
                        </div>
                        <span className="text-xs sm:text-sm text-yellow-500 bg-yellow-500/20 px-2 sm:px-3 py-1 rounded-full self-start">
                          Awaiting Your Signature
                        </span>
                      </div>
                      
                      <p className="text-gray-300 mb-3 sm:mb-4 text-sm sm:text-base">{contract.description}</p>
                      
                      {contract.files && contract.files.length > 0 && (
                        <div className="mb-3 sm:mb-4">
                          <p className="text-xs sm:text-sm text-gray-400 mb-2">
                            📎 {contract.files.length} attachment{contract.files.length > 1 ? 's' : ''}
                          </p>
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
                                        className="w-full h-auto rounded max-h-48 object-contain"
                                      />
                                    </div>
                                  )}
                                  <div className="p-2 flex items-center justify-between">
                                    <p className="text-xs text-gray-300 truncate flex-1">{file.name}</p>
                                    <a 
                                      href={file.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-400 hover:text-blue-300 text-xs ml-2"
                                    >
                                      View
                                    </a>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      
                      {!contract.files && contract.fileName && (
                        <div className="mb-3 sm:mb-4">
                          <p className="text-xs sm:text-sm text-gray-400 mb-2">
                            📎 Attachment: {contract.fileName}
                          </p>
                          {contract.fileUrl && (
                            <div className="bg-gray-800 rounded overflow-hidden">
                              {/\.(jpg|jpeg|png|gif|webp)$/i.test(contract.fileName) && (
                                <div className="p-2">
                                  <img 
                                    src={contract.fileUrl} 
                                    alt={contract.fileName}
                                    className="w-full h-auto rounded max-h-48 object-contain"
                                  />
                                </div>
                              )}
                              <div className="p-2">
                                <a 
                                  href={contract.fileUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 text-xs"
                                >
                                  View File
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Show other signers status */}
                      {totalParties > 1 && (
                        <div className="mb-3 sm:mb-4">
                          <h4 className="text-xs sm:text-sm font-medium text-gray-400 mb-1">Other Signers:</h4>
                          <div className="space-y-1">
                            {contract.parties
                              .filter(p => p.role !== 'creator' && p.name !== userHandle.toLowerCase().replace('@', ''))
                              .map((party, idx) => (
                                <div key={idx} className="flex items-center gap-2 text-xs sm:text-sm">
                                  <span className={party.signed ? 'text-green-500' : 'text-gray-500'}>
                                    {party.signed ? '✓' : '○'}
                                  </span>
                                  <span>{party.name}</span>
                                  {party.signed ? (
                                    <span className="text-green-500 text-xs">signed</span>
                                  ) : (
                                    <span className="text-gray-500 text-xs">pending</span>
                                  )}
                                </div>
                              ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                        <span className="text-xs sm:text-sm text-gray-500">
                          Created {new Date(contract.createdAt).toLocaleDateString()}
                        </span>
                        <button
                          onClick={() => handleSignContract(contract.id)}
                          disabled={!walletAddress}
                          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 sm:px-6 py-2 rounded-lg font-semibold text-sm sm:text-base w-full sm:w-auto"
                        >
                          Sign Contract
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {activeView === 'my-contracts' && (
          <div>
            <button
              onClick={() => setActiveView('hub')}
              className="mb-4 sm:mb-6 text-gray-400 hover:text-white flex items-center gap-2 text-sm sm:text-base"
            >
              ← Back to hub
            </button>

            <h2 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">My Contracts</h2>

            {getFilteredContracts().length === 0 ? (
              <div className="text-center py-8 sm:py-12 text-gray-400">
                <p className="text-sm sm:text-base">You have no contracts yet</p>
              </div>
            ) : (
              <div className="grid gap-3 sm:gap-4">
                {getFilteredContracts().map((contract) => {
                  const normalizedHandle = userHandle.toLowerCase().replace('@', '')
                  const userParty = contract.parties.find(p => 
                    p.name === normalizedHandle
                  )
                  const isCreator = contract.creator === normalizedHandle
                  
                  // Calculate signing progress
                  const totalParties = contract.parties.filter(p => p.role !== 'creator').length
                  const signedParties = contract.parties.filter(p => p.role !== 'creator' && p.signed).length
                  const signingProgress = totalParties > 0 ? (signedParties / totalParties) * 100 : 0
                  
                  return (
                    <div key={contract.id} className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6">
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3 sm:mb-4 gap-2">
                        <div className="flex-1">
                          <h3 className="text-lg sm:text-xl font-bold">{contract.title}</h3>
                          <p className="text-gray-400 mt-1 text-sm">
                            {isCreator ? 'You created this' : `Created by ${contract.creator}`}
                          </p>
                        </div>
                        <span className={`text-xs sm:text-sm px-2 sm:px-3 py-1 rounded-full self-start ${
                          contract.status === 'completed' 
                            ? 'text-green-500 bg-green-500/20'
                            : contract.status === 'pending'
                            ? 'text-yellow-500 bg-yellow-500/20'
                            : 'text-gray-500 bg-gray-500/20'
                        }`}>
                          {contract.status === 'completed' ? 'Completed' : 
                           contract.status === 'pending' ? 'Pending' : 'Draft'}
                        </span>
                      </div>
                      
                      <p className="text-gray-300 mb-3 sm:mb-4 text-sm sm:text-base">{contract.description}</p>
                      
                      {contract.files && contract.files.length > 0 && (
                        <div className="mb-3 sm:mb-4">
                          <p className="text-xs sm:text-sm text-gray-400 mb-2">
                            📎 {contract.files.length} attachment{contract.files.length > 1 ? 's' : ''}
                          </p>
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
                                        className="w-full h-auto rounded max-h-48 object-contain"
                                      />
                                    </div>
                                  )}
                                  <div className="p-2 flex items-center justify-between">
                                    <p className="text-xs text-gray-300 truncate flex-1">{file.name}</p>
                                    <a 
                                      href={file.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer"
                                      className="text-blue-400 hover:text-blue-300 text-xs ml-2"
                                    >
                                      View
                                    </a>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                      
                      {!contract.files && contract.fileName && (
                        <div className="mb-3 sm:mb-4">
                          <p className="text-xs sm:text-sm text-gray-400 mb-2">
                            📎 Attachment: {contract.fileName}
                          </p>
                          {contract.fileUrl && (
                            <div className="bg-gray-800 rounded overflow-hidden">
                              {/\.(jpg|jpeg|png|gif|webp)$/i.test(contract.fileName) && (
                                <div className="p-2">
                                  <img 
                                    src={contract.fileUrl} 
                                    alt={contract.fileName}
                                    className="w-full h-auto rounded max-h-48 object-contain"
                                  />
                                </div>
                              )}
                              <div className="p-2">
                                <a 
                                  href={contract.fileUrl} 
                                  target="_blank" 
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 text-xs"
                                >
                                  View File
                                </a>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Signing Progress */}
                      {totalParties > 0 && (
                        <div className="mb-3 sm:mb-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs sm:text-sm text-gray-400">Signing Progress</span>
                            <span className="text-xs sm:text-sm text-gray-400">{signedParties}/{totalParties} signed</span>
                          </div>
                          <div className="w-full bg-gray-800 rounded-full h-2">
                            <div 
                              className={`h-2 rounded-full transition-all duration-300 ${
                                signingProgress === 100 ? 'bg-green-500' : 'bg-blue-500'
                              }`}
                              style={{ width: `${signingProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      
                      <div className="mb-3 sm:mb-4">
                        <h4 className="text-xs sm:text-sm font-medium text-gray-400 mb-2">Parties:</h4>
                        <div className="space-y-1">
                          {contract.parties.map((party, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs sm:text-sm">
                              <span className={party.signed ? 'text-green-500' : 'text-gray-500'}>
                                {party.signed ? '✓' : '○'}
                              </span>
                              <span className={party.name === normalizedHandle ? 'font-semibold' : ''}>{party.name}</span>
                              <span className="text-gray-500">({party.role})</span>
                              {party.signed && party.signedAt && (
                                <span className="text-gray-600 text-xs hidden sm:inline">
                                  signed {new Date(party.signedAt).toLocaleDateString()}
                                </span>
                              )}
                              {!party.signed && party.role !== 'creator' && (
                                <span className="text-yellow-500 text-xs">pending</span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                      
                      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                        <span className="text-xs sm:text-sm text-gray-500">
                          Created {new Date(contract.createdAt).toLocaleDateString()}
                        </span>
                        <div className="flex gap-2">
                          {isCreator && (
                            <button
                              onClick={() => copyShareLink(contract.id)}
                              className="bg-gray-700 hover:bg-gray-600 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm flex-1 sm:flex-initial"
                            >
                              📋 Copy Link
                            </button>
                          )}
                          {!isCreator && userParty && !userParty.signed && (
                            <button
                              onClick={() => handleSignContract(contract.id)}
                              disabled={!walletAddress}
                              className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 px-4 sm:px-6 py-2 rounded-lg font-semibold text-xs sm:text-sm flex-1 sm:flex-initial"
                            >
                              Sign Contract
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Share Modal */}
      {showShareModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6 max-w-md w-full">
            <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Contract Created Successfully!</h3>
            <p className="text-gray-400 mb-2 text-sm sm:text-base">Share this link with the parties who need to sign:</p>
            <div className="bg-gray-800 p-2 sm:p-3 rounded-lg mb-2 break-all">
              <code className="text-xs sm:text-sm">{shareLink}</code>
            </div>
            <p className="text-xs text-gray-500 mb-3 sm:mb-4">
              Note: Parties must log in with the Twitter/X account you specified to sign the contract
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareLink)
                  alert('Link copied to clipboard!')
                }}
                className="flex-1 bg-blue-600 hover:bg-blue-700 py-2 rounded-lg font-semibold text-sm sm:text-base"
              >
                Copy Link
              </button>
              <button
                onClick={() => {
                  setShowShareModal(false)
                  setActiveView('my-contracts')
                }}
                className="flex-1 bg-gray-700 hover:bg-gray-600 py-2 rounded-lg font-semibold text-sm sm:text-base"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
} 