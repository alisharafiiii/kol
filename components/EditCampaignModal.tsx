'use client'

import { useState, useEffect } from 'react'
import { X, Save, Calendar, Users, Briefcase, AlertCircle } from '@/components/icons'
import type { Campaign } from '@/lib/campaign'
import type { Project } from '@/lib/project'

interface EditCampaignModalProps {
  campaign: Campaign
  projects: Project[]
  onClose: () => void
  onSave: (updates: Partial<Campaign>) => Promise<void>
}

interface ApprovedUser {
  handle: string
  name: string
  profileImageUrl: string
}

export default function EditCampaignModal({ campaign, projects, onClose, onSave }: EditCampaignModalProps) {
  const [formData, setFormData] = useState({
    name: campaign.name,
    startDate: campaign.startDate.split('T')[0],
    endDate: campaign.endDate.split('T')[0],
    status: campaign.status,
    chains: campaign.chains || [],
    projects: campaign.projects || [],
    teamMembers: campaign.teamMembers || [],
  })
  
  const [newTeamMember, setNewTeamMember] = useState('')
  const [customChain, setCustomChain] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Team member autocomplete
  const [approvedUsers, setApprovedUsers] = useState<ApprovedUser[]>([])
  const [showTeamMemberDropdown, setShowTeamMemberDropdown] = useState(false)
  const [loadingUsers, setLoadingUsers] = useState(false)
  
  // Project search
  const [projectSearch, setProjectSearch] = useState('')
  const [showProjectDropdown, setShowProjectDropdown] = useState(false)
  
  // Fetch approved users for team member autocomplete
  useEffect(() => {
    const fetchApprovedUsers = async () => {
      setLoadingUsers(true)
      try {
        const res = await fetch('/api/profiles/approved')
        if (res.ok) {
          const data = await res.json()
          setApprovedUsers(data.profiles || [])
        }
      } catch (error) {
        console.error('Error fetching approved users:', error)
      } finally {
        setLoadingUsers(false)
      }
    }
    fetchApprovedUsers()
  }, [])
  
  const filteredProjects = projects.filter(p => 
    !formData.projects.includes(p.id) &&
    ((p.twitterHandle?.toLowerCase().includes(projectSearch.toLowerCase()) || false) ||
     (p.notes?.toLowerCase().includes(projectSearch.toLowerCase()) || false))
  )
  
  const selectedProjects = projects.filter(p => formData.projects.includes(p.id))
  
  // Filter approved users for team member suggestions
  const filteredUsers = approvedUsers.filter(user => 
    !formData.teamMembers.includes(user.handle) &&
    (user.handle.toLowerCase().includes(newTeamMember.toLowerCase()) ||
     user.name?.toLowerCase().includes(newTeamMember.toLowerCase()))
  )
  
  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    
    // Validation
    if (!formData.name.trim()) {
      setError('Campaign name is required')
      return
    }
    
    if (new Date(formData.startDate) > new Date(formData.endDate)) {
      setError('End date must be after start date')
      return
    }
    
    setSaving(true)
    try {
      const updateData = {
        name: formData.name.trim(),
        startDate: new Date(formData.startDate).toISOString(),
        endDate: new Date(formData.endDate).toISOString(),
        status: formData.status,
        chains: formData.chains,
        projects: formData.projects,
        teamMembers: formData.teamMembers,
      }
      
      console.log('EditCampaignModal: Saving campaign updates:', updateData)
      
      await onSave(updateData)
      
      console.log('EditCampaignModal: Save completed successfully')
      setSaving(false)
      // Don't close here - let the parent handle it after successful save
    } catch (err: any) {
      console.error('EditCampaignModal: Save error:', err)
      setError(err.message || 'Failed to save campaign')
      setSaving(false)
    }
  }
  
  // Add team member
  const addTeamMember = (handle?: string) => {
    const memberToAdd = handle || newTeamMember.trim()
    if (!memberToAdd) return
    
    // Clean up handle
    let cleanHandle = memberToAdd
    if (cleanHandle.startsWith('@')) {
      cleanHandle = cleanHandle.substring(1)
    }
    
    // Check if already exists
    if (formData.teamMembers.includes(cleanHandle)) {
      setError('Team member already added')
      return
    }
    
    setFormData({
      ...formData,
      teamMembers: [...formData.teamMembers, cleanHandle]
    })
    setNewTeamMember('')
    setShowTeamMemberDropdown(false)
    setError(null)
  }
  
  // Remove team member
  const removeTeamMember = (handle: string) => {
    setFormData({
      ...formData,
      teamMembers: formData.teamMembers.filter(h => h !== handle)
    })
  }
  
  // Add project
  const addProject = (projectId: string) => {
    setFormData({
      ...formData,
      projects: [...formData.projects, projectId]
    })
    setProjectSearch('')
    setShowProjectDropdown(false)
  }
  
  // Remove project
  const removeProject = (projectId: string) => {
    setFormData({
      ...formData,
      projects: formData.projects.filter(id => id !== projectId)
    })
  }
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-black border border-green-500 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-green-500">
          <h2 className="text-xl font-bold text-green-300">Edit Campaign</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-green-900/50 rounded transition-colors"
          >
            <X className="w-5 h-5 text-green-300" />
          </button>
        </div>
        
        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {error && (
            <div className="mb-4 p-3 bg-red-900/20 border border-red-500 rounded flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}
          
          {/* Campaign Name */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-green-300 mb-2">
              Campaign Name
            </label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
              placeholder="Enter campaign name"
              required
            />
          </div>
          
          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-green-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Start Date
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 focus:outline-none focus:border-green-400"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-green-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                End Date
              </label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 focus:outline-none focus:border-green-400"
                required
              />
            </div>
          </div>
          
          {/* Status */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-green-300 mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as Campaign['status'] })}
              className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 focus:outline-none focus:border-green-400"
            >
              <option value="draft">Draft</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          
          {/* Chains */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-green-300 mb-2">
              Chains
            </label>
            
            {/* Selected chains */}
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.chains.map(chain => (
                <span
                  key={chain}
                  className="px-2 py-1 bg-yellow-900 border border-yellow-300 text-yellow-300 text-xs flex items-center gap-1"
                >
                  {chain}
                  <button
                    type="button"
                    onClick={() => setFormData({
                      ...formData,
                      chains: formData.chains.filter(c => c !== chain)
                    })}
                    className="text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
            
            {/* Chain options */}
            <div className="grid grid-cols-4 gap-2 mb-2">
              {['Solana', 'Ethereum', 'Polygon', 'BSC', 'Arbitrum', 'Optimism', 'Avalanche', 'Base'].map(chain => (
                <button
                  key={chain}
                  type="button"
                  onClick={() => {
                    if (!formData.chains.includes(chain)) {
                      setFormData({
                        ...formData,
                        chains: [...formData.chains, chain]
                      })
                    }
                  }}
                  className={`px-2 py-1 border text-xs ${
                    formData.chains.includes(chain)
                      ? 'border-yellow-500 bg-yellow-900/50 text-yellow-300'
                      : 'border-green-300 hover:bg-green-900'
                  }`}
                  disabled={formData.chains.includes(chain)}
                >
                  {chain}
                </button>
              ))}
            </div>
            
            {/* Add custom chain */}
            <div className="flex gap-2">
              <input
                type="text"
                value={customChain}
                onChange={(e) => setCustomChain(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    if (customChain && !formData.chains.includes(customChain)) {
                      setFormData({
                        ...formData,
                        chains: [...formData.chains, customChain]
                      })
                      setCustomChain('')
                    }
                  }
                }}
                placeholder="Add custom chain..."
                className="flex-1 px-3 py-1 bg-black border border-green-300 text-green-300 text-xs focus:outline-none focus:border-green-400"
              />
              <button
                type="button"
                onClick={() => {
                  if (customChain && !formData.chains.includes(customChain)) {
                    setFormData({
                      ...formData,
                      chains: [...formData.chains, customChain]
                    })
                    setCustomChain('')
                  }
                }}
                className="px-3 py-1 bg-green-900 border border-green-300 text-xs hover:bg-green-800"
              >
                Add
              </button>
            </div>
          </div>
          
          {/* Team Members */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-green-300 mb-2">
              <Users className="w-4 h-4 inline mr-1" />
              Team Members
            </label>
            
            <div className="relative">
              <div className="flex gap-2 mb-3">
                <input
                  type="text"
                  value={newTeamMember}
                  onChange={(e) => {
                    setNewTeamMember(e.target.value)
                    setShowTeamMemberDropdown(e.target.value.length > 0)
                  }}
                  onFocus={() => setShowTeamMemberDropdown(newTeamMember.length > 0)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTeamMember()
                    }
                  }}
                  placeholder="@handle or search by name"
                  className="flex-1 px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                />
                <button
                  type="button"
                  onClick={() => addTeamMember()}
                  className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors"
                >
                  Add
                </button>
              </div>
              
              {/* Team member dropdown */}
              {showTeamMemberDropdown && newTeamMember && (
                <div className="absolute top-full mt-1 w-full bg-black border border-green-500 rounded-lg max-h-48 overflow-y-auto z-10">
                  {loadingUsers ? (
                    <div className="p-3 text-center text-green-400 text-sm">Loading users...</div>
                  ) : filteredUsers.length > 0 ? (
                    filteredUsers.slice(0, 10).map(user => (
                      <button
                        key={user.handle}
                        type="button"
                        onClick={() => addTeamMember(user.handle)}
                        className="w-full px-3 py-2 text-left hover:bg-green-900/30 transition-colors flex items-center gap-3"
                      >
                        <img
                          src={user.profileImageUrl || `https://unavatar.io/twitter/${user.handle}`}
                          alt={user.handle}
                          className="w-8 h-8 rounded-full"
                        />
                        <div className="flex-1">
                          <div className="text-sm text-green-300">@{user.handle}</div>
                          {user.name && (
                            <div className="text-xs text-green-500">{user.name}</div>
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="p-3 text-center text-green-500 text-sm">
                      No approved users found. You can still add any handle manually.
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="flex flex-wrap gap-2">
              {formData.teamMembers.map(handle => (
                <div
                  key={handle}
                  className="flex items-center gap-2 px-3 py-1 bg-green-900/30 border border-green-500 rounded"
                >
                  <img
                    src={`https://unavatar.io/twitter/${handle}`}
                    alt={handle}
                    className="w-5 h-5 rounded-full"
                  />
                  <span className="text-sm text-green-300">@{handle}</span>
                  <button
                    type="button"
                    onClick={() => removeTeamMember(handle)}
                    className="text-red-400 hover:text-red-300"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
          
          {/* Projects */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-green-300 mb-2">
              <Briefcase className="w-4 h-4 inline mr-1" />
              Projects
            </label>
            
            <div className="relative mb-3">
              <input
                type="text"
                value={projectSearch}
                onChange={(e) => setProjectSearch(e.target.value)}
                onFocus={() => setShowProjectDropdown(true)}
                placeholder="Search projects..."
                className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
              />
              
              {showProjectDropdown && projectSearch && filteredProjects.length > 0 && (
                <div className="absolute top-full mt-1 w-full bg-black border border-green-500 rounded-lg max-h-48 overflow-y-auto z-10">
                  {filteredProjects.slice(0, 10).map(project => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => addProject(project.id)}
                      className="w-full px-3 py-2 text-left hover:bg-green-900/30 transition-colors flex items-center gap-3"
                    >
                      <img
                        src={project.profileImageUrl || `https://unavatar.io/twitter/${project.twitterHandle}`}
                        alt={project.twitterHandle}
                        className="w-8 h-8 rounded-full"
                      />
                      <div className="flex-1">
                        <div className="text-sm text-green-300">@{project.twitterHandle.replace('@', '')}</div>
                        {project.notes && (
                          <div className="text-xs text-green-500">{project.notes}</div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="space-y-2">
              {selectedProjects.map(project => (
                <div
                  key={project.id}
                  className="flex items-center gap-3 p-2 bg-green-900/30 border border-green-500 rounded"
                >
                  <img
                    src={project.profileImageUrl || `https://unavatar.io/twitter/${project.twitterHandle}`}
                    alt={project.twitterHandle}
                    className="w-10 h-10 rounded-full"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-green-300">
                      @{project.twitterHandle.replace('@', '')}
                    </div>
                    {project.notes && (
                      <div className="text-xs text-green-500">{project.notes}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeProject(project.id)}
                    className="text-red-400 hover:text-red-300 text-xl"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        </form>
        
        {/* Footer */}
        <div className="p-4 border-t border-green-500 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-green-300 hover:text-green-100 transition-colors"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {saving ? (
              <>
                <div className="w-4 h-4 border-2 border-green-100 border-t-transparent rounded-full animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
      
      {/* Click outside to close dropdowns */}
      {(showProjectDropdown || showTeamMemberDropdown) && (
        <div
          className="fixed inset-0 z-0"
          onClick={() => {
            setShowProjectDropdown(false)
            setShowTeamMemberDropdown(false)
          }}
        />
      )}
    </div>
  )
} 