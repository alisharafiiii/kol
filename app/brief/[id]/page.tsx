'use client'

import { useState, useEffect } from 'react'
import { useSession, signIn } from 'next-auth/react'
import { useParams } from 'next/navigation'
import type { Campaign } from '@/lib/campaign'
import type { Project } from '@/lib/project'

export default function BriefPage() {
  const { data: session, status } = useSession()
  const params = useParams()
  const campaignId = params.id as string
  
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [mainProject, setMainProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasAccess, setHasAccess] = useState(false)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set())
  
  // Check user access
  useEffect(() => {
    const checkAccess = async () => {
      if (status === 'loading') return
      
      if (status === 'unauthenticated') {
        setLoading(false)
        return
      }
      
      if (!session?.user?.name) {
        setError('Please sign in to view this brief')
        setLoading(false)
        return
      }
      
      try {
        // Get user profile
        const profileRes = await fetch(`/api/user/profile?handle=${session.user.name}`, {
          credentials: 'include'
        })
        if (profileRes.ok) {
          const profileData = await profileRes.json()
          const profile = profileData.user
          setUserProfile(profile)
          
          // Get campaign to check KOL list
          const campaignRes = await fetch(`/api/campaigns/${campaignId}`, {
            credentials: 'include'
          })
          if (campaignRes.ok) {
            const campaignData = await campaignRes.json()
            
            console.log('Access check - User:', {
              sessionName: session.user.name,
              twitterHandle: (session.user as any).twitterHandle,
              role: profile.role,
              profileHandle: profile.twitterHandle
            })
            console.log('Campaign data:', {
              createdBy: campaignData.createdBy,
              teamMembers: campaignData.teamMembers,
              kols: campaignData.kols?.map((k: any) => k.handle)
            })
            
            // Check if user has admin/core/viewer role first
            const allowedRoles = ['admin', 'core', 'viewer']
            if (profile.role && allowedRoles.includes(profile.role)) {
              console.log('Access granted: Admin/Core/Viewer role')
              setHasAccess(true)
              return
            }
            
            // Get user handle - try different sources
            const userHandle = (session.user as any).twitterHandle || 
                             profile.twitterHandle?.replace('@', '') || 
                             session.user.name
            
            // Check if user is owner or team member
            if (campaignData.createdBy === userHandle || 
                campaignData.teamMembers?.includes(userHandle)) {
              console.log('Access granted: Owner or team member')
              setHasAccess(true)
              return
            }
            
            // Check if user has 'kol' role OR is added as KOL in this campaign
            if (profile.role === 'kol') {
              console.log('Access granted: KOL role')
              setHasAccess(true)
              return
            }
            
            const isKOLInCampaign = campaignData.kols?.some((kol: any) => {
              const kolHandle = kol.handle?.replace('@', '')
              return kolHandle === userHandle || kolHandle === `@${userHandle}`
            })
            
            if (isKOLInCampaign) {
              console.log('Access granted: KOL in campaign')
              setHasAccess(true)
              return
            }
            
            console.log('Access denied: No matching criteria')
            setError('Access denied. You need appropriate permissions to view this campaign brief.')
            setLoading(false)
            return
          }
        } else {
          setError('Profile not found. Please contact an administrator.')
          setLoading(false)
          return
        }
      } catch (err) {
        console.error('Error checking access:', err)
        setError('Error checking access permissions')
        setLoading(false)
      }
    }
    
    checkAccess()
  }, [session, status, campaignId])
  
  // Fetch campaign data
  useEffect(() => {
    const fetchCampaign = async () => {
      if (!hasAccess) return
      
      try {
        const res = await fetch(`/api/campaigns/${campaignId}`, {
          credentials: 'include'
        })
        if (res.ok) {
          const data = await res.json()
          setCampaign(data)
          
          // Fetch all projects for the campaign
          if (data.projects?.length > 0) {
            console.log('Campaign has projects:', data.projects)
            const projectPromises = data.projects.map(async (projectId: string) => {
              try {
                console.log('Fetching project:', projectId)
                const projectRes = await fetch(`/api/projects/${projectId}`, {
                  credentials: 'include'
                })
                console.log(`Project ${projectId} response status:`, projectRes.status)
                if (projectRes.ok) {
                  const projectData = await projectRes.json()
                  console.log(`Project ${projectId} data:`, projectData)
                  try {
                    const scoutRes = await fetch(`/api/projects/${projectData.scoutProjectId}`, {
                      credentials: 'include'
                    })
                    if (scoutRes.ok) {
                      // Project fetch successful
                    } else {
                      console.error(`Failed to fetch scout project ${projectData.scoutProjectId}:`, scoutRes.status)
                    }
                  } catch (err) {
                    console.error(`Failed to fetch scout project ${projectData.scoutProjectId}:`, err)
                  }
                  return projectData
                } else {
                  const errorText = await projectRes.text()
                  console.error(`Failed to fetch project ${projectId}:`, projectRes.status, errorText)
                }
              } catch (err) {
                console.error(`Failed to fetch project ${projectId}:`, err)
              }
              return null
            })
            
            const fetchedProjects = (await Promise.all(projectPromises)).filter(Boolean)
            console.log('Fetched projects:', fetchedProjects)
            setProjects(fetchedProjects)
            
            // Determine main project - use the one with highest budget or first one
            if (fetchedProjects.length > 0) {
              let main = fetchedProjects[0]
              
              // If we have project budgets, use the one with highest budget
              if (data.projectBudgets) {
                console.log('Project budgets:', data.projectBudgets)
                let maxBudget = 0
                fetchedProjects.forEach((proj: Project) => {
                  const budget = data.projectBudgets[proj.id]
                  if (budget) {
                    const budgetValue = parseFloat(budget.usd.replace(/[^0-9.-]+/g, '')) || 0
                    console.log(`Project ${proj.id} budget:`, budget.usd, 'parsed:', budgetValue)
                    if (budgetValue > maxBudget) {
                      maxBudget = budgetValue
                      main = proj
                    }
                  }
                })
              }
              
              setMainProject(main)
              console.log('Main project set:', main)
              console.log('Main project details:', {
                id: main.id,
                twitterHandle: main.twitterHandle,
                profileImageUrl: main.profileImageUrl,
                name: main.name
              })
            } else {
              console.log('No projects fetched successfully')
            }
          } else {
            console.log('Campaign has no projects')
          }
          
          // Debug log the brief content to check for images
          if (data.brief) {
            const imgMatches = data.brief.match(/<img[^>]+src="([^"]+)"/g)
            if (imgMatches) {
              console.log('Images found in brief:', imgMatches)
            }
          }
        } else {
          setError('Campaign not found')
        }
      } catch (err) {
        console.error('Error fetching campaign:', err)
        setError('Error loading campaign')
      } finally {
        setLoading(false)
      }
    }
    
    fetchCampaign()
  }, [campaignId, hasAccess])
  
  // Add image error handlers after brief content is rendered
  useEffect(() => {
    if (!campaign?.brief) return

    // Small delay to ensure DOM is updated
    const timer = setTimeout(() => {
      const images = document.querySelectorAll('.brief-content img')
      
      images.forEach((img: Element) => {
        const imgElement = img as HTMLImageElement
        
        // Log current src
        console.log('Found image in brief:', imgElement.src)
        
        // Add error handler
        imgElement.onerror = () => {
          console.error('Image failed to load:', imgElement.src)
          
          // If it's a relative path, try with full URL
          if (imgElement.src.includes('/uploads/briefs/') && !imgElement.src.startsWith('http')) {
            const newSrc = window.location.origin + '/uploads/briefs/' + imgElement.src.split('/uploads/briefs/').pop()
            console.log('Trying alternative URL:', newSrc)
            imgElement.src = newSrc
          }
        }
        
        // Add load handler
        imgElement.onload = () => {
          console.log('Image loaded successfully:', imgElement.src)
        }
      })
    }, 100)

    return () => clearTimeout(timer)
  }, [campaign?.brief])
  
  // Show login screen for unauthenticated users
  if (status === 'unauthenticated') {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <style jsx global>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono&display=swap');
          body {
            font-family: 'IBM Plex Sans', sans-serif;
          }
        `}</style>
        
        <div className="bg-black border border-green-500 rounded-lg p-8 max-w-md w-full text-center">
          <div className="w-24 h-24 mx-auto mb-6 bg-green-900/20 rounded-full flex items-center justify-center">
            <span className="text-4xl text-green-300">🚀</span>
          </div>
          <h1 className="text-2xl font-bold text-green-300 mb-4">Campaign Brief Access</h1>
          <p className="text-green-400 mb-6">Please sign in to view this campaign brief</p>
          
          <button
            onClick={() => {
              // Use redirect: false to prevent loops on mobile
              signIn('twitter', {
                redirect: false,
                callbackUrl: window.location.href
              }).then((result) => {
                if (result?.ok) {
                  window.location.reload()
                } else if (result?.error) {
                  console.error('Sign in error:', result.error)
                  if (result.error === 'OAuthCallback' || result.error === 'Callback') {
                    // On mobile, OAuth callbacks sometimes fail - try direct redirect
                    setTimeout(() => {
                      window.location.href = '/api/auth/signin/twitter'
                    }, 1000)
                  }
                }
              }).catch((err) => {
                console.error('Sign in failed:', err)
                // Fallback to direct redirect
                window.location.href = '/api/auth/signin/twitter'
              })
            }}
            className="w-full px-6 py-3 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
            </svg>
            Sign in with X
          </button>
        </div>
      </div>
    )
  }
  
  // Show loading or error states
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-green-300">Loading...</div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-black border border-red-500 rounded-lg p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-red-400 mb-4">Access Error</h1>
          <p className="text-red-300">{error}</p>
          {status === 'authenticated' && (
            <button
              onClick={() => window.location.href = '/'}
              className="mt-6 px-4 py-2 border border-green-500 text-green-300 rounded hover:bg-green-900/30"
            >
              Go to Dashboard
            </button>
          )}
          {status !== 'authenticated' && status !== 'loading' && (
            <button
              onClick={() => {
                signIn('twitter', {
                  redirect: false,
                  callbackUrl: window.location.href
                }).then((result) => {
                  if (result?.ok) {
                    window.location.reload()
                  } else if (result?.error) {
                    if (result.error === 'OAuthCallback' || result.error === 'Callback') {
                      setTimeout(() => {
                        window.location.href = '/api/auth/signin/twitter'
                      }, 1000)
                    }
                  }
                }).catch((err) => {
                  window.location.href = '/api/auth/signin/twitter'
                })
              }}
              className="mt-6 px-4 py-2 border border-green-500 text-green-300 rounded hover:bg-green-900/30"
            >
              Sign In
            </button>
          )}
        </div>
      </div>
    )
  }
  
  if (!campaign || !campaign.brief) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-green-300">No brief available for this campaign</div>
      </div>
    )
  }
  
  // Render the brief
  return (
    <div className="min-h-screen bg-black">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono&display=swap');
        body {
          font-family: 'IBM Plex Sans', sans-serif;
        }
        
        /* Reset some default styles that might interfere */
        .brief-content * {
          font-family: 'IBM Plex Sans', sans-serif;
        }
        
        /* Handle any div containers from the editor */
        .brief-content div {
          color: #bbf7d0;
          line-height: 1.8;
        }
        
        .brief-content h1 {
          font-size: 2rem;
          font-weight: 700;
          margin: 2rem 0 1.5rem;
          color: #86efac;
        }
        .brief-content h2 {
          font-size: 1.5rem;
          font-weight: 600;
          margin: 1.5rem 0 1rem;
          color: #86efac;
        }
        .brief-content h3 {
          font-size: 1.25rem;
          font-weight: 600;
          margin: 1.25rem 0 0.75rem;
          color: #86efac;
        }
        .brief-content p {
          margin: 0.75rem 0;
          color: #bbf7d0;
          line-height: 1.8;
        }
        .brief-content ul, .brief-content ol {
          margin: 0.75rem 0;
          padding-left: 1.5rem;
          color: #bbf7d0;
        }
        .brief-content li {
          margin: 0.5rem 0;
          line-height: 1.8;
          color: #bbf7d0;
        }
        .brief-content strong, .brief-content b {
          color: #86efac;
          font-weight: 600;
        }
        .brief-content em, .brief-content i {
          font-style: italic;
          color: #bbf7d0;
        }
        .brief-content a {
          color: #60a5fa;
          text-decoration: underline;
        }
        .brief-content a:hover {
          color: #93c5fd;
        }
        .brief-content img, .brief-content video {
          margin: 1rem auto;
          border-radius: 0.5rem;
          border: 1px solid #065f46;
          max-width: 100%;
          height: auto;
          display: block;
        }
        .brief-content blockquote {
          border-left: 4px solid #86efac;
          padding-left: 1rem;
          margin: 1rem 0;
          color: #86efac;
          font-style: italic;
        }
        .brief-content pre {
          background: #1a1a1a;
          padding: 1rem;
          border-radius: 0.5rem;
          overflow-x: auto;
          margin: 1rem 0;
        }
        .brief-content code {
          color: #86efac;
          font-family: 'IBM Plex Mono', monospace;
          background: #1a1a1a;
          padding: 0.125rem 0.25rem;
          border-radius: 0.25rem;
        }
        .brief-content pre code {
          background: none;
          padding: 0;
        }
        .brief-content table {
          width: 100%;
          border-collapse: collapse;
          margin: 1rem 0;
        }
        .brief-content th {
          padding: 0.5rem;
          text-align: left;
          border-bottom: 2px solid #065f46;
          color: #86efac;
          font-weight: 600;
        }
        .brief-content td {
          padding: 0.5rem;
          border-bottom: 1px solid #065f46;
          color: #bbf7d0;
        }
        .brief-content hr {
          border: 0;
          height: 1px;
          background: #065f46;
          margin: 2rem 0;
        }
        
        /* Handle align attributes from editor */
        .brief-content [align="center"] {
          text-align: center;
        }
        .brief-content [align="right"] {
          text-align: right;
        }
        .brief-content [align="left"] {
          text-align: left;
        }
      `}</style>
      
      {/* Header */}
      <div className="border-b border-green-500 bg-black/95 backdrop-blur sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-green-300">{campaign.name}</h1>
            <p className="text-xs text-green-400">Campaign Brief</p>
          </div>
          
          <div className="flex items-center gap-6">
            {projects.length > 0 && (
              <div className="flex items-center gap-3">
                {/* Show all project avatars */}
                <div className="flex -space-x-2">
                  {projects.slice(0, 3).map((project, idx) => {
                    const handle = (project.twitterHandle || '').replace('@', '')
                    const imageUrl = project.profileImageUrl || `https://unavatar.io/twitter/${handle}`
                    const showFallback = failedImages.has(project.id)
                    
                    if (showFallback || !handle) {
                      return (
                        <div
                          key={project.id}
                          className="w-10 h-10 rounded-full border-2 border-black bg-gray-700 flex items-center justify-center text-gray-300 text-sm font-medium"
                          title={`@${handle}`}
                        >
                          {handle.charAt(0).toUpperCase() || 'P'}
                        </div>
                      )
                    }
                    
                    return (
                      <img
                        key={project.id}
                        src={imageUrl}
                        alt={handle}
                        className="w-10 h-10 rounded-full border-2 border-black bg-gray-800 object-cover"
                        title={`@${handle}`}
                        onError={(e) => {
                          const img = e.currentTarget
                          if (!img.src.includes('unavatar.io')) {
                            // Try unavatar as fallback
                            img.src = `https://unavatar.io/twitter/${handle}`
                          } else {
                            // If unavatar also fails, add to failed set
                            setFailedImages(prev => new Set(prev).add(project.id))
                          }
                        }}
                      />
                    )
                  })}
                  {projects.length > 3 && (
                    <div className="w-10 h-10 rounded-full bg-gray-700 border-2 border-black flex items-center justify-center text-xs text-gray-300">
                      +{projects.length - 3}
                    </div>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-green-300">
                    {projects.length === 1 && mainProject ? `@${(mainProject.twitterHandle || '').replace('@', '')}` : `${projects.length} Clients`}
                  </div>
                  <div className="text-xs text-green-400">Project{projects.length > 1 ? 's' : ''}</div>
                </div>
              </div>
            )}
            
            {/* Viewer's profile */}
            {(userProfile || session?.user) && (
              <div className="flex items-center gap-2 pl-6 border-l border-green-500/30">
                {(() => {
                  const handle = userProfile?.twitterHandle || (session?.user as any)?.twitterHandle || session?.user?.name || ''
                  const cleanHandle = handle.replace('@', '')
                  const imageUrl = userProfile?.profileImageUrl || session?.user?.image || `https://unavatar.io/twitter/${cleanHandle}`
                  const showFallback = failedImages.has('viewer')
                  
                  if (showFallback || !cleanHandle) {
                    return (
                      <div className="w-8 h-8 rounded-full border border-green-500/50 bg-green-900/30 flex items-center justify-center text-green-300 text-sm font-medium">
                        {cleanHandle.charAt(0).toUpperCase() || 'U'}
                      </div>
                    )
                  }
                  
                  return (
                    <img
                      src={imageUrl}
                      alt="Your profile"
                      className="w-8 h-8 rounded-full border border-green-500/50 bg-gray-800 object-cover"
                      onError={(e) => {
                        const img = e.currentTarget
                        if (!img.src.includes('unavatar.io')) {
                          img.src = `https://unavatar.io/twitter/${cleanHandle}`
                        } else {
                          setFailedImages(prev => new Set(prev).add('viewer'))
                        }
                      }}
                    />
                  )
                })()}
                <div>
                  <div className="text-xs text-green-400">Viewing as</div>
                  <div className="text-xs font-medium text-green-300">
                    @{userProfile?.twitterHandle || (session?.user as any)?.twitterHandle || session?.user?.name || 'Unknown'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Brief Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Brief Content with better typography */}
        <div className="bg-black/50 border border-green-500/30 rounded-lg p-6 md:p-8">
          {campaign.brief && campaign.brief.trim() ? (
            <div 
              className="brief-content prose prose-invert prose-green max-w-none"
              dangerouslySetInnerHTML={{ __html: campaign.brief }}
              style={{ color: '#bbf7d0', fontSize: '16px', lineHeight: '1.8' }}
            />
          ) : (
            <div className="text-center py-12">
              <p className="text-green-400 text-lg">No brief content available yet.</p>
              <p className="text-green-500 text-sm mt-2">Please check back later.</p>
            </div>
          )}
        </div>
      </div>
      
      {/* Footer */}
      <div className="mt-16 border-t border-green-500 py-8">
        <div className="max-w-4xl mx-auto px-6 text-center text-xs text-green-400">
          <p>This brief is confidential and intended only for authorized KOLs</p>
        </div>
      </div>
    </div>
  )
} 