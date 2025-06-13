'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Trophy, Users, Twitter, RefreshCw, Settings, Activity } from 'lucide-react'

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

interface PointRule {
  id: string
  tier: number
  interactionType: 'like' | 'retweet' | 'reply'
  points: number
}

interface BatchJob {
  id: string
  startedAt: string
  completedAt?: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  tweetsProcessed: number
  engagementsFound: number
  error?: string
}

export default function EngagementAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  
  const [activeTab, setActiveTab] = useState('overview')
  const [tweets, setTweets] = useState<Tweet[]>([])
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [rules, setRules] = useState<PointRule[]>([])
  const [batchJobs, setBatchJobs] = useState<BatchJob[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/api/auth/signin')
    } else if (session) {
      // Check if user has admin role
      const userRole = (session as any).role || (session.user as any)?.role
      if (!['admin', 'core'].includes(userRole)) {
        router.push('/')
      } else {
        fetchData()
      }
    }
  }, [session, status, router])
  
  const fetchData = async () => {
    setLoading(true)
    try {
      // Fetch tweets
      const tweetsRes = await fetch('/api/engagement/tweets')
      if (tweetsRes.ok) {
        const data = await tweetsRes.json()
        setTweets(data.tweets || [])
      }
      
      // Fetch leaderboard
      const leaderboardRes = await fetch('/api/engagement/leaderboard?limit=20')
      if (leaderboardRes.ok) {
        const data = await leaderboardRes.json()
        setLeaderboard(data.leaderboard || [])
      }
      
      // Fetch rules
      const rulesRes = await fetch('/api/engagement/rules')
      if (rulesRes.ok) {
        const data = await rulesRes.json()
        setRules(data.rules || [])
      }
      
      // Fetch batch jobs
      const jobsRes = await fetch('/api/engagement/batch')
      if (jobsRes.ok) {
        const data = await jobsRes.json()
        setBatchJobs(data.jobs || [])
      }
    } catch (error) {
      console.error('Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const runBatchJob = async () => {
    setRefreshing(true)
    try {
      const res = await fetch('/api/engagement/batch', {
        method: 'POST'
      })
      
      if (res.ok) {
        alert('Batch processing started')
        // Refresh batch jobs after a delay
        setTimeout(() => fetchData(), 2000)
      } else {
        const data = await res.json()
        alert(data.error || 'Failed to start batch processing')
      }
    } catch (error) {
      console.error('Error starting batch job:', error)
      alert('Failed to start batch processing')
    } finally {
      setRefreshing(false)
    }
  }
  
  const deleteTweet = async (tweetId: string) => {
    if (!confirm('Are you sure you want to delete this tweet?')) return
    
    try {
      const res = await fetch(`/api/engagement/tweets?id=${tweetId}`, {
        method: 'DELETE'
      })
      
      if (res.ok) {
        setTweets(tweets.filter(t => t.id !== tweetId))
      } else {
        alert('Failed to delete tweet')
      }
    } catch (error) {
      console.error('Error deleting tweet:', error)
      alert('Failed to delete tweet')
    }
  }
  
  const updateRule = async (tier: number, interactionType: string, points: number) => {
    try {
      const res = await fetch('/api/engagement/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, interactionType, points })
      })
      
      if (res.ok) {
        fetchData() // Refresh rules
      } else {
        alert('Failed to update rule')
      }
    } catch (error) {
      console.error('Error updating rule:', error)
      alert('Failed to update rule')
    }
  }
  
  const setupDefaultRules = async () => {
    try {
      const res = await fetch('/api/engagement/rules?action=setup-defaults', {
        method: 'PUT'
      })
      
      if (res.ok) {
        alert('Default rules created')
        fetchData()
      } else {
        alert('Failed to setup default rules')
      }
    } catch (error) {
      console.error('Error setting up default rules:', error)
      alert('Failed to setup default rules')
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-black p-8 flex items-center justify-center">
        <div className="text-green-300">Loading engagement data...</div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-black p-4 sm:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-green-300 mb-2">Engagement Tracker</h1>
          <p className="text-gray-400">Manage Twitter engagement tracking and points system</p>
        </div>
        
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-3 text-blue-400 mb-2">
              <Twitter className="w-5 h-5" />
              <span className="text-sm">Active Tweets</span>
            </div>
            <p className="text-2xl font-bold text-white">{tweets.length}</p>
          </div>
          
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-3 text-green-400 mb-2">
              <Users className="w-5 h-5" />
              <span className="text-sm">Connected Users</span>
            </div>
            <p className="text-2xl font-bold text-white">{leaderboard.length}</p>
          </div>
          
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-3 text-purple-400 mb-2">
              <Trophy className="w-5 h-5" />
              <span className="text-sm">Top Score</span>
            </div>
            <p className="text-2xl font-bold text-white">
              {leaderboard[0]?.totalPoints || 0}
            </p>
          </div>
          
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-3 text-orange-400 mb-2">
              <Activity className="w-5 h-5" />
              <span className="text-sm">Last Batch</span>
            </div>
            <p className="text-sm text-white">
              {batchJobs[0] ? new Date(batchJobs[0].startedAt).toLocaleString() : 'Never'}
            </p>
          </div>
        </div>
        
        {/* Tabs */}
        <div className="flex gap-4 mb-6 border-b border-gray-700">
          {['overview', 'tweets', 'leaderboard', 'rules', 'batch'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 px-1 capitalize ${
                activeTab === tab
                  ? 'text-green-300 border-b-2 border-green-300'
                  : 'text-gray-400 hover:text-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
        
        {/* Content */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-green-300 mb-4">Quick Actions</h2>
              <div className="flex gap-4">
                <button
                  onClick={runBatchJob}
                  disabled={refreshing}
                  className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 disabled:opacity-50 flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                  Run Batch Processing
                </button>
                <button
                  onClick={setupDefaultRules}
                  className="px-4 py-2 bg-gray-800 text-gray-100 rounded hover:bg-gray-700 flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Setup Default Rules
                </button>
              </div>
            </div>
            
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-green-300 mb-4">Recent Activity</h2>
              <div className="space-y-3">
                {tweets.slice(0, 5).map(tweet => (
                  <div key={tweet.id} className="flex items-center justify-between py-2 border-b border-gray-800">
                    <div>
                      <p className="text-white">@{tweet.authorHandle}</p>
                      <p className="text-xs text-gray-400">
                        Submitted {new Date(tweet.submittedAt).toLocaleString()}
                      </p>
                    </div>
                    <a
                      href={tweet.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-400 hover:underline text-sm"
                    >
                      View Tweet
                    </a>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'tweets' && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Author</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Category</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Metrics</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Submitted</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {tweets.map(tweet => (
                  <tr key={tweet.id}>
                    <td className="px-4 py-3 text-sm text-white">@{tweet.authorHandle}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{tweet.category || 'General'}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {tweet.metrics ? (
                        <span>
                          ❤️ {tweet.metrics.likes} 🔁 {tweet.metrics.retweets} 💬 {tweet.metrics.replies}
                        </span>
                      ) : (
                        <span className="text-gray-500">Not processed</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {new Date(tweet.submittedAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <a
                        href={tweet.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:underline mr-3"
                      >
                        View
                      </a>
                      <button
                        onClick={() => deleteTweet(tweet.id)}
                        className="text-red-400 hover:text-red-300"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {activeTab === 'leaderboard' && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Rank</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Twitter</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Tier</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Total Points</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Weekly Points</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {leaderboard.map(entry => (
                  <tr key={entry.discordId}>
                    <td className="px-4 py-3 text-sm font-bold text-white">#{entry.rank}</td>
                    <td className="px-4 py-3 text-sm text-white">@{entry.twitterHandle}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">Level {entry.tier}</td>
                    <td className="px-4 py-3 text-sm font-semibold text-green-400">{entry.totalPoints}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{entry.weeklyPoints}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        
        {activeTab === 'rules' && (
          <div className="space-y-6">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-green-300 mb-4">Point Rules by Tier</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {[1, 2, 3].map(tier => (
                  <div key={tier} className="space-y-3">
                    <h3 className="text-lg font-medium text-white">Tier {tier}</h3>
                    {['like', 'retweet', 'reply'].map(type => {
                      const rule = rules.find(r => r.tier === tier && r.interactionType === type)
                      return (
                        <div key={type} className="flex items-center justify-between">
                          <span className="text-gray-300 capitalize">{type}:</span>
                          <input
                            type="number"
                            value={rule?.points || 0}
                            onChange={(e) => updateRule(tier, type, parseInt(e.target.value) || 0)}
                            className="w-20 px-2 py-1 bg-black border border-gray-600 rounded text-white text-right"
                          />
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        
        {activeTab === 'batch' && (
          <div className="bg-gray-900 border border-gray-700 rounded-lg overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-800">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Started</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Tweets</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Engagements</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-400 uppercase">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {batchJobs.map(job => (
                  <tr key={job.id}>
                    <td className="px-4 py-3 text-sm text-white">
                      {new Date(job.startedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs ${
                        job.status === 'completed' ? 'bg-green-900 text-green-300' :
                        job.status === 'running' ? 'bg-blue-900 text-blue-300' :
                        job.status === 'failed' ? 'bg-red-900 text-red-300' :
                        'bg-gray-800 text-gray-300'
                      }`}>
                        {job.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300">{job.tweetsProcessed}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">{job.engagementsFound}</td>
                    <td className="px-4 py-3 text-sm text-gray-300">
                      {job.completedAt ? (
                        `${Math.round((new Date(job.completedAt).getTime() - new Date(job.startedAt).getTime()) / 1000)}s`
                      ) : job.status === 'running' ? (
                        'Running...'
                      ) : (
                        '-'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
} 