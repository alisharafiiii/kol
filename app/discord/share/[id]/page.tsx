'use client'

import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { MessageSquare, Users, TrendingUp, AlertCircle } from 'lucide-react'
import { Line, Doughnut, Bar } from 'react-chartjs-2'
import Image from 'next/image'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
  Filler
} from 'chart.js'

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  BarElement,
  Filler
)

interface DiscordProject {
  id: string
  name: string
  serverId: string
  serverName: string
  trackedChannels: string[]
}

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
  const id = decodeURIComponent(params.id as string)
  const searchParams = useSearchParams()
  const router = useRouter()
  const { data: session, status } = useSession()
  const timeframe = searchParams.get('timeframe') || 'weekly'
  
  const [project, setProject] = useState<DiscordProject | null>(null)
  const [analytics, setAnalytics] = useState<DiscordAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [scoutProject, setScoutProject] = useState<any>(null)
  const [roleError, setRoleError] = useState(false)

  // Check authentication and role
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/api/auth/signin?callbackUrl=' + encodeURIComponent(window.location.href))
    } else if (status === 'authenticated' && session) {
      // Check user role
      const userRole = (session as any)?.role || (session.user as any)?.role
      const allowedRoles = ['admin', 'core', 'team', 'viewer']
      
      if (!allowedRoles.includes(userRole)) {
        setRoleError(true)
        setLoading(false)
      }
    }
  }, [status, session, router])

  useEffect(() => {
    if (id && status === 'authenticated' && !roleError) {
      fetchData()
    }
  }, [id, timeframe, status, roleError])

  const fetchData = async () => {
    try {
      // Fetch project data from public API
      const projectRes = await fetch(`/api/public/discord/${id}`)
      if (!projectRes.ok) {
        throw new Error('Project not found')
      }
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

      // Fetch analytics from public API
      const analyticsRes = await fetch(`/api/public/discord/${id}/analytics?timeframe=${timeframe}`)
      if (analyticsRes.ok) {
        const analyticsData = await analyticsRes.json()
        setAnalytics(analyticsData)
      }
    } catch (error) {
      console.error('Error fetching data:', error)
      setError(error instanceof Error ? error.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
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

  if (loading || status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading analytics...</p>
        </div>
      </div>
    )
  }

  if (roleError) {
    return (
      <div className="container mx-auto p-6 min-h-screen bg-black">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-red-400 mb-4" />
          <h1 className="text-2xl font-bold text-red-400 mb-2">Access Denied</h1>
          <p className="text-gray-400">You don't have permission to view Discord analytics.</p>
          <p className="text-sm text-gray-500 mt-2">Only admin, core, team, and viewer roles can access this page.</p>
        </div>
      </div>
    )
  }

  if (error || !project) {
    return (
      <div className="container mx-auto p-6 min-h-screen bg-black">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-red-400 mb-4" />
          <p className="text-red-400">{error || 'Project not found'}</p>
        </div>
      </div>
    )
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