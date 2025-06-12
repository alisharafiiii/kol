'use client'

import { useRouter } from 'next/navigation'
import type { Campaign } from '@/lib/campaign'
import { useEffect, useState } from 'react'
import type { Project } from '@/lib/project'

interface CampaignCardProps {
  campaign: Campaign
  onDelete: (id: string) => void
  currentUser?: string
}

// Shared cache for projects
let projectsCache: Project[] | null = null
let projectsCacheTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

export default function CampaignCard({ campaign, onDelete, currentUser }: CampaignCardProps) {
  const router = useRouter()
  const [firstProject, setFirstProject] = useState<Project | null>(null)
  const [totalBudget, setTotalBudget] = useState<number>(0)
  const [isNavigating, setIsNavigating] = useState(false)
  
  const isOwner = currentUser === campaign.createdBy
  const isTeamMember = campaign.teamMembers.includes(currentUser || '')
  const canEdit = isOwner || isTeamMember
  
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }
  
  const getStatusColor = (status: Campaign['status']) => {
    switch (status) {
      case 'active': return 'text-green-400'
      case 'completed': return 'text-blue-400'
      case 'cancelled': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }
  
  const handleNavigation = (path: string) => {
    if (isNavigating) return
    setIsNavigating(true)
    router.push(path)
  }
  
  useEffect(() => {
    const fetchProject = async () => {
      if (campaign.projects.length === 0) return
      
      try {
        let list: Project[] = []
        
        // Check if cache is valid
        if (projectsCache && Date.now() - projectsCacheTime < CACHE_DURATION) {
          list = projectsCache
        } else {
          // Fetch fresh data
          const res = await fetch('/api/projects/all')
          const data = await res.json()
          list = Array.isArray(data) ? data : data?.projects || []
          
          // Update cache
          projectsCache = list
          projectsCacheTime = Date.now()
        }
        
        const proj = list.find(p => p.id === campaign.projects[0]) || null
        setFirstProject(proj)
      } catch (error) {
        console.error('Error fetching project:', error)
      }
    }
    fetchProject()
  }, [campaign.projects])

  // Calculate total budget from project budgets
  useEffect(() => {
    if (campaign.projectBudgets) {
      const total = Object.values(campaign.projectBudgets).reduce((sum, budget) => {
        const usdAmount = parseFloat(budget.usd) || 0
        return sum + usdAmount
      }, 0)
      setTotalBudget(total)
    }
  }, [campaign.projectBudgets])
  
  return (
    <div className="border border-green-300 p-4 hover:bg-green-950 transition-colors font-sans">
      <div className="flex justify-between items-start mb-3">
        <h3 
          className="text-lg font-bold cursor-pointer hover:text-green-400"
          onClick={() => handleNavigation(`/campaigns/${campaign.slug}`)}
        >
          {campaign.name}
        </h3>
        <span className={`text-xs uppercase ${getStatusColor(campaign.status)}`}>
          {campaign.status}
        </span>
      </div>
      
      <div className="space-y-2 text-xs">
        {firstProject && (
          <div className="flex items-center gap-2">
            <img
              src={firstProject.profileImageUrl || `https://unavatar.io/twitter/${firstProject.twitterHandle}`}
              alt={firstProject.twitterHandle}
              className="w-12 h-12 rounded-full"
              loading="lazy"
            />
            <span className="text-xs">@{firstProject.twitterHandle.replace('@', '')}</span>
          </div>
        )}
        
        <div className="flex justify-between">
          <span className="text-gray-500">Period:</span>
          <span>{formatDate(campaign.startDate)} - {formatDate(campaign.endDate)}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-500">Budget:</span>
          <span>${totalBudget.toLocaleString()} USD</span>
        </div>
        
        {/* Campaign metadata */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2 py-1 bg-yellow-900 border border-yellow-300 text-yellow-300">
            {campaign.projects.length} PROJECTS
          </span>
          {campaign.chains && campaign.chains.length > 0 && (
            <span className="px-2 py-1 bg-yellow-900 border border-yellow-300 text-yellow-300">
              {campaign.chains.join(', ')}
            </span>
          )}
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-500">KOLs:</span>
          <span>{campaign.kols.length}</span>
        </div>
        
        <div className="flex justify-between">
          <span className="text-gray-500">Created by:</span>
          <span>@{campaign.createdBy}</span>
        </div>
        
        {campaign.teamMembers.length > 0 && (
          <div>
            <span className="text-gray-500">Team:</span>
            <div className="mt-2 flex -space-x-3">
              {campaign.teamMembers.slice(0, 5).map(member => (
                <img
                  key={member}
                  src={`https://unavatar.io/twitter/${member}`}
                  alt={member}
                  className="w-12 h-12 rounded-full border-2 border-black"
                  loading="lazy"
                  title={`@${member}`}
                />
              ))}
              {campaign.teamMembers.length > 5 && (
                <div className="w-12 h-12 rounded-full bg-gray-700 border-2 border-black flex items-center justify-center text-xs">
                  +{campaign.teamMembers.length - 5}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      <div className="mt-4 flex gap-2">
        <button
          onClick={() => handleNavigation(`/campaigns/${campaign.slug}`)}
          disabled={isNavigating}
          className={`flex-1 px-3 py-1 border border-green-300 hover:bg-green-900 text-xs transition-all ${
            isNavigating ? 'opacity-50 cursor-not-allowed' : ''
          }`}
        >
          {isNavigating ? 'Loading...' : 'View Details'}
        </button>
        {canEdit && (
          <>
            <button
              onClick={() => handleNavigation(`/campaigns/${campaign.slug}/kols`)}
              disabled={isNavigating}
              className={`px-3 py-1 border border-green-300 hover:bg-green-900 text-xs ${
                isNavigating ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              KOLs
            </button>
            <button
              onClick={() => handleNavigation(`/campaigns/${campaign.slug}/analytics`)}
              disabled={isNavigating}
              className={`px-3 py-1 border border-purple-300 text-purple-300 hover:bg-purple-900 text-xs ${
                isNavigating ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => handleNavigation(`/campaigns/${campaign.slug}/edit`)}
              disabled={isNavigating}
              className={`px-3 py-1 border border-green-300 hover:bg-green-900 text-xs ${
                isNavigating ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              Edit
            </button>
          </>
        )}
        {isOwner && (
          <button
            onClick={() => onDelete(campaign.id)}
            disabled={isNavigating}
            className={`px-3 py-1 border border-red-500 text-red-500 hover:bg-red-900 text-xs ${
              isNavigating ? 'opacity-50 cursor-not-allowed' : ''
            }`}
          >
            Delete
          </button>
        )}
      </div>
    </div>
  )
} 