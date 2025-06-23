'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState, useMemo, useCallback } from 'react'
import ProjectCard from '@/components/ProjectCard'
import ProjectModal from '@/components/ProjectModal'
import { Project } from '@/lib/project'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { getTwitterHandleFromSession } from '@/lib/auth-utils'

export default function ScoutPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [allProjects, setAllProjects] = useState<Project[]>([])
  const [showModal, setShowModal] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState<'my' | 'all'>('my')
  const [userRole, setUserRole] = useState<string>('scout')
  const [isApproved, setIsApproved] = useState<boolean | null>(null)
  const [retryCount, setRetryCount] = useState(0)

  const userHandle = getTwitterHandleFromSession(session) || ''
  const userImage = session?.user?.image
  
  // Debug logging for scout page
  useEffect(() => {
    console.log('[Scout Page] Session status:', status);
    console.log('[Scout Page] Session data:', session);
    console.log('[Scout Page] User handle:', userHandle);
  }, [session, status, userHandle]);

  // Check approval status with error handling
  useEffect(() => {
    if (status === 'loading') return
    
    // Trust that middleware has already validated authentication
    // We only need to check approval status
    if (status === 'authenticated' && userHandle && isApproved === null) {
      const checkApproval = async () => {
        try {
          console.log('[Scout Page] Checking approval status for:', userHandle)
          const res = await fetch(`/api/user/profile?handle=${userHandle}`)
          
          if (!res.ok) {
            throw new Error(`Failed to check approval: ${res.status}`)
          }
          
          const data = await res.json()
          console.log('[Scout Page] Approval check response:', data)
          
          if (data.user?.approvalStatus === 'approved') {
            setIsApproved(true)
          } else {
            setIsApproved(false)
            console.log('[Scout Page] User not approved, redirecting to access-denied')
            router.replace('/access-denied')
          }
        } catch (error) {
          console.error('[Scout Page] Error checking approval:', error)
          setIsApproved(false)
          setError('Failed to verify access. Please try refreshing the page.')
          
          // Retry logic
          if (retryCount < 3) {
            setTimeout(() => {
              setRetryCount(prev => prev + 1)
            }, 2000)
          }
        }
      }
      
      checkApproval()
    }
  }, [session, status, router, userHandle, isApproved, retryCount])

  // Load projects with error handling
  const loadProjects = useCallback(async () => {
    if (!userHandle) {
      console.log('[Scout Page] No user handle, skipping project load')
      return
    }
    
    try {
      setLoading(true)
      setError(null)
      console.log('[Scout Page] Loading projects for scout:', userHandle)
      
      // Load user's projects
      const res = await fetch('/api/scout/projects')
      console.log('[Scout Page] Scout projects API response status:', res.status)
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to load projects' }))
        throw new Error(errorData.error || `Failed to load projects: ${res.status}`)
      }
      
      const data = await res.json()
      console.log('[Scout Page] Scout projects data:', data)
      console.log('[Scout Page] Number of my projects received:', data.projects?.length || 0)
      
      // Ensure projects is always an array
      const myProjects = Array.isArray(data.projects) ? data.projects : []
      setProjects(myProjects)
      
      // Load all projects with error handling
      try {
        const allRes = await fetch('/api/projects/all')
        console.log('[Scout Page] All projects API response status:', allRes.status)
        
        if (allRes.ok) {
          const allData = await allRes.json()
          console.log('[Scout Page] Number of all projects received:', allData.projects?.length || 0)
          
          // Ensure all projects is always an array
          const allProjectsData = Array.isArray(allData.projects) ? allData.projects : []
          setAllProjects(allProjectsData)
        } else {
          console.error('[Scout Page] Failed to load all projects')
          setAllProjects([])
        }
      } catch (allError) {
        console.error('[Scout Page] Error loading all projects:', allError)
        setAllProjects([])
      }
    } catch (err) {
      console.error('[Scout Page] Error loading projects:', err)
      setError(err instanceof Error ? err.message : 'Failed to load projects')
      setProjects([])
      setAllProjects([])
    } finally {
      setLoading(false)
    }
  }, [userHandle])

  // Fetch user role with error handling
  const fetchUserRole = useCallback(async () => {
    if (!userHandle) return
    
    try {
      const normalizedHandle = userHandle.replace('@', '').toLowerCase()
      const res = await fetch(`/api/user/role?handle=${normalizedHandle}`)
      
      if (res.ok) {
        const data = await res.json()
        setUserRole(data.role || 'scout')
        console.log('[Scout Page] User role fetched:', data.role)
      } else {
        console.error('[Scout Page] Failed to fetch user role')
        setUserRole('scout')
      }
    } catch (err) {
      console.error('[Scout Page] Error fetching user role:', err)
      setUserRole('scout')
    }
  }, [userHandle])

  // Load projects when authenticated and approved
  useEffect(() => {
    if (status === 'authenticated' && userHandle && isApproved === true) {
      loadProjects()
      fetchUserRole()
    }
  }, [status, userHandle, isApproved, loadProjects, fetchUserRole])

  const handleSaveProject = async (data: Partial<Project>) => {
    try {
      const body = {
        ...data,
        createdBy: userHandle
      }
      setSaving(true)
      setError(null)
      console.log('[Scout Page] Creating project with data:', body)
      
      const res = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      const responseData = await res.json()
      
      if (res.ok) {
        console.log('[Scout Page] Project created successfully:', responseData.project)
        
        // Add to local state immediately
        if (responseData.project) {
          setProjects(prev => [...prev, responseData.project])
          setAllProjects(prev => [...prev, responseData.project])
        }
        
        setShowModal(false)
        
        // Reload projects to ensure consistency
        console.log('[Scout Page] Reloading projects from server...')
        await loadProjects()
      } else {
        console.error('[Scout Page] Project creation failed:', responseData)
        throw new Error(responseData.error || 'Failed to create project')
      }
    } catch (e) {
      console.error('[Scout Page] Failed to save project:', e)
      setError(e instanceof Error ? e.message : 'Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    if (!projectId) return
    
    try {
      setError(null)
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      })

      const responseData = await res.json().catch(() => ({}))
      
      if (res.ok) {
        // Remove from local state
        setProjects(prev => prev.filter(p => p.id !== projectId))
        setAllProjects(prev => prev.filter(p => p.id !== projectId))
        setShowModal(false)
        setSelectedProject(null)
        
        // Reload projects to ensure consistency
        await loadProjects()
      } else {
        throw new Error(responseData.error || 'Failed to delete project')
      }
    } catch (e) {
      console.error('[Scout Page] Failed to delete project:', e)
      setError(e instanceof Error ? e.message : 'Failed to delete project')
    }
  }

  const currentProjects = activeTab === 'my' ? projects : allProjects

  const filteredProjects = useMemo(() => {
    if (!searchTerm) return currentProjects
    
    const term = searchTerm.toLowerCase()
    return currentProjects.filter(p => {
      if (!p) return false // Guard against null/undefined
      return (
        (p.twitterHandle && p.twitterHandle.toLowerCase().includes(term)) ||
        (p.notes && p.notes.toLowerCase().includes(term))
      )
    })
  }, [currentProjects, searchTerm])

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black font-mono text-green-300">
        <div className="text-center">
          <div className="animate-pulse mb-4">Loading scout dashboard...</div>
          <div className="text-xs text-gray-500">Please wait while we verify your access</div>
        </div>
      </div>
    )
  }

  if (isApproved === false) {
    return null // Will redirect to access-denied
  }

  return (
    <div className="min-h-screen bg-black text-green-300">
      {/* Background pattern */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-5">
        <div className="absolute inset-0" 
          style={{
            backgroundImage: 'url("data:image/svg+xml,%3Csvg width=\'60\' height=\'60\' viewBox=\'0 0 60 60\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cg fill=\'none\' fill-rule=\'evenodd\'%3E%3Cg fill=\'%2322c55e\' fill-opacity=\'0.4\'%3E%3Cpath d=\'M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z\'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")',
          }}
        />
      </div>

      <div className="container mx-auto p-4 relative z-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6 mt-4 sm:mt-8 pb-4 border-b border-green-400/30">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
            <h1 className="text-lg sm:text-xl font-mono text-green-300 font-bold relative">
              <span className="relative">
                Scout Dashboard
                <span className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-green-400 to-transparent"></span>
              </span>
            </h1>
            <div className="text-xs px-2 py-1 bg-green-900/30 border border-green-500 rounded-md inline-flex">
              <div className="flex items-center gap-2">
                {userImage && (
                  <Image 
                    src={userImage} 
                    alt={userHandle} 
                    width={20} 
                    height={20}
                    className="rounded-full"
                  />
                )}
                <span>{userHandle}</span>
              </div>
            </div>
          </div>
          
          <div className="flex gap-2">
            <button
              onClick={() => setShowModal(true)}
              className="px-3 py-1.5 sm:px-4 sm:py-2 border border-green-400 bg-green-900/30 text-green-300 rounded-md shadow-md hover:bg-green-800/40 transition-colors duration-300 text-sm sm:text-base"
            >
              + New Project
            </button>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-4 p-3 bg-red-900/20 border border-red-500 text-red-400 text-sm rounded-md">
            {error}
            <button 
              onClick={() => {
                setError(null)
                loadProjects()
              }}
              className="ml-4 underline hover:text-red-300"
            >
              Retry
            </button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-2 sm:gap-4 mb-4 sm:mb-6 overflow-x-auto">
          <button
            onClick={() => setActiveTab('my')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 border transition-colors duration-300 rounded-md text-sm sm:text-base whitespace-nowrap ${
              activeTab === 'my'
                ? 'border-green-400 bg-green-900/30 text-green-300 shadow-md'
                : 'border-green-600 text-green-600 hover:border-green-400 hover:text-green-400'
            }`}
          >
            My Projects ({projects.length})
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 sm:px-4 sm:py-2 border transition-colors duration-300 rounded-md text-sm sm:text-base whitespace-nowrap ${
              activeTab === 'all'
                ? 'border-green-400 bg-green-900/30 text-green-300 shadow-md'
                : 'border-green-600 text-green-600 hover:border-green-400 hover:text-green-400'
            }`}
          >
            All Projects ({allProjects.length})
          </button>
        </div>

        {/* Search Bar */}
        <div className="mb-4 sm:mb-6">
          <div className="relative">
            <input
              type="text"
              placeholder="Search projects..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full border border-green-300 bg-black p-2 pr-10 text-green-300 rounded-md focus:outline-none focus:border-green-400 focus:ring-1 focus:ring-green-400 transition-colors text-sm sm:text-base"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-300/50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
          </div>
        </div>

        {/* Projects Grid */}
        {filteredProjects.length === 0 ? (
          <div className="text-center py-12 text-yellow-300 border border-dashed border-yellow-500 p-8 rounded-lg bg-yellow-900/5">
            <div className="mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-yellow-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M12 21a9 9 0 100-18 9 9 0 000 18z" />
              </svg>
            </div>
            <div className="text-lg mb-2 font-bold">No Projects Found</div>
            <div>
              {searchTerm 
                ? "No projects match your search criteria"
                : activeTab === 'my' 
                  ? "You haven't created any projects yet. Click 'New Project' to get started!"
                  : "No projects have been created yet."}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onClick={() => {
                  setSelectedProject(project)
                  setShowModal(true)
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      {showModal && (
        <ProjectModal 
          project={selectedProject ?? undefined}
          onClose={() => {
            setShowModal(false)
            setSelectedProject(null)
          }}
          onSave={handleSaveProject}
          isEditMode={!!selectedProject}
          userRole={userRole}
          currentUserWallet={userHandle}
          onDelete={handleDeleteProject}
        />
      )}

      {/* Saving Overlay */}
      {saving && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center z-50">
          <div className="border border-green-400 bg-black p-8 flex flex-col items-center gap-4 rounded-md shadow-lg">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-400"></div>
            <p className="text-green-300 font-bold">
              {selectedProject ? 'Updating project...' : 'Creating project...'}
            </p>
            <p className="text-green-400 text-sm">Please wait while we save your project</p>
          </div>
        </div>
      )}
    </div>
  )
} 