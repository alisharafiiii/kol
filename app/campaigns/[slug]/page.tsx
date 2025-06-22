'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import type { Campaign, KOL } from '@/lib/campaign'
import type { Project } from '@/lib/project'
import KOLTable from '@/components/KOLTable'
import AddKOLModal from '@/components/AddKOLModal'
import CampaignBrief from '@/components/CampaignBrief'
import EditCampaignModal from '@/components/EditCampaignModal'
import { ArrowLeft, Users, Calendar, DollarSign, Briefcase, TrendingUp } from '@/components/icons'
import { getAllProjects } from '@/lib/project'

// Cache for projects to avoid repeated fetches
let projectsCache: Project[] | null = null
let projectsCacheTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

// Loading skeleton component
function LoadingSkeleton() {
  return (
    <div className="min-h-screen bg-black text-green-300 font-sans p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-green-900 rounded w-1/4"></div>
          <div className="h-20 bg-green-900 rounded"></div>
          <div className="h-40 bg-green-900 rounded"></div>
          <div className="h-60 bg-green-900 rounded"></div>
        </div>
      </div>
    </div>
  )
}

export default function CampaignPage({ params }: { params: { slug: string } }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddKOL, setShowAddKOL] = useState(false)
  const [showEditModal, setShowEditModal] = useState(false)
  const [projectDetails, setProjectDetails] = useState<Project[]>([])
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [syncing, setSyncing] = useState(false)

  const fetchCampaign = async () => {
    try {
      setError(null)
      const res = await fetch(`/api/campaigns/slug/${params.slug}`)
      if (res.ok) {
        const data = await res.json()
        setCampaign(data)
      } else if (res.status === 404) {
        setError('Campaign not found')
        setTimeout(() => router.push('/campaigns'), 2000)
      } else {
        setError('Failed to load campaign')
      }
    } catch (error) {
      console.error('Error fetching campaign:', error)
      setError('Failed to load campaign')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCampaign()
    // Make refresh function available globally for child components
    ;(window as any).refreshCampaignData = fetchCampaign
    
    return () => {
      // Clean up when component unmounts
      delete (window as any).refreshCampaignData
    }
  }, [params.slug])

  // Fetch project details with caching
  useEffect(() => {
    const getProjects = async () => {
      if (!campaign || !campaign.projects || campaign.projects.length === 0) {
        setProjectDetails([])
        return
      }
      
      try {
        let list: Project[] = []
        
        // Check if cache is valid
        if (projectsCache && Date.now() - projectsCacheTime < CACHE_DURATION) {
          list = projectsCache
        } else {
          // Fetch fresh data
          const res = await fetch('/api/projects/all')
          const data = await res.json()
          list = Array.isArray(data) ? data : data?.projects || []
          
          // Update cache
          projectsCache = list
          projectsCacheTime = Date.now()
        }
        
        setAllProjects(list)
        const filtered = list.filter((p: Project) => campaign.projects?.includes(p.id))
        setProjectDetails(filtered)
      } catch (err) {
        console.error('Error fetching projects for campaign page:', err)
      }
    }
    getProjects()
  }, [campaign])

  const isOwner = session?.user?.name === campaign?.createdBy
  const isTeamMember = campaign?.teamMembers?.includes(session?.user?.name || '') || false
  const userRole = (session as any)?.role || (session as any)?.user?.role || 'user'
  const canEditByRole = ['admin', 'core', 'team'].includes(userRole)
  const canEdit = !!(isOwner || isTeamMember || canEditByRole)
  const canManage = !!(isOwner || isTeamMember || ['admin', 'core'].includes(userRole))

  const handleKOLUpdate = async (kolId: string, updates: Partial<KOL>) => {
    if (!campaign || !canEdit) return

    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/kols`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kolId, ...updates })
      })

      if (res.ok) {
        await fetchCampaign()
        return true // Return success
      } else {
        throw new Error('Failed to update KOL')
      }
    } catch (error) {
      console.error('Error updating KOL:', error)
      throw error // Re-throw to let KOLTable handle it
    }
  }

  const handleKOLDelete = async (kolId: string) => {
    if (!campaign || !canEdit) return

    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/kols`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kolId })
      })

      if (res.ok) {
        await fetchCampaign()
      }
    } catch (error) {
      console.error('Error removing KOL:', error)
    }
  }

  const handleKOLAdd = async (kol: Omit<KOL, 'id' | 'lastUpdated'>) => {
    if (!campaign) return

    try {
      // Just refresh the campaign data - AddKOLModal already handled the POST request
      await fetchCampaign()
    } catch (error) {
      console.error('Error refreshing campaign after KOL add:', error)
      // Don't throw - the KOL was already added successfully
    }
    setShowAddKOL(false)
  }

  const handleCampaignUpdate = async (updates: Partial<Campaign>) => {
    if (!campaign) return

    console.log('CampaignPage: Updating campaign with:', updates)

    const res = await fetch(`/api/campaigns/${campaign.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    })

    if (!res.ok) {
      const error = await res.json()
      console.error('CampaignPage: Update failed:', error)
      throw new Error(error.error || 'Failed to update campaign')
    }

    const updatedCampaign = await res.json()
    console.log('CampaignPage: Campaign updated successfully:', updatedCampaign)
    setCampaign(updatedCampaign)
    
    // Refresh project details if projects were updated
    if (updates.projects) {
      const filtered = allProjects.filter((p: Project) => updates.projects!.includes(p.id))
      setProjectDetails(filtered)
    }
    
    // Close the modal after successful update
    setShowEditModal(false)
  }

  const syncTweets = async () => {
    console.log('\n🔄 CLIENT: Sync button clicked')
    console.log('Campaign:', campaign?.id, campaign?.slug)
    console.log('Session:', session)
    console.log('User role:', userRole)
    
    if (!campaign) {
      console.error('No campaign loaded')
      return
    }
    
    setSyncing(true)
    console.log('Making API call to:', `/api/campaigns/${campaign.id}/sync-tweets`)
    
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/sync-tweets`, {
        method: 'POST'
      })
      
      console.log('Response status:', res.status)
      console.log('Response headers:', Object.fromEntries(res.headers.entries()))
      
      if (!res.ok) {
        const data = await res.json()
        console.error('Error response:', data)
        throw new Error(data.error || 'Failed to sync tweets')
      }
      
      const data = await res.json()
      console.log('Sync response data:', JSON.stringify(data, null, 2))
      
      // Extract result - handle different response structures
      const result = data.result || data
      const synced = result.synced ?? 0
      const failed = result.failed ?? 0
      const rateLimited = result.rateLimited ?? false
      const queued = data.queued ?? false
      
      console.log('Parsed results:', { synced, failed, rateLimited, queued })
      
      // Show appropriate message based on result
      if (queued) {
        alert('Campaign queued for sync due to rate limit')
      } else if (synced === 0 && failed === 0 && !rateLimited) {
        alert('No new tweets found to sync')
      } else if (synced > 0) {
        alert(`Successfully synced ${synced} tweet${synced !== 1 ? 's' : ''}${failed > 0 ? ` (${failed} failed)` : ''}`)
      } else if (failed > 0) {
        alert(`Sync completed with ${failed} failed tweet${failed !== 1 ? 's' : ''}`)
      } else {
        // Fallback message if we can't determine the exact result
        alert('Tweet sync completed')
      }
      
      // Reload campaign to show updated metrics
      console.log('Refreshing campaign data...')
      await fetchCampaign()
    } catch (err: any) {
      console.error('CLIENT: Sync error:', {
        message: err.message,
        stack: err.stack,
        error: err
      })
      alert(err.message || 'Failed to sync tweets')
    } finally {
      setSyncing(false)
      console.log('CLIENT: Sync operation completed')
    }
  }

  // Show loading skeleton while data is being fetched
  if (loading) {
    return <LoadingSkeleton />
  }

  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-black text-green-300 font-sans p-6">
        <div className="max-w-7xl mx-auto text-center py-20">
          <h2 className="text-xl mb-4">{error}</h2>
          <p className="text-gray-400">Redirecting to campaigns page...</p>
        </div>
      </div>
    )
  }

  if (!campaign) {
    return null
  }

  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <div className="min-h-screen bg-black text-green-300 font-sans p-4 md:p-6">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6 md:mb-8">
            <button
              onClick={() => router.push('/campaigns')}
              className="text-xs mb-4 hover:text-green-400"
            >
              ← Back to campaigns
            </button>
            
            <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-4">
              <div>
                <h1 className="text-xl md:text-2xl font-bold mb-2">{campaign.name}</h1>
                <div className="text-xs md:text-sm space-y-1">
                  <div className="flex items-center gap-4 text-gray-400">
                    <span>Status: <span className="text-green-400 font-medium">{campaign.status}</span></span>
                    <span>•</span>
                    <span>{new Date(campaign.startDate).toLocaleDateString()} - {new Date(campaign.endDate).toLocaleDateString()}</span>
                    <span>•</span>
                    <span>by @{campaign.createdBy}</span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <span className="px-2 py-0.5 bg-yellow-900/50 text-yellow-300 text-xs rounded">
                      {campaign.projects.length} PROJECT{campaign.projects.length !== 1 ? 'S' : ''}
                    </span>
                    {campaign.chains && campaign.chains.length > 0 && campaign.chains.map(chain => (
                      <span key={chain} className="px-2 py-0.5 bg-blue-900/50 text-blue-300 text-xs rounded">
                        {chain}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              {canEdit && (
                <div className="flex flex-col gap-2">
                  {/* Primary Actions */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setShowAddKOL(true)}
                      className="px-3 py-1 bg-green-900/50 border border-green-500 hover:bg-green-800/50 text-green-300 text-xs font-medium rounded flex items-center gap-1"
                    >
                      <span className="text-base">+</span> Add KOL
                    </button>
                    <button
                      onClick={() => router.push(`/campaigns/${campaign.slug}/analytics`)}
                      className="px-3 py-1 bg-purple-900/50 border border-purple-500 hover:bg-purple-800/50 text-purple-300 text-xs font-medium rounded flex items-center gap-1"
                    >
                      <span>📊</span> Analytics
                    </button>
                    <button
                      onClick={syncTweets}
                      disabled={syncing}
                      className="px-3 py-1 bg-blue-900/50 border border-blue-500 hover:bg-blue-800/50 text-blue-300 text-xs font-medium rounded flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <span className={syncing ? 'animate-spin' : ''}>🔄</span> {syncing ? 'Syncing' : 'Sync'}
                    </button>
                  </div>
                  
                  {/* Secondary Actions */}
                  <div className="flex flex-wrap gap-2">
                    {canManage && (
                      <button
                        onClick={() => setShowEditModal(true)}
                        className="px-3 py-1 bg-gray-800 border border-gray-600 hover:bg-gray-700 text-gray-300 text-xs rounded flex items-center gap-1"
                      >
                        <span>⚙️</span> Settings
                      </button>
                    )}
                    {canEdit && (
                      <button
                        onClick={() => router.push(`/campaigns/${campaign.slug}/brief/edit`)}
                        className="px-3 py-1 bg-gray-800 border border-gray-600 hover:bg-gray-700 text-gray-300 text-xs rounded flex items-center gap-1"
                      >
                        <span>✏️</span> Brief
                      </button>
                    )}
                    {campaign.brief && (
                      <button
                        onClick={() => {
                          const briefUrl = `${window.location.origin}/brief/${campaign.id}`
                          navigator.clipboard.writeText(briefUrl).then(() => {
                            alert('Brief link copied to clipboard!')
                          })
                        }}
                        className="px-3 py-1 bg-gray-800 border border-gray-600 hover:bg-gray-700 text-gray-300 text-xs rounded flex items-center gap-1"
                        title="Copy brief link"
                      >
                        <span>🔗</span> Share
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Team Members */}
          {campaign.teamMembers && campaign.teamMembers.length > 0 && (
            <div className="mb-4">
              <h3 className="text-xs uppercase mb-2 text-gray-400">Team Members</h3>
              <div className="flex flex-wrap gap-2">
                {campaign.teamMembers.map(member => (
                  <div key={member} className="flex items-center gap-1.5 px-2 py-1 bg-green-900/20 border border-green-500/50 text-xs rounded-full">
                    <img
                      src={`https://unavatar.io/twitter/${member}`}
                      alt={member}
                      className="w-4 h-4 rounded-full"
                      loading="lazy"
                    />
                    <span className="text-green-300">@{member}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {projectDetails.length > 0 && (
            <div className="mb-6 font-sans">
              <h3 className="text-xs uppercase mb-3 text-gray-400">Project{projectDetails.length > 1 ? 's' : ''} ({projectDetails.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {projectDetails.map(project => {
                  const budget = campaign.projectBudgets?.[project.id]
                  return (
                    <div key={project.id} className="flex items-center gap-3 p-3 bg-gray-900/50 border border-gray-700 rounded-lg hover:border-gray-600 transition-colors">
                      <img
                        src={project.profileImageUrl || `https://unavatar.io/twitter/${project.twitterHandle}`}
                        alt={project.twitterHandle}
                        className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                        loading="lazy"
                        onError={(e) => {
                          e.currentTarget.src = `https://unavatar.io/twitter/${project.twitterHandle}`
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-semibold text-green-300 truncate">@{project.twitterHandle.replace('@', '')}</div>
                        {budget && (
                          <div className="text-xs text-gray-400">
                            ${budget.usd} • {budget.devices} devices
                          </div>
                        )}
                        {project.notes && (
                          <div className="text-xs text-gray-500 truncate" title={project.notes}>{project.notes}</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Campaign Brief */}
          <div className="mb-6 md:mb-8">
            <CampaignBrief
              brief={campaign.brief}
              briefUpdatedAt={campaign.briefUpdatedAt}
              briefUpdatedBy={campaign.briefUpdatedBy}
            />
          </div>

          {/* Campaign Stats */}
          {campaign.kols && campaign.kols.length > 0 && (
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <div className="bg-gradient-to-br from-green-900/20 to-green-900/10 border border-green-500/50 rounded-lg p-3">
                <h3 className="text-xs font-medium text-green-400/80 uppercase">Cash Budget</h3>
                <p className="text-lg font-bold text-green-300 mt-1">
                  ${campaign.kols.reduce((sum, kol) => {
                    // Only count entries with non-zero budget to avoid duplication
                    const budgetNum = typeof kol.budget === 'number' 
                      ? kol.budget 
                      : parseFloat(kol.budget?.replace(/[^0-9.-]+/g, '') || '0') || 0
                    // Skip entries with "0" budget (these are product-only entries)
                    if (kol.budget === "0" || budgetNum === 0) return sum
                    return sum + budgetNum
                  }, 0).toLocaleString()}
                </p>
                {campaign.kols.some(kol => kol.productCost && kol.productCost > 0) && (
                  <p className="text-xs text-purple-400 mt-1">
                    + ${campaign.kols.reduce((sum, kol) => sum + ((kol.productCost || 0) * (kol.productQuantity || 1)), 0).toLocaleString()} in products
                  </p>
                )}
              </div>
              <div className="bg-gradient-to-br from-blue-900/20 to-blue-900/10 border border-blue-500/50 rounded-lg p-3">
                <h3 className="text-xs font-medium text-blue-400/80 uppercase">Total Views</h3>
                <p className="text-lg font-bold text-blue-300 mt-1">
                  {campaign.kols.reduce((sum, kol) => sum + (kol.views || 0), 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-gradient-to-br from-purple-900/20 to-purple-900/10 border border-purple-500/50 rounded-lg p-3">
                <h3 className="text-xs font-medium text-purple-400/80 uppercase">Engagement</h3>
                <p className="text-lg font-bold text-purple-300 mt-1">
                  {campaign.kols.reduce((sum, kol) => sum + ((kol.likes || 0) + (kol.retweets || 0) + (kol.comments || 0)), 0).toLocaleString()}
                </p>
              </div>
              <div className="bg-gradient-to-br from-orange-900/20 to-orange-900/10 border border-orange-500/50 rounded-lg p-3">
                <h3 className="text-xs font-medium text-orange-400/80 uppercase">Avg Eng. Rate</h3>
                <p className="text-lg font-bold text-orange-300 mt-1">
                  {(() => {
                    const totalViews = campaign.kols.reduce((sum, kol) => sum + (kol.views || 0), 0)
                    const totalEngagement = campaign.kols.reduce((sum, kol) => sum + ((kol.likes || 0) + (kol.retweets || 0) + (kol.comments || 0)), 0)
                    return totalViews > 0 ? ((totalEngagement / totalViews) * 100).toFixed(2) : '0'
                  })()}%
                </p>
              </div>
            </div>
          )}

          {/* KOL Table */}
          <div className="overflow-x-auto">
            <h3 className="text-xs uppercase mb-3 text-gray-400">KOLs ({campaign.kols?.length || 0})</h3>
            <KOLTable
              kols={campaign.kols || []}
              campaignId={campaign.id}
              onUpdate={handleKOLUpdate}
              onDelete={handleKOLDelete}
              canEdit={canEdit}
            />
          </div>

          {/* Add KOL Modal */}
          {showAddKOL && (
            <AddKOLModal
              campaign={campaign}
              onClose={() => setShowAddKOL(false)}
              onAdd={handleKOLAdd}
            />
          )}

          {/* Edit Campaign Modal */}
          {showEditModal && (
            <EditCampaignModal
              campaign={campaign}
              projects={allProjects}
              onClose={() => setShowEditModal(false)}
              onSave={handleCampaignUpdate}
            />
          )}
        </div>
      </div>
    </Suspense>
  )
} 