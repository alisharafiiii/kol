'use client'

import React from 'react'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'
import { MessageSquare, Users, TrendingUp, AlertCircle } from 'lucide-react'
import { Line, Doughnut, Bar } from 'react-chartjs-2'
import Image from 'next/image'
import { format, parseISO, startOfDay, endOfDay, subDays } from 'date-fns'
import { hasAdminAccess, logAdminAccess } from '@/lib/admin-config'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js'
import type { DiscordProject } from '@/lib/types/discord'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
)

interface DiscordAnalytics {
  metrics: {
    totalMessages: number
    uniqueUsers: number
    averageMessagesPerUser: number
    sentimentBreakdown: {
      positive: number
      neutral: number
      negative: number
    }
    dailyTrend: Array<{ date: string; messages: number }>
    channelActivity: Array<{ channelId: string; channelName: string; messageCount: number }>
    topUsers: Array<{ userId: string; username: string; messageCount: number; avgSentiment: number }>
  }
}

// Add error boundary
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error) {
    console.error('ErrorBoundary caught error:', error)
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary Error Details:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center p-4">
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-8 max-w-md w-full">
            <h1 className="text-xl font-bold text-red-400 mb-4">Something went wrong</h1>
            <p className="text-red-300 mb-4">An error occurred while loading the page.</p>
            <details className="text-sm text-gray-400">
              <summary className="cursor-pointer">Error details</summary>
              <pre className="mt-2 whitespace-pre-wrap">{this.state.error?.toString()}</pre>
            </details>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

// This page requires authentication and proper role
function DiscordSharePageContent() {
  const params = useParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const [project, setProject] = useState<DiscordProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [analytics, setAnalytics] = useState<DiscordAnalytics | null>(null)
  const [scoutProject, setScoutProject] = useState<any>(null)
  const [checkingAccess, setCheckingAccess] = useState(true)
  const searchParams = useSearchParams()
  const timeframe = searchParams.get('timeframe') || 'weekly'
  
  // Convert URL-safe format back to normal format
  // Handle both %3A (URL-encoded colon) and -- (double dash) formats
  const rawId = params.id as string
  const projectId = rawId
    .replace(/%3A/g, ':')  // Convert URL-encoded colons
    .replace(/--/g, ':')   // Convert double dashes
  
  console.log('=== DISCORD SHARE COMPONENT MOUNTED ===')
  console.log('Discord Share: Raw ID:', rawId)
  console.log('Discord Share: Parsed project ID:', projectId)
  console.log('Discord Share: Session status:', status)
  console.log('Discord Share: Session data:', session)
  console.log('Discord Share: Current URL:', typeof window !== 'undefined' ? window.location.href : 'SSR')
  
  // Add a catch-all error handler
  useEffect(() => {
    const handleError = (event: ErrorEvent) => {
      console.error('Discord Share: Uncaught error:', event.error)
      setError(`Unexpected error: ${event.error?.message || 'Unknown error'}`)
    }
    
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Discord Share: Unhandled promise rejection:', event.reason)
      setError(`Unexpected error: ${event.reason?.message || event.reason || 'Unknown error'}`)
    }
    
    window.addEventListener('error', handleError)
    window.addEventListener('unhandledrejection', handleUnhandledRejection)
    
    return () => {
      window.removeEventListener('error', handleError)
      window.removeEventListener('unhandledrejection', handleUnhandledRejection)
    }
  }, [])

  // Check authentication and access in one effect
  useEffect(() => {
    const checkAccessAndFetchData = async () => {
      // Enhanced logging for debugging
      console.log('=== DISCORD SHARE PAGE RENDER ===')
      console.log('Discord Share: Current URL:', window.location.href)
      console.log('Discord Share: Project ID:', projectId)
      console.log('Discord Share: Auth Status:', status)
      console.log('Discord Share: Session:', session)
      console.log('Discord Share: CheckingAccess:', checkingAccess)
      console.log('Discord Share: Loading:', loading)
      console.log('Discord Share: Error:', error)
      
      // Skip if we're still checking access
      if (checkingAccess && status === 'loading') {
        console.log('Discord Share: Waiting for session status...')
        return
      }
      
      // If not authenticated and we've finished checking, redirect to sign in
      if (status === 'unauthenticated') {
        console.log('Discord Share: User not authenticated, redirecting to sign in')
        setCheckingAccess(false)
        setLoading(false)
        
        // Automatically redirect to sign in with the current URL as callback
        const currentUrl = window.location.href
        const signInUrl = `/auth/signin?callbackUrl=${encodeURIComponent(currentUrl)}`
        console.log('Discord Share: Redirecting to:', signInUrl)
        window.location.href = signInUrl
        return
      }
      
      // If authenticated, check access
      if (status === 'authenticated') {
        if (!session?.user?.name) {
          console.error('Discord Share: Authenticated but no user name')
          setError('Authentication error. Please try signing in again.')
          setCheckingAccess(false)
          setLoading(false)
          return
        }
        
        console.log('Discord Share: User authenticated as:', session.user.name)
        console.log('Discord Share: Session Twitter handle:', (session as any).twitterHandle)
        
        try {
          // Get user profile to check role
          // IMPORTANT: Use twitterHandle from session, not user.name which might be ENS
          const handleToSearch = (session as any).twitterHandle || session.user.name
          console.log('Discord Share: Fetching user profile for:', handleToSearch)
          const profileUrl = `/api/user/profile?handle=${encodeURIComponent(handleToSearch)}`
          console.log('Discord Share: Profile URL:', profileUrl)
          
          const profileRes = await fetch(profileUrl, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            cache: 'no-store'
          })
          
          console.log('Discord Share: Profile response status:', profileRes.status)
          console.log('Discord Share: Profile response headers:', profileRes.headers)
          
          if (!profileRes.ok) {
            console.error('Discord Share: Failed to fetch profile:', profileRes.status)
            const errorText = await profileRes.text()
            console.error('Discord Share: Profile error response:', errorText)
            
            if (profileRes.status === 401) {
              // Session invalid, redirect to sign in
              window.location.href = `/api/auth/signin?callbackUrl=${encodeURIComponent(window.location.href)}`
              return
            }
            setError('Failed to fetch user profile')
            setCheckingAccess(false)
            setLoading(false)
            return
          }
          
          const profileData = await profileRes.json()
          const profile = profileData.user
          console.log('Discord Share: Full profile response:', profileData)
          console.log('Discord Share: User profile object:', profile)
          console.log('Discord Share: User role from profile:', profile?.role)
          console.log('Discord Share: User handle from profile:', profile?.twitterHandle)
          
          // Check access based on role
          const allowedRoles = ['admin', 'core', 'viewer']
          const userRole = profile?.role || 'user'  // Default to 'user' if no role
          
          // Use session username for admin check
          // IMPORTANT: Use twitterHandle from session which is the actual Twitter username
          const sessionHandle = (session as any).twitterHandle || session.user.name || ''
          const profileHandle = profile?.twitterHandle || ''
          const handle = profileHandle || sessionHandle
          
          console.log('Discord Share: Access check - session.user.name:', session.user.name)
          console.log('Discord Share: Access check - session.twitterHandle:', (session as any).twitterHandle)
          console.log('Discord Share: Access check - profile handle:', profileHandle)
          console.log('Discord Share: Access check - final handle:', handle)
          console.log('Discord Share: Access check - role:', userRole)
          console.log('Discord Share: Access check - allowed roles:', allowedRoles)
          
          // Check for admin access through any method
          // Try both the profile handle and session handle
          const hasAdminByProfile = hasAdminAccess(profileHandle, userRole)
          const hasAdminBySession = hasAdminAccess(sessionHandle, userRole)
          const hasAdmin = hasAdminByProfile || hasAdminBySession
          
          console.log('Discord Share: hasAdminAccess by profile handle:', hasAdminByProfile)
          console.log('Discord Share: hasAdminAccess by session handle:', hasAdminBySession)
          console.log('Discord Share: hasAdminAccess final result:', hasAdmin)
          
          if (hasAdmin) {
            console.log('Discord Share: Admin access detected for:', handle)
            logAdminAccess(handle, 'discord_share_access', { 
              method: 'admin_check',
              projectId: projectId,
              page: 'discord_share',
              sessionHandle,
              profileHandle
            })
            // Continue with access granted
          } else if (!allowedRoles.includes(userRole)) {
            console.log('Discord Share: Access denied. User role:', userRole)
            console.log('Discord Share: Not in allowed roles:', allowedRoles)
            setError(`Access denied. You need appropriate permissions to view Discord analytics.\n\nYour current role: ${userRole}\nRequired roles: ${allowedRoles.join(', ')}\n\nPlease contact an administrator to request access.`)
            setCheckingAccess(false)
            setLoading(false)
            return
          }
          
          console.log('Discord Share: Access granted. Role:', userRole)
          setCheckingAccess(false)
          
          // Fetch project data
          const projectRes = await fetch(`/api/discord/projects/${encodeURIComponent(projectId)}`, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            }
          })
          
          console.log('Discord Share: Project fetch status:', projectRes.status)
          
          if (!projectRes.ok) {
            const errorText = await projectRes.text()
            console.error('Discord Share: Project fetch error:', errorText)
            
            if (projectRes.status === 404) {
              setError('Discord project not found')
            } else if (projectRes.status === 403) {
              setError('Access denied to project data. Please ensure you are properly authenticated.')
            } else if (projectRes.status === 401) {
              // Session might have expired, redirect to login
              console.log('Discord Share: Session expired, redirecting to login')
              window.location.href = `/api/auth/signin?callbackUrl=${encodeURIComponent(window.location.href)}`
              return
            } else {
              setError(`Failed to load Discord project (${projectRes.status})`)
            }
            setLoading(false)
            return
          }
          
          const projectData = await projectRes.json()
          setProject(projectData)
          console.log('Discord Share: Project loaded:', projectData.name)
          
          // Fetch Scout project if linked
          if (projectData.scoutProjectId) {
            try {
              const scoutRes = await fetch(`/api/projects/${projectData.scoutProjectId}`, {
                credentials: 'include',
                headers: {
                  'Content-Type': 'application/json',
                }
              })
              if (scoutRes.ok) {
                const scoutData = await scoutRes.json()
                setScoutProject(scoutData)
              }
            } catch (error) {
              console.log('Could not fetch Scout project data')
            }
          }
          
          // Fetch analytics
          const analyticsRes = await fetch(`/api/discord/projects/${encodeURIComponent(projectId)}/analytics?timeframe=${timeframe}`, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            }
          })
          
          if (!analyticsRes.ok) {
            console.error('Discord Share: Failed to fetch analytics:', analyticsRes.status)
            if (analyticsRes.status === 403) {
              setError('Access denied to analytics data.')
            }
          } else {
            const analyticsData = await analyticsRes.json()
            console.log('Discord Share: Analytics loaded')
            setAnalytics(analyticsData.analytics || analyticsData)
          }
          
          setLoading(false)
          
        } catch (err) {
          console.error('Discord Share: Error during access check:', err)
          setError('Error checking access permissions')
          setCheckingAccess(false)
          setLoading(false)
        }
      }
    }
    
    checkAccessAndFetchData()
  }, [session, status, projectId, timeframe])

  // Show loading while checking session or access
  if (status === 'loading' || checkingAccess) {
    console.log('Discord Share: RENDERING - Loading/Checking access screen')
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-green-300">Checking access...</p>
        </div>
      </div>
    )
  }

  // Show loading screen for unauthenticated users (they will be redirected)
  if (status === 'unauthenticated') {
    console.log('Discord Share: RENDERING - Unauthenticated screen')
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-green-300">Redirecting to sign in...</p>
        </div>
      </div>
    )
  }
  
  // Show error state
  if (error) {
    console.log('Discord Share: RENDERING - Error screen:', error)
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-neutral-900 border border-red-900 rounded-lg p-8 max-w-md w-full">
          <div className="flex items-center justify-center w-16 h-16 bg-red-900/20 rounded-full mx-auto mb-6">
            <AlertCircle className="w-8 h-8 text-red-400" />
          </div>
          
          <h1 className="text-2xl font-bold text-red-400 mb-4 text-center">Access Denied</h1>
          
          <div className="text-gray-300 text-center space-y-4">
            <p>You don't have permission to view Discord analytics.</p>
            
            <div className="bg-black/50 rounded-lg p-4 text-sm">
              <p className="text-gray-400 mb-2">Your current role:</p>
              <p className="text-white font-medium">{error.includes('Your current role:') ? error.split('Your current role:')[1].split('\n')[0].trim() : 'Not assigned'}</p>
            </div>
            
            <div className="bg-black/50 rounded-lg p-4 text-sm">
              <p className="text-gray-400 mb-2">Required roles:</p>
              <div className="flex gap-2 justify-center flex-wrap">
                <span className="px-3 py-1 bg-green-900/20 border border-green-900 rounded-full text-green-400">admin</span>
                <span className="px-3 py-1 bg-blue-900/20 border border-blue-900 rounded-full text-blue-400">core</span>
                <span className="px-3 py-1 bg-purple-900/20 border border-purple-900 rounded-full text-purple-400">viewer</span>
              </div>
            </div>
            
            <p className="text-sm text-gray-400 pt-2">
              Please contact an administrator to request access to Discord analytics.
            </p>
          </div>
          
          <div className="mt-8 space-y-3">
            <button
              onClick={() => window.location.href = '/'}
              className="w-full px-4 py-3 bg-green-900 text-green-100 rounded-lg hover:bg-green-800 transition-colors font-medium"
            >
              Go to Dashboard
            </button>
            
            <button
              onClick={() => {
                // Sign out and sign in again
                window.location.href = '/api/auth/signout?callbackUrl=' + encodeURIComponent('/api/auth/signin')
              }}
              className="w-full px-4 py-3 border border-gray-700 text-gray-300 rounded-lg hover:bg-gray-900 transition-colors"
            >
              Sign Out & Try Another Account
            </button>
          </div>
          
          {/* Show authenticated user info */}
          {session && (
            <div className="mt-6 pt-6 border-t border-gray-800">
              <p className="text-xs text-gray-500 text-center">
                Signed in as: {session.user?.name || session.user?.email}
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }
  
  // Show loading state while fetching data
  if (loading) {
    console.log('Discord Share: RENDERING - Loading analytics screen')
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-green-300">Loading analytics...</div>
      </div>
    )
  }

  if (!project) {
    console.log('Discord Share: RENDERING - No project found screen')
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-red-400">Discord project not found</div>
      </div>
    )
  }

  console.log('Discord Share: RENDERING - Main analytics view')
  console.log('Discord Share: Project:', project)
  console.log('Discord Share: Analytics:', analytics)

  // Chart configurations
  const sentimentChartData = {
    labels: ['Positive', 'Neutral', 'Negative'],
    datasets: [{
      data: [
        analytics?.metrics?.sentimentBreakdown?.positive || 0,
        analytics?.metrics?.sentimentBreakdown?.neutral || 0,
        analytics?.metrics?.sentimentBreakdown?.negative || 0
      ],
      backgroundColor: ['#10b981', '#6b7280', '#ef4444'],
      borderWidth: 0
    }]
  }

  const activityChartData = {
    labels: analytics?.metrics?.dailyTrend?.map(d => new Date(d.date).toLocaleDateString()) || [],
    datasets: [{
      label: 'Messages',
      data: analytics?.metrics?.dailyTrend?.map(d => d.messages) || [],
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: true
    }]
  }

  const channelChartData = {
    labels: analytics?.metrics?.channelActivity?.map(c => c.channelName) || [],
    datasets: [{
      label: 'Messages',
      data: analytics?.metrics?.channelActivity?.map(c => c.messageCount) || [],
      backgroundColor: '#10b981'
    }]
  }

  const timeframeLabel = timeframe === 'daily' ? 'Last 24 Hours' : 
                        timeframe === 'weekly' ? 'Last 7 Days' : 
                        timeframe === 'monthly' ? 'Last 30 Days' :
                        timeframe === 'allTime' ? 'All Time' : 'Last 7 Days'

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto px-4 sm:px-6 py-6">
        {/* Viewer Info Bar - Only show if authenticated */}
        {session && (
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-4 border-b border-gray-800">
            <div className="flex items-center gap-3">
              {scoutProject?.profileImageUrl && (
                <Image
                  src={scoutProject.profileImageUrl}
                  alt={scoutProject.twitterHandle}
                  width={48}
                  height={48}
                  className="rounded-full"
                />
              )}
              <div>
                <h3 className="text-lg font-semibold text-white">
                  {scoutProject?.twitterHandle || project.name}
                </h3>
                <p className="text-sm text-gray-400">{project.serverName}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500">Viewing as:</span>
              {session?.user?.image && (
                <Image
                  src={session.user.image}
                  alt={session.user.name || 'User'}
                  width={32}
                  height={32}
                  className="rounded-full"
                />
              )}
              <span className="text-sm text-gray-400">
                {(session as any)?.twitterHandle || session?.user?.name}
              </span>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-green-400 mb-2">Discord Analytics Report</h1>
          <p className="text-gray-400 text-sm sm:text-base">{project.name} • {timeframeLabel}</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6">
            <div className="flex items-center gap-3 text-blue-400 mb-2">
              <MessageSquare className="w-5 h-5" />
              <span className="text-sm">Total Messages</span>
            </div>
            <p className="text-3xl font-bold text-white">{analytics?.metrics?.totalMessages?.toLocaleString() || 0}</p>
          </div>
          
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6">
            <div className="flex items-center gap-3 text-green-400 mb-2">
              <Users className="w-5 h-5" />
              <span className="text-sm">Active Users</span>
            </div>
            <p className="text-3xl font-bold text-white">{analytics?.metrics?.uniqueUsers?.toLocaleString() || 0}</p>
          </div>
          
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6">
            <div className="flex items-center gap-3 text-purple-400 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm">Avg Messages/User</span>
            </div>
            <p className="text-3xl font-bold text-white">{analytics?.metrics?.averageMessagesPerUser?.toFixed(1) || 0}</p>
          </div>
          
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6">
            <div className="flex items-center gap-3 text-orange-400 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm">Sentiment Score</span>
            </div>
            <p className="text-3xl font-bold text-white">
              {analytics?.metrics?.sentimentBreakdown && analytics?.metrics?.totalMessages ? (
                ((analytics.metrics.sentimentBreakdown.positive - analytics.metrics.sentimentBreakdown.negative) / 
                 analytics.metrics.totalMessages * 100).toFixed(1)
              ) : 0}%
            </p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-8 mb-8">
          {/* Activity Trend */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6">
            <h3 className="text-lg text-green-400 mb-4">Activity Trend</h3>
            <div className="h-64">
              {analytics && (
                <Line
                  data={activityChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(107, 114, 128, 0.2)' },
                        ticks: { color: '#9ca3af' }
                      },
                      x: {
                        grid: { color: 'rgba(107, 114, 128, 0.2)' },
                        ticks: { color: '#9ca3af' }
                      }
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* Sentiment Distribution */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6">
            <h3 className="text-lg text-green-400 mb-4">Sentiment Distribution</h3>
            <div className="h-64">
              {analytics && (
                <Doughnut
                  data={sentimentChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: {
                        position: 'bottom',
                        labels: { color: '#9ca3af' }
                      }
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* Channel Activity */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6">
            <h3 className="text-lg text-green-400 mb-4">Channel Activity</h3>
            <div className="h-64">
              {analytics && (
                <Bar
                  data={channelChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                      legend: { display: false }
                    },
                    scales: {
                      y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(107, 114, 128, 0.2)' },
                        ticks: { color: '#9ca3af' }
                      },
                      x: {
                        grid: { color: 'rgba(107, 114, 128, 0.2)' },
                        ticks: { color: '#9ca3af' }
                      }
                    }
                  }}
                />
              )}
            </div>
          </div>

          {/* Top Contributors */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 sm:p-6">
            <h3 className="text-lg text-green-400 mb-4">Top Contributors</h3>
            <div className="space-y-3">
              {analytics?.metrics?.topUsers?.slice(0, 10).map((user, index) => {
                const sentimentColor = user.avgSentiment > 0.3 ? 'text-green-400' : 
                                     user.avgSentiment < -0.3 ? 'text-red-400' : 'text-gray-400'
                return (
                  <div key={user.userId} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-500 w-6">{index + 1}.</span>
                      <span>{user.username}</span>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-400">{user.messageCount} msgs</span>
                      <span className={`text-sm ${sentimentColor}`}>
                        {user.avgSentiment > 0 ? '+' : ''}{(user.avgSentiment * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm mt-12">
          <p>Generated by KOL Platform • Discord Analytics</p>
        </div>
      </div>
    </div>
  )
}

export default function DiscordSharePage() {
  return (
    <ErrorBoundary>
      <DiscordSharePageContent />
    </ErrorBoundary>
  )
} 