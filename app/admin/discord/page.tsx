'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, Settings, Bot, TrendingUp, MessageSquare, Users, Calendar, Brain, Activity, BarChart3, PieChart, Hash, Clock } from 'lucide-react'
import { Line, Doughnut, Bar } from 'react-chartjs-2'
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

// Register Chart.js components
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

interface AggregatedStats {
  totalProjects: number
  totalMessages: number
  totalUsers: number
  totalChannels: number
  avgSentiment: number
  sentimentBreakdown: {
    positive: number
    neutral: number
    negative: number
  }
  projectActivity: Array<{
    projectId: string
    name: string
    messages: number
    users: number
  }>
  weeklyTrend: Array<{
    date: string
    messages: number
    sentiment: number
  }>
  hourlyActivity: number[]
  topProjects: Array<{
    id: string
    name: string
    messageCount: number
    userCount: number
    sentiment: number
  }>
}

export default function DiscordAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [projects, setProjects] = useState<DiscordProject[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [geminiKey, setGeminiKey] = useState('')
  const [updatingKey, setUpdatingKey] = useState(false)
  const [scoutProjects, setScoutProjects] = useState<any[]>([])
  const [aggregatedStats, setAggregatedStats] = useState<AggregatedStats | null>(null)
  const [statsLoading, setStatsLoading] = useState(true)
  const [selectedTimeframe, setSelectedTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [botStatus, setBotStatus] = useState<any>(null)
  const [botLoading, setBotLoading] = useState(false)
  const [rebooting, setRebooting] = useState(false)

  // Check admin access
  useEffect(() => {
    // Wait for session to load
    if (status === 'loading') return

    // Check role after session loads
    const userRole = (session as any)?.role || (session?.user as any)?.role
    const twitterHandle = (session as any)?.twitterHandle || 
                         (session as any)?.user?.twitterHandle ||
                         session?.user?.name ||
                         (session as any)?.user?.username;
    
    // Special case for sharafi_eth
    const normalizedHandle = twitterHandle?.toLowerCase().replace('@', '');
    
    if (!['admin', 'core'].includes(userRole) && normalizedHandle !== 'sharafi_eth') {
      console.log('Discord page access denied. Role:', userRole, 'Handle:', normalizedHandle);
      router.push('/')
    }
  }, [session, status, router])

  // Fetch data
  useEffect(() => {
    // Only fetch if authenticated
    if (status === 'authenticated') {
      fetchProjects()
      fetchGeminiKey()
      fetchScoutProjects()
      fetchAggregatedStats()
      fetchBotStatus()
    }
  }, [status, selectedTimeframe])

  // Refresh bot status every 30 seconds
  useEffect(() => {
    if (status === 'authenticated') {
      const interval = setInterval(fetchBotStatus, 30000)
      return () => clearInterval(interval)
    }
  }, [status])

  const fetchAggregatedStats = async () => {
    setStatsLoading(true)
    try {
      const res = await fetch(`/api/discord/aggregated-stats?timeframe=${selectedTimeframe}`)
      if (res.ok) {
        const data = await res.json()
        setAggregatedStats(data)
      }
    } catch (error) {
      console.error('Error fetching aggregated stats:', error)
    } finally {
      setStatsLoading(false)
    }
  }

  const fetchScoutProjects = async () => {
    try {
      const res = await fetch('/api/projects/all')
      if (res.ok) {
        const data = await res.json()
        setScoutProjects(data.projects || [])
      }
    } catch (error) {
      console.error('Error fetching Scout projects:', error)
    }
  }

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/discord/projects')
      if (res.ok) {
        const data = await res.json()
        setProjects(data)
      }
    } catch (error) {
      console.error('Error fetching projects:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchGeminiKey = async () => {
    try {
      const res = await fetch('/api/discord/gemini-key')
      if (res.ok) {
        const data = await res.json()
        setGeminiKey(data.key || '')
      }
    } catch (error) {
      console.error('Error fetching Gemini key:', error)
    }
  }

  const updateGeminiKey = async () => {
    setUpdatingKey(true)
    try {
      const res = await fetch('/api/discord/gemini-key', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: geminiKey })
      })
      if (res.ok) {
        alert('Gemini API key updated successfully')
      }
    } catch (error) {
      alert('Failed to update API key')
    } finally {
      setUpdatingKey(false)
    }
  }

  const getProjectStats = (project: DiscordProject) => {
    return project.stats || { totalMessages: 0, totalUsers: 0 }
  }

  const fetchBotStatus = async () => {
    setBotLoading(true)
    try {
      const res = await fetch('/api/discord/bot-status')
      if (res.ok) {
        const data = await res.json()
        setBotStatus(data)
      }
    } catch (error) {
      console.error('Error fetching bot status:', error)
    } finally {
      setBotLoading(false)
    }
  }

  const rebootBot = async () => {
    if (!confirm('Are you sure you want to reboot the Discord bot? This will temporarily disconnect it from all servers.')) {
      return
    }
    
    setRebooting(true)
    try {
      const res = await fetch('/api/discord/bot-reboot', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })
      
      const data = await res.json()
      
      if (res.ok) {
        // Show warning if CSRF is disabled
        if (data.warning) {
          console.warn('Security warning:', data.warning)
        }
        
        const message = data.success 
          ? 'Bot restarted successfully!' 
          : 'Bot command executed but status uncertain. Check logs.'
        
        alert(message)
        
        // Wait a bit then check status
        setTimeout(fetchBotStatus, 5000)
      } else {
        console.error('Bot reboot failed:', data)
        alert(data.error || 'Failed to reboot bot. Check console for details.')
      }
    } catch (error) {
      console.error('Bot reboot error:', error)
      alert('Failed to connect to bot reboot endpoint. Check console for details.')
    } finally {
      setRebooting(false)
    }
  }

  // Chart configurations
  const sentimentChartData = {
    labels: ['Positive', 'Neutral', 'Negative'],
    datasets: [{
      data: [
        aggregatedStats?.sentimentBreakdown.positive || 0,
        aggregatedStats?.sentimentBreakdown.neutral || 0,
        aggregatedStats?.sentimentBreakdown.negative || 0
      ],
      backgroundColor: ['#10b981', '#6b7280', '#ef4444'],
      borderWidth: 0
    }]
  }

  const weeklyTrendData = {
    labels: aggregatedStats?.weeklyTrend.map(d => new Date(d.date).toLocaleDateString()) || [],
    datasets: [{
      label: 'Messages',
      data: aggregatedStats?.weeklyTrend.map(d => d.messages) || [],
      borderColor: '#10b981',
      backgroundColor: 'rgba(16, 185, 129, 0.1)',
      fill: true,
      yAxisID: 'y',
    }, {
      label: 'Avg Sentiment',
      data: aggregatedStats?.weeklyTrend.map(d => d.sentiment) || [],
      borderColor: '#8b5cf6',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      fill: false,
      yAxisID: 'y1',
    }]
  }

  const hourlyActivityData = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [{
      label: 'Messages by Hour',
      data: aggregatedStats?.hourlyActivity || [],
      backgroundColor: '#3b82f6',
      borderColor: '#3b82f6',
      borderWidth: 1
    }]
  }

  const projectComparisonData = {
    labels: aggregatedStats?.topProjects.map(p => p.name) || [],
    datasets: [{
      label: 'Messages',
      data: aggregatedStats?.topProjects.map(p => p.messageCount) || [],
      backgroundColor: '#10b981',
    }, {
      label: 'Active Users',
      data: aggregatedStats?.topProjects.map(p => p.userCount) || [],
      backgroundColor: '#3b82f6',
    }]
  }

  // Show loading while session is loading
  if (status === 'loading' || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-green-400 mb-2">Discord Analytics Hub</h1>
        <p className="text-gray-400">Comprehensive insights across all Discord servers</p>
      </div>

      {/* Overall Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <Bot className="w-8 h-8 text-blue-400" />
            <span className="text-2xl font-bold text-white">{aggregatedStats?.totalProjects || 0}</span>
          </div>
          <p className="text-gray-400">Active Servers</p>
          <p className="text-xs text-gray-500 mt-1">Discord communities tracked</p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <MessageSquare className="w-8 h-8 text-green-400" />
            <span className="text-2xl font-bold text-white">{(aggregatedStats?.totalMessages || 0).toLocaleString()}</span>
          </div>
          <p className="text-gray-400">Total Messages</p>
          <p className="text-xs text-gray-500 mt-1">Across all servers</p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <Users className="w-8 h-8 text-purple-400" />
            <span className="text-2xl font-bold text-white">{(aggregatedStats?.totalUsers || 0).toLocaleString()}</span>
          </div>
          <p className="text-gray-400">Active Users</p>
          <p className="text-xs text-gray-500 mt-1">Unique participants</p>
        </div>

        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <div className="flex items-center justify-between mb-2">
            <Brain className="w-8 h-8 text-yellow-400" />
            <span className="text-2xl font-bold text-white">
              {aggregatedStats?.avgSentiment ? `${(aggregatedStats.avgSentiment * 100).toFixed(1)}%` : 'N/A'}
            </span>
          </div>
          <p className="text-gray-400">Avg Sentiment</p>
          <p className="text-xs text-gray-500 mt-1">Overall positivity score</p>
        </div>
      </div>

      {/* Analytics Charts Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-green-300">Network Analytics</h2>
          <select
            value={selectedTimeframe}
            onChange={(e) => setSelectedTimeframe(e.target.value as any)}
            className="px-3 py-1 bg-black border border-gray-600 rounded text-white text-sm"
          >
            <option value="daily">Last 24 Hours</option>
            <option value="weekly">Last 7 Days</option>
            <option value="monthly">Last 30 Days</option>
          </select>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Weekly Trend Chart */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-4">Activity & Sentiment Trend</h3>
            {!statsLoading && aggregatedStats ? (
              <Line
                data={weeklyTrendData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { position: 'bottom' as const },
                    title: { display: false }
                  },
                  scales: {
                    y: {
                      type: 'linear' as const,
                      display: true,
                      position: 'left' as const,
                      title: { display: true, text: 'Messages' }
                    },
                    y1: {
                      type: 'linear' as const,
                      display: true,
                      position: 'right' as const,
                      title: { display: true, text: 'Sentiment Score' },
                      grid: { drawOnChartArea: false },
                      min: -1,
                      max: 1
                    }
                  }
                }}
              />
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
              </div>
            )}
          </div>

          {/* Sentiment Breakdown */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-4">Overall Sentiment Distribution</h3>
            {!statsLoading && aggregatedStats ? (
              <div className="flex items-center justify-center">
                <div className="w-64 h-64">
                  <Doughnut
                    data={sentimentChartData}
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
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
              </div>
            )}
          </div>

          {/* Hourly Activity Pattern */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-4">24-Hour Activity Pattern</h3>
            {!statsLoading && aggregatedStats ? (
              <Bar
                data={hourlyActivityData}
                options={{
                  responsive: true,
                  plugins: {
                    legend: { display: false },
                    title: { display: false }
                  },
                  scales: {
                    y: { beginAtZero: true }
                  }
                }}
              />
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
              </div>
            )}
          </div>

          {/* Project Comparison */}
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
            <h3 className="text-lg font-medium text-white mb-4">Top Projects Comparison</h3>
            {!statsLoading && aggregatedStats ? (
              <Bar
                data={projectComparisonData}
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
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Gemini API Key Section */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-8">
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-5 h-5 text-purple-400" />
          <h2 className="text-xl font-semibold text-purple-400">Gemini AI Configuration</h2>
        </div>
        <div className="flex gap-3">
          <input
            type="password"
            value={geminiKey}
            onChange={(e) => setGeminiKey(e.target.value)}
            placeholder="Enter Gemini API Key"
            className="flex-1 px-4 py-2 bg-black border border-gray-600 rounded text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
          />
          <button
            onClick={updateGeminiKey}
            disabled={updatingKey}
            className="px-6 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded font-medium disabled:opacity-50"
          >
            {updatingKey ? 'Updating...' : 'Update Key'}
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-2">
          Used for sentiment analysis of Discord messages
        </p>
      </div>

      {/* Discord Bot Monitor */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-blue-400" />
            <h2 className="text-xl font-semibold text-blue-400">Discord Bot Monitor</h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchBotStatus}
              disabled={botLoading}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {botLoading ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Activity className="w-4 h-4" />
              )}
              Check Status
            </button>
            <button
              onClick={rebootBot}
              disabled={rebooting || botLoading}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded font-medium disabled:opacity-50 flex items-center gap-2"
            >
              {rebooting ? (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              ) : (
                <Bot className="w-4 h-4" />
              )}
              Reboot Bot
            </button>
          </div>
        </div>
        
        {botStatus ? (
          <div className="space-y-4">
            {/* Engagement Bot Status */}
            <div className="border border-gray-700 rounded-lg p-4 bg-black/50">
              <h3 className="text-lg font-medium text-green-400 mb-3">Engagement Bot</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-black rounded p-4 border border-gray-600">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Status</span>
                    <span className={`font-medium ${botStatus.status === 'running' ? 'text-green-400' : 'text-red-400'}`}>
                      {botStatus.status === 'running' ? '🟢 Running' : '🔴 Stopped'}
                    </span>
                  </div>
                </div>
                <div className="bg-black rounded p-4 border border-gray-600">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Uptime</span>
                    <span className="font-medium text-white">
                      {botStatus.uptime || 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="bg-black rounded p-4 border border-gray-600">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Token</span>
                    <span className={`font-medium ${botStatus.hasToken ? 'text-green-400' : 'text-red-400'}`}>
                      {botStatus.hasToken ? '✓ Configured' : '✗ Missing'}
                    </span>
                  </div>
                </div>
              </div>
              
              {botStatus.process && (
                <div className="bg-black rounded p-4 border border-gray-600 mb-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Process Info</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">PID:</span> <span className="text-white">{botStatus.process.pid}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">CPU:</span> <span className="text-white">{botStatus.process.cpu}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Memory:</span> <span className="text-white">{botStatus.process.memory}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Started:</span> <span className="text-white">{botStatus.process.startTime}</span>
                    </div>
                  </div>
                </div>
              )}
              
              {botStatus.lastLogs && botStatus.lastLogs.length > 0 && (
                <div className="bg-black rounded p-4 border border-gray-600">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Recent Logs</h4>
                  <div className="space-y-1 text-xs font-mono max-h-32 overflow-y-auto">
                    {botStatus.lastLogs.map((log: string, index: number) => (
                      <div key={index} className="text-gray-300">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Analytics Bot Status */}
            <div className="border border-gray-700 rounded-lg p-4 bg-black/50">
              <h3 className="text-lg font-medium text-purple-400 mb-3">Analytics Bot</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div className="bg-black rounded p-4 border border-gray-600">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Status</span>
                    <span className={`font-medium ${botStatus.analyticsStatus === 'running' ? 'text-green-400' : 'text-red-400'}`}>
                      {botStatus.analyticsStatus === 'running' ? '🟢 Running' : '🔴 Stopped'}
                    </span>
                  </div>
                </div>
                <div className="bg-black rounded p-4 border border-gray-600">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Uptime</span>
                    <span className="font-medium text-white">
                      {botStatus.analyticsUptime || 'N/A'}
                    </span>
                  </div>
                </div>
                <div className="bg-black rounded p-4 border border-gray-600">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Function</span>
                    <span className="font-medium text-purple-400">
                      Message Tracking
                    </span>
                  </div>
                </div>
              </div>
              
              {botStatus.analyticsProcess && (
                <div className="bg-black rounded p-4 border border-gray-600 mb-4">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Process Info</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                    <div>
                      <span className="text-gray-500">PID:</span> <span className="text-white">{botStatus.analyticsProcess.pid}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">CPU:</span> <span className="text-white">{botStatus.analyticsProcess.cpu}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Memory:</span> <span className="text-white">{botStatus.analyticsProcess.memory}%</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Started:</span> <span className="text-white">{botStatus.analyticsProcess.startTime}</span>
                    </div>
                  </div>
                </div>
              )}
              
              {botStatus.analyticsLogs && botStatus.analyticsLogs.length > 0 && (
                <div className="bg-black rounded p-4 border border-gray-600">
                  <h4 className="text-sm font-medium text-gray-400 mb-2">Recent Analytics Logs</h4>
                  <div className="space-y-1 text-xs font-mono max-h-32 overflow-y-auto">
                    {botStatus.analyticsLogs.map((log: string, index: number) => (
                      <div key={index} className="text-gray-300">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            {botLoading ? 'Loading bot status...' : 'Click "Check Status" to view bot information'}
          </div>
        )}
      </div>

      {/* Projects Grid */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-green-300">Discord Projects</h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
        >
          <Plus className="w-4 h-4" />
          Add Server
        </button>
      </div>

      {projects.length === 0 ? (
        <div className="text-center py-12 bg-gray-900 rounded-lg border border-gray-700">
          <Bot className="w-16 h-16 mx-auto text-gray-600 mb-4" />
          <p className="text-gray-400 mb-4">No Discord servers connected yet</p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium"
          >
            Connect First Server
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {projects.map((project) => {
            const stats = getProjectStats(project)
            const scoutProject = scoutProjects.find(sp => sp.id === project.scoutProjectId)
            
            return (
              <div
                key={project.id}
                className="bg-gray-900 border border-gray-700 rounded-lg p-6 hover:border-green-500 transition-colors cursor-pointer"
                onClick={() => router.push(`/admin/discord/${project.id.replace(/:/g, '--')}`)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    {scoutProject?.profileImageUrl ? (
                      <img
                        src={scoutProject.profileImageUrl}
                        alt={scoutProject.twitterHandle}
                        className="w-12 h-12 rounded-full"
                      />
                    ) : project.iconUrl ? (
                      <img
                        src={project.iconUrl}
                        alt={project.name}
                        className="w-12 h-12 rounded-full"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-gray-800 rounded-full flex items-center justify-center">
                        <Bot className="w-6 h-6 text-gray-500" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-white">{project.name}</h3>
                      <p className="text-xs text-gray-400">{project.serverName}</p>
                      {scoutProject && (
                        <p className="text-xs text-green-400 mt-0.5">{scoutProject.twitterHandle}</p>
                      )}
                    </div>
                  </div>
                  <Settings className="w-4 h-4 text-gray-500" />
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className="bg-black/50 rounded p-3">
                    <div className="flex items-center gap-2 text-blue-400 mb-1">
                      <MessageSquare className="w-4 h-4" />
                      <span className="text-xs">Messages</span>
                    </div>
                    <p className="text-xl font-bold text-white">{stats.totalMessages.toLocaleString()}</p>
                  </div>
                  <div className="bg-black/50 rounded p-3">
                    <div className="flex items-center gap-2 text-green-400 mb-1">
                      <Users className="w-4 h-4" />
                      <span className="text-xs">Users</span>
                    </div>
                    <p className="text-xl font-bold text-white">{stats.totalUsers.toLocaleString()}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className={`px-2 py-1 rounded ${project.isActive ? 'bg-green-900 text-green-300' : 'bg-red-900 text-red-300'}`}>
                    {project.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="text-gray-500">
                    {project.trackedChannels.length} channels tracked
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Project Modal */}
      {showCreateModal && (
        <CreateProjectModal
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false)
            fetchProjects()
            fetchAggregatedStats()
          }}
        />
      )}
    </div>
  )
}

// Create Project Modal Component
function CreateProjectModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    serverId: '',
    serverName: '',
    iconUrl: '',
    scoutProjectId: ''
  })
  const [creating, setCreating] = useState(false)
  const [scoutProjects, setScoutProjects] = useState<any[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)

  // Load Scout projects
  useEffect(() => {
    fetchScoutProjects()
  }, [])

  const fetchScoutProjects = async () => {
    try {
      const res = await fetch('/api/projects/all')
      if (res.ok) {
        const data = await res.json()
        setScoutProjects(data.projects || [])
      }
    } catch (error) {
      console.error('Error fetching Scout projects:', error)
    } finally {
      setLoadingProjects(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)

    try {
      const res = await fetch('/api/discord/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      })

      if (res.ok) {
        onCreated()
      } else {
        alert('Failed to create project')
      }
    } catch (error) {
      alert('Error creating project')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-lg w-full max-w-md">
        <div className="p-6">
          <h3 className="text-xl font-semibold text-green-400 mb-4">Connect Discord Server</h3>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Project Name
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-gray-600 rounded text-white focus:outline-none focus:border-green-500"
                placeholder="e.g. Main Community"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Server ID
              </label>
              <input
                type="text"
                required
                value={formData.serverId}
                onChange={(e) => setFormData({ ...formData, serverId: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-gray-600 rounded text-white focus:outline-none focus:border-green-500"
                placeholder="e.g. 1234567890123456789"
              />
              <p className="text-xs text-gray-500 mt-1">
                Enable Developer Mode in Discord to copy server ID
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Server Name
              </label>
              <input
                type="text"
                required
                value={formData.serverName}
                onChange={(e) => setFormData({ ...formData, serverName: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-gray-600 rounded text-white focus:outline-none focus:border-green-500"
                placeholder="As shown in Discord"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Scout Project
              </label>
              <select
                required
                value={formData.scoutProjectId}
                onChange={(e) => setFormData({ ...formData, scoutProjectId: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-gray-600 rounded text-white focus:outline-none focus:border-green-500"
                disabled={loadingProjects}
              >
                <option value="">Select a Scout project</option>
                {scoutProjects.map((project) => (
                  <option key={project.id} value={project.id}>
                    {project.twitterHandle} - {project.notes || 'No description'}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Link this Discord server to a Scout project for unified analytics
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-400 mb-1">
                Server Icon URL (Optional)
              </label>
              <input
                type="url"
                value={formData.iconUrl}
                onChange={(e) => setFormData({ ...formData, iconUrl: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-gray-600 rounded text-white focus:outline-none focus:border-green-500"
                placeholder="https://..."
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded font-medium"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded font-medium disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create Project'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 