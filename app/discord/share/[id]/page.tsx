'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'
import { MessageSquare, Users, TrendingUp, AlertCircle } from 'lucide-react'
import { Line, Doughnut, Bar } from 'react-chartjs-2'
import Image from 'next/image'
import { format, parseISO, startOfDay, endOfDay, subDays } from 'date-fns'
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

// This page requires authentication and proper role
export default function DiscordSharePage() {
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
  
  console.log('Discord Share: Raw ID:', rawId)
  console.log('Discord Share: Parsed project ID:', projectId)
  console.log('Discord Share: Session status:', status)
  console.log('Discord Share: Session data:', session)

  // Check authentication and access in one effect
  useEffect(() => {
    const checkAccessAndFetchData = async () => {
      // Skip if we're still checking access
      if (checkingAccess && status === 'loading') {
        console.log('Discord Share: Waiting for session status...')
        return
      }
      
      // If not authenticated and we've finished checking, show login screen
      if (status === 'unauthenticated') {
        console.log('Discord Share: User not authenticated')
        setCheckingAccess(false)
        setLoading(false)
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
        
        try {
          // Get user profile to check role
          const profileRes = await fetch(`/api/user/profile?handle=${session.user.name}`, {
            credentials: 'include',
            headers: {
              'Content-Type': 'application/json',
            },
            cache: 'no-store'
          })
          
          if (!profileRes.ok) {
            console.error('Discord Share: Failed to fetch profile:', profileRes.status)
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
          console.log('Discord Share: User profile:', profile)
          
          // Check access based on role
          const allowedRoles = ['admin', 'core', 'viewer']
          const userRole = profile.role || 'user'
          const handle = (profile.twitterHandle || session.user.name || '').toLowerCase().replace('@', '')
          
          // Special handling for hardcoded admins
          if (handle === 'alinabu' || handle === 'sharafi_eth') {
            console.log('Discord Share: Hardcoded admin detected:', handle)
            // Continue with access granted
          } else if (!allowedRoles.includes(userRole)) {
            console.log('Discord Share: Access denied. User role:', userRole)
            setError(`Access denied. You need appropriate permissions to view Discord analytics.\n\nYour current role: ${userRole}\nRequired roles: ${allowedRoles.join(', ')}`)
            setCheckingAccess(false)
            setLoading(false)
            return
          }
          
          console.log('Discord Share: Access granted. Role:', userRole || 'admin (hardcoded)')
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
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-green-300">Checking access...</p>
        </div>
      </div>
    )
  }

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
            <span className="text-4xl text-green-300">💬</span>
          </div>
          <h1 className="text-2xl font-bold text-green-300 mb-4">Discord Analytics Access</h1>
          <p className="text-green-400 mb-6">Please sign in to view Discord analytics</p>
          
          <button
            onClick={() => {
              console.log('Discord Share: Initiating sign in...')
              signIn('twitter', {
                callbackUrl: window.location.href
              })
            }}
            className="w-full px-6 py-3 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z"/>
            </svg>
            Sign in with X
          </button>
          
          <div className="mt-4 text-xs text-gray-500">
            <p>Having trouble? Try:</p>
            <ul className="mt-2 space-y-1 text-left">
              <li>• Clear your browser cookies</li>
              <li>• Use a different browser</li>
              <li>• Disable ad blockers</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }
  
  // Show error state
  if (error) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="bg-black border border-red-500 rounded-lg p-8 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-red-400 mb-4">Access Error</h1>
          <p className="text-red-300 whitespace-pre-wrap">{error}</p>
          
          <div className="mt-6 space-y-3">
            <button
              onClick={() => window.location.href = '/'}
              className="w-full px-4 py-2 border border-green-500 text-green-300 rounded hover:bg-green-900/30"
            >
              Go to Dashboard
            </button>
            
            <button
              onClick={() => {
                // Sign out and sign in again
                window.location.href = '/api/auth/signout?callbackUrl=' + encodeURIComponent('/api/auth/signin')
              }}
              className="w-full px-4 py-2 border border-gray-500 text-gray-300 rounded hover:bg-gray-900/30"
            >
              Sign Out & Try Again
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  // Show loading state while fetching data
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-green-300">Loading analytics...</div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-red-400">Discord project not found</div>
      </div>
    )
  }

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