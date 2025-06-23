'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Trophy, Users, Twitter, RefreshCw, Settings, Activity, Plus, Trash2 } from 'lucide-react'

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
  
  // Add refs to track component state and prevent unnecessary refreshes
  const isComponentMounted = useRef(true)
  const lastFetchTime = useRef<number>(0)
  const fetchInterval = useRef<NodeJS.Timeout | null>(null)
  
  // Minimum time between fetches (in milliseconds)
  const FETCH_COOLDOWN = 5000 // 5 seconds
  
  useEffect(() => {
    return () => {
      isComponentMounted.current = false
      if (fetchInterval.current) {
        clearInterval(fetchInterval.current)
      }
    }
  }, [])
  
  // Handle visibility change to prevent unnecessary refreshes
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('[Engagement Admin] Page hidden, pausing updates')
        if (fetchInterval.current) {
          clearInterval(fetchInterval.current)
          fetchInterval.current = null
        }
      } else {
        console.log('[Engagement Admin] Page visible, resuming updates if needed')
        // Only fetch if enough time has passed since last fetch
        const timeSinceLastFetch = Date.now() - lastFetchTime.current
        if (timeSinceLastFetch > FETCH_COOLDOWN) {
          fetchData()
        }
        // Restart periodic updates
        startPeriodicUpdates()
      }
    }
    
    document.addEventListener('visibilitychange', handleVisibilityChange)
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])
  
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/api/auth/signin')
    } else if (session) {
      // Check if user has admin role
      const userRole = (session as any).role || (session.user as any)?.role
      console.log('[Engagement Admin] User role:', userRole, 'Session:', session)
      
      if (!['admin', 'core'].includes(userRole)) {
        router.push('/')
      } else {
        fetchData()
        startPeriodicUpdates()
      }
    }
  }, [session, status, router])
  
  const startPeriodicUpdates = useCallback(() => {
    // Clear any existing interval
    if (fetchInterval.current) {
      clearInterval(fetchInterval.current)
    }
    
    // Set up periodic updates for recent tweets
    fetchInterval.current = setInterval(() => {
      if (!document.hidden && isComponentMounted.current) {
        console.log('[Engagement Admin] Periodic update: fetching recent tweets')
        fetchRecentTweets()
      }
    }, 30000) // Update every 30 seconds
  }, [])
  
  const fetchRecentTweets = async () => {
    try {
      const tweetsRes = await fetch('/api/engagement/tweets')
      if (tweetsRes.ok) {
        const data = await tweetsRes.json()
        if (isComponentMounted.current) {
          setTweets(data.tweets || [])
          console.log('[Engagement Admin] Updated tweets:', data.tweets?.length || 0)
        }
      }
    } catch (error) {
      console.error('[Engagement Admin] Error fetching recent tweets:', error)
    }
  }
  
  const fetchData = async () => {
    // Prevent too frequent fetches
    const timeSinceLastFetch = Date.now() - lastFetchTime.current
    if (timeSinceLastFetch < FETCH_COOLDOWN && lastFetchTime.current > 0) {
      console.log('[Engagement Admin] Skipping fetch, too soon since last fetch')
      return
    }
    
    lastFetchTime.current = Date.now()
    setLoading(true)
    console.log('[Engagement Admin] Fetching all data...')
    
    try {
      // Fetch tweets
      const tweetsRes = await fetch('/api/engagement/tweets')
      if (tweetsRes.ok) {
        const data = await tweetsRes.json()
        setTweets(data.tweets || [])
        console.log('[Engagement Admin] Fetched tweets:', data.tweets?.length || 0)
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
      console.error('[Engagement Admin] Error fetching data:', error)
    } finally {
      setLoading(false)
    }
  }
  
  const runBatchJob = async () => {
    setRefreshing(true)
    console.log('[Engagement Admin] Creating batch job...')
    
    try {
      // Include session information in the request headers
      const res = await fetch('/api/engagement/batch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include' // Ensure cookies are sent
      })
      
      console.log('[Engagement Admin] Batch job response:', res.status, res.statusText)
      
      if (res.ok) {
        const data = await res.json()
        alert(`Batch job created successfully! ${data.message}`)
        // Refresh batch jobs after a delay
        setTimeout(() => fetchData(), 2000)
      } else {
        const data = await res.json()
        console.error('[Engagement Admin] Batch job error:', data)
        alert(data.error || 'Failed to create batch job')
      }
    } catch (error) {
      console.error('[Engagement Admin] Error creating batch job:', error)
      alert('Failed to create batch job')
    } finally {
      setRefreshing(false)
    }
  }
  
  const deleteTweet = async (tweetId: string) => {
    if (!confirm('Are you sure you want to delete this tweet?')) return
    
    try {
      const res = await fetch(`/api/engagement/tweets?id=${tweetId}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (res.ok) {
        setTweets(tweets.filter(t => t.id !== tweetId))
      } else {
        alert('Failed to delete tweet')
      }
    } catch (error) {
      console.error('[Engagement Admin] Error deleting tweet:', error)
      alert('Failed to delete tweet')
    }
  }
  
  const updateRule = async (tier: number, interactionType: string, points: number) => {
    try {
      const res = await fetch('/api/engagement/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, interactionType, points }),
        credentials: 'include'
      })
      
      if (res.ok) {
        fetchData() // Refresh rules
      } else {
        alert('Failed to update rule')
      }
    } catch (error) {
      console.error('[Engagement Admin] Error updating rule:', error)
      alert('Failed to update rule')
    }
  }
  
  const setupDefaultRules = async () => {
    try {
      const res = await fetch('/api/engagement/rules?action=setup-defaults', {
        method: 'PUT',
        credentials: 'include'
      })
      
      if (res.ok) {
        alert('Default rules created')
        fetchData()
      } else {
        alert('Failed to setup default rules')
      }
    } catch (error) {
      console.error('[Engagement Admin] Error setting up default rules:', error)
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

function TierScenarios() {
  const [scenarios, setScenarios] = useState<any>({})
  const [editingTier, setEditingTier] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<any>({})

  useEffect(() => {
    fetchScenarios()
  }, [])

  const fetchScenarios = async () => {
    try {
      const response = await fetch('/api/engagement/scenarios', {
        credentials: 'include'
      })
      if (response.ok) {
        const data = await response.json()
        setScenarios(data)
      }
    } catch (error) {
      console.error('[Engagement Admin] Error fetching scenarios:', error)
    }
  }

  const handleEdit = (tier: number) => {
    setEditingTier(tier)
    setEditForm(scenarios[`tier${tier}`])
  }

  const handleSave = async () => {
    if (!editingTier) return

    try {
      const response = await fetch('/api/engagement/scenarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tier: editingTier,
          scenarios: editForm
        }),
        credentials: 'include'
      })

      if (response.ok) {
        await fetchScenarios()
        setEditingTier(null)
      }
    } catch (error) {
      console.error('[Engagement Admin] Error saving scenarios:', error)
    }
  }

  const handleCategoryChange = (index: number, value: string) => {
    const newCategories = [...editForm.categories]
    newCategories[index] = value
    setEditForm({ ...editForm, categories: newCategories })
  }

  const addCategory = () => {
    setEditForm({ 
      ...editForm, 
      categories: [...editForm.categories, 'New Category'] 
    })
  }

  const removeCategory = (index: number) => {
    const newCategories = editForm.categories.filter((_: any, i: number) => i !== index)
    setEditForm({ ...editForm, categories: newCategories })
  }

  return (
    <div className="space-y-4">
      {[1, 2, 3].map(tier => {
        const tierScenarios = scenarios[`tier${tier}`] || {}
        const isEditing = editingTier === tier

        return (
          <div key={tier} className="border border-gray-700 rounded-lg p-4 bg-black">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-white">Tier {tier}</h3>
              {!isEditing ? (
                <button
                  onClick={() => handleEdit(tier)}
                  className="px-3 py-1 bg-gray-800 text-green-300 rounded hover:bg-gray-700"
                >
                  Edit
                </button>
              ) : (
                <div className="space-x-2">
                  <button
                    onClick={handleSave}
                    className="px-3 py-1 bg-green-900 text-green-100 rounded hover:bg-green-800"
                  >
                    Save
                  </button>
                  <button
                    onClick={() => setEditingTier(null)}
                    className="px-3 py-1 bg-gray-800 text-gray-300 rounded hover:bg-gray-700"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            {!isEditing ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium text-gray-400">Daily Tweet Limit:</span>{' '}
                  <span className="text-white">{tierScenarios.dailyTweetLimit || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-400">Min Followers:</span>{' '}
                  <span className="text-white">{tierScenarios.minFollowers || 'N/A'}</span>
                </div>
                <div>
                  <span className="font-medium text-gray-400">Bonus Multiplier:</span>{' '}
                  <span className="text-white">{tierScenarios.bonusMultiplier || 'N/A'}x</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="font-medium text-gray-400">Categories:</span>{' '}
                  <span className="text-white">{tierScenarios.categories?.join(', ') || 'N/A'}</span>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Daily Tweet Limit</label>
                  <input
                    type="number"
                    value={editForm.dailyTweetLimit || ''}
                    onChange={(e) => setEditForm({ ...editForm, dailyTweetLimit: parseInt(e.target.value) })}
                    className="w-full p-2 bg-black border border-gray-600 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Minimum Followers</label>
                  <input
                    type="number"
                    value={editForm.minFollowers || ''}
                    onChange={(e) => setEditForm({ ...editForm, minFollowers: parseInt(e.target.value) })}
                    className="w-full p-2 bg-black border border-gray-600 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Bonus Multiplier</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.bonusMultiplier || ''}
                    onChange={(e) => setEditForm({ ...editForm, bonusMultiplier: parseFloat(e.target.value) })}
                    className="w-full p-2 bg-black border border-gray-600 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-1">Categories</label>
                  <div className="space-y-2">
                    {editForm.categories?.map((category: string, index: number) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={category}
                          onChange={(e) => handleCategoryChange(index, e.target.value)}
                          className="flex-1 p-2 bg-black border border-gray-600 rounded text-white"
                        />
                        <button
                          onClick={() => removeCategory(index)}
                          className="px-3 py-2 bg-red-900 text-red-100 rounded hover:bg-red-800"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={addCategory}
                      className="px-3 py-2 bg-gray-800 text-gray-100 rounded hover:bg-gray-700 flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Category
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )
      })}
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
          <p className="text-xs text-gray-500 mt-1">
            {session ? `Logged in as: ${(session as any).twitterHandle || session.user?.name} (${(session as any).role || 'unknown'})` : ''}
          </p>
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
        <div className="flex gap-4 mb-6 border-b border-gray-700 overflow-x-auto">
          {['overview', 'tweets', 'leaderboard', 'rules', 'scenarios', 'batch'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`pb-2 px-1 capitalize whitespace-nowrap ${
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
                  Create Batch Job
                </button>
                <button
                  onClick={setupDefaultRules}
                  className="px-4 py-2 bg-gray-800 text-gray-100 rounded hover:bg-gray-700 flex items-center gap-2"
                >
                  <Settings className="w-4 h-4" />
                  Setup Default Rules
                </button>
                <button
                  onClick={fetchRecentTweets}
                  className="px-4 py-2 bg-blue-900 text-blue-100 rounded hover:bg-blue-800 flex items-center gap-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  Refresh Tweets
                </button>
              </div>
              <div className="mt-4 p-3 bg-black border border-yellow-500 rounded text-sm">
                <p className="text-yellow-300 font-semibold mb-1">ℹ️ How Batch Processing Works</p>
                <p className="text-gray-300">
                  Creating a batch job only queues it. To actually process tweets and award points:
                </p>
                <ol className="list-decimal list-inside mt-2 text-gray-400 space-y-1">
                  <li>Run once: <code className="bg-gray-800 px-1 rounded">node discord-bots/engagement-batch-processor.js</code></li>
                  <li>Or use the helper: <code className="bg-gray-800 px-1 rounded">node scripts/run-engagement-batch.mjs</code></li>
                  <li>Set up cron for automation: <code className="bg-gray-800 px-1 rounded">*/30 * * * * cd /path/to/project && node discord-bots/engagement-batch-processor.js</code></li>
                </ol>
                <div className="mt-3 p-2 bg-gray-900 rounded">
                  <p className="text-xs text-gray-400">
                    <strong>Important:</strong> Points require:
                  </p>
                  <ul className="list-disc list-inside text-xs text-gray-500 mt-1">
                    <li>Users must connect both Discord & Twitter accounts</li>
                    <li>Twitter API must have "Elevated" access (not just "Essential")</li>
                    <li>The tweetLikedBy endpoint is needed to see who engaged</li>
                  </ul>
                </div>
              </div>
            </div>
            
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold text-green-300">Recent Activity</h2>
                <span className="text-xs text-gray-500">Updates every 30 seconds</span>
              </div>
              <div className="space-y-3">
                {tweets
                  .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
                  .slice(0, 5)
                  .map(tweet => (
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
                {tweets.length === 0 && (
                  <p className="text-gray-500 text-center py-4">No recent tweets yet</p>
                )}
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
        
        {activeTab === 'scenarios' && (
          <div className="space-y-6">
            <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
              <h2 className="text-xl font-semibold text-green-300 mb-4">Tier Scenarios</h2>
              <p className="text-gray-400 mb-6">Configure daily limits, categories, and bonus multipliers for each tier.</p>
              <TierScenarios />
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