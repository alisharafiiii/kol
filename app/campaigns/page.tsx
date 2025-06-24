'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import CampaignModal from '@/components/CampaignModal'
import CampaignCard from '@/components/CampaignCard'
import type { Campaign } from '@/lib/campaign'
import { isMasterAdmin } from '@/lib/admin-config'
import { getTwitterHandleFromSession } from '@/lib/auth-utils'

export default function CampaignsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<Campaign['status'] | 'all'>('all')
  const [isAuthorized, setIsAuthorized] = useState<boolean | null>(null)
  const [userRole, setUserRole] = useState<string | null>(null)
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  // Combined access check and data fetching
  useEffect(() => {
    const checkAccessAndFetchData = async () => {
      console.log('=== CAMPAIGNS PAGE: Starting access check ===');
      console.log('Session status:', status);
      console.log('Session data:', JSON.stringify(session, null, 2));
      
      // Wait for session to load
      if (status === 'loading') return
      
      console.log('Campaigns page - Session:', session)
      console.log('Campaigns page - Session status:', status)
      
      // No session - redirect to access denied
      if (!session?.user?.name) {
        console.log('CAMPAIGNS PAGE: No session found - redirecting to access denied')
        router.push('/access-denied')
        return
      }
      
      // Check if user is a master admin
      const handle = getTwitterHandleFromSession(session) || ''
      console.log('CAMPAIGNS PAGE: User handle:', handle);
      console.log('CAMPAIGNS PAGE: Session twitterHandle:', (session as any)?.twitterHandle);
      console.log('CAMPAIGNS PAGE: Session user.name:', session.user?.name);
      console.log('CAMPAIGNS PAGE: Full session structure:', JSON.stringify(session, null, 2));
      
      const isUserMasterAdmin = isMasterAdmin(handle)
      
      if (isUserMasterAdmin) {
        console.log(`CAMPAIGNS PAGE: Master admin ${handle} detected - granting immediate access`)
        setIsAuthorized(true)
        setUserRole('admin')
        setLoading(false)
        // Fetch campaigns in background
        fetch('/api/campaigns').then(res => res.json()).then(data => {
          console.log('CAMPAIGNS PAGE: Campaigns data received:', data);
          setCampaigns(Array.isArray(data) ? data : [])
          setIsInitialLoad(false)
        }).catch(err => {
          console.error('CAMPAIGNS PAGE: Failed to fetch campaigns for master admin:', err)
          setCampaigns([])
          setIsInitialLoad(false)
        })
        return
      }
      
      try {
        setLoading(true)
        
        const handle = getTwitterHandleFromSession(session) || ''
        const normalized = encodeURIComponent(handle.replace('@',''))
        console.log('CAMPAIGNS PAGE: Checking profile for handle:', normalized);
        
        // Check user profile and role in parallel with timeout
        const fetchWithTimeout = (url: string, timeout = 5000) => {
          return Promise.race([
            fetch(url),
            new Promise<Response>((_, reject) => 
              setTimeout(() => reject(new Error('Request timeout')), timeout)
            )
          ])
        }
        
        let profileData, roleData
        
        try {
          const [profileRes, roleRes] = await Promise.all([
            fetchWithTimeout(`/api/user/profile?handle=${normalized}`),
            fetchWithTimeout(`/api/user/role?handle=${normalized}`)
          ])
          
          console.log('CAMPAIGNS PAGE: Profile API status:', profileRes.status);
          console.log('CAMPAIGNS PAGE: Role API status:', roleRes.status);
          
          profileData = await profileRes.json()
          roleData = await roleRes.json()
          
          console.log('CAMPAIGNS PAGE: Profile data:', JSON.stringify(profileData, null, 2));
          console.log('CAMPAIGNS PAGE: Role data:', JSON.stringify(roleData, null, 2));
        } catch (fetchError) {
          console.error('CAMPAIGNS PAGE: Failed to fetch user data:', fetchError)
          // Default to checking if the user is sharafi_eth or nabulines (master admins)
          const isUserMasterAdmin = isMasterAdmin(handle)
          if (isUserMasterAdmin) {
            console.log('CAMPAIGNS PAGE: Master admin detected on error, granting access')
            profileData = { user: { approvalStatus: 'approved' } }
            roleData = { role: 'admin' }
          } else {
            throw fetchError
          }
        }
        
        setUserRole(roleData.role)
        console.log(`CAMPAIGNS PAGE: User: @${handle}, Role: ${roleData.role}, Approval: ${profileData.user?.approvalStatus}`)
        
        // Check if user has access
        const isAdmin = roleData.role === 'admin'
        const isApproved = profileData.user?.approvalStatus === 'approved'
        
        console.log('CAMPAIGNS PAGE: Access check - isAdmin:', isAdmin, 'isApproved:', isApproved);
        
        // Fetch campaigns first
        let allCampaigns = []
        try {
          const campaignsRes = await fetchWithTimeout('/api/campaigns')
          console.log('CAMPAIGNS PAGE: Campaign API response status:', campaignsRes.status);
          
          if (campaignsRes.ok) {
            const data = await campaignsRes.json()
            allCampaigns = Array.isArray(data) ? data : []
            console.log('CAMPAIGNS PAGE: Loaded', allCampaigns.length, 'campaigns');
          } else {
            console.warn('CAMPAIGNS PAGE: Campaign API returned:', campaignsRes.status, campaignsRes.statusText);
            // Try to read error response
            try {
              const errorText = await campaignsRes.text();
              console.error('CAMPAIGNS PAGE: Error response:', errorText.substring(0, 200));
            } catch (e) {
              console.error('CAMPAIGNS PAGE: Could not read error response');
            }
          }
        } catch (campaignError) {
          console.error('CAMPAIGNS PAGE: Error fetching campaigns:', campaignError)
          // For approved users, continue with empty campaigns instead of throwing error
          if (roleData.role === 'admin' || profileData.user?.approvalStatus === 'approved') {
            console.log('CAMPAIGNS PAGE: Approved user, continuing with empty campaigns')
            allCampaigns = []
          } else {
            throw campaignError
          }
        }
        
        // Check if user is a team member in any campaign
        const userHandle = getTwitterHandleFromSession(session) || ''
        const isTeamMember = allCampaigns.some((campaign: Campaign) => 
          campaign.teamMembers.includes(userHandle) || 
          campaign.createdBy === userHandle
        )
        
        // Allow access if: admin OR approved OR team member
        if (isAdmin || isApproved || isTeamMember) {
          setIsAuthorized(true)
          setCampaigns(allCampaigns)
          setIsInitialLoad(false)
        } else {
          console.log('Access denied - not admin, not approved, not team member')
          setIsAuthorized(false)
          router.push('/access-denied')
        }
        
      } catch (error) {
        console.error('Error checking access:', error)
        setIsAuthorized(false)
        router.push('/access-denied')
      } finally {
        setLoading(false)
      }
    }
    
    checkAccessAndFetchData()
  }, [session, status, router])

  // Refetch campaigns when tab changes
  useEffect(() => {
    if (!isAuthorized || loading || isInitialLoad) return
    
    const fetchCampaigns = async () => {
      try {
        const url = activeTab === 'my' ? '/api/campaigns?user=true' : '/api/campaigns'
        const res = await fetch(url)
        if (res.ok) {
          const data = await res.json()
          setCampaigns(Array.isArray(data) ? data : [])
        }
      } catch (error) {
        console.error('Error fetching campaigns:', error)
        setCampaigns([])
      }
    }
    
    fetchCampaigns()
  }, [activeTab, isAuthorized, loading, isInitialLoad])

  // Filter campaigns based on search and status
  const filteredCampaigns = (Array.isArray(campaigns) ? campaigns : [])
    .filter(campaign => {
      // Filter by active tab (skip for admins on 'all' tab)
      if (activeTab === 'my' && userRole !== 'admin') {
        const userHandle = (session as any)?.twitterHandle || session?.user?.name
        const isTeamMember = campaign.teamMembers.includes(userHandle)
        const isCreator = campaign.createdBy === userHandle
        if (!isTeamMember && !isCreator) return false
      }
      
      // Filter by status
      if (statusFilter !== 'all' && campaign.status !== statusFilter) return false
      
      // Filter by search term
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        return (
          campaign.name.toLowerCase().includes(search) ||
          campaign.slug.toLowerCase().includes(search) ||
          campaign.teamMembers.some(member => member.toLowerCase().includes(search))
        )
      }
      
      return true
    })

  const handleCreateCampaign = async (newCampaign: any) => {
    const handlerId = Date.now() // Unique ID for this handler call
    console.log(`[CampaignsPage] handleCreateCampaign called (handler ID: ${handlerId})`)
    console.log(`[CampaignsPage] New campaign received (handler ${handlerId}):`, newCampaign)
    
    try {
      // The CampaignModal already created the campaign, we just need to refresh the list
      console.log(`[CampaignsPage] Refreshing campaigns list (handler ${handlerId})...`)
      const refreshRes = await fetch(activeTab === 'my' ? '/api/campaigns?user=true' : '/api/campaigns')
      if (refreshRes.ok) {
        const data = await refreshRes.json()
        console.log(`[CampaignsPage] Refreshed campaigns (handler ${handlerId}):`, data.length, 'campaigns')
        setCampaigns(Array.isArray(data) ? data : [])
      }
      setShowModal(false)
    } catch (error) {
      console.error(`[CampaignsPage] Error refreshing campaigns (handler ${handlerId}):`, error)
    }
  }

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign?')) return

    try {
      const res = await fetch(`/api/campaigns/${campaignId}`, {
        method: 'DELETE'
      })

      if (res.ok) {
        setCampaigns(prev => prev.filter(c => c.id !== campaignId))
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to delete campaign')
      }
    } catch (error) {
      console.error('Error deleting campaign:', error)
      alert('Failed to delete campaign')
    }
  }

  // Show loading while checking access
  if (loading || status === 'loading') {
    return (
      <div className="min-h-screen bg-black text-green-300 font-sans flex items-center justify-center">
        <div className="animate-pulse">Checking access...</div>
      </div>
    )
  }

  // Don't render if not authorized
  if (!isAuthorized) {
    return null
  }

  return (
    <div className="min-h-screen bg-black text-green-300 font-sans p-4 md:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 md:mb-8">
          <h1 className="text-xl md:text-2xl font-bold">CAMPAIGN MANAGEMENT</h1>
          {session?.user && (
            <button
              onClick={() => setShowModal(true)}
              className="px-3 py-1.5 md:px-4 md:py-2 bg-green-900 border border-green-300 hover:bg-green-800 text-sm md:text-base"
            >
              + New Campaign
            </button>
          )}
        </div>

        {/* Admin Notice */}
        {(userRole === 'admin' || userRole === 'core') && (
          <div className="mb-4 p-3 border border-purple-500 bg-purple-900/20 text-purple-300 text-sm">
            <span className="font-bold">Admin Mode:</span> You have access to all campaigns
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 md:gap-4 mb-4 md:mb-6">
          <button
            onClick={() => setActiveTab('my')}
            className={`px-3 py-1.5 md:px-4 md:py-2 border text-sm md:text-base ${
              activeTab === 'my' 
                ? 'border-green-300 bg-green-900' 
                : 'border-gray-600 hover:border-green-300'
            }`}
          >
            My Campaigns
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 md:px-4 md:py-2 border text-sm md:text-base ${
              activeTab === 'all' 
                ? 'border-green-300 bg-green-900' 
                : 'border-gray-600 hover:border-green-300'
            }`}
          >
            All Campaigns
          </button>
        </div>

        {/* Search and Filters */}
        <div className="mb-4 md:mb-6 flex flex-col sm:flex-row gap-2 md:gap-4">
          <input
            type="text"
            placeholder="Search campaigns..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="flex-1 px-3 py-1.5 md:px-4 md:py-2 bg-black border border-green-300 text-green-300 placeholder-green-700 text-sm md:text-base"
          />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Campaign['status'] | 'all')}
            className="px-3 py-1.5 md:px-4 md:py-2 bg-black border border-green-300 text-green-300 text-sm md:text-base"
          >
            <option value="all">All Status</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>

        {/* Campaigns Grid */}
        {filteredCampaigns.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500">No campaigns found</p>
            {session?.user && activeTab === 'my' && (
              <button
                onClick={() => setShowModal(true)}
                className="mt-4 px-3 py-1.5 md:px-4 md:py-2 border border-green-300 hover:bg-green-900 text-sm md:text-base"
              >
                Create your first campaign
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
            {filteredCampaigns.map(campaign => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onDelete={handleDeleteCampaign}
                currentUser={session?.user?.name || undefined}
              />
            ))}
          </div>
        )}

        {/* Campaign Modal */}
        {showModal && (
          <CampaignModal
            onClose={() => setShowModal(false)}
            onCampaignCreated={handleCreateCampaign}
          />
        )}
      </div>
    </div>
  )
} 