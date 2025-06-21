'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import type { UnifiedProfile, CampaignParticipation } from '@/lib/types/profile'
import { UserContracts } from '@/components/UserContracts'

export default function ProfilePage({ params }: { params: { handle: string } }) {
  const { data: session } = useSession()
  const router = useRouter()
  const [profile, setProfile] = useState<UnifiedProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'campaigns' | 'metrics' | 'contracts'>('overview')
  
  // Check if viewing own profile
  const isOwnProfile = session?.user?.name === params.handle || 
                      (session as any)?.twitterHandle === params.handle ||
                      (session as any)?.twitterHandle === `@${params.handle}`
  
  useEffect(() => {
    loadProfile()
  }, [params.handle])
  
  const loadProfile = async () => {
    try {
      setLoading(true)
      setError(null)
      
      const res = await fetch(`/api/profile/${params.handle}`)
      if (!res.ok) {
        if (res.status === 404) {
          throw new Error('Profile not found')
        }
        throw new Error('Failed to load profile')
      }
      
      const data = await res.json()
      console.log('Profile data received:', {
        handle: data.twitterHandle,
        hasDiscordInSocialAccounts: !!data.socialAccounts?.discord,
        discordUsername: data.socialAccounts?.discord?.username || data.discordUsername,
        discordId: data.socialAccounts?.discord?.id || data.discordId,
        socialAccounts: data.socialAccounts,
        points: data.points,
        hasPoints: 'points' in data
      })
      setProfile(data)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }
  
  const getTierColor = (tier: string) => {
    switch (tier) {
      case 'hero': return 'text-yellow-300 bg-yellow-900/50'
      case 'legend': return 'text-orange-300 bg-orange-900/50'
      case 'star': return 'text-blue-300 bg-blue-900/50'
      case 'rising': return 'text-green-300 bg-green-900/50'
      case 'micro': return 'text-gray-300 bg-gray-900/50'
      default: return 'text-gray-300 bg-gray-900/50'
    }
  }
  
  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'text-red-300 bg-red-900/50'
      case 'core': return 'text-purple-300 bg-purple-900/50'
      case 'team': return 'text-blue-300 bg-blue-900/50'
      case 'kol': return 'text-green-300 bg-green-900/50'
      case 'scout': return 'text-yellow-300 bg-yellow-900/50'
      default: return 'text-gray-300 bg-gray-900/50'
    }
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-green-300 flex items-center justify-center">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 border-2 border-green-300 border-t-transparent rounded-full animate-spin" />
          <span>Loading profile...</span>
        </div>
      </div>
    )
  }
  
  if (error || !profile) {
    return (
      <div className="min-h-screen bg-black text-green-300 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
            <p className="text-red-400 mb-4">{error || 'Profile not found'}</p>
            <button
              onClick={() => router.push('/')}
              className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors"
            >
              Go Home
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-black text-green-300 p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row items-start md:items-center gap-6">
            {/* Profile Image */}
            <div className="relative">
              <img
                src={profile.profileImageUrl || `https://unavatar.io/twitter/${profile.twitterHandle}`}
                alt={profile.name}
                className="w-24 h-24 md:w-32 md:h-32 rounded-full border-4 border-green-500"
              />
              {profile.approvalStatus === 'approved' && (
                <div className="absolute -bottom-2 -right-2 bg-green-900 border-2 border-green-300 rounded-full p-1">
                  <svg className="w-6 h-6 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
              )}
            </div>
            
            {/* Profile Info */}
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-2">
                <h1 className="text-2xl md:text-3xl font-bold text-green-300">{profile.name}</h1>
                {profile.role && (
                  <span className={`px-3 py-1 text-xs rounded-full ${getRoleColor(profile.role)}`}>
                    {profile.role.toUpperCase()}
                  </span>
                )}
                {profile.currentTier && (
                  <span className={`px-3 py-1 text-xs rounded-full ${getTierColor(profile.currentTier)}`}>
                    {profile.currentTier.toUpperCase()}
                  </span>
                )}
              </div>
              
              <p className="text-green-400 mb-2">@{profile.twitterHandle}</p>
              
              {profile.bio && (
                <p className="text-green-300 mb-4 max-w-2xl">{profile.bio}</p>
              )}
              
              {/* Quick Stats */}
              <div className="flex flex-wrap gap-4">
                <div>
                  <span className="text-green-500 text-sm">Points</span>
                  <p className="text-xl font-bold">{profile.points || 0}</p>
                </div>
                {profile.isKOL && profile.kolMetrics && (
                  <>
                    <div>
                      <span className="text-green-500 text-sm">Campaigns</span>
                      <p className="text-xl font-bold">{profile.kolMetrics.totalCampaigns}</p>
                    </div>
                    <div>
                      <span className="text-green-500 text-sm">Total Views</span>
                      <p className="text-xl font-bold">{profile.kolMetrics.totalViews.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-green-500 text-sm">Engagement</span>
                      <p className="text-xl font-bold">{profile.kolMetrics.totalEngagement.toLocaleString()}</p>
                    </div>
                    <div>
                      <span className="text-green-500 text-sm">Avg Rate</span>
                      <p className="text-xl font-bold">{profile.kolMetrics.averageEngagementRate.toFixed(2)}%</p>
                    </div>
                  </>
                )}
                <div>
                  <span className="text-green-500 text-sm">Member Since</span>
                  <p className="text-xl font-bold">{formatDate(profile.createdAt)}</p>
                </div>
              </div>
            </div>
            
            {/* Actions */}
            {isOwnProfile && (
              <div>
                <button
                  onClick={() => router.push('/profile/edit')}
                  className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors"
                >
                  Edit Profile
                </button>
              </div>
            )}
          </div>
        </div>
        
        {/* Tabs */}
        <div className="border-b border-green-500 mb-6">
          <div className="flex gap-8">
            <button
              onClick={() => setActiveTab('overview')}
              className={`pb-4 px-1 transition-colors ${
                activeTab === 'overview' 
                  ? 'text-green-300 border-b-2 border-green-300' 
                  : 'text-green-600 hover:text-green-400'
              }`}
            >
              Overview
            </button>
            {profile.isKOL && (
              <>
                <button
                  onClick={() => setActiveTab('campaigns')}
                  className={`pb-4 px-1 transition-colors ${
                    activeTab === 'campaigns' 
                      ? 'text-green-300 border-b-2 border-green-300' 
                      : 'text-green-600 hover:text-green-400'
                  }`}
                >
                  Campaigns ({profile.campaigns?.length || 0})
                </button>
                <button
                  onClick={() => setActiveTab('metrics')}
                  className={`pb-4 px-1 transition-colors ${
                    activeTab === 'metrics' 
                      ? 'text-green-300 border-b-2 border-green-300' 
                      : 'text-green-600 hover:text-green-400'
                  }`}
                >
                  Metrics
                </button>
              </>
            )}
            <button
              onClick={() => setActiveTab('contracts')}
              className={`pb-4 px-1 transition-colors ${
                activeTab === 'contracts' 
                  ? 'text-green-300 border-b-2 border-green-300' 
                  : 'text-green-600 hover:text-green-400'
              }`}
            >
              Contracts
            </button>
          </div>
        </div>
        
        {/* Tab Content */}
        <div>
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Contact Information */}
              <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Contact Information</h3>
                <div className="space-y-3">
                  {profile.email && (
                    <div className="flex items-center gap-3">
                      <span className="text-green-500">Email:</span>
                      <span className="text-green-300">{isOwnProfile ? profile.email : '••••••••'}</span>
                    </div>
                  )}
                  {profile.contacts?.telegram && (
                    <div className="flex items-center gap-3">
                      <span className="text-green-500">Telegram:</span>
                      <a 
                        href={`https://t.me/${profile.contacts.telegram.replace('@', '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-300 hover:text-green-100 underline"
                      >
                        {profile.contacts.telegram}
                      </a>
                    </div>
                  )}
                  {profile.country && (
                    <div className="flex items-center gap-3">
                      <span className="text-green-500">Location:</span>
                      <span className="text-green-300">
                        {profile.city && `${profile.city}, `}{profile.country}
                      </span>
                    </div>
                  )}
                  {profile.languages && profile.languages.length > 0 && (
                    <div className="flex items-center gap-3">
                      <span className="text-green-500">Languages:</span>
                      <span className="text-green-300">{profile.languages.join(', ')}</span>
                    </div>
                  )}
                </div>
              </div>
              
              {/* Social Links */}
              <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Social Media</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-green-500">Twitter:</span>
                    <a 
                      href={`https://twitter.com/${profile.twitterHandle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-green-300 hover:text-green-100 underline"
                    >
                      @{profile.twitterHandle}
                    </a>
                  </div>
                  {profile.socialAccounts?.discord && (
                    <div className="flex items-center gap-3">
                      <span className="text-green-500">Discord:</span>
                      <span className="text-green-300">
                        {profile.socialAccounts.discord.username}
                      </span>
                    </div>
                  )}
                  {!profile.socialAccounts?.discord && profile.discordUsername && (
                    <div className="flex items-center gap-3">
                      <span className="text-green-500">Discord:</span>
                      <span className="text-green-300">
                        {profile.discordUsername}
                      </span>
                    </div>
                  )}
                  {profile.socialLinks?.instagram && (
                    <div className="flex items-center gap-3">
                      <span className="text-green-500">Instagram:</span>
                      <a 
                        href={`https://instagram.com/${profile.socialLinks.instagram}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-300 hover:text-green-100 underline"
                      >
                        @{profile.socialLinks.instagram}
                      </a>
                    </div>
                  )}
                  {profile.socialLinks?.youtube && (
                    <div className="flex items-center gap-3">
                      <span className="text-green-500">YouTube:</span>
                      <a 
                        href={profile.socialLinks.youtube}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-300 hover:text-green-100 underline"
                      >
                        Channel
                      </a>
                    </div>
                  )}
                  {profile.socialLinks?.website && (
                    <div className="flex items-center gap-3">
                      <span className="text-green-500">Website:</span>
                      <a 
                        href={profile.socialLinks.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-green-300 hover:text-green-100 underline"
                      >
                        {profile.socialLinks.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                </div>
              </div>
              
              {/* KOL Statistics */}
              {profile.isKOL && profile.kolMetrics && (
                <div className="bg-green-900/20 border border-green-500 rounded-lg p-6 md:col-span-2">
                  <h3 className="text-lg font-semibold mb-4">KOL Statistics</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-300">{profile.kolMetrics.totalCampaigns}</p>
                      <p className="text-sm text-green-500">Total Campaigns</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-300">
                        ${profile.kolMetrics.totalEarnings.toLocaleString()}
                      </p>
                      <p className="text-sm text-green-500">Total Earnings</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-300">
                        {profile.kolMetrics.totalViews > 1000000 
                          ? `${(profile.kolMetrics.totalViews / 1000000).toFixed(1)}M`
                          : profile.kolMetrics.totalViews > 1000
                          ? `${(profile.kolMetrics.totalViews / 1000).toFixed(1)}K`
                          : profile.kolMetrics.totalViews.toLocaleString()
                        }
                      </p>
                      <p className="text-sm text-green-500">Total Views</p>
                    </div>
                    <div className="text-center">
                      <p className="text-3xl font-bold text-green-300">
                        {profile.kolMetrics.averageEngagementRate.toFixed(2)}%
                      </p>
                      <p className="text-sm text-green-500">Avg Engagement</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'campaigns' && profile.campaigns && (
            <div className="space-y-4">
              {profile.campaigns.length === 0 ? (
                <div className="text-center py-12 text-green-500">
                  No campaigns yet
                </div>
              ) : (
                profile.campaigns.map((campaign) => (
                  <div
                    key={campaign.campaignId}
                    className="bg-green-900/20 border border-green-500 rounded-lg p-6 hover:bg-green-900/30 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h4 className="text-lg font-semibold text-green-300 mb-1">
                          {campaign.campaignName}
                        </h4>
                        <div className="flex items-center gap-4 text-sm">
                          <span className={`px-2 py-1 rounded ${getTierColor(campaign.tier || '')}`}>
                            {campaign.tier?.toUpperCase()}
                          </span>
                          <span className="text-green-400">
                            {campaign.platform}
                          </span>
                          <span className="text-green-500">
                            {formatDate(campaign.joinedAt)}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold text-green-300">
                          ${campaign.budget.toLocaleString()}
                        </p>
                        <p className={`text-sm ${
                          campaign.paymentStatus === 'paid' ? 'text-green-400' :
                          campaign.paymentStatus === 'approved' ? 'text-blue-400' :
                          'text-gray-400'
                        }`}>
                          {campaign.paymentStatus}
                        </p>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                      <div>
                        <span className="text-green-500">Views:</span>
                        <p className="text-green-300 font-semibold">
                          {campaign.totalViews.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-green-500">Engagement:</span>
                        <p className="text-green-300 font-semibold">
                          {campaign.totalEngagement.toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-green-500">Stage:</span>
                        <p className="text-green-300 font-semibold">
                          {campaign.stage.replace(/_/g, ' ')}
                        </p>
                      </div>
                      <div>
                        <span className="text-green-500">Score:</span>
                        <p className="text-green-300 font-semibold">
                          {campaign.score?.toFixed(0) || 'N/A'}
                        </p>
                      </div>
                    </div>
                    
                    {campaign.links && campaign.links.length > 0 && (
                      <div className="mt-4 flex flex-wrap gap-2">
                        {campaign.links.map((link, i) => (
                          <a
                            key={i}
                            href={link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-green-400 hover:text-green-300 underline"
                          >
                            View Post {i + 1}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
          
          {activeTab === 'metrics' && profile.isKOL && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tier History */}
              {profile.kolMetrics?.tierHistory && profile.kolMetrics.tierHistory.length > 0 && (
                <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Tier History</h3>
                  <div className="space-y-2">
                    {profile.kolMetrics.tierHistory.slice(-5).reverse().map((history, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className={`px-2 py-1 text-xs rounded ${getTierColor(history.tier)}`}>
                          {history.tier.toUpperCase()}
                        </span>
                        <span className="text-green-500 text-sm">
                          {formatDate(history.date)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Performance Score */}
              {profile.overallScore && (
                <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
                  <h3 className="text-lg font-semibold mb-4">Performance Score</h3>
                  <div className="text-center mb-4">
                    <p className="text-5xl font-bold text-green-300">
                      {profile.overallScore.toFixed(0)}
                    </p>
                    <p className="text-sm text-green-500">Overall Score</p>
                  </div>
                  {profile.scoreBreakdown && (
                    <div className="space-y-2">
                      <div className="flex justify-between">
                        <span className="text-green-500">Performance:</span>
                        <span className="text-green-300">{profile.scoreBreakdown.performance}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-500">Reliability:</span>
                        <span className="text-green-300">{profile.scoreBreakdown.reliability}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-500">Engagement:</span>
                        <span className="text-green-300">{profile.scoreBreakdown.engagement}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-green-500">Reach:</span>
                        <span className="text-green-300">{profile.scoreBreakdown.reach}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
          
          {activeTab === 'contracts' && (
            <UserContracts 
              twitterHandle={profile.twitterHandle} 
              isOwnProfile={isOwnProfile}
            />
          )}
        </div>
      </div>
    </div>
  )
} 