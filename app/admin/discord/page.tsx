'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Plus, Settings, Bot, TrendingUp, MessageSquare, Users } from 'lucide-react'
import type { DiscordProject } from '@/lib/types/discord'

export default function DiscordAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [projects, setProjects] = useState<DiscordProject[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [geminiKey, setGeminiKey] = useState('')
  const [updatingKey, setUpdatingKey] = useState(false)
  const [scoutProjects, setScoutProjects] = useState<any[]>([])

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

  // Fetch Discord projects
  useEffect(() => {
    // Only fetch if authenticated
    if (status === 'authenticated') {
      fetchProjects()
      fetchGeminiKey()
      fetchScoutProjects()
    }
  }, [status])

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
        <h1 className="text-3xl font-bold text-green-400 mb-2">Discord Analytics</h1>
        <p className="text-gray-400">Manage Discord servers and view sentiment analytics</p>
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
                onClick={() => router.push(`/admin/discord/${project.id}`)}
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