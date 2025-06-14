'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Contest, ContestSponsor, DEFAULT_PRIZE_DISTRIBUTIONS, PrizeTier } from '@/lib/types/contest'
import type { Project } from '@/lib/project'
import Image from 'next/image'
import ContestFormModal from '@/components/ContestFormModal'

type Tab = 'active' | 'drafts' | 'ended' | 'create'

export default function ContestsAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('active')
  const [contests, setContests] = useState<Contest[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedContest, setSelectedContest] = useState<Contest | null>(null)
  const [isEditMode, setIsEditMode] = useState(false)

  // Create/Edit form state
  const [formData, setFormData] = useState<{
    name: string
    description: string
    startTime: string
    endTime: string
    imageUrl: string
    sponsors: ContestSponsor[]
    sentimentTags: string[]
    prizePool: number
    prizeDistribution: {
      type: 'default' | 'custom'
      tiers: PrizeTier[]
    }
    status: Contest['status']
    visibility: Contest['visibility']
  }>({
    name: '',
    description: '',
    startTime: '',
    endTime: '',
    imageUrl: '',
    sponsors: [],
    sentimentTags: [],
    prizePool: 0,
    prizeDistribution: DEFAULT_PRIZE_DISTRIBUTIONS.top5,
    status: 'active',  // Changed from 'draft' to 'active'
    visibility: 'public',
  })

  const [newTag, setNewTag] = useState('')
  const [searchSponsor, setSearchSponsor] = useState('')
  const [showSponsorDropdown, setShowSponsorDropdown] = useState(false)
  const [customDistribution, setCustomDistribution] = useState<PrizeTier[]>([])

  // Check authorization
  useEffect(() => {
    if (status === 'loading') return
    
    if (!session) {
      router.push('/auth/signin')
      return
    }

    // Check if user has admin role
    const userRole = (session as any)?.user?.role || (session as any)?.role
    if (userRole !== 'admin') {
      router.push('/access-denied')
    }
  }, [session, status, router])

  // Fetch contests and projects
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      // Fetch contests from API
      const contestsRes = await fetch('/api/contests')
      if (contestsRes.ok) {
        const contestsData = await contestsRes.json()
        setContests(contestsData)
      } else {
        console.error('Failed to fetch contests:', contestsRes.status)
        setContests([])
      }
      
      // Fetch projects from API
      console.log('Fetching projects from API...')
      const projectsRes = await fetch('/api/projects/all')
      if (projectsRes.ok) {
        const projectsData = await projectsRes.json()
        console.log('Fetched projects from API:', projectsData)
        setProjects(projectsData.projects || [])
      } else {
        console.error('Failed to fetch projects:', projectsRes.status)
        setProjects([])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateContest = async () => {
    try {
      console.log('Creating contest with data:', formData)
      console.log('Session:', session)
      
      const response = await fetch('/api/contests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          startTime: new Date(formData.startTime),
          endTime: new Date(formData.endTime),
          createdBy: (session as any)?.twitterHandle || session?.user?.email || 'admin',
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || error.details || 'Failed to create contest')
      }
      
      const contest = await response.json()
      setContests([...contests, contest])
      setShowCreateModal(false)
      resetForm()
      alert('Contest created successfully!')
    } catch (error) {
      console.error('Error creating contest:', error)
      alert('Failed to create contest: ' + (error as any).message)
    }
  }

  const handleUpdateContest = async () => {
    if (!selectedContest) return

    try {
      const response = await fetch(`/api/contests/${selectedContest.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...formData,
          startTime: new Date(formData.startTime),
          endTime: new Date(formData.endTime),
        }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update contest')
      }
      
      const updated = await response.json()
      setContests(contests.map(c => c.id === updated.id ? updated : c))
      setSelectedContest(null)
      setIsEditMode(false)
      resetForm()
    } catch (error) {
      console.error('Error updating contest:', error)
      alert('Failed to update contest: ' + (error as any).message)
    }
  }

  const handleDeleteContest = async (contestId: string) => {
    if (!confirm('Are you sure you want to delete this contest?')) return

    try {
      const response = await fetch(`/api/contests/${contestId}`, {
        method: 'DELETE',
      })
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to delete contest')
      }
      
      setContests(contests.filter(c => c.id !== contestId))
    } catch (error) {
      console.error('Error deleting contest:', error)
      alert('Failed to delete contest: ' + (error as any).message)
    }
  }

  const handleAddSponsor = (project: Project) => {
    const sponsor: ContestSponsor = {
      projectId: project.id,
      name: project.twitterHandle,
      imageUrl: project.profileImageUrl,
      twitterHandle: project.twitterHandle,
    }
    
    setFormData({
      ...formData,
      sponsors: [...formData.sponsors, sponsor]
    })
    setSearchSponsor('')
    setShowSponsorDropdown(false)
  }

  const handleRemoveSponsor = (projectId: string) => {
    setFormData({
      ...formData,
      sponsors: formData.sponsors.filter(s => s.projectId !== projectId)
    })
  }

  const handleAddTag = () => {
    if (newTag.trim()) {
      setFormData({
        ...formData,
        sentimentTags: [...formData.sentimentTags, newTag.trim()]
      })
      setNewTag('')
    }
  }

  const handleRemoveTag = (tag: string) => {
    setFormData({
      ...formData,
      sentimentTags: formData.sentimentTags.filter(t => t !== tag)
    })
  }

  const handleDistributionChange = (type: 'default' | 'custom') => {
    if (type === 'default') {
      // Reset to default distribution
      setFormData({
        ...formData,
        prizeDistribution: DEFAULT_PRIZE_DISTRIBUTIONS.top5
      })
      setCustomDistribution([])
    } else {
      // Initialize custom distribution
      setCustomDistribution([
        { position: 1, percentage: 40 },
        { position: 2, percentage: 30 },
        { position: 3, percentage: 20 },
        { position: 4, percentage: 10 },
      ])
      setFormData({
        ...formData,
        prizeDistribution: {
          type: 'custom',
          tiers: customDistribution
        }
      })
    }
  }

  const handleCustomTierChange = (index: number, field: 'position' | 'percentage', value: string | number) => {
    const updated = [...customDistribution]
    updated[index] = {
      ...updated[index],
      [field]: field === 'percentage' ? Number(value) : value
    }
    setCustomDistribution(updated)
    setFormData({
      ...formData,
      prizeDistribution: {
        type: 'custom',
        tiers: updated
      }
    })
  }

  const handleAddCustomTier = () => {
    const newTier = { position: customDistribution.length + 1, percentage: 0 }
    setCustomDistribution([...customDistribution, newTier])
    setFormData({
      ...formData,
      prizeDistribution: {
        type: 'custom',
        tiers: [...customDistribution, newTier]
      }
    })
  }

  const handleRemoveCustomTier = (index: number) => {
    const updated = customDistribution.filter((_, i) => i !== index)
    setCustomDistribution(updated)
    setFormData({
      ...formData,
      prizeDistribution: {
        type: 'custom',
        tiers: updated
      }
    })
  }

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      startTime: '',
      endTime: '',
      imageUrl: '',
      sponsors: [],
      sentimentTags: [],
      prizePool: 0,
      prizeDistribution: DEFAULT_PRIZE_DISTRIBUTIONS.top5,
      status: 'active',  // Changed from 'draft' to 'active'
      visibility: 'public',
    })
    setCustomDistribution([])
  }

  const editContest = (contest: Contest) => {
    setFormData({
      name: contest.name,
      description: contest.description || '',
      startTime: new Date(contest.startTime).toISOString().slice(0, 16),
      endTime: new Date(contest.endTime).toISOString().slice(0, 16),
      imageUrl: contest.imageUrl || '',
      sponsors: contest.sponsors,
      sentimentTags: contest.sentimentTags || [],
      prizePool: contest.prizePool,
      prizeDistribution: contest.prizeDistribution,
      status: contest.status,
      visibility: contest.visibility,
    })
    
    if (contest.prizeDistribution.type === 'custom') {
      setCustomDistribution(contest.prizeDistribution.tiers)
    }
    
    setSelectedContest(contest)
    setIsEditMode(true)
    setShowCreateModal(true)
  }

  const getFilteredContests = () => {
    switch (activeTab) {
      case 'active':
        return contests.filter(c => c.status === 'active')
      case 'drafts':
        return contests.filter(c => c.status === 'draft')
      case 'ended':
        return contests.filter(c => c.status === 'ended' || c.status === 'cancelled')
      default:
        return []
    }
  }

  const filteredProjects = projects.filter(p => {
    // If no search term, show all projects
    if (!searchSponsor) return !formData.sponsors.some(s => s.projectId === p.id)
    
    // Otherwise filter by search term
    return p.twitterHandle.toLowerCase().includes(searchSponsor.toLowerCase()) &&
           !formData.sponsors.some(s => s.projectId === p.id)
  })

  const totalPercentage = formData.prizeDistribution.tiers.reduce((sum, tier) => sum + tier.percentage, 0)

  if (loading || status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-green-300">
        <div className="animate-pulse">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-green-300 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'Press Start 2P, monospace' }}>
            Contest Management
          </h1>
          <button
            onClick={() => router.push('/admin')}
            className="px-4 py-2 border border-green-400 hover:bg-green-900/30"
          >
            Back to Admin
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-green-300">
          <button
            className={`px-4 py-2 ${activeTab === 'active' ? 'bg-green-800' : ''}`}
            onClick={() => setActiveTab('active')}
          >
            Active Contests
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'drafts' ? 'bg-green-800' : ''}`}
            onClick={() => setActiveTab('drafts')}
          >
            Drafts
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'ended' ? 'bg-green-800' : ''}`}
            onClick={() => setActiveTab('ended')}
          >
            Ended
          </button>
          <button
            className={`px-4 py-2 ${activeTab === 'create' ? 'bg-green-800' : ''}`}
            onClick={() => {
              setActiveTab('create')
              setShowCreateModal(true)
              setIsEditMode(false)
              resetForm()
            }}
          >
            + Create Contest
          </button>
        </div>

        {/* Contest List */}
        {activeTab !== 'create' && (
          <div className="grid gap-4">
            {getFilteredContests().length === 0 ? (
              <div className="border border-green-300 p-8 text-center">
                <p className="text-sm opacity-70">No contests found in this category</p>
              </div>
            ) : (
              getFilteredContests().map(contest => (
                <ContestListItem
                  key={contest.id}
                  contest={contest}
                  onEdit={() => editContest(contest)}
                  onDelete={() => handleDeleteContest(contest.id)}
                  onViewDetails={() => router.push(`/admin/contests/${contest.id}`)}
                />
              ))
            )}
          </div>
        )}

        {/* Create/Edit Modal */}
        {(showCreateModal || activeTab === 'create') && (
          <ContestFormModal
            isEditMode={isEditMode}
            formData={formData}
            setFormData={setFormData}
            projects={filteredProjects}
            searchSponsor={searchSponsor}
            setSearchSponsor={setSearchSponsor}
            showSponsorDropdown={showSponsorDropdown}
            setShowSponsorDropdown={setShowSponsorDropdown}
            newTag={newTag}
            setNewTag={setNewTag}
            customDistribution={customDistribution}
            totalPercentage={totalPercentage}
            onSubmit={isEditMode ? handleUpdateContest : handleCreateContest}
            onCancel={() => {
              setShowCreateModal(false)
              setActiveTab('active')
              setIsEditMode(false)
              setSelectedContest(null)
              resetForm()
            }}
            onAddSponsor={handleAddSponsor}
            onRemoveSponsor={handleRemoveSponsor}
            onAddTag={handleAddTag}
            onRemoveTag={handleRemoveTag}
            onDistributionChange={handleDistributionChange}
            onCustomTierChange={handleCustomTierChange}
            onAddCustomTier={handleAddCustomTier}
            onRemoveCustomTier={handleRemoveCustomTier}
          />
        )}
      </div>
    </div>
  )
}

// Contest List Item Component
function ContestListItem({ 
  contest, 
  onEdit, 
  onDelete, 
  onViewDetails 
}: { 
  contest: Contest
  onEdit: () => void
  onDelete: () => void
  onViewDetails: () => void
}) {
  return (
    <div className="border border-green-300 p-4 hover:bg-green-900/10">
      <div className="flex items-start gap-4">
        {/* Contest Image */}
        {contest.imageUrl && (
          <div className="w-24 h-24 border border-green-400 overflow-hidden">
            <img
              src={contest.imageUrl}
              alt={contest.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        
        {/* Contest Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="font-bold text-lg">{contest.name}</h3>
            <span className={`px-2 py-0.5 text-xs rounded ${
              contest.status === 'active' ? 'bg-green-900 text-green-300' :
              contest.status === 'draft' ? 'bg-yellow-900 text-yellow-300' :
              'bg-red-900 text-red-300'
            }`}>
              {contest.status}
            </span>
            <span className={`px-2 py-0.5 text-xs rounded ${
              contest.visibility === 'public' ? 'bg-blue-900 text-blue-300' :
              'bg-gray-900 text-gray-300'
            }`}>
              {contest.visibility}
            </span>
          </div>
          
          {contest.description && (
            <p className="text-sm mb-2 opacity-80">{contest.description}</p>
          )}
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="opacity-70">Start:</span> {new Date(contest.startTime).toLocaleDateString()}
            </div>
            <div>
              <span className="opacity-70">End:</span> {new Date(contest.endTime).toLocaleDateString()}
            </div>
            <div>
              <span className="opacity-70">Prize Pool:</span> ${contest.prizePool}
            </div>
            <div>
              <span className="opacity-70">Sponsors:</span> {contest.sponsors.length}
            </div>
          </div>
          
          {/* Sponsors */}
          {contest.sponsors.length > 0 && (
            <div className="flex gap-2 mt-2">
              {contest.sponsors.map(sponsor => (
                <div key={sponsor.projectId} className="flex items-center gap-1">
                  {sponsor.imageUrl && (
                    <img
                      src={sponsor.imageUrl}
                      alt={sponsor.name}
                      className="w-6 h-6 rounded-full"
                    />
                  )}
                  <span className="text-xs">{sponsor.twitterHandle}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        
        {/* Actions */}
        <div className="flex flex-col gap-2">
          <button
            onClick={onViewDetails}
            className="px-3 py-1 text-xs border border-blue-400 text-blue-400 hover:bg-blue-900/30"
          >
            View Details
          </button>
          <button
            onClick={onEdit}
            className="px-3 py-1 text-xs border border-green-400 text-green-400 hover:bg-green-900/30"
          >
            Edit
          </button>
          <button
            onClick={onDelete}
            className="px-3 py-1 text-xs border border-red-400 text-red-400 hover:bg-red-900/30"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

 