'use client'

import { useState, useEffect } from 'react'
import { Trophy, Users, Twitter, RefreshCw, Activity, TrendingUp, Clock, Award } from 'lucide-react'

interface Tweet {
  id: string
  tweetId: string
  submitterDiscordId: string
  submittedAt: string
  category?: string
  url: string
  authorHandle: string
  metrics?: {
    likes: number
    retweets: number
    replies: number
  }
}

interface LeaderboardEntry {
  discordId: string
  twitterHandle: string
  tier: number
  totalPoints: number
  weeklyPoints: number
  rank: number
}

interface EngagementStats {
  totalTweets: number
  activeUsers: number
  totalPoints: number
  todayEngagements: number
  weeklyGrowth: number
  topCategory: string
}

interface BatchJob {
  id: string
  startedAt: string
  completedAt?: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  tweetsProcessed: number
  engagementsFound: number
}

interface DiscordEngagementDashboardProps {
  compact?: boolean
  showActions?: boolean
  className?: string
}

export default function DiscordEngagementDashboard({ 
  compact = false, 
  showActions = true,
  className = "" 
}: DiscordEngagementDashboardProps) {
  const [stats, setStats] = useState<EngagementStats>({
    totalTweets: 0,
    activeUsers: 0,
    totalPoints: 0,
    todayEngagements: 0,
    weeklyGrowth: 0,
    topCategory: 'General'
  })
  const [recentTweets, setRecentTweets] = useState<Tweet[]>([])
  const [topUsers, setTopUsers] = useState<LeaderboardEntry[]>([])
  const [latestJob, setLatestJob] = useState<BatchJob | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  // [ENGAGEMENT DASHBOARD STATE PERSISTENCE]
  const [lastFetchTime, setLastFetchTime] = useState<number>(0)
  const [isStale, setIsStale] = useState(false)

  useEffect(() => {
    fetchDashboardData()
    
    // [ENGAGEMENT REAL-TIME REFRESH] - Auto-refresh every 15 seconds for recent activity
    const refreshInterval = setInterval(() => {
      if (document.visibilityState === 'visible' && !compact) {
        fetchDashboardData(true) // Silent refresh
      } else {
        setIsStale(true)
      }
    }, 15000)
    
    return () => clearInterval(refreshInterval)
  }, [compact])
  
  // [ENGAGEMENT TAB FOCUS HANDLER] - Refresh when returning to tab
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isStale) {
        // Only refresh if data is older than 15 seconds
        if (Date.now() - lastFetchTime > 15000) {
          fetchDashboardData(true)
        }
        setIsStale(false)
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isStale, lastFetchTime])

  const fetchDashboardData = async (silent = false) => {
    // [ENGAGEMENT REAL-TIME FETCH] - Track fetch time and prevent loading spinner on silent refresh
    if (!silent) setLoading(true)
    setLastFetchTime(Date.now())
    
    try {
      // Fetch stats with cache busting for real-time data
      const [tweetsRes, leaderboardRes, jobsRes] = await Promise.all([
        fetch('/api/engagement/tweets?limit=5', { cache: 'no-store' }),
        fetch('/api/engagement/leaderboard?limit=5', { cache: 'no-store' }),
        fetch('/api/engagement/batch?limit=1', { cache: 'no-store' })
      ])

      if (tweetsRes.ok) {
        const data = await tweetsRes.json()
        setRecentTweets(data.tweets || [])
        
        // Calculate stats from data
        const tweets = data.tweets || []
        const uniqueUsers = new Set(tweets.map((t: Tweet) => t.submitterDiscordId))
        
        setStats(prev => ({
          ...prev,
          totalTweets: data.total || tweets.length,
          activeUsers: uniqueUsers.size
        }))
      }

      if (leaderboardRes.ok) {
        const data = await leaderboardRes.json()
        setTopUsers(data.leaderboard || [])
        
        // Calculate total points
        const totalPoints = (data.leaderboard || []).reduce(
          (sum: number, user: LeaderboardEntry) => sum + user.totalPoints, 
          0
        )
        
        setStats(prev => ({
          ...prev,
          totalPoints,
          activeUsers: data.leaderboard?.length || 0
        }))
      }

      if (jobsRes.ok) {
        const data = await jobsRes.json()
        setLatestJob(data.jobs?.[0] || null)
      }

    } catch (error) {
      console.error('Error fetching dashboard data:', error)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const runBatchJob = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/engagement/batch', {
        method: 'POST'
      })
      
      if (res.ok) {
        setTimeout(() => fetchDashboardData(), 2000)
      }
    } catch (error) {
      console.error('Error creating batch job:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const formatTimeAgo = (date: string) => {
    const seconds = Math.floor((new Date().getTime() - new Date(date).getTime()) / 1000)
    
    if (seconds < 60) return `${seconds}s ago`
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
    return `${Math.floor(seconds / 86400)}d ago`
  }

  if (loading) {
    return (
      <div className={`bg-gray-900 border border-gray-700 rounded-lg p-6 ${className}`}>
        <div className="animate-pulse">
          <div className="h-6 bg-gray-700 rounded w-1/3 mb-4"></div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-gray-800 rounded p-4 h-20"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`bg-gray-900 border border-gray-700 rounded-lg p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-green-300">Discord Engagement</h2>
          <p className="text-sm text-gray-400 mt-1">
            Twitter engagement tracking for Discord users
            {/* [ENGAGEMENT LAST UPDATE INDICATOR] */}
            {lastFetchTime > 0 && (
              <span className="ml-2 text-xs text-gray-500">
                • Updated {formatTimeAgo(new Date(lastFetchTime).toISOString())}
              </span>
            )}
          </p>
        </div>
        
        {showActions && !compact && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchDashboardData()}
              className="p-2 text-gray-400 hover:text-green-300 transition-colors"
              title="Refresh data"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={runBatchJob}
              disabled={refreshing}
              className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 disabled:opacity-50 flex items-center gap-2 text-sm"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              Process Engagements
            </button>
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-black/50 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-blue-400 mb-2">
            <Twitter className="w-4 h-4" />
            <span className="text-xs uppercase">Tweets</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalTweets}</p>
          <p className="text-xs text-gray-500 mt-1">Submitted tweets</p>
        </div>

        <div className="bg-black/50 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-green-400 mb-2">
            <Users className="w-4 h-4" />
            <span className="text-xs uppercase">Active Users</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.activeUsers}</p>
          <p className="text-xs text-gray-500 mt-1">Connected accounts</p>
        </div>

        <div className="bg-black/50 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-purple-400 mb-2">
            <Trophy className="w-4 h-4" />
            <span className="text-xs uppercase">Total Points</span>
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalPoints.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">Points awarded</p>
        </div>

        <div className="bg-black/50 border border-gray-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-orange-400 mb-2">
            <Activity className="w-4 h-4" />
            <span className="text-xs uppercase">Last Batch</span>
          </div>
          <p className="text-sm font-medium text-white">
            {latestJob ? formatTimeAgo(latestJob.startedAt) : 'Never'}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            {latestJob?.status || 'No jobs'}
          </p>
        </div>
      </div>

      {!compact && (
        <>
          {/* Top Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Leaderboard */}
            <div className="bg-black/50 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-green-300 flex items-center gap-2">
                  <Award className="w-4 h-4" />
                  Top Performers
                </h3>
                <a 
                  href="/admin/engagement" 
                  className="text-xs text-gray-400 hover:text-green-300"
                >
                  View all →
                </a>
              </div>
              
              <div className="space-y-2">
                {topUsers.map((user, index) => (
                  <div key={user.discordId} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                    <div className="flex items-center gap-3">
                      <span className={`text-lg font-bold ${
                        index === 0 ? 'text-yellow-400' :
                        index === 1 ? 'text-gray-300' :
                        index === 2 ? 'text-orange-400' :
                        'text-gray-500'
                      }`}>
                        #{user.rank}
                      </span>
                      <div>
                        <p className="text-sm text-white">{user.twitterHandle}</p>
                        <p className="text-xs text-gray-500">Tier {user.tier}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-300">{user.totalPoints}</p>
                      <p className="text-xs text-gray-500">points</p>
                    </div>
                  </div>
                ))}
                
                {topUsers.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No users yet</p>
                )}
              </div>
            </div>

            {/* Recent Activity */}
            <div className="bg-black/50 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-green-300 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Recent Tweets
                </h3>
                <a 
                  href="/admin/engagement" 
                  className="text-xs text-gray-400 hover:text-green-300"
                >
                  View all →
                </a>
              </div>
              
              <div className="space-y-2">
                {recentTweets.map(tweet => (
                  <div key={tweet.id} className="flex items-center justify-between py-2 border-b border-gray-800 last:border-0">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">@{tweet.authorHandle}</p>
                      <p className="text-xs text-gray-500">
                        {tweet.category || 'General'} • {formatTimeAgo(tweet.submittedAt)}
                      </p>
                    </div>
                    <a
                      href={tweet.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 text-xs text-blue-400 hover:text-blue-300"
                    >
                      View →
                    </a>
                  </div>
                ))}
                
                {recentTweets.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No tweets submitted yet</p>
                )}
              </div>
            </div>
          </div>

          {/* Batch Processing Status */}
          {latestJob && (
            <div className="mt-6 bg-black/50 border border-gray-800 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${
                    latestJob.status === 'completed' ? 'bg-green-400' :
                    latestJob.status === 'running' ? 'bg-yellow-400 animate-pulse' :
                    latestJob.status === 'failed' ? 'bg-red-400' :
                    'bg-gray-400'
                  }`} />
                  <div>
                    <p className="text-sm text-white">
                      Batch Job: {latestJob.status}
                    </p>
                    <p className="text-xs text-gray-500">
                      {latestJob.tweetsProcessed} tweets processed, {latestJob.engagementsFound} engagements found
                    </p>
                  </div>
                </div>
                <p className="text-xs text-gray-400">
                  Started {formatTimeAgo(latestJob.startedAt)}
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
} 