'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useState, useMemo } from 'react'
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

  const userHandle = getTwitterHandleFromSession(session) || ''
  const userImage = session?.user?.image
  
  // Debug logging for scout page
  useEffect(() => {
    console.log('[Scout Page] Session status:', status);
    console.log('[Scout Page] Session data:', session);
    console.log('[Scout Page] User handle:', userHandle);
  }, [session, status, userHandle]);

  // FIXED: Removed duplicate auth check - middleware already handles authentication
  // Only check approval status if we have a session
  useEffect(() => {
    if (status === 'loading') return
    
    // Trust that middleware has already validated authentication
    // We only need to check approval status
    if (status === 'authenticated' && userHandle && isApproved === null) {
      ;(async () => {
        try {
          const res = await fetch(`/api/user/profile?handle=${userHandle}`)
          const data = await res.json()
          if (data.user?.approvalStatus === 'approved') {
            setIsApproved(true)
          } else {
            setIsApproved(false)
            router.replace('/access-denied')
          }
        } catch {
          setIsApproved(false)
          router.replace('/access-denied')
        }
      })()
    }
  }, [session, status, router, userHandle])

  // Load projects
  useEffect(() => {
    // Only load projects if we have a session with userHandle
    if (status === 'authenticated' && userHandle) {
      loadProjects()
      fetchUserRole()
    }
  }, [status, userHandle])

  const loadProjects = async () => {
    try {
      setLoading(true)
      setError(null) // Clear any previous errors
      console.log('🔍 Loading projects for scout:', userHandle)
      
      // Load user's projects
      const res = await fetch('/api/scout/projects')
      console.log('🔍 Scout projects API response status:', res.status)
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => ({ error: 'Failed to load projects' }))
        throw new Error(errorData.error || 'Failed to load projects')
      }
      
      const data = await res.json()
      console.log('🔍 Scout projects API response data:', data)
      console.log('🔍 Number of my projects received:', data.projects?.length || 0)
      
      setProjects(data.projects || [])
      
      // Load all projects
      const allRes = await fetch('/api/projects/all')
      console.log('🔍 All projects API response status:', allRes.status)
      
      if (allRes.ok) {
        const allData = await allRes.json()
        console.log('🔍 Number of all projects received:', allData.projects?.length || 0)
        setAllProjects(allData.projects || [])
      } else {
        console.error('Failed to load all projects')
      }
    } catch (err) {
      console.error('❌ Error loading projects:', err)
      setError(err instanceof Error ? err.message : 'Failed to load projects')
    } finally {
      setLoading(false)
    }
  }

  const fetchUserRole = async () => {
    try {
      const normalizedHandle = userHandle.replace('@', '').toLowerCase()
      const res = await fetch(`/api/user/role?handle=${normalizedHandle}`)
      if (res.ok) {
        const data = await res.json()
        setUserRole(data.role || 'scout')
        console.log('User role fetched:', data.role)
      }
    } catch (err) {
      console.error('Error fetching user role:', err)
    }
  }

  const handleSaveProject = async (data: Partial<Project>) => {
    try {
      const body = {
        ...data,
        createdBy: userHandle
      }
      setSaving(true)
      console.log('🚀 Creating project with data:', body)
      
      const res = await fetch('/api/projects/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })

      if (res.ok) {
        const json = await res.json()
        console.log('✅ Project created successfully:', json.project)
        
        // Add to local state immediately
        setProjects(prev => {
          const newProjects = [...prev, json.project]
          console.log('📝 Updated projects list, now has:', newProjects.length, 'projects')
          return newProjects
        })
        // Also add to all projects
        setAllProjects(prev => [...prev, json.project])
        setShowModal(false)
        
        // Force reload projects from server immediately and after a short delay
        console.log('🔄 Reloading projects from server...')
        await loadProjects()
        
        // Also reload after a delay to ensure indexing is complete
        setTimeout(async () => {
          console.log('🔄 Second reload after indexing delay...')
          await loadProjects()
        }, 2000) // Increased delay to ensure indexing is complete
      } else {
        const error = await res.json()
        console.error('❌ Project creation failed:', error)
        alert(error.error || 'Failed to create project')
      }
    } catch (e) {
      console.error('❌ Failed to save project:', e)
      alert('Failed to save project')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteProject = async (projectId: string) => {
    try {
      const res = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        // Remove from local state
        setProjects(prev => prev.filter(p => p.id !== projectId))
        setAllProjects(prev => prev.filter(p => p.id !== projectId))
        setShowModal(false)
        setSelectedProject(null)
        
        // Reload projects to ensure consistency
        await loadProjects()
      } else {
        const error = await res.json()
        alert(error.error || 'Failed to delete project')
      }
    } catch (e) {
      console.error('Failed to delete project:', e)
      alert('Failed to delete project')
    }
  }

  const currentProjects = activeTab === 'my' ? projects : allProjects

  const filteredProjects = useMemo(() => {
    if (!searchTerm) return currentProjects
    const term = searchTerm.toLowerCase()
    return currentProjects.filter(p => 
      p.twitterHandle.toLowerCase().includes(term) ||
      p.notes?.toLowerCase().includes(term)
    )
  }, [currentProjects, searchTerm])

  if (status === 'loading' || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black font-mono text-green-300">
        <div className="animate-pulse">Loading scout dashboard...</div>
      </div>
    )
  }

  if (isApproved === false) {
    return null
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
        {error ? (
          <div className="text-center py-12">
            <div className="border border-red-500 p-6 max-w-md mx-auto bg-red-900/10 rounded-md">
              <p className="text-red-400 mb-4">{error}</p>
              <button 
                onClick={loadProjects}
                className="px-4 py-2 border border-red-400 hover:bg-red-900/30 text-red-300 transition-colors"
              >
                Retry
              </button>
            </div>
          </div>
        ) : filteredProjects.length === 0 ? (
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
            <p className="text-green-300 font-bold">Creating project...</p>
            <p className="text-green-400 text-sm">Please wait while we save your project</p>
          </div>
        </div>
      )}
    </div>
  )
} 