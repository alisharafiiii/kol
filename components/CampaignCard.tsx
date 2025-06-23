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
      case 'active': return 'text-green-400 bg-green-900/20 border-green-400'
      case 'completed': return 'text-blue-400 bg-blue-900/20 border-blue-400'
      case 'cancelled': return 'text-red-400 bg-red-900/20 border-red-400'
      default: return 'text-gray-400 bg-gray-900/20 border-gray-400'
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
    <div className="border border-green-300 p-4 md:p-6 hover:bg-green-950 transition-colors font-sans h-full flex flex-col">
      {/* Header Section */}
      <div className="flex justify-between items-start mb-4 gap-2">
        <h3 
          className="text-base md:text-lg font-bold cursor-pointer hover:text-green-400 transition-colors line-clamp-2 flex-1"
          onClick={() => handleNavigation(`/campaigns/${campaign.slug}`)}
        >
          {campaign.name}
        </h3>
        <span className={`text-xs uppercase px-2 py-1 border rounded-full whitespace-nowrap ${getStatusColor(campaign.status)}`}>
          {campaign.status}
        </span>
      </div>
      
      {/* Content Section - Grows to fill space */}
      <div className="space-y-3 text-xs md:text-sm flex-1">
        {/* Project Avatar Section */}
        {firstProject && (
          <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
            <img
              src={firstProject.profileImageUrl || `https://unavatar.io/twitter/${firstProject.twitterHandle}`}
              alt={firstProject.twitterHandle}
              className="w-10 h-10 md:w-12 md:h-12 rounded-full flex-shrink-0 border-2 border-green-300"
              loading="lazy"
            />
            <span className="text-sm truncate">@{firstProject.twitterHandle.replace('@', '')}</span>
          </div>
        )}
        
        {/* Stats Grid - Responsive */}
        <div className="grid grid-cols-2 gap-2 p-3 bg-gray-900/30 rounded-lg">
          <div className="space-y-1">
            <span className="text-gray-500 block text-xs">Period</span>
            <span className="text-green-300 block text-xs md:text-sm">{formatDate(campaign.startDate)}</span>
            <span className="text-green-300 block text-xs md:text-sm">to {formatDate(campaign.endDate)}</span>
          </div>
          
          <div className="space-y-1 text-right">
            <span className="text-gray-500 block text-xs">Budget</span>
            <span className="text-green-300 block text-sm md:text-base font-bold">${totalBudget.toLocaleString()}</span>
            <span className="text-gray-500 block text-xs">USD</span>
          </div>
        </div>
        
        {/* Campaign Metadata - Responsive Pills */}
        <div className="flex flex-wrap gap-2">
          <span className="px-2 py-1 bg-yellow-900/30 border border-yellow-300 text-yellow-300 rounded-full text-xs">
            {campaign.projects.length} {campaign.projects.length === 1 ? 'PROJECT' : 'PROJECTS'}
          </span>
          {campaign.chains && campaign.chains.length > 0 && (
            <span className="px-2 py-1 bg-blue-900/30 border border-blue-300 text-blue-300 rounded-full text-xs">
              {campaign.chains.join(', ')}
            </span>
          )}
          <span className="px-2 py-1 bg-purple-900/30 border border-purple-300 text-purple-300 rounded-full text-xs">
            {campaign.kols.length} {campaign.kols.length === 1 ? 'KOL' : 'KOLs'}
          </span>
        </div>
        
        {/* Creator Info */}
        <div className="pt-2 border-t border-gray-800">
          <div className="flex justify-between items-center">
            <span className="text-gray-500 text-xs">Created by</span>
            <span className="text-green-300 text-xs">@{campaign.createdBy}</span>
          </div>
        </div>
        
        {/* Team Members - Show only on larger screens or if few members */}
        {campaign.teamMembers.length > 0 && campaign.teamMembers.length <= 3 && (
          <div className="pt-2">
            <span className="text-gray-500 text-xs block mb-2">Team ({campaign.teamMembers.length})</span>
            <div className="flex -space-x-2">
              {campaign.teamMembers.slice(0, 5).map(member => (
                <img
                  key={member}
                  src={`https://unavatar.io/twitter/${member}`}
                  alt={member}
                  className="w-8 h-8 md:w-10 md:h-10 rounded-full border-2 border-black"
                  loading="lazy"
                  title={`@${member}`}
                />
              ))}
              {campaign.teamMembers.length > 5 && (
                <div className="w-8 h-8 md:w-10 md:h-10 rounded-full bg-gray-700 border-2 border-black flex items-center justify-center text-xs">
                  +{campaign.teamMembers.length - 5}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
      
      {/* Action Buttons - Responsive Grid */}
      <div className="mt-4 grid grid-cols-2 md:flex gap-2">
        <button
          onClick={() => handleNavigation(`/campaigns/${campaign.slug}`)}
          disabled={isNavigating}
          className={`col-span-2 md:col-span-1 flex-1 px-3 py-2 border border-green-300 hover:bg-green-900 text-xs md:text-sm transition-all rounded ${
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
              className={`px-3 py-2 border border-green-300 hover:bg-green-900 text-xs md:text-sm rounded ${
                isNavigating ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              KOLs
            </button>
            <button
              onClick={() => handleNavigation(`/campaigns/${campaign.slug}/analytics`)}
              disabled={isNavigating}
              className={`px-3 py-2 border border-purple-300 text-purple-300 hover:bg-purple-900 text-xs md:text-sm rounded ${
                isNavigating ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              Analytics
            </button>
            <button
              onClick={() => handleNavigation(`/campaigns/${campaign.slug}/edit`)}
              disabled={isNavigating}
              className={`px-3 py-2 border border-green-300 hover:bg-green-900 text-xs md:text-sm rounded ${
                isNavigating ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              Edit
            </button>
            {isOwner && (
              <button
                onClick={() => onDelete(campaign.id)}
                disabled={isNavigating}
                className={`px-3 py-2 border border-red-500 text-red-500 hover:bg-red-900 text-xs md:text-sm rounded ${
                  isNavigating ? 'opacity-50 cursor-not-allowed' : ''
                }`}
              >
                Delete
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
} 