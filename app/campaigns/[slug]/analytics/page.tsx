'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Download, RefreshCw, Calculator, TrendingUp } from '@/components/icons'
import BudgetCalculator from '@/components/BudgetCalculator'
import TimelineAnalytics from '@/components/TimelineAnalytics'
import {
  InteractiveBarChart,
  InteractivePieChart,
  MultiBarChart,
  ProgressChart,
  TIER_COLORS,
  CHART_COLORS
} from '@/components/charts/ChartComponents'
import { PDFExporter } from '@/lib/pdf-export'
import type { CampaignKOL, KOLTier, SocialPlatform, DeviceStatus, PaymentStatus, CampaignStage } from '@/lib/types/profile'
import type { Campaign, KOL } from '@/lib/campaign'

// Chart components placeholder - we'll implement with recharts
interface ChartData {
  name: string
  value: number
  [key: string]: any
}

// Specific types for analytics data
interface TierChartData extends ChartData {
  views: number
  budget: number
  color?: string
}

interface PlatformChartData extends ChartData {
  views: number
}

interface PaymentChartData extends ChartData {
  amount: number
}

interface BudgetChartData extends ChartData {
  percentage: number
  color?: string
}

// Adapter function to convert KOL to CampaignKOL format
function mapKOLToCampaignKOL(kol: KOL): CampaignKOL {
  // Parse budget to get numeric value
  let budgetValue = 0
  if (kol.budget === 'free') {
    budgetValue = 0
  } else if (kol.budget === 'with device') {
    budgetValue = 500 // Estimated device cost
  } else {
    // Parse numeric budget (remove $ and commas)
    budgetValue = parseFloat(kol.budget.replace(/[$,]/g, '')) || 0
  }
  
  return {
    id: kol.id,
    campaignId: '', // Will be filled from campaign context
    kolId: kol.id, // Using same ID for now
    kolHandle: kol.handle,
    kolName: kol.name,
    kolImage: kol.pfp,
    tier: (kol.tier || 'micro') as KOLTier,
    stage: kol.stage as CampaignStage,
    deviceStatus: kol.device as DeviceStatus,
    budget: budgetValue,
    paymentStatus: kol.payment as PaymentStatus,
    links: kol.links || [],
    platform: (kol.platform[0] || 'twitter') as SocialPlatform,
    contentType: 'tweet', // Default content type
    metrics: undefined, // No metrics data in KOL type
    totalViews: kol.views || 0,
    totalEngagement: 0, // Not available in current KOL type
    engagementRate: 0, // Not available in current KOL type
    score: 0, // Not available in current KOL type
    addedAt: new Date(kol.lastUpdated || Date.now()),
    addedBy: kol.addedBy || '',
    postedAt: undefined,
    completedAt: kol.stage === 'done' ? new Date() : undefined,
    lastSyncedAt: undefined,
  }
}

export default function CampaignAnalyticsPage({ params }: { params: { slug: string } }) {
  const router = useRouter()
  const [campaign, setCampaign] = useState<Campaign | null>(null)
  const [kols, setKols] = useState<CampaignKOL[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [showBudgetCalculator, setShowBudgetCalculator] = useState(false)
  const [showTimeline, setShowTimeline] = useState(false)
  
  useEffect(() => {
    loadData()
  }, [params.slug])
  
  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Fetch campaign by slug using the dedicated API endpoint
      const campaignRes = await fetch(`/api/campaigns/slug/${params.slug}`)
      if (!campaignRes.ok) {
        if (campaignRes.status === 404) {
          throw new Error('Campaign not found')
        }
        throw new Error('Failed to load campaign')
      }
      const campaignData = await campaignRes.json()
      
      setCampaign(campaignData)
      
      // Use KOLs from the campaign object - they're already included
      setKols(campaignData.kols.map(mapKOLToCampaignKOL))
      
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }
  
  const refreshData = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }
  
  // Calculate analytics data
  const analytics = {
    // Basic stats
    totalKOLs: kols.length,
    totalBudget: kols.reduce((sum, kol) => sum + kol.budget, 0),
    totalViews: kols.reduce((sum, kol) => sum + (kol.totalViews || 0), 0),
    totalEngagement: kols.reduce((sum, kol) => sum + (kol.totalEngagement || 0), 0),
    
    // Efficiency metrics
    costPerView: 0,
    costPerEngagement: 0,
    averageEngagementRate: 0,
    
    // Tier distribution
    tierDistribution: [] as TierChartData[],
    
    // Platform breakdown
    platformBreakdown: [] as PlatformChartData[],
    
    // Stage distribution
    stageDistribution: [] as ChartData[],
    
    // Payment status
    paymentDistribution: [] as PaymentChartData[],
    
    // Top performers
    topPerformers: [] as any[],
    
    // Budget allocation
    budgetByTier: [] as BudgetChartData[],
    
    // Performance timeline
    performanceTimeline: [] as ChartData[],
  }
  
  // Calculate efficiency metrics
  if (analytics.totalBudget > 0) {
    analytics.costPerView = analytics.totalViews > 0 ? analytics.totalBudget / analytics.totalViews : 0
    analytics.costPerEngagement = analytics.totalEngagement > 0 ? analytics.totalBudget / analytics.totalEngagement : 0
  }
  
  if (kols.length > 0) {
    analytics.averageEngagementRate = kols.reduce((sum, kol) => sum + (kol.engagementRate || 0), 0) / kols.length
  }
  
  // Calculate tier distribution
  const tierCounts: Record<KOLTier, number> = {
    hero: 0,
    legend: 0,
    star: 0,
    rising: 0,
    micro: 0,
  }
  
  const tierViews: Record<KOLTier, number> = {
    hero: 0,
    legend: 0,
    star: 0,
    rising: 0,
    micro: 0,
  }
  
  const tierBudgets: Record<KOLTier, number> = {
    hero: 0,
    legend: 0,
    star: 0,
    rising: 0,
    micro: 0,
  }
  
  kols.forEach(kol => {
    tierCounts[kol.tier]++
    tierViews[kol.tier] += kol.totalViews || 0
    tierBudgets[kol.tier] += kol.budget
  })
  
  analytics.tierDistribution = Object.entries(tierCounts).map(([tier, count]) => ({
    name: tier.charAt(0).toUpperCase() + tier.slice(1),
    value: count,
    views: tierViews[tier as KOLTier],
    budget: tierBudgets[tier as KOLTier],
    color: TIER_COLORS[tier]
  }))
  
  // Calculate platform breakdown
  const platformCounts: Record<string, number> = {}
  const platformViews: Record<string, number> = {}
  
  kols.forEach(kol => {
    if (!platformCounts[kol.platform]) {
      platformCounts[kol.platform] = 0
      platformViews[kol.platform] = 0
    }
    platformCounts[kol.platform]++
    platformViews[kol.platform] += kol.totalViews || 0
  })
  
  analytics.platformBreakdown = Object.entries(platformCounts).map(([platform, count]) => ({
    name: platform.charAt(0).toUpperCase() + platform.slice(1),
    value: count,
    views: platformViews[platform],
  }))
  
  // Calculate stage distribution
  const stageCounts: Record<string, number> = {}
  kols.forEach(kol => {
    const stage = kol.stage.replace(/_/g, ' ')
    stageCounts[stage] = (stageCounts[stage] || 0) + 1
  })
  
  analytics.stageDistribution = Object.entries(stageCounts).map(([stage, count]) => ({
    name: stage.split(' ').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
    value: count,
  }))
  
  // Calculate payment distribution
  const paymentCounts: Record<string, number> = {}
  const paymentAmounts: Record<string, number> = {}
  
  kols.forEach(kol => {
    const status = kol.paymentStatus || 'pending'
    paymentCounts[status] = (paymentCounts[status] || 0) + 1
    paymentAmounts[status] = (paymentAmounts[status] || 0) + kol.budget
  })
  
  analytics.paymentDistribution = Object.entries(paymentCounts).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
    amount: paymentAmounts[status],
  }))
  
  // Get top performers
  analytics.topPerformers = [...kols]
    .sort((a, b) => (b.score || 0) - (a.score || 0))
    .slice(0, 10)
    .map(kol => ({
      handle: kol.kolHandle,
      name: kol.kolName,
      tier: kol.tier,
      views: kol.totalViews || 0,
      engagement: kol.totalEngagement || 0,
      score: kol.score || 0,
      roi: kol.budget > 0 ? ((kol.totalViews || 0) / kol.budget) : 0,
    }))
  
  // Budget by tier
  analytics.budgetByTier = Object.entries(tierBudgets)
    .filter(([_, budget]) => budget > 0)
    .map(([tier, budget]) => ({
      name: tier.charAt(0).toUpperCase() + tier.slice(1),
      value: budget,
      percentage: (budget / analytics.totalBudget) * 100,
      color: TIER_COLORS[tier]
    }))
  
  const exportAnalytics = async () => {
    if (!campaign) return
    
    try {
      // Get user session for profile image and name
      const session = await fetch('/api/auth/session').then(res => res.json())
      
      // Convert logo to base64
      let logoBase64 = ''
      try {
        const logoResponse = await fetch('/logo.png')
        const logoBlob = await logoResponse.blob()
        logoBase64 = await new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onloadend = () => resolve(reader.result as string)
          reader.readAsDataURL(logoBlob)
        })
      } catch (e) {
        console.error('Failed to load logo:', e)
      }
      
      const exporter = new PDFExporter()
      const pdfBlob = await exporter.exportAnalytics({
        campaign,
        kols,
        totalKOLs: analytics.totalKOLs,
        totalBudget: analytics.totalBudget,
        totalViews: analytics.totalViews,
        totalEngagement: analytics.totalEngagement,
        costPerView: analytics.costPerView,
        costPerEngagement: analytics.costPerEngagement,
        averageEngagementRate: analytics.averageEngagementRate,
        tierDistribution: analytics.tierDistribution,
        topPerformers: analytics.topPerformers,
        platformBreakdown: analytics.platformBreakdown,
        stageDistribution: analytics.stageDistribution,
        paymentDistribution: analytics.paymentDistribution,
        timelineData: kols.length > 0 ? generateTimelineData(kols) : undefined,
        userProfileImage: session?.user?.image,
        userName: session?.user?.name,
        logoBase64
      })
      
      PDFExporter.download(
        pdfBlob,
        `${campaign.slug}-analytics-${new Date().toISOString().split('T')[0]}.pdf`
      )
    } catch (error) {
      console.error('Error exporting PDF:', error)
      alert('Failed to export PDF. Please try again.')
    }
  }
  
  // Generate timeline data from KOLs
  const generateTimelineData = (kols: CampaignKOL[]) => {
    // Group KOLs by date (using postedAt or addedAt)
    const dateGroups: Record<string, { views: number; engagement: number; posts: number }> = {}
    
    kols.forEach(kol => {
      const dateValue = kol.postedAt || kol.addedAt
      const date = dateValue ? new Date(dateValue).toISOString().split('T')[0] : new Date().toISOString().split('T')[0]
      
      if (!dateGroups[date]) {
        dateGroups[date] = { views: 0, engagement: 0, posts: 0 }
      }
      
      dateGroups[date].views += kol.totalViews || 0
      dateGroups[date].engagement += kol.totalEngagement || 0
      dateGroups[date].posts += 1
    })
    
    // Convert to array and sort by date
    const timeline = Object.entries(dateGroups)
      .map(([date, data]) => ({
        date,
        views: data.views,
        engagement: data.engagement,
        posts: data.posts
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(-30) // Last 30 days
    
    // Format dates for display
    return timeline.map(point => ({
      ...point,
      date: new Date(point.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    }))
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-green-300 flex items-center justify-center">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 border-2 border-green-300 border-t-transparent rounded-full animate-spin" />
          <span>Loading analytics...</span>
        </div>
      </div>
    )
  }
  
  if (error || !campaign) {
    return (
      <div className="min-h-screen bg-black text-green-300 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6 text-center">
            <p className="text-red-400 mb-4">{error || 'Campaign not found'}</p>
            <button
              onClick={() => router.push('/campaigns')}
              className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors"
            >
              Back to Campaigns
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-black text-green-300 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-4 mb-4">
            <button
              onClick={() => router.back()}
              className="p-2 hover:bg-green-900/50 rounded transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h1 className="text-2xl md:text-3xl font-bold text-green-300">
                {campaign.name} - Analytics
              </h1>
              <p className="text-green-400 mt-1">
                Campaign performance insights and metrics
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setShowTimeline(true)}
                className="px-4 py-2 border border-green-500 text-green-300 rounded hover:bg-green-900/30 transition-colors flex items-center gap-2"
              >
                <TrendingUp className="w-4 h-4" />
                Timeline
              </button>
              <button
                onClick={() => setShowBudgetCalculator(true)}
                className="px-4 py-2 border border-green-500 text-green-300 rounded hover:bg-green-900/30 transition-colors flex items-center gap-2"
              >
                <Calculator className="w-4 h-4" />
                Budget
              </button>
              <button
                onClick={refreshData}
                disabled={refreshing}
                className="px-4 py-2 border border-green-500 text-green-300 rounded hover:bg-green-900/30 transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                onClick={exportAnalytics}
                className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
              </button>
            </div>
          </div>
        </div>
        
        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
            <h3 className="text-sm font-medium text-green-400 mb-2">Total KOLs</h3>
            <p className="text-3xl font-bold text-green-300">{analytics.totalKOLs}</p>
          </div>
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
            <h3 className="text-sm font-medium text-green-400 mb-2">Total Budget</h3>
            <p className="text-3xl font-bold text-green-300">${analytics.totalBudget.toLocaleString()}</p>
          </div>
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
            <h3 className="text-sm font-medium text-green-400 mb-2">Total Views</h3>
            <p className="text-3xl font-bold text-green-300">
              {analytics.totalViews > 1000000 
                ? `${(analytics.totalViews / 1000000).toFixed(1)}M`
                : analytics.totalViews > 1000
                ? `${(analytics.totalViews / 1000).toFixed(1)}K`
                : analytics.totalViews.toLocaleString()
              }
            </p>
          </div>
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
            <h3 className="text-sm font-medium text-green-400 mb-2">Engagement Rate</h3>
            <p className="text-3xl font-bold text-green-300">{analytics.averageEngagementRate.toFixed(2)}%</p>
          </div>
        </div>
        
        {/* Efficiency Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
            <h3 className="text-sm font-medium text-green-400 mb-2">Cost per View</h3>
            <p className="text-2xl font-bold text-green-300">
              ${analytics.costPerView.toFixed(4)}
            </p>
            <p className="text-xs text-green-500 mt-1">
              Lower is better
            </p>
          </div>
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
            <h3 className="text-sm font-medium text-green-400 mb-2">Cost per Engagement</h3>
            <p className="text-2xl font-bold text-green-300">
              ${analytics.costPerEngagement.toFixed(2)}
            </p>
            <p className="text-xs text-green-500 mt-1">
              Lower is better
            </p>
          </div>
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
            <h3 className="text-sm font-medium text-green-400 mb-2">Total Engagement</h3>
            <p className="text-2xl font-bold text-green-300">
              {analytics.totalEngagement.toLocaleString()}
            </p>
            <p className="text-xs text-green-500 mt-1">
              Likes, comments, shares
            </p>
          </div>
        </div>
        
        {/* Charts Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          {/* Tier Distribution */}
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">KOL Tier Distribution</h3>
            <InteractivePieChart
              data={analytics.tierDistribution}
              height={250}
              innerRadius={40}
            />
            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
              {analytics.tierDistribution.map((tier) => (
                <div key={tier.name} className="flex justify-between">
                  <span className="text-green-300">{tier.name}:</span>
                  <span className="text-green-400">{tier.views.toLocaleString()} views</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Platform Breakdown */}
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Platform Distribution</h3>
            <InteractiveBarChart
              data={analytics.platformBreakdown}
              color={CHART_COLORS.blue}
              height={250}
            />
          </div>
          
          {/* Stage Distribution */}
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Campaign Stage Progress</h3>
            <div className="space-y-3">
              {analytics.stageDistribution.map((stage) => (
                <div key={stage.name} className="flex items-center justify-between">
                  <span className="text-sm text-green-300">{stage.name}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 bg-black rounded-full h-4 relative overflow-hidden">
                      <div
                        className="h-full bg-yellow-600 rounded-full transition-all duration-500"
                        style={{ width: `${(stage.value / analytics.totalKOLs) * 100}%` }}
                      />
                    </div>
                    <span className="text-sm text-green-400 w-12 text-right">{stage.value}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Payment Status */}
          <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
            <h3 className="text-lg font-semibold mb-4">Payment Status</h3>
            <div className="space-y-3">
              {analytics.paymentDistribution.map((payment) => (
                <div key={payment.name}>
                  <div className="flex justify-between mb-1">
                    <span className="text-sm text-green-300">{payment.name}</span>
                    <span className="text-sm text-green-400">{payment.value} KOLs</span>
                  </div>
                  <div className="w-full bg-black rounded-full h-4 relative overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        payment.name.toLowerCase() === 'paid' ? 'bg-green-600' :
                        payment.name.toLowerCase() === 'approved' ? 'bg-blue-600' :
                        payment.name.toLowerCase() === 'rejected' ? 'bg-red-600' :
                        'bg-gray-600'
                      }`}
                      style={{ width: `${(payment.amount / analytics.totalBudget) * 100}%` }}
                    />
                  </div>
                  <div className="text-xs text-green-500 mt-1">
                    ${payment.amount.toLocaleString()} ({((payment.amount / analytics.totalBudget) * 100).toFixed(0)}% of budget)
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        
        {/* Budget Allocation */}
        <div className="bg-green-900/20 border border-green-500 rounded-lg p-6 mb-8">
          <h3 className="text-lg font-semibold mb-4">Budget Allocation by Tier</h3>
          <MultiBarChart
            data={analytics.budgetByTier.map(tier => ({
              name: tier.name,
              budget: tier.value,
              percentage: tier.percentage
            }))}
            bars={[
              { dataKey: 'budget', color: CHART_COLORS.green, name: 'Budget ($)' }
            ]}
            height={250}
          />
        </div>
        
        {/* Top Performers */}
        <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
          <h3 className="text-lg font-semibold mb-4">Top Performers</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-green-500">
                  <th className="text-left p-3 text-green-300">Rank</th>
                  <th className="text-left p-3 text-green-300">KOL</th>
                  <th className="text-left p-3 text-green-300">Tier</th>
                  <th className="text-left p-3 text-green-300">Views</th>
                  <th className="text-left p-3 text-green-300">Engagement</th>
                  <th className="text-left p-3 text-green-300">Score</th>
                  <th className="text-left p-3 text-green-300">Views/$</th>
                </tr>
              </thead>
              <tbody>
                {analytics.topPerformers.map((performer, index) => (
                  <tr key={performer.handle} className="border-b border-green-500/30">
                    <td className="p-3 text-green-400">#{index + 1}</td>
                    <td className="p-3">
                      <a 
                        href={`/profile/${performer.handle}`}
                        className="hover:text-green-100 transition-colors"
                      >
                        <div className="font-medium text-green-300">{performer.name}</div>
                        <div className="text-xs text-green-500">@{performer.handle}</div>
                      </a>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 text-xs rounded ${
                        performer.tier === 'hero' ? 'bg-yellow-900/50 text-yellow-300' :
                        performer.tier === 'legend' ? 'bg-purple-900/50 text-purple-300' :
                        performer.tier === 'star' ? 'bg-blue-900/50 text-blue-300' :
                        performer.tier === 'rising' ? 'bg-green-900/50 text-green-300' :
                        'bg-gray-900/50 text-gray-300'
                      }`}>
                        {performer.tier}
                      </span>
                    </td>
                    <td className="p-3 text-green-300">{performer.views.toLocaleString()}</td>
                    <td className="p-3 text-green-300">{performer.engagement.toLocaleString()}</td>
                    <td className="p-3 text-green-300">{performer.score.toFixed(0)}</td>
                    <td className="p-3 text-green-300">{performer.roi.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      
      {/* Budget Calculator Modal */}
      {showBudgetCalculator && campaign && (
        <BudgetCalculator
          kols={kols}
          campaignName={campaign.name}
          onClose={() => setShowBudgetCalculator(false)}
        />
      )}
      
      {/* Timeline Analytics Modal */}
      {showTimeline && campaign && (
        <TimelineAnalytics
          kols={kols}
          campaignName={campaign.name}
          startDate={campaign.startDate || new Date().toISOString()}
          endDate={campaign.endDate || new Date().toISOString()}
          onClose={() => setShowTimeline(false)}
        />
      )}
    </div>
  )
} 