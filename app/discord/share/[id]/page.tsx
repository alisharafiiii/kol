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
  const { data: session, status } = useSession()
  const [project, setProject] = useState<DiscordProject | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [hasAccess, setHasAccess] = useState(false)
  const [analytics, setAnalytics] = useState<DiscordAnalytics | null>(null)
  const [scoutProject, setScoutProject] = useState<any>(null)
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

  // Check user access
  useEffect(() => {
    const checkAccess = async () => {
      if (status === 'loading') return
      
      console.log('Discord Share: Auth status:', status)
      
      if (status === 'unauthenticated') {
        setLoading(false)
        return
      }
      
      if (!session?.user?.name) {
        setError('Please sign in to view this page')
        setLoading(false)
        return
      }
      
      try {
        // Get user profile to check role (same as brief page)
        const profileRes = await fetch(`/api/user/profile?handle=${session.user.name}`)
        if (profileRes.ok) {
          const profileData = await profileRes.json()
          const profile = profileData.user
          
          console.log('Discord Share: Profile data:', profile)
          
          // Check if user has appropriate role
          const allowedRoles = ['admin', 'core', 'team', 'viewer']
          if (profile.role && allowedRoles.includes(profile.role)) {
            console.log('Access granted: User role:', profile.role)
            setHasAccess(true)
          } else {
            // Hardcoded check for alinabu and sharafi_eth
            const handle = session.user.name?.toLowerCase()
            if (handle === 'alinabu' || handle === 'sharafi_eth') {
              console.log('Access granted: Hardcoded admin -', handle)
              setHasAccess(true)
            } else {
              console.log('Access denied: User role:', profile.role)
              setError('Access denied. You need appropriate permissions to view Discord analytics.')
              setLoading(false)
            }
          }
        } else {
          // If profile API fails, check hardcoded admins
          const handle = session.user.name?.toLowerCase()
          if (handle === 'alinabu' || handle === 'sharafi_eth') {
            console.log('Access granted: Hardcoded admin (API failed) -', handle)
            setHasAccess(true)
          } else {
            setError('Profile not found. Please contact an administrator.')
            setLoading(false)
          }
        }
      } catch (err) {
        console.error('Error checking access:', err)
        // On error, still check hardcoded admins
        const handle = session.user.name?.toLowerCase()
        if (handle === 'alinabu' || handle === 'sharafi_eth') {
          console.log('Access granted: Hardcoded admin (error occurred) -', handle)
          setHasAccess(true)
        } else {
          setError('Error checking access permissions')
          setLoading(false)
        }
      }
    }
    
    checkAccess()
  }, [session, status])

  // Fetch project data and analytics
  useEffect(() => {
    const fetchData = async () => {
      if (!hasAccess || !projectId) return
      
      try {
        // Fetch project data
        const projectRes = await fetch(`/api/discord/projects/${encodeURIComponent(projectId)}`)
        if (!projectRes.ok) {
          if (projectRes.status === 404) {
            setError('Discord project not found')
          } else {
            setError('Failed to load Discord project')
          }
          setLoading(false)
          return
        } else {
          const projectData = await projectRes.json()
          setProject(projectData)
          
          // Fetch Scout project if linked
          if (projectData.scoutProjectId) {
            try {
              const scoutRes = await fetch(`/api/projects/${projectData.scoutProjectId}`)
              if (scoutRes.ok) {
                const scoutData = await scoutRes.json()
                setScoutProject(scoutData)
              }
            } catch (error) {
              console.log('Could not fetch Scout project data')
            }
          }
          
          // Fetch analytics
          const analyticsRes = await fetch(`/api/discord/projects/${encodeURIComponent(projectId)}/analytics?timeframe=${timeframe}`)
          if (analyticsRes.ok) {
            const analyticsData = await analyticsRes.json()
            setAnalytics(analyticsData)
          }
        }
      } catch (err) {
        console.error('Error fetching data:', err)
        setError('Error loading Discord project')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [projectId, hasAccess, timeframe])

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
            onClick={() => signIn('twitter')}
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
  
  // Show loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-green-300">Loading...</div>
      </div>
    )
  }
  
  // Show error state
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
        </div>
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
        analytics?.metrics.sentimentBreakdown.positive || 0,
        analytics?.metrics.sentimentBreakdown.neutral || 0,
        analytics?.metrics.sentimentBreakdown.negative || 0
      ],
      backgroundColor: ['#10b981', '#6b7280', '#ef4444'],
      borderWidth: 0
    }]
  }

  const activityChartData = {
    labels: analytics?.metrics.dailyTrend.map(d => new Date(d.date).toLocaleDateString()) || [],
    datasets: [{
      label: 'Messages',
      data: analytics?.metrics.dailyTrend.map(d => d.messages) || [],
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: true
    }]
  }

  const channelChartData = {
    labels: analytics?.metrics.channelActivity.map(c => c.channelName) || [],
    datasets: [{
      label: 'Messages',
      data: analytics?.metrics.channelActivity.map(c => c.messageCount) || [],
      backgroundColor: '#10b981'
    }]
  }

  const timeframeLabel = timeframe === 'daily' ? 'Last 24 Hours' : 
                        timeframe === 'weekly' ? 'Last 7 Days' : 'Last 30 Days'

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="container mx-auto p-6">
        {/* Viewer Info Bar - Only show if authenticated */}
        {session && (
          <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-800">
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
          <h1 className="text-3xl font-bold text-green-400 mb-2">Discord Analytics Report</h1>
          <p className="text-gray-400">{project.name} • {timeframeLabel}</p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-3 text-blue-400 mb-2">
              <MessageSquare className="w-5 h-5" />
              <span className="text-sm">Total Messages</span>
            </div>
            <p className="text-3xl font-bold text-white">{analytics?.metrics.totalMessages.toLocaleString() || 0}</p>
          </div>
          
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-3 text-green-400 mb-2">
              <Users className="w-5 h-5" />
              <span className="text-sm">Active Users</span>
            </div>
            <p className="text-3xl font-bold text-white">{analytics?.metrics.uniqueUsers.toLocaleString() || 0}</p>
          </div>
          
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-3 text-purple-400 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm">Avg Messages/User</span>
            </div>
            <p className="text-3xl font-bold text-white">{analytics?.metrics.averageMessagesPerUser.toFixed(1) || 0}</p>
          </div>
          
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <div className="flex items-center gap-3 text-orange-400 mb-2">
              <TrendingUp className="w-5 h-5" />
              <span className="text-sm">Sentiment Score</span>
            </div>
            <p className="text-3xl font-bold text-white">
              {analytics ? (
                ((analytics.metrics.sentimentBreakdown.positive - analytics.metrics.sentimentBreakdown.negative) / 
                 analytics.metrics.totalMessages * 100).toFixed(1)
              ) : 0}%
            </p>
          </div>
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Activity Trend */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
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
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
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
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
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
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg text-green-400 mb-4">Top Contributors</h3>
            <div className="space-y-3">
              {analytics?.metrics.topUsers.slice(0, 10).map((user, index) => {
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