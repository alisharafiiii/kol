'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useParams } from 'next/navigation'
import { ArrowLeft, Settings, Download, Share2, Users, MessageSquare, TrendingUp, AlertCircle, Hash, RefreshCw, Clock } from 'lucide-react'
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
import type { DiscordProject, DiscordAnalytics, DiscordChannel } from '@/lib/types/discord'

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

export default function DiscordProjectPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const params = useParams()
  // Convert URL-safe format back to original format (replace -- with :)
  const projectId = (params.id as string).replace(/--/g, ':')

  const [project, setProject] = useState<DiscordProject | null>(null)
  const [analytics, setAnalytics] = useState<DiscordAnalytics | null>(null)
  const [channels, setChannels] = useState<DiscordChannel[]>([])
  const [loading, setLoading] = useState(true)
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly' | 'allTime'>('weekly')
  const [showSettings, setShowSettings] = useState(false)
  const [teamMods, setTeamMods] = useState<string[]>([])
  const [shareableLink, setShareableLink] = useState('')
  const [channelsLoading, setChannelsLoading] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [newChannelId, setNewChannelId] = useState('')
  const [addingChannel, setAddingChannel] = useState(false)
  const [channelError, setChannelError] = useState('')
  const [channelSuccess, setChannelSuccess] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [copySuccess, setCopySuccess] = useState(false)
  const [analyticsLoading, setAnalyticsLoading] = useState(true)
  const [analyticsCache, setAnalyticsCache] = useState<Record<string, any>>({})
  
  // Sentiment settings state
  const [sentimentSettings, setSentimentSettings] = useState({
    bullishKeywords: '',
    bearishKeywords: '',
    bullishEmojis: '',
    bearishEmojis: '',
    ignoredChannels: [] as string[],
    minimumMessageLength: 3
  })
  const [savingSentimentSettings, setSavingSentimentSettings] = useState(false)

  // Add Moderator Modal state
  const [showAddModModal, setShowAddModModal] = useState(false)
  const [approvedUsers, setApprovedUsers] = useState<Array<{
    handle: string
    name: string
    role: string
    timezone?: string
    profileImageUrl?: string
  }>>([])
  const [selectedMod, setSelectedMod] = useState('')
  const [modShift, setModShift] = useState({
    startTime: '',
    endTime: '',
    timezone: 'EDT'
  })
  const [addingMod, setAddingMod] = useState(false)
  const [modSearchQuery, setModSearchQuery] = useState('')

  // Check admin access
  useEffect(() => {
    // Only check role if session is loaded
    if (session !== undefined) {
      const userRole = (session as any)?.role || (session?.user as any)?.role
      if (session && !['admin', 'core'].includes(userRole)) {
        router.push('/')
      }
    }
  }, [session, router])

  // Fetch project data
  useEffect(() => {
    if (projectId) {
      fetchProjectData()
      fetchAnalytics()
      fetchChannels()
    }
  }, [projectId, timeframe])

  // Load sentiment settings
  useEffect(() => {
    if (projectId) {
      fetchSentimentSettings()
    }
  }, [projectId])

  const fetchSentimentSettings = async () => {
    try {
      const res = await fetch(`/api/discord/projects/${projectId}/sentiment-settings`)
      if (res.ok) {
        const settings = await res.json()
        if (settings) {
          setSentimentSettings({
            bullishKeywords: settings.bullishKeywords || '',
            bearishKeywords: settings.bearishKeywords || '',
            bullishEmojis: settings.bullishEmojis || '',
            bearishEmojis: settings.bearishEmojis || '',
            ignoredChannels: settings.ignoredChannels || [],
            minimumMessageLength: settings.minimumMessageLength || 3
          })
        }
      }
    } catch (error) {
      console.error('Error fetching sentiment settings:', error)
    }
  }

  const fetchProjectData = async () => {
    try {
      const res = await fetch(`/api/discord/projects/${projectId}`)
      if (res.ok) {
        const data = await res.json()
        setProject(data)
        setTeamMods(data.teamMods || [])
      }
    } catch (error) {
      console.error('Error fetching project:', error)
    } finally {
      setLoading(false)
    }
  }

  const refreshAllData = async () => {
    console.log('🔄 Starting refresh for project:', projectId)
    setRefreshing(true)
    try {
      // Clear cache to force fresh data
      setAnalyticsCache({})
      await fetchProjectData()
      await fetchAnalytics()
      await fetchChannels()
      console.log('✅ Refresh complete')
    } catch (error) {
      console.error('❌ Error during refresh:', error)
    } finally {
      setRefreshing(false)
    }
  }

  const fetchAnalytics = async () => {
    console.log('🔍 Fetching analytics for:', projectId, 'timeframe:', timeframe)
    
    // Check cache first
    const cacheKey = `${projectId}-${timeframe}`
    if (analyticsCache[cacheKey]) {
      console.log('📊 Using cached analytics data')
      setAnalytics(analyticsCache[cacheKey])
      setAnalyticsLoading(false)
      return
    }
    
    setAnalyticsLoading(true)
    try {
      const res = await fetch(`/api/discord/projects/${projectId}/analytics?timeframe=${timeframe}`)
      console.log('📊 Analytics response status:', res.status)
      if (res.ok) {
        const data = await res.json()
        console.log('✅ Analytics data received:', data)
        const analyticsData = data.analytics || data
        setAnalytics(analyticsData)
        // Cache the data
        setAnalyticsCache(prev => ({
          ...prev,
          [cacheKey]: analyticsData
        }))
      } else {
        const errorText = await res.text()
        console.error('❌ Analytics fetch failed:', res.status, errorText)
      }
    } catch (error) {
      console.error('❌ Error fetching analytics:', error)
    } finally {
      setAnalyticsLoading(false)
    }
  }

  const fetchChannels = async () => {
    setChannelsLoading(true)
    try {
      const res = await fetch(`/api/discord/projects/${projectId}/channels`)
      console.log('📡 Fetching channels, status:', res.status)
      if (res.ok) {
        const data = await res.json()
        console.log('📡 Channels data received:', data)
        setChannels(data)
      } else {
        console.error('❌ Failed to fetch channels:', res.status, await res.text())
      }
    } catch (error) {
      console.error('Error fetching channels:', error)
    } finally {
      setChannelsLoading(false)
    }
  }

  const updateTrackedChannels = async (channelIds: string[]) => {
    try {
      const res = await fetch(`/api/discord/projects/${projectId}/channels`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ trackedChannels: channelIds })
      })
      if (res.ok) {
        await fetchProjectData()
        await fetchChannels()
      }
    } catch (error) {
      console.error('Error updating channels:', error)
    }
  }

  const addChannelById = async () => {
    if (!newChannelId.trim()) return
    
    setAddingChannel(true)
    setChannelError('')
    setChannelSuccess('')
    
    try {
      // Check if channel already exists
      if (project?.trackedChannels.includes(newChannelId.trim())) {
        setChannelError('This channel is already being tracked')
        setAddingChannel(false)
        return
      }
      
      // Try to fetch channel info from Discord
      let channelName = `Channel ${newChannelId.trim()}`
      try {
        const infoRes = await fetch(`/api/discord/projects/${projectId}/fetch-channel`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelId: newChannelId.trim() })
        })
        
        if (infoRes.ok) {
          const channelInfo = await infoRes.json()
          channelName = channelInfo.name || channelName
        }
      } catch (error) {
        console.log('Could not fetch channel name from Discord')
      }
      
      // Add the channel
      const updatedChannels = [...(project?.trackedChannels || []), newChannelId.trim()]
      await updateTrackedChannels(updatedChannels)
      
      setChannelSuccess(`Channel "${channelName}" (${newChannelId.trim()}) added successfully!`)
      setNewChannelId('')
      
      // Clear success message after 3 seconds
      setTimeout(() => setChannelSuccess(''), 3000)
    } catch (error) {
      console.error('Error adding channel:', error)
      setChannelError('Failed to add channel. Please try again.')
    } finally {
      setAddingChannel(false)
    }
  }

  const removeChannel = async (channelId: string) => {
    const updatedChannels = (project?.trackedChannels || []).filter(id => id !== channelId)
    await updateTrackedChannels(updatedChannels)
  }

  const deleteProject = async () => {
    try {
      const res = await fetch(`/api/discord/projects/${projectId}`, {
        method: 'DELETE'
      })
      if (res.ok) {
        router.push('/admin/discord')
      }
    } catch (error) {
      console.error('Error deleting project:', error)
    }
  }

  const generateShareableLink = async () => {
    try {
      // Generate shareable link client-side
      const baseUrl = window.location.origin
      // Convert project ID to URL-safe format (replace : with --)
      const urlSafeId = projectId.replace(/:/g, '--')
      const shareUrl = `${baseUrl}/discord/share/${urlSafeId}?timeframe=${timeframe}`
      setShareableLink(shareUrl)
    } catch (error) {
      console.error('Error generating share link:', error)
    }
  }

  const downloadReport = async () => {
    // TODO: Implement PDF download
    alert('PDF download coming soon!')
  }

  const saveSentimentSettings = async () => {
    setSavingSentimentSettings(true)
    try {
      const res = await fetch(`/api/discord/projects/${projectId}/sentiment-settings`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(sentimentSettings)
      })
      
      if (res.ok) {
        alert('Sentiment settings saved successfully!')
      } else {
        const error = await res.json()
        alert(`Failed to save settings: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Error saving sentiment settings:', error)
      alert('Failed to save sentiment settings')
    } finally {
      setSavingSentimentSettings(false)
    }
  }

  const resetSentimentSettings = () => {
    setSentimentSettings({
      bullishKeywords: '',
      bearishKeywords: '',
      bullishEmojis: '',
      bearishEmojis: '',
      ignoredChannels: [],
      minimumMessageLength: 3
    })
  }

  // Fetch approved users for moderator dropdown
  const fetchApprovedUsers = async () => {
    try {
      const res = await fetch('/api/profiles/approved')
      if (res.ok) {
        const users = await res.json()
        // Filter for team roles only (Team, Core, Admin, Intern)
        const teamUsers = users.filter((user: any) => 
          ['admin', 'core', 'team', 'intern'].includes(user.role)
        )
        setApprovedUsers(teamUsers)
      }
    } catch (error) {
      console.error('Error fetching approved users:', error)
    }
  }

  // Add moderator to project
  const addModerator = async () => {
    if (!selectedMod) {
      alert('Please select a moderator')
      return
    }

    setAddingMod(true)
    try {
      // Find the selected user details
      const modUser = approvedUsers.find(u => u.handle === selectedMod)
      if (!modUser) {
        alert('Selected user not found')
        return
      }

      // Create moderator object with shift info
      const modInfo = {
        handle: modUser.handle,
        name: modUser.name,
        profileImageUrl: modUser.profileImageUrl,
        role: modUser.role,
        timezone: modUser.timezone || 'UTC',
        shift: {
          startTime: modShift.startTime,
          endTime: modShift.endTime,
          timezone: modShift.timezone
        },
        // Future Mod 2FA check-in integration placeholder
        twoFactorEnabled: false,
        lastCheckIn: null
      }

      // Update project with new moderator
      const updatedMods = [...teamMods, JSON.stringify(modInfo)]
      
      const res = await fetch(`/api/discord/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamMods: updatedMods })
      })

      if (res.ok) {
        await fetchProjectData()
        setShowAddModModal(false)
        setSelectedMod('')
        setModShift({ startTime: '', endTime: '', timezone: 'EDT' })
        alert('Moderator added successfully!')
      } else {
        alert('Failed to add moderator')
      }
    } catch (error) {
      console.error('Error adding moderator:', error)
      alert('Error adding moderator')
    } finally {
      setAddingMod(false)
    }
  }

  // Remove moderator from project
  const removeModerator = async (modHandle: string) => {
    try {
      const updatedMods = teamMods.filter(mod => {
        try {
          const modData = JSON.parse(mod)
          return modData.handle !== modHandle
        } catch {
          return mod !== modHandle
        }
      })

      const res = await fetch(`/api/discord/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamMods: updatedMods })
      })

      if (res.ok) {
        await fetchProjectData()
      }
    } catch (error) {
      console.error('Error removing moderator:', error)
    }
  }

  // Convert time between timezones
  const convertTimezone = (time: string, fromTz: string, toTz: string) => {
    // This is a simplified timezone conversion
    // In production, use a library like moment-timezone or date-fns-tz
    const timezoneOffsets: Record<string, number> = {
      'UTC': 0,
      'EDT': -4,
      'EST': -5,
      'PDT': -7,
      'PST': -8,
      'CET': 1,
      'CEST': 2
    }

    if (!time || !timezoneOffsets[fromTz] || !timezoneOffsets[toTz]) {
      return time
    }

    const [hours, minutes] = time.split(':').map(Number)
    const totalMinutes = hours * 60 + minutes
    const offsetDiff = (timezoneOffsets[toTz] - timezoneOffsets[fromTz]) * 60
    const convertedMinutes = totalMinutes + offsetDiff

    const newHours = Math.floor((convertedMinutes + 1440) % 1440 / 60)
    const newMinutes = convertedMinutes % 60

    return `${newHours.toString().padStart(2, '0')}:${newMinutes.toString().padStart(2, '0')}`
  }

  // Load approved users when modal opens
  useEffect(() => {
    if (showAddModModal && approvedUsers.length === 0) {
      fetchApprovedUsers()
    }
  }, [showAddModModal])

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
      fill: true,
      yAxisID: 'y'
    }, {
      label: 'Sentiment Score',
      data: analytics?.metrics.dailyTrend.map(d => d.sentiment) || [],
      borderColor: '#8b5cf6',
      backgroundColor: 'rgba(139, 92, 246, 0.1)',
      fill: false,
      yAxisID: 'y1'
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

  const hourlyActivityData = {
    labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
    datasets: [{
      label: 'Messages by Hour',
      data: analytics?.metrics.hourlyActivity || [],
      backgroundColor: '#3b82f6',
      borderColor: '#3b82f6',
      borderWidth: 1
    }]
  }

  const topUsersData = {
    labels: analytics?.metrics.topUsers.slice(0, 10).map(u => u.username) || [],
    datasets: [{
      label: 'Messages',
      data: analytics?.metrics.topUsers.slice(0, 10).map(u => u.messageCount) || [],
      backgroundColor: '#8b5cf6'
    }, {
      label: 'Avg Sentiment',
      data: analytics?.metrics.topUsers.slice(0, 10).map(u => u.avgSentiment * 100) || [],
      backgroundColor: '#10b981'
    }]
  }

  // Sentiment over time data
  const sentimentTimeData = {
    labels: analytics?.metrics.dailyTrend.map(d => new Date(d.date).toLocaleDateString()) || [],
    datasets: [{
      label: 'Positive',
      data: analytics?.metrics.dailyTrend.map(() => Math.random() * 50 + 30) || [], // TODO: Get real data
      backgroundColor: '#10b981',
      stack: 'Stack 0'
    }, {
      label: 'Neutral',
      data: analytics?.metrics.dailyTrend.map(() => Math.random() * 30 + 20) || [], // TODO: Get real data
      backgroundColor: '#6b7280',
      stack: 'Stack 0'
    }, {
      label: 'Negative',
      data: analytics?.metrics.dailyTrend.map(() => Math.random() * 20 + 10) || [], // TODO: Get real data
      backgroundColor: '#ef4444',
      stack: 'Stack 0'
    }]
  }

  if (loading || session === undefined) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <AlertCircle className="w-16 h-16 mx-auto text-red-400 mb-4" />
          <p className="text-red-400">Project not found</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push('/admin/discord')}
            className="p-2 hover:bg-gray-800 rounded"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-green-400">{project.name}</h1>
            <p className="text-gray-400">{project.serverName}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={refreshAllData}
            className={`flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded ${refreshing ? 'opacity-50' : ''}`}
            disabled={refreshing}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
            className="px-3 py-2 bg-black border border-gray-600 rounded text-white"
          >
            <option value="daily">Last 24 Hours</option>
            <option value="weekly">Last 7 Days</option>
            <option value="monthly">Last 30 Days</option>
            <option value="allTime">All Time</option>
          </select>
          
          <button
            onClick={generateShareableLink}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded"
          >
            <Share2 className="w-4 h-4" />
            Share
          </button>
          
          <button
            onClick={downloadReport}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
          
          <button
            onClick={() => setShowSettings(!showSettings)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
          >
            <Settings className="w-4 h-4" />
            Settings
          </button>
        </div>
      </div>

      {/* Share Link Modal */}
      {shareableLink && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-green-400 mb-4">Share Report</h3>
            <input
              type="text"
              value={shareableLink}
              readOnly
              className="w-full px-3 py-2 bg-black border border-gray-600 rounded text-white mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => {
                  navigator.clipboard.writeText(shareableLink)
                  setCopySuccess(true)
                  setTimeout(() => setCopySuccess(false), 2000)
                }}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded"
              >
                {copySuccess ? 'Copied!' : 'Copy Link'}
              </button>
              <button
                onClick={() => {
                  setShareableLink('')
                  setCopySuccess(false)
                }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Settings Panel */}
      {showSettings && (
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-8">
          <h2 className="text-xl font-semibold text-green-400 mb-4">Project Settings</h2>
          
          {/* Tracked Channels */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-lg text-green-300">Tracked Channels</h3>
            </div>

            {/* Currently Tracked Channels */}
            <div className="space-y-2 mb-4">
              <h4 className="text-sm text-gray-400">Currently Tracking:</h4>
              {loading ? (
                <div className="flex items-center gap-2 text-gray-500">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400"></div>
                  <span>Loading channels...</span>
                </div>
              ) : project?.trackedChannels.length === 0 ? (
                <p className="text-gray-500">No channels being tracked</p>
              ) : (
                project?.trackedChannels.map((channelId) => {
                  const channel = channels.find(ch => ch.id === channelId)
                  return (
                    <div key={channelId} className="flex items-center justify-between bg-black/50 p-2 rounded group">
                      <div className="flex items-center gap-2">
                        <Hash className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-white">
                          {channel?.name && channel.name !== `Channel ${channelId}` 
                            ? channel.name 
                            : `#${channelId}`}
                        </span>
                        {channel?.name && channel.name !== `Channel ${channelId}` && (
                          <span className="text-xs text-gray-500">(ID: {channelId})</span>
                        )}
                      </div>
                      <button
                        onClick={() => removeChannel(channelId)}
                        className="text-red-400 hover:text-red-300 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        Remove
                      </button>
                    </div>
                  )
                })
              )}
            </div>

            {/* Add Channel by ID */}
            <div className="mb-4">
              <h4 className="text-sm text-gray-400 mb-2">Add Channel by ID:</h4>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newChannelId}
                  onChange={(e) => setNewChannelId(e.target.value)}
                  placeholder="Enter channel ID (e.g., 1234567890)"
                  className="flex-1 px-3 py-2 bg-black border border-gray-600 rounded text-white"
                  disabled={addingChannel}
                />
                <button
                  onClick={addChannelById}
                  className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50"
                  disabled={addingChannel || !newChannelId.trim()}
                >
                  {addingChannel ? 'Adding...' : 'Add'}
                </button>
              </div>
              
              {channelError && (
                <p className="text-sm text-red-400 mt-2">{channelError}</p>
              )}
              
              {channelSuccess && (
                <p className="text-sm text-green-400 mt-2">{channelSuccess}</p>
              )}
              
              <p className="text-xs text-gray-500 mt-2">
                To get a channel ID: In Discord, enable Developer Mode (Settings → Advanced → Developer Mode), 
                then right-click any channel and select "Copy ID"
              </p>
            </div>


          </div>
          
          {/* Team Moderators */}
          <div className="mb-6">
            <h3 className="text-lg text-green-300 mb-3">Team Moderators</h3>
            <div className="space-y-2">
              {teamMods.map((mod, index) => {
                let modData: any = null
                try {
                  modData = JSON.parse(mod)
                } catch {
                  // Handle legacy string format
                  modData = { handle: mod, name: mod }
                }
                
                return (
                  <div key={index} className="flex items-center justify-between bg-black/50 p-3 rounded">
                    <div className="flex items-center gap-3 flex-1">
                      {/* Profile Picture */}
                      <div className="relative">
                        {modData.profileImageUrl ? (
                          <img 
                            src={modData.profileImageUrl} 
                            alt={modData.name}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                            <span className="text-sm text-gray-400">
                              {(modData.name || modData.handle || '?')[0].toUpperCase()}
                            </span>
                          </div>
                        )}
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-medium">{modData.name || modData.handle}</span>
                          <span className="text-gray-400 text-sm">@{modData.handle}</span>
                          {/* Role Badge */}
                          {modData.role && (
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              modData.role === 'admin' ? 'bg-red-500/20 text-red-400' :
                              modData.role === 'core' ? 'bg-purple-500/20 text-purple-400' :
                              modData.role === 'team' ? 'bg-green-500/20 text-green-400' :
                              modData.role === 'intern' ? 'bg-blue-500/20 text-blue-400' :
                              'bg-gray-500/20 text-gray-400'
                            }`}>
                              {modData.role.toUpperCase()}
                            </span>
                          )}
                        </div>
                        {modData.shift && (
                          <div className="text-xs text-gray-500 mt-1">
                            Shift: {modData.shift.startTime} - {modData.shift.endTime} {modData.shift.timezone}
                            {modData.timezone && modData.timezone !== modData.shift.timezone && (
                              <span className="ml-2 text-blue-400">
                                ({convertTimezone(modData.shift.startTime, modData.shift.timezone, modData.timezone)} - 
                                {convertTimezone(modData.shift.endTime, modData.shift.timezone, modData.timezone)} {modData.timezone})
                              </span>
                            )}
                          </div>
                        )}
                        {/* Future Mod 2FA check-in integration placeholder */}
                        {modData.twoFactorEnabled && (
                          <div className="text-xs text-yellow-400 mt-1">
                            2FA Enabled • Last check-in: {modData.lastCheckIn || 'Never'}
                          </div>
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => removeModerator(modData.handle)}
                      className="text-red-400 hover:text-red-300 ml-4"
                    >
                      Remove
                    </button>
                  </div>
                )
              })}
              <button 
                onClick={() => setShowAddModModal(true)}
                className="w-full py-2 border border-dashed border-gray-600 rounded hover:border-green-500 transition-colors"
              >
                + Add Moderator
              </button>
            </div>
          </div>

          {/* Sentiment Analysis Settings */}
          <div className="mb-6">
            <h3 className="text-lg text-green-300 mb-3">Sentiment Analysis Settings</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Bullish Keywords (comma-separated)</label>
                <input
                  type="text"
                  value={sentimentSettings.bullishKeywords}
                  onChange={(e) => setSentimentSettings({ ...sentimentSettings, bullishKeywords: e.target.value })}
                  placeholder="moon, pump, bullish, amazing, great"
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded text-white placeholder-gray-500"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Bearish Keywords (comma-separated)</label>
                <input
                  type="text"
                  value={sentimentSettings.bearishKeywords}
                  onChange={(e) => setSentimentSettings({ ...sentimentSettings, bearishKeywords: e.target.value })}
                  placeholder="dump, crash, bearish, terrible, scam"
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded text-white placeholder-gray-500"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Bullish Emojis (comma-separated)</label>
                <input
                  type="text"
                  value={sentimentSettings.bullishEmojis}
                  onChange={(e) => setSentimentSettings({ ...sentimentSettings, bullishEmojis: e.target.value })}
                  placeholder="🚀, 🌙, 💎, 🔥, ✨"
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded text-white placeholder-gray-500"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Bearish Emojis (comma-separated)</label>
                <input
                  type="text"
                  value={sentimentSettings.bearishEmojis}
                  onChange={(e) => setSentimentSettings({ ...sentimentSettings, bearishEmojis: e.target.value })}
                  placeholder="📉, 💩, 🔴, ⬇️, 😢"
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded text-white placeholder-gray-500"
                />
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">Ignored Channels</label>
                <select
                  multiple
                  value={sentimentSettings.ignoredChannels}
                  onChange={(e) => {
                    const selected = Array.from(e.target.selectedOptions, option => option.value)
                    setSentimentSettings({ ...sentimentSettings, ignoredChannels: selected })
                  }}
                  className="w-full px-3 py-2 bg-black border border-gray-600 rounded text-white min-h-[100px]"
                >
                  {channels.map(channel => (
                    <option key={channel.id} value={channel.id}>
                      {channel.name}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">Hold Ctrl/Cmd to select multiple channels</p>
              </div>
              
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  Minimum Message Length: {sentimentSettings.minimumMessageLength}
                </label>
                <input
                  type="range"
                  min="1"
                  max="50"
                  value={sentimentSettings.minimumMessageLength}
                  onChange={(e) => setSentimentSettings({ ...sentimentSettings, minimumMessageLength: parseInt(e.target.value) })}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-gray-500">
                  <span>1 char</span>
                  <span>50 chars</span>
                </div>
              </div>
              
              <div className="flex gap-3 pt-4">
                <button
                  onClick={saveSentimentSettings}
                  disabled={savingSentimentSettings}
                  className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50"
                >
                  {savingSentimentSettings ? 'Saving...' : 'Save Settings'}
                </button>
                <button
                  onClick={resetSentimentSettings}
                  className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          </div>

          {/* Danger Zone */}
          <div className="border-t border-gray-700 pt-6">
            <h3 className="text-lg text-red-400 mb-3">Danger Zone</h3>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
            >
              Delete Project
            </button>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-red-400 mb-4">Delete Project</h3>
            <p className="text-gray-300 mb-6">
              Are you sure you want to delete "{project?.name}"? This will remove all analytics data and cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={deleteProject}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
              >
                Delete
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Moderator Modal */}
      {showAddModModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
          <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-green-400 mb-4">Add Moderator</h3>
            
            {/* Searchable Moderator Dropdown */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-2">Select Moderator</label>
              <input
                type="text"
                value={modSearchQuery}
                onChange={(e) => {
                  setModSearchQuery(e.target.value)
                  // If exact match, select it
                  const exactMatch = approvedUsers.find(u => 
                    u.handle.toLowerCase() === e.target.value.toLowerCase() ||
                    u.name.toLowerCase() === e.target.value.toLowerCase()
                  )
                  if (exactMatch) {
                    setSelectedMod(exactMatch.handle)
                  }
                }}
                placeholder="Search by name or handle..."
                className="w-full px-3 py-2 bg-black border border-gray-600 rounded text-white mb-2"
              />
              
              <select
                value={selectedMod}
                onChange={(e) => setSelectedMod(e.target.value)}
                className="w-full px-3 py-2 bg-black border border-gray-600 rounded text-white"
                size={5}
              >
                <option value="">-- Select a team member --</option>
                {approvedUsers
                  .filter(user => 
                    !modSearchQuery || 
                    user.handle.toLowerCase().includes(modSearchQuery.toLowerCase()) ||
                    user.name.toLowerCase().includes(modSearchQuery.toLowerCase())
                  )
                  .map(user => (
                    <option key={user.handle} value={user.handle}>
                      {user.name} (@{user.handle}) - {
                        user.role === 'admin' ? 'Admin' : 
                        user.role === 'core' ? 'Core' : 
                        user.role === 'team' ? 'Team' :
                        'Intern'
                      }
                    </option>
                  ))
                }
              </select>
            </div>

            {/* Shift Time Settings */}
            <div className="mb-4">
              <h4 className="text-sm text-gray-400 mb-2">Moderator Shift Times</h4>
              
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Start Time</label>
                  <input
                    type="time"
                    value={modShift.startTime}
                    onChange={(e) => setModShift({ ...modShift, startTime: e.target.value })}
                    className="w-full px-2 py-1 bg-black border border-gray-600 rounded text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">End Time</label>
                  <input
                    type="time"
                    value={modShift.endTime}
                    onChange={(e) => setModShift({ ...modShift, endTime: e.target.value })}
                    className="w-full px-2 py-1 bg-black border border-gray-600 rounded text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-500 mb-1">Timezone</label>
                <select
                  value={modShift.timezone}
                  onChange={(e) => setModShift({ ...modShift, timezone: e.target.value })}
                  className="w-full px-2 py-1 bg-black border border-gray-600 rounded text-white"
                >
                  <option value="EDT">EDT (Eastern Daylight)</option>
                  <option value="EST">EST (Eastern Standard)</option>
                  <option value="PDT">PDT (Pacific Daylight)</option>
                  <option value="PST">PST (Pacific Standard)</option>
                  <option value="UTC">UTC (Universal)</option>
                  <option value="CET">CET (Central European)</option>
                  <option value="CEST">CEST (Central European Summer)</option>
                </select>
              </div>
            </div>

            {/* Timezone Conversion Display */}
            {selectedMod && modShift.startTime && modShift.endTime && (
              <div className="bg-black/50 p-3 rounded mb-4">
                <h4 className="text-xs text-gray-400 mb-2">Time Conversions</h4>
                <div className="space-y-1 text-xs">
                  <div>
                    <span className="text-gray-500">EDT:</span>{' '}
                    <span className="text-white">
                      {convertTimezone(modShift.startTime, modShift.timezone, 'EDT')} - 
                      {convertTimezone(modShift.endTime, modShift.timezone, 'EDT')}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">UTC:</span>{' '}
                    <span className="text-white">
                      {convertTimezone(modShift.startTime, modShift.timezone, 'UTC')} - 
                      {convertTimezone(modShift.endTime, modShift.timezone, 'UTC')}
                    </span>
                  </div>
                  {approvedUsers.find(u => u.handle === selectedMod)?.timezone && (
                    <div>
                      <span className="text-gray-500">Mod's Local Time:</span>{' '}
                      <span className="text-white">
                        {convertTimezone(modShift.startTime, modShift.timezone, 
                          approvedUsers.find(u => u.handle === selectedMod)?.timezone || 'UTC')} - 
                        {convertTimezone(modShift.endTime, modShift.timezone, 
                          approvedUsers.find(u => u.handle === selectedMod)?.timezone || 'UTC')}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Future Mod 2FA Integration Notice */}
            <div className="bg-blue-900/20 border border-blue-700 p-3 rounded mb-4 text-xs">
              <p className="text-blue-300">
                ℹ️ Future Feature: Moderator 2FA check-ins will be integrated here
              </p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={addModerator}
                disabled={addingMod || !selectedMod || !modShift.startTime || !modShift.endTime}
                className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded disabled:opacity-50"
              >
                {addingMod ? 'Adding...' : 'Add Moderator'}
              </button>
              <button
                onClick={() => {
                  setShowAddModModal(false)
                  setSelectedMod('')
                  setModSearchQuery('')
                  setModShift({ startTime: '', endTime: '', timezone: 'EDT' })
                }}
                className="flex-1 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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
            {analytics ? (
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
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                {analyticsLoading ? 'Loading...' : 'No data available'}
              </div>
            )}
          </div>
        </div>

        {/* Sentiment Distribution */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg text-green-400 mb-4">Sentiment Distribution</h3>
          <div className="h-64">
            {analytics ? (
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
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                {analyticsLoading ? 'Loading...' : 'No data available'}
              </div>
            )}
          </div>
        </div>

        {/* Channel Activity */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg text-green-400 mb-4">Channel Activity</h3>
          <div className="h-64">
            {analytics ? (
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
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500">
                {analyticsLoading ? 'Loading...' : 'No data available'}
              </div>
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
                    <span className="text-white">{user.username}</span>
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

      {/* Additional Analytics Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
        {/* Hourly Activity Pattern */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg text-green-400 mb-4">24-Hour Activity Pattern</h3>
          <div className="h-64">
            {analytics && (
              <Bar
                data={hourlyActivityData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { display: false },
                    tooltip: {
                      callbacks: {
                        label: (context: any) => `${context.parsed.y} messages`
                      }
                    }
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
          <p className="text-xs text-gray-500 mt-2">Peak activity hours in server timezone</p>
        </div>

        {/* Top Users Bar Chart */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6">
          <h3 className="text-lg text-green-400 mb-4">Top Users Analysis</h3>
          <div className="h-64">
            {analytics && (
              <Bar
                data={topUsersData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { 
                      position: 'bottom' as const,
                      labels: { color: '#9ca3af' }
                    }
                  },
                  scales: {
                    y: {
                      beginAtZero: true,
                      grid: { color: 'rgba(107, 114, 128, 0.2)' },
                      ticks: { color: '#9ca3af' }
                    },
                    x: {
                      grid: { color: 'rgba(107, 114, 128, 0.2)' },
                      ticks: { 
                        color: '#9ca3af',
                        maxRotation: 45,
                        minRotation: 45
                      }
                    }
                  }
                }}
              />
            )}
          </div>
        </div>

        {/* Sentiment Over Time */}
        <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 lg:col-span-2">
          <h3 className="text-lg text-green-400 mb-4">Sentiment Evolution</h3>
          <div className="h-64">
            {analytics && (
              <Bar
                data={sentimentTimeData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: {
                    legend: { 
                      position: 'bottom' as const,
                      labels: { color: '#9ca3af' }
                    },
                    tooltip: {
                      mode: 'index' as const,
                      intersect: false
                    }
                  },
                  scales: {
                    y: {
                      stacked: true,
                      beginAtZero: true,
                      max: 100,
                      grid: { color: 'rgba(107, 114, 128, 0.2)' },
                      ticks: { 
                        color: '#9ca3af',
                        callback: (value: any) => `${value}%`
                      }
                    },
                    x: {
                      stacked: true,
                      grid: { color: 'rgba(107, 114, 128, 0.2)' },
                      ticks: { color: '#9ca3af' }
                    }
                  }
                }}
              />
            )}
          </div>
          <p className="text-xs text-gray-500 mt-2">Sentiment distribution over time as percentage of daily messages</p>
        </div>
      </div>

      {/* Message Activity Heatmap - Placeholder for future */}
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-6 mb-8">
        <h3 className="text-lg text-green-400 mb-4">Activity Insights</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <h4 className="text-sm text-gray-400 mb-2">Most Active Day</h4>
            <p className="text-2xl font-bold text-white">
              {analytics?.metrics.dailyTrend.reduce((max, day) => 
                day.messages > (max?.messages || 0) ? day : max, 
                analytics.metrics.dailyTrend[0]
              )?.date ? new Date(analytics.metrics.dailyTrend.reduce((max, day) => 
                day.messages > (max?.messages || 0) ? day : max, 
                analytics.metrics.dailyTrend[0]
              ).date).toLocaleDateString() : 'N/A'}
            </p>
            <p className="text-sm text-gray-500">
              {analytics?.metrics.dailyTrend.reduce((max, day) => 
                day.messages > (max?.messages || 0) ? day : max, 
                analytics.metrics.dailyTrend[0]
              )?.messages || 0} messages
            </p>
          </div>

          <div>
            <h4 className="text-sm text-gray-400 mb-2">Peak Hour</h4>
            <p className="text-2xl font-bold text-white">
              {analytics?.metrics.hourlyActivity ? 
                `${analytics.metrics.hourlyActivity.indexOf(Math.max(...analytics.metrics.hourlyActivity))}:00` : 
                'N/A'
              }
            </p>
            <p className="text-sm text-gray-500">
              {analytics?.metrics.hourlyActivity ? 
                Math.max(...analytics.metrics.hourlyActivity) : 0
              } messages/hour avg
            </p>
          </div>

          <div>
            <h4 className="text-sm text-gray-400 mb-2">Most Active Channel</h4>
            <p className="text-2xl font-bold text-white">
              {analytics?.metrics.channelActivity[0]?.channelName || 'N/A'}
            </p>
            <p className="text-sm text-gray-500">
              {analytics?.metrics.channelActivity[0]?.messageCount || 0} messages
            </p>
          </div>
        </div>
      </div>
    </div>
  )
} 