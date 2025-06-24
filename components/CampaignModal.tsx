'use client'

import { useState, useEffect, useRef } from 'react'
import { useSession } from 'next-auth/react'
import type { Campaign } from '@/lib/campaign'
import type { Project } from '@/lib/project'

interface CampaignModalProps {
  onClose: () => void
  onCampaignCreated: (campaign: Campaign) => void
}

// Cache for approved users to avoid repeated fetches
let approvedUsersCache: string[] | null = null
let approvedUsersCacheTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export default function CampaignModal({ onClose, onCampaignCreated }: CampaignModalProps) {
  const { data: session } = useSession()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [selectedChains, setSelectedChains] = useState<string[]>(['Solana'])
  const [customChain, setCustomChain] = useState('')
  const [selectedProjects, setSelectedProjects] = useState<string[]>([])
  const [teamMembers, setTeamMembers] = useState<string[]>([])
  const [teamMemberInput, setTeamMemberInput] = useState('')
  const [projects, setProjects] = useState<Project[]>([])
  const [approvedUsers, setApprovedUsers] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)
  const [showUserDropdown, setShowUserDropdown] = useState(false)
  const [projectBudgets, setProjectBudgets] = useState<Record<string, { usd: string; devices: string }>>({})
  const modalRef = useRef<HTMLDivElement>(null)
  const projectDropdownRef = useRef<HTMLDivElement>(null)
  const userDropdownRef = useRef<HTMLDivElement>(null)
  
  // Add error state
  const [error, setError] = useState<string | null>(null)
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [usersLoading, setUsersLoading] = useState(true)

  // Fetch projects with error handling
  useEffect(() => {
    const fetchProjects = async () => {
      console.log('[CampaignModal] Fetching projects...')
      setProjectsLoading(true)
      try {
        const res = await fetch('/api/projects/all')
        
        if (!res.ok) {
          throw new Error(`Failed to fetch projects: ${res.status} ${res.statusText}`)
        }
        
        const data = await res.json()
        console.log('[CampaignModal] Projects API response:', data)
        
        // Support both {projects: [...]} and direct array formats
        let projectsArray: Project[] = []
        if (Array.isArray(data)) {
          projectsArray = data
        } else if (data && Array.isArray(data.projects)) {
          projectsArray = data.projects
        } else {
          console.warn('[CampaignModal] Unexpected projects data format:', data)
          projectsArray = []
        }
        
        console.log(`[CampaignModal] Loaded ${projectsArray.length} projects`)
        setProjects(projectsArray)
      } catch (error) {
        console.error('[CampaignModal] Error fetching projects:', error)
        setError('Failed to load projects. Some features may be limited.')
        setProjects([])
      } finally {
        setProjectsLoading(false)
      }
    }
    
    fetchProjects()
  }, [])

  // Fetch approved users with caching and error handling
  useEffect(() => {
    const fetchApprovedUsers = async () => {
      console.log('[CampaignModal] Fetching approved users...')
      
      // Check if cache is valid
      if (approvedUsersCache && Date.now() - approvedUsersCacheTime < CACHE_DURATION) {
        console.log('[CampaignModal] Using cached approved users')
        setApprovedUsers(approvedUsersCache)
        setUsersLoading(false)
        return
      }

      setUsersLoading(true)
      try {
        const res = await fetch('/api/users?approved=true')
        
        if (!res.ok) {
          throw new Error(`Failed to fetch users: ${res.status} ${res.statusText}`)
        }
        
        const data = await res.json()
        console.log('[CampaignModal] Users API response:', data)
        
        // Ensure data is an array before processing
        let userHandles: string[] = []
        if (Array.isArray(data)) {
          userHandles = data
            .map((user: any) => {
              // Try multiple possible fields for the handle
              return user.handle || user.twitterHandle?.replace('@', '') || user.name
            })
            .filter(Boolean) // Remove null/undefined values
        } else if (data && Array.isArray(data.users)) {
          // Handle {users: [...]} format
          userHandles = data.users
            .map((user: any) => user.handle || user.twitterHandle?.replace('@', '') || user.name)
            .filter(Boolean)
        } else {
          console.warn('[CampaignModal] Unexpected users data format:', data)
          userHandles = []
        }
        
        console.log(`[CampaignModal] Loaded ${userHandles.length} approved users`)
        
        // Update cache
        approvedUsersCache = userHandles
        approvedUsersCacheTime = Date.now()
        
        setApprovedUsers(userHandles)
      } catch (error) {
        console.error('[CampaignModal] Error fetching approved users:', error)
        setError('Failed to load team members. You can still create a campaign.')
        setApprovedUsers([])
      } finally {
        setUsersLoading(false)
      }
    }
    
    fetchApprovedUsers()
  }, [])

  // Handle click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (projectDropdownRef.current && !projectDropdownRef.current.contains(event.target as Node)) {
        setShowProjectDropdown(false)
      }
      if (userDropdownRef.current && !userDropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredProjects = projects.filter(p => {
    if (!p) return false // Guard against null/undefined projects
    const searchLower = projectSearch.toLowerCase()
    return (
      (p.twitterHandle && p.twitterHandle.toLowerCase().includes(searchLower)) ||
      (p.notes && p.notes.toLowerCase().includes(searchLower))
    )
  })

  const filteredUsers = approvedUsers.filter(handle => {
    if (!handle || !teamMemberInput) return false // Guard against null/undefined
    return (
      handle.toLowerCase().includes(teamMemberInput.toLowerCase()) &&
      !teamMembers.includes(handle) &&
      handle !== session?.user?.name
    )
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!session?.user?.name) {
      setError('You must be logged in to create a campaign')
      return
    }

    // Prevent double submission
    if (loading) {
      console.log('[CampaignModal] Already creating campaign, ignoring duplicate submit')
      return
    }

    const submissionId = Date.now() // Unique ID for this submission
    console.log(`[CampaignModal] Creating campaign (submission ID: ${submissionId})...`)
    setLoading(true)
    setError(null)
    
    try {
      const campaignData = {
        name,
        startDate,
        endDate,
        chains: selectedChains,
        projects: selectedProjects,
        teamMembers,
        projectBudgets
      }
      
      console.log(`[CampaignModal] Campaign data (submission ${submissionId}):`, campaignData)
      
      const res = await fetch('/api/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(campaignData)
      })

      const responseData = await res.json()
      
      if (res.ok) {
        console.log(`[CampaignModal] Campaign created successfully (submission ${submissionId}):`, responseData)
        onCampaignCreated(responseData)
      } else {
        console.error(`[CampaignModal] Failed to create campaign (submission ${submissionId}):`, responseData)
        throw new Error(responseData.error || 'Failed to create campaign')
      }
    } catch (error) {
      console.error(`[CampaignModal] Error creating campaign (submission ${submissionId}):`, error)
      setError(error instanceof Error ? error.message : 'Failed to create campaign. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const toggleProject = (projectId: string) => {
    if (!projectId) return // Guard against null/undefined
    
    setSelectedProjects(prev => 
      prev.includes(projectId) 
        ? prev.filter(id => id !== projectId)
        : [...prev, projectId]
    )
    setProjectBudgets(prev => (
      prev[projectId] ? prev : { ...prev, [projectId]: { usd: '', devices: '' } }
    ))
  }

  const addTeamMember = (handle: string) => {
    if (!handle) return // Guard against null/undefined
    
    setTeamMembers(prev => [...prev, handle])
    setTeamMemberInput('')
    setShowUserDropdown(false)
  }

  const removeTeamMember = (handle: string) => {
    setTeamMembers(prev => prev.filter(h => h !== handle))
  }

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50" onClick={handleBackdropClick}>
      <div ref={modalRef} className="bg-black border-2 border-green-300 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto font-sans" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-xl font-bold mb-6">CREATE NEW CAMPAIGN</h2>

        {/* Error display */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500 text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Campaign Name */}
          <div>
            <label className="block text-xs uppercase mb-2">Campaign Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 bg-black border border-green-300 text-green-300 focus:outline-none focus:border-green-400"
              required
            />
          </div>

          {/* Date Range */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs uppercase mb-2">Start Date</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-green-300 text-green-300 focus:outline-none focus:border-green-400"
                required
              />
            </div>
            <div>
              <label className="block text-xs uppercase mb-2">End Date</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full px-3 py-2 bg-black border border-green-300 text-green-300 focus:outline-none focus:border-green-400"
                required
              />
            </div>
          </div>

          {/* Chains */}
          <div>
            <label className="block text-xs uppercase mb-2">Chains</label>
            
            {/* Selected chains */}
            <div className="flex flex-wrap gap-2 mb-2">
              {selectedChains.map(chain => (
                <span
                  key={chain}
                  className="px-2 py-1 bg-yellow-900 border border-yellow-300 text-yellow-300 text-xs flex items-center gap-1"
                >
                  {chain}
                  <button
                    type="button"
                    onClick={() => setSelectedChains(selectedChains.filter(c => c !== chain))}
                    className="text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            
            {/* Chain options */}
            <div className="grid grid-cols-4 gap-2 mb-2">
              {['Solana', 'Ethereum', 'Polygon', 'BSC', 'Arbitrum', 'Optimism', 'Avalanche', 'Base'].map(chain => (
                <button
                  key={chain}
                  type="button"
                  onClick={() => {
                    if (!selectedChains.includes(chain)) {
                      setSelectedChains([...selectedChains, chain])
                    }
                  }}
                  className={`px-2 py-1 border text-xs ${
                    selectedChains.includes(chain)
                      ? 'border-yellow-500 bg-yellow-900/50 text-yellow-300'
                      : 'border-green-300 hover:bg-green-900'
                  }`}
                  disabled={selectedChains.includes(chain)}
                >
                  {chain}
                </button>
              ))}
            </div>
            
            {/* Add custom chain */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customChain}
                onChange={(e) => setCustomChain(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (customChain && !selectedChains.includes(customChain)) {
                      setSelectedChains([...selectedChains, customChain])
                      setCustomChain('')
                    }
                  }
                }}
                placeholder="Add custom chain..."
                className="flex-1 px-3 py-1 bg-black border border-green-300 text-green-300 text-xs focus:outline-none focus:border-green-400"
              />
              <button
                type="button"
                onClick={() => {
                  if (customChain && !selectedChains.includes(customChain)) {
                    setSelectedChains([...selectedChains, customChain])
                    setCustomChain('')
                  }
                }}
                className="px-3 py-1 bg-green-900 border border-green-300 text-xs hover:bg-green-800"
              >
                Add
              </button>
            </div>
          </div>

          {/* Projects */}
          <div>
            <label className="block text-xs uppercase mb-2">
              Assign Projects {projectsLoading && <span className="text-xs text-gray-500">(loading...)</span>}
            </label>
            <div className="relative" ref={projectDropdownRef}>
              <input
                type="text"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                onFocus={() => setShowProjectDropdown(true)}
                placeholder={projectsLoading ? "Loading projects..." : "Search projects..."}
                className="w-full px-3 py-2 bg-black border border-green-300 text-green-300 focus:outline-none focus:border-green-400"
                disabled={projectsLoading}
              />
              {showProjectDropdown && !projectsLoading && (
                <div className="absolute top-full left-0 right-0 bg-black border border-green-300 max-h-48 overflow-y-auto z-20 mt-1">
                  {filteredProjects.length === 0 ? (
                    <div className="p-2 text-gray-500 text-sm">
                      {projects.length === 0 ? "No projects available" : "No projects found"}
                    </div>
                  ) : (
                    filteredProjects.map(project => (
                      <div
                        key={project.id}
                        onClick={() => {
                          toggleProject(project.id)
                          setShowProjectDropdown(false)
                          setProjectSearch('')
                        }}
                        className={`p-2 cursor-pointer hover:bg-green-900 ${
                          selectedProjects.includes(project.id) ? 'bg-green-800' : ''
                        }`}
                      >
                        <div className="text-sm">{project.twitterHandle}</div>
                        {project.notes && (
                          <div className="text-xs text-gray-500">{project.notes}</div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            {selectedProjects.length > 0 && (
              <div className="mt-4 space-y-4">
                {selectedProjects.map(id => {
                  const project = projects.find(p => p.id === id)
                  if (!project) return null
                  const budget = projectBudgets[id] || { usd: '', devices: '' }
                  return (
                    <div key={id} className="border border-green-700 p-3 rounded">
                      <div className="flex justify-between items-center mb-2">
                        <div className="font-bold text-sm">{project.twitterHandle}</div>
                        <button
                          type="button"
                          onClick={() => {
                            toggleProject(id)
                            setProjectBudgets(prev => {
                              const cp = { ...prev }
                              delete cp[id]
                              return cp
                            })
                          }}
                          className="text-red-500 text-sm hover:text-red-400"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs uppercase mb-1">Budget (USD)</label>
                          <input
                            type="number"
                            value={budget.usd}
                            onChange={e => setProjectBudgets(prev => ({ ...prev, [id]: { ...budget, usd: e.target.value } }))}
                            className="w-full px-2 py-1 bg-black border border-green-300 text-green-300 text-sm focus:outline-none focus:border-green-400"
                          />
                        </div>
                        <div>
                          <label className="block text-xs uppercase mb-1">Devices (model & qty)</label>
                          <input
                            type="text"
                            value={budget.devices}
                            onChange={e => setProjectBudgets(prev => ({ ...prev, [id]: { ...budget, devices: e.target.value } }))}
                            placeholder="e.g. iPhone 15 x2"
                            className="w-full px-2 py-1 bg-black border border-green-300 text-green-300 text-sm focus:outline-none focus:border-green-400"
                          />
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Team Members */}
          <div>
            <label className="block text-xs uppercase mb-2">
              Team Members {usersLoading && <span className="text-xs text-gray-500">(loading...)</span>}
            </label>
            <div className="relative" ref={userDropdownRef}>
              <input
                type="text"
                value={teamMemberInput}
                onChange={(e) => setTeamMemberInput(e.target.value)}
                onFocus={() => setShowUserDropdown(true)}
                placeholder={usersLoading ? "Loading users..." : "Search approved users..."}
                className="w-full px-3 py-2 bg-black border border-green-300 text-green-300 focus:outline-none focus:border-green-400"
                disabled={usersLoading}
              />
              {showUserDropdown && teamMemberInput && !usersLoading && (
                <div className="absolute top-full left-0 right-0 bg-black border border-green-300 max-h-48 overflow-y-auto z-20 mt-1">
                  {filteredUsers.length === 0 ? (
                    <div className="p-2 text-gray-500 text-sm">
                      {approvedUsers.length === 0 ? "No approved users available" : "No users found"}
                    </div>
                  ) : (
                    filteredUsers.map(handle => (
                      <div
                        key={handle}
                        onClick={() => addTeamMember(handle)}
                        className="p-2 cursor-pointer hover:bg-green-900"
                      >
                        @{handle}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
            {teamMembers.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {teamMembers.map(handle => (
                  <span
                    key={handle}
                    className="px-2 py-1 bg-green-900 border border-green-300 text-xs"
                  >
                    @{handle}
                    <button
                      type="button"
                      onClick={() => removeTeamMember(handle)}
                      className="ml-2 text-red-500 hover:text-red-400"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-4 mt-6">
            <button
              type="submit"
              disabled={loading || projectsLoading || usersLoading}
              className="px-4 py-2 bg-green-900 border border-green-300 hover:bg-green-800 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              {loading ? 'Creating...' : 'Create Campaign'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-green-300 hover:bg-green-900 focus:outline-none focus:ring-2 focus:ring-green-400"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}