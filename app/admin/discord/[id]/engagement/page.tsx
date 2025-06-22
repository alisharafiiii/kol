'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, RefreshCw, Download, TrendingUp, Users, MessageSquare, Heart, Repeat2, Twitter, Clock, Award, Activity } from 'lucide-react'
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import type { DiscordProject } from '@/lib/types/discord'

interface ServerEngagementStats {
  totalTweets: number
  totalLikes: number
  totalRetweets: number
  totalReplies: number
  totalEngagements: number
  activeParticipants: number
  topContributors: Array<{
    discordId: string
    discordUsername: string
    twitterHandle: string
    totalPoints: number
    tweetCount: number
    engagementCount: number
  }>
  recentTweets: Array<{
    id: string
    tweetId: string
    url: string
    authorHandle: string
    submitterDiscordId: string
    submitterUsername: string
    submittedAt: string
    metrics: {
      likes: number
      retweets: number
      replies: number
    }
  }>
  engagementTrend: Array<{
    date: string
    likes: number
    retweets: number
    replies: number
    total: number
  }>
  engagementByType: {
    likes: number
    retweets: number
    replies: number
  }
}

export default function ServerEngagementDetailPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const params = useParams()
  const projectId = params?.id as string
  const [project, setProject] = useState<DiscordProject | null>(null)
  const [stats, setStats] = useState<ServerEngagementStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // [SERVER ENGAGEMENT STATE PERSISTENCE]
  const [lastFetchTime, setLastFetchTime] = useState<number>(0)
  const [isDataStale, setIsDataStale] = useState(false)

  // Check admin access
  useEffect(() => {
    if (status === 'loading') return
    
    const userRole = (session as any)?.role || (session?.user as any)?.role
    if (!['admin', 'core'].includes(userRole)) {
      router.push('/')
    }
  }, [session, status, router])

  // Fetch data
  useEffect(() => {
    if (status === 'authenticated' && projectId) {
      fetchData()
      
      // [SERVER ENGAGEMENT REAL-TIME REFRESH] - Auto-refresh every 20 seconds
      const refreshInterval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchData(true) // Silent refresh
        } else {
          setIsDataStale(true)
        }
      }, 20000)
      
      return () => clearInterval(refreshInterval)
    }
  }, [status, projectId])
  
  // [SERVER ENGAGEMENT TAB FOCUS HANDLER]
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isDataStale) {
        if (Date.now() - lastFetchTime > 20000) {
          fetchData(true)
        }
        setIsDataStale(false)
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isDataStale, lastFetchTime])

  const fetchData = async (silent = false) => {
    // [SERVER ENGAGEMENT REAL-TIME FETCH] - Track fetch time
    if (!silent) setLoading(true)
    setLastFetchTime(Date.now())
    
    try {
      // Fetch project details with cache busting
      const projectRes = await fetch(
        `/api/discord/projects/${projectId.replace(/--/g, ':')}`, 
        { cache: 'no-store' }
      )
      if (projectRes.ok) {
        const projectData = await projectRes.json()
        setProject(projectData)
      }

      // TODO: Fetch actual engagement stats from API
      // For now, using mock data
      const mockStats: ServerEngagementStats = {
        totalTweets: 156,
        totalLikes: 2340,
        totalRetweets: 892,
        totalReplies: 445,
        totalEngagements: 3677,
        activeParticipants: 42,
        topContributors: [
          {
            discordId: '123456789',
            discordUsername: 'CryptoKing#1234',
            twitterHandle: '@cryptoking',
            totalPoints: 1250,
            tweetCount: 23,
            engagementCount: 145
          },
          {
            discordId: '987654321',
            discordUsername: 'DeFiDegen#5678',
            twitterHandle: '@defidegen',
            totalPoints: 980,
            tweetCount: 18,
            engagementCount: 112
          }
        ],
        recentTweets: [
          {
            id: '1',
            tweetId: '1234567890',
            url: 'https://twitter.com/user/status/1234567890',
            authorHandle: '@cryptoking',
            submitterDiscordId: '123456789',
            submitterUsername: 'CryptoKing#1234',
            submittedAt: new Date().toISOString(),
            metrics: {
              likes: 45,
              retweets: 12,
              replies: 8
            }
          }
        ],
        engagementTrend: Array.from({ length: 7 }, (_, i) => ({
          date: new Date(Date.now() - (6 - i) * 24 * 60 * 60 * 1000).toISOString(),
          likes: Math.floor(Math.random() * 500),
          retweets: Math.floor(Math.random() * 200),
          replies: Math.floor(Math.random() * 100),
          total: 0
        })).map(day => ({ ...day, total: day.likes + day.retweets + day.replies })),
        engagementByType: {
          likes: 2340,
          retweets: 892,
          replies: 445
        }
      }
      
      setStats(mockStats)
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const handleRefresh = async () => {
    setRefreshing(true)
    await fetchData()
    setRefreshing(false)
  }

  const downloadPDF = () => {
    // TODO: Implement PDF download
    alert('PDF download will be implemented')
  }

  // Chart configurations
  const engagementTrendData = {
    labels: stats?.engagementTrend.map(d => new Date(d.date).toLocaleDateString()) || [],
    datasets: [
      {
        label: 'Likes',
        data: stats?.engagementTrend.map(d => d.likes) || [],
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        fill: true
      },
      {
        label: 'Retweets',
        data: stats?.engagementTrend.map(d => d.retweets) || [],
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true
      },
      {
        label: 'Replies',
        data: stats?.engagementTrend.map(d => d.replies) || [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true
      }
    ]
  }

  const engagementTypeData = {
    labels: ['Likes', 'Retweets', 'Replies'],
    datasets: [{
      data: [
        stats?.engagementByType.likes || 0,
        stats?.engagementByType.retweets || 0,
        stats?.engagementByType.replies || 0
      ],
      backgroundColor: ['#ef4444', '#10b981', '#3b82f6'],
      borderWidth: 0
    }]
  }

  const contributorChartData = {
    labels: stats?.topContributors.slice(0, 5).map(c => c.discordUsername) || [],
    datasets: [{
      label: 'Points',
      data: stats?.topContributors.slice(0, 5).map(c => c.totalPoints) || [],
      backgroundColor: '#8b5cf6',
      borderColor: '#8b5cf6',
      borderWidth: 1
    }]
  }

  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push('/admin/discord')}
          className="flex items-center gap-2 text-gray-400 hover:text-white mb-4"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Discord Hub
        </button>
        
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-green-400 mb-2">
              {project?.name || 'Server'} - Engagement Analytics
            </h1>
            <p className="text-gray-400">
              {project?.serverName || 'Loading...'}
              {/* [SERVER ENGAGEMENT LAST UPDATE] */}
              {lastFetchTime > 0 && (
                <span className="ml-2 text-xs text-gray-500">
                  • Last updated {new Date(lastFetchTime).toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          
          <div className="flex gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={downloadPDF}
              className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 mb-8">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Twitter className="w-6 h-6 text-blue-400" />
            <span className="text-xl font-bold text-white">{stats?.totalTweets || 0}</span>
          </div>
          <p className="text-sm text-gray-400">Total Tweets</p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Heart className="w-6 h-6 text-red-400" />
            <span className="text-xl font-bold text-white">{stats?.totalLikes || 0}</span>
          </div>
          <p className="text-sm text-gray-400">Likes</p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Repeat2 className="w-6 h-6 text-green-400" />
            <span className="text-xl font-bold text-white">{stats?.totalRetweets || 0}</span>
          </div>
          <p className="text-sm text-gray-400">Retweets</p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <MessageSquare className="w-6 h-6 text-blue-400" />
            <span className="text-xl font-bold text-white">{stats?.totalReplies || 0}</span>
          </div>
          <p className="text-sm text-gray-400">Replies</p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Activity className="w-6 h-6 text-purple-400" />
            <span className="text-xl font-bold text-white">{stats?.totalEngagements || 0}</span>
          </div>
          <p className="text-sm text-gray-400">Total Engagements</p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-6 h-6 text-yellow-400" />
            <span className="text-xl font-bold text-white">{stats?.activeParticipants || 0}</span>
          </div>
          <p className="text-sm text-gray-400">Active Users</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Engagement Trend */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Engagement Trend (7 Days)</h3>
          <Line
            data={engagementTrendData}
            options={{
              responsive: true,
              plugins: {
                legend: { position: 'bottom' as const }
              },
              scales: {
                y: { beginAtZero: true }
              }
            }}
          />
        </div>

        {/* Engagement by Type */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4">Engagement Distribution</h3>
          <div className="flex items-center justify-center">
            <div className="w-64 h-64">
              <Doughnut
                data={engagementTypeData}
                options={{
                  responsive: true,
                  maintainAspectRatio: true,
                  plugins: {
                    legend: { position: 'bottom' as const }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Top Contributors and Recent Tweets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Contributors */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-400" />
            Top Contributors
          </h3>
          <div className="space-y-3">
            {stats?.topContributors.map((contributor, index) => (
              <div key={contributor.discordId} className="flex items-center justify-between p-3 bg-black/50 rounded-lg">
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold ${
                    index === 0 ? 'text-yellow-400' :
                    index === 1 ? 'text-gray-300' :
                    index === 2 ? 'text-orange-400' :
                    'text-gray-500'
                  }`}>
                    #{index + 1}
                  </span>
                  <div>
                    <p className="text-sm font-medium text-white">{contributor.discordUsername}</p>
                    <p className="text-xs text-gray-400">{contributor.twitterHandle}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-green-300">{contributor.totalPoints} pts</p>
                  <p className="text-xs text-gray-500">{contributor.tweetCount} tweets</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Tweets */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-medium text-white mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-400" />
            Recent Tweet Engagements
          </h3>
          <div className="space-y-3">
            {stats?.recentTweets.map((tweet) => (
              <div key={tweet.id} className="p-3 bg-black/50 rounded-lg">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-white">{tweet.authorHandle}</p>
                    <p className="text-xs text-gray-400">by {tweet.submitterUsername}</p>
                  </div>
                  <a
                    href={tweet.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:text-blue-300"
                  >
                    View →
                  </a>
                </div>
                <div className="flex gap-4 text-xs">
                  <span className="flex items-center gap-1 text-red-400">
                    <Heart className="w-3 h-3" />
                    {tweet.metrics.likes}
                  </span>
                  <span className="flex items-center gap-1 text-green-400">
                    <Repeat2 className="w-3 h-3" />
                    {tweet.metrics.retweets}
                  </span>
                  <span className="flex items-center gap-1 text-blue-400">
                    <MessageSquare className="w-3 h-3" />
                    {tweet.metrics.replies}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
} 