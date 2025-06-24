'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, RefreshCw, Download, Filter, ChevronDown, FileText, Calculator } from '@/components/icons'
import AddKOLModal from '@/components/AddKOLModal'
import EditKOLModal from '@/components/EditKOLModal'
import BriefComposer from '@/components/BriefComposer'
import BudgetCalculator from '@/components/BudgetCalculator'
import { PDFExporter } from '@/lib/pdf-export'
import type { CampaignKOL, KOLTier, CampaignStage, PaymentStatus } from '@/lib/types/profile'

export default function CampaignKOLsPage({ params }: { params: { slug: string } }) {
  const router = useRouter()
  const campaignSlug = params.slug
  const [campaignId, setCampaignId] = useState<string | null>(null)
  
  // State
  const [campaign, setCampaign] = useState<any>(null)
  const [kols, setKols] = useState<CampaignKOL[]>([])
  const [filteredKols, setFilteredKols] = useState<CampaignKOL[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingKOL, setEditingKOL] = useState<CampaignKOL | null>(null)
  const [showBriefComposer, setShowBriefComposer] = useState(false)
  const [showBudgetCalculator, setShowBudgetCalculator] = useState(false)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [tierFilter, setTierFilter] = useState<KOLTier | 'all'>('all')
  const [stageFilter, setStageFilter] = useState<CampaignStage | 'all'>('all')
  const [paymentFilter, setPaymentFilter] = useState<PaymentStatus | 'all'>('all')
  const [sortBy, setSortBy] = useState<'name' | 'tier' | 'stage' | 'views' | 'score'>('score')
  const [showFilters, setShowFilters] = useState(false)
  
  // Load campaign and KOLs
  useEffect(() => {
    loadCampaignData()
  }, [campaignSlug])
  
  // Apply filters
  useEffect(() => {
    let filtered = [...kols]
    
    // Search filter
    if (searchTerm) {
      filtered = filtered.filter(kol => 
        kol.kolName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        kol.kolHandle.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    // Tier filter
    if (tierFilter !== 'all') {
      filtered = filtered.filter(kol => kol.tier === tierFilter)
    }
    
    // Stage filter
    if (stageFilter !== 'all') {
      filtered = filtered.filter(kol => kol.stage === stageFilter)
    }
    
    // Payment filter
    if (paymentFilter !== 'all') {
      filtered = filtered.filter(kol => kol.paymentStatus === paymentFilter)
    }
    
    // Sort
    filtered.sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.kolName.localeCompare(b.kolName)
        case 'tier':
          const tierOrder = ['hero', 'legend', 'star', 'rising', 'micro']
          return tierOrder.indexOf(a.tier) - tierOrder.indexOf(b.tier)
        case 'stage':
          const stageOrder = ['done', 'posted', 'preparing', 'waiting_brief', 'waiting_device', 'reached_out']
          return stageOrder.indexOf(a.stage) - stageOrder.indexOf(b.stage)
        case 'views':
          return (b.totalViews || 0) - (a.totalViews || 0)
        case 'score':
          return (b.score || 0) - (a.score || 0)
        default:
          return 0
      }
    })
    
    setFilteredKols(filtered)
  }, [kols, searchTerm, tierFilter, stageFilter, paymentFilter, sortBy])
  
  const loadCampaignData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // First, fetch campaign by slug to get ID
      const campaignsRes = await fetch('/api/campaigns')
      if (!campaignsRes.ok) throw new Error('Failed to load campaigns')
      const campaigns = await campaignsRes.json()
      
      const campaign = campaigns.find((c: any) => c.slug === campaignSlug)
      if (!campaign) throw new Error('Campaign not found')
      
      setCampaign(campaign)
      setCampaignId(campaign.id)
      
      // Load KOLs
      const kolsRes = await fetch(`/api/campaigns/${campaign.id}/kols`)
      if (!kolsRes.ok) throw new Error('Failed to load KOLs')
      const kolsData = await kolsRes.json()
      setKols(kolsData)
      
    } catch (err: any) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }
  
  const syncTweets = async () => {
    if (!campaignId) return
    
    console.log('[DEBUG] Sync Tweets - Starting sync process')
    console.log('[DEBUG] Campaign ID:', campaignId)
    console.log('[DEBUG] Current KOLs:', kols.length)
    
    setSyncing(true)
    try {
      console.log('[DEBUG] Making POST request to sync-tweets API...')
      const res = await fetch(`/api/campaigns/${campaignId}/sync-tweets`, {
        method: 'POST'
      })
      
      console.log('[DEBUG] API Response status:', res.status)
      console.log('[DEBUG] API Response headers:', Object.fromEntries(res.headers.entries()))
      
      const responseData = await res.json()
      console.log('[DEBUG] API Response data:', responseData)
      
      if (!res.ok) {
        console.error('[DEBUG] Sync failed with error:', responseData)
        throw new Error(responseData.error || 'Failed to sync tweets')
      }
      
      const result = responseData.result || responseData
      console.log('[DEBUG] Sync result:', result)
      
      // Reload KOLs to show updated metrics
      console.log('[DEBUG] Reloading campaign data...')
      await loadCampaignData()
      console.log('[DEBUG] Campaign data reloaded, new KOLs count:', kols.length)
      
      // Check if any tweets were found
      if (result.synced === 0 && result.failed === 0) {
        console.warn('[DEBUG] No tweets were synced - possible issues:')
        console.warn('- No tweet links added to KOLs')
        console.warn('- Invalid tweet URLs')
        console.warn('- Twitter API credentials missing')
        alert('No tweets found to sync. Make sure KOLs have tweet links added.')
      } else {
        alert(`Synced ${result.synced} tweets, ${result.failed} failed`)
      }
    } catch (err: any) {
      console.error('[DEBUG] Sync error:', err)
      alert(err.message || 'Failed to sync tweets')
    } finally {
      setSyncing(false)
    }
  }
  
  const exportData = () => {
    // Create CSV
    const headers = ['Handle', 'Name', 'Tier', 'Stage', 'Device', 'Budget', 'Payment', 'Views', 'Engagement', 'Score', 'Links']
    const rows = filteredKols.map(kol => [
      kol.kolHandle,
      kol.kolName,
      kol.tier,
      kol.stage.replace(/_/g, ' '),
      kol.deviceStatus.replace(/_/g, ' '),
      kol.budget.toString(),
      kol.paymentStatus,
      kol.totalViews.toString(),
      kol.totalEngagement.toString(),
      kol.score.toFixed(0),
      kol.links.join('; ')
    ])
    
    const csv = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n')
    
    // Download
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${campaign?.name || 'campaign'}-kols-${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }
  
  const handleKOLAdded = (newKOL: CampaignKOL) => {
    setKols([...kols, newKOL])
  }
  
  const handleKOLUpdated = (updatedKOL: CampaignKOL) => {
    setKols(kols.map(k => k.id === updatedKOL.id ? updatedKOL : k))
    setEditingKOL(null)
  }
  
  const handleKOLRemoved = (kolHandle: string) => {
    setKols(kols.filter(k => k.kolHandle !== kolHandle))
    setEditingKOL(null)
  }
  
  const handleSaveBrief = async (brief: string) => {
    if (!campaignId) return
    
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/brief`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ brief })
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to save brief')
      }
      
      alert('Brief saved successfully!')
    } catch (err: any) {
      alert(err.message || 'Failed to save brief')
      throw err
    }
  }
  
  // Calculate stats
  const stats = {
    totalKOLs: kols.length,
    totalBudget: kols.reduce((sum, kol) => sum + kol.budget, 0),
    totalViews: kols.reduce((sum, kol) => sum + (kol.totalViews || 0), 0),
    totalEngagement: kols.reduce((sum, kol) => sum + (kol.totalEngagement || 0), 0),
    averageScore: kols.length > 0 ? kols.reduce((sum, kol) => sum + (kol.score || 0), 0) / kols.length : 0,
    stageBreakdown: kols.reduce((acc, kol) => {
      acc[kol.stage] = (acc[kol.stage] || 0) + 1
      return acc
    }, {} as Record<CampaignStage, number>)
  }
  
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-green-300 p-8 flex items-center justify-center">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 border-2 border-green-300 border-t-transparent rounded-full animate-spin" />
          <span>Loading campaign data...</span>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-black text-green-300 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-4">
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => router.push('/campaigns')}
              className="mt-4 px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors"
            >
              Back to Campaigns
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  return (
    <div className="min-h-screen bg-black text-green-300 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-green-300 mb-2">
                {campaign?.name || 'Campaign'} - KOL Management
              </h1>
              <p className="text-green-400">
                Manage KOLs, track performance, and sync metrics
              </p>
            </div>
            <button
              onClick={() => router.push('/campaigns')}
              className="px-4 py-2 text-green-300 hover:text-green-100 transition-colors"
            >
              Back to Campaigns
            </button>
          </div>
          
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="bg-green-900/20 border border-green-500 rounded-lg p-4">
              <h3 className="text-sm font-medium text-green-400 mb-1">Total KOLs</h3>
              <p className="text-2xl font-bold text-green-300">{stats.totalKOLs}</p>
            </div>
            <div className="bg-green-900/20 border border-green-500 rounded-lg p-4">
              <h3 className="text-sm font-medium text-green-400 mb-1">Total Budget</h3>
              <p className="text-2xl font-bold text-green-300">${stats.totalBudget.toLocaleString()}</p>
            </div>
            <div className="bg-green-900/20 border border-green-500 rounded-lg p-4">
              <h3 className="text-sm font-medium text-green-400 mb-1">Total Views</h3>
              <p className="text-2xl font-bold text-green-300">{stats.totalViews.toLocaleString()}</p>
            </div>
            <div className="bg-green-900/20 border border-green-500 rounded-lg p-4">
              <h3 className="text-sm font-medium text-green-400 mb-1">Engagement</h3>
              <p className="text-2xl font-bold text-green-300">{stats.totalEngagement.toLocaleString()}</p>
            </div>
            <div className="bg-green-900/20 border border-green-500 rounded-lg p-4">
              <h3 className="text-sm font-medium text-green-400 mb-1">Avg Score</h3>
              <p className="text-2xl font-bold text-green-300">{stats.averageScore.toFixed(0)}</p>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add KOL
            </button>
            <button
              onClick={() => setShowBriefComposer(true)}
              className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              Campaign Brief
            </button>
            <button
              onClick={() => setShowBudgetCalculator(true)}
              className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors flex items-center gap-2"
            >
              <Calculator className="w-4 h-4" />
              Budget Calculator
            </button>
            <button
              onClick={syncTweets}
              disabled={syncing}
              className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? 'Syncing...' : 'Sync Tweets'}
            </button>
            <div className="relative group">
              <button
                className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Export
                <ChevronDown className="w-3 h-3" />
              </button>
              <div className="absolute top-full left-0 mt-1 hidden group-hover:block bg-black border border-green-500 rounded shadow-lg z-10">
                <button
                  onClick={exportData}
                  className="block w-full px-4 py-2 text-left text-green-300 hover:bg-green-900/30 transition-colors"
                >
                  Export as CSV
                </button>
                <button
                  onClick={async () => {
                    if (!campaign) return
                    try {
                      const exporter = new PDFExporter()
                      const pdfBlob = await exporter.exportKOLList(campaign, filteredKols)
                      PDFExporter.download(
                        pdfBlob,
                        `${campaign.slug}-kols-${new Date().toISOString().split('T')[0]}.pdf`
                      )
                    } catch (error) {
                      console.error('Error exporting PDF:', error)
                      alert('Failed to export PDF')
                    }
                  }}
                  className="block w-full px-4 py-2 text-left text-green-300 hover:bg-green-900/30 transition-colors"
                >
                  Export as PDF
                </button>
              </div>
            </div>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-4 py-2 border border-green-500 text-green-300 rounded hover:bg-green-900/30 transition-colors flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              Filters
              <ChevronDown className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
            </button>
          </div>
        </div>
        
        {/* Filters */}
        {showFilters && (
          <div className="mb-6 p-4 bg-green-900/20 border border-green-500 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-green-300 mb-1">Search</label>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Name or handle..."
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-green-300 mb-1">Tier</label>
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value as KOLTier | 'all')}
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 focus:outline-none focus:border-green-400"
                >
                  <option value="all">All Tiers</option>
                  <option value="hero">Hero</option>
                  <option value="legend">Legend</option>
                  <option value="star">Star</option>
                  <option value="rising">Rising</option>
                  <option value="micro">Micro</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-green-300 mb-1">Stage</label>
                <select
                  value={stageFilter}
                  onChange={(e) => setStageFilter(e.target.value as CampaignStage | 'all')}
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 focus:outline-none focus:border-green-400"
                >
                  <option value="all">All Stages</option>
                  <option value="reached_out">Reached Out</option>
                  <option value="waiting_device">Waiting Device</option>
                  <option value="waiting_brief">Waiting Brief</option>
                  <option value="posted">Posted</option>
                  <option value="preparing">Preparing</option>
                  <option value="done">Done</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-green-300 mb-1">Payment</label>
                <select
                  value={paymentFilter}
                  onChange={(e) => setPaymentFilter(e.target.value as PaymentStatus | 'all')}
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 focus:outline-none focus:border-green-400"
                >
                  <option value="all">All Payments</option>
                  <option value="pending">Pending</option>
                  <option value="approved">Approved</option>
                  <option value="rejected">Rejected</option>
                  <option value="paid">Paid</option>
                  <option value="revision">Revision</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-green-300 mb-1">Sort By</label>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 focus:outline-none focus:border-green-400"
                >
                  <option value="score">Score</option>
                  <option value="views">Views</option>
                  <option value="name">Name</option>
                  <option value="tier">Tier</option>
                  <option value="stage">Stage</option>
                </select>
              </div>
            </div>
          </div>
        )}
        
        {/* KOLs Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-green-500">
                <th className="text-left p-3 text-green-300 font-medium">KOL</th>
                <th className="text-left p-3 text-green-300 font-medium">Tier</th>
                <th className="text-left p-3 text-green-300 font-medium">Stage</th>
                <th className="text-left p-3 text-green-300 font-medium">Device</th>
                <th className="text-left p-3 text-green-300 font-medium">Budget</th>
                <th className="text-left p-3 text-green-300 font-medium">Payment</th>
                <th className="text-left p-3 text-green-300 font-medium">Views</th>
                <th className="text-left p-3 text-green-300 font-medium">Engagement</th>
                <th className="text-left p-3 text-green-300 font-medium">Score</th>
                <th className="text-left p-3 text-green-300 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredKols.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center p-8 text-green-400">
                    {kols.length === 0 ? 'No KOLs added yet' : 'No KOLs match your filters'}
                  </td>
                </tr>
              ) : (
                filteredKols.map((kol) => (
                  <tr
                    key={kol.id}
                    className="border-b border-green-500/30 hover:bg-green-900/10 transition-colors"
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        {kol.kolImage && (
                          <img
                            src={kol.kolImage}
                            alt={kol.kolName}
                            className="w-10 h-10 rounded-full object-cover"
                          />
                        )}
                        <div>
                          <div className="font-medium text-green-300">
                            <a 
                              href={`/profile/${kol.kolHandle}`}
                              className="hover:text-green-100 transition-colors"
                            >
                              {kol.kolName}
                            </a>
                          </div>
                          <div className="text-sm text-green-500">
                            <a 
                              href={`/profile/${kol.kolHandle}`}
                              className="hover:text-green-400 transition-colors"
                            >
                              @{kol.kolHandle}
                            </a>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className={`px-2 py-1 text-xs rounded ${
                        kol.tier === 'hero' ? 'bg-yellow-900/50 text-yellow-300' :
                        kol.tier === 'legend' ? 'bg-orange-900/50 text-orange-300' :
                        kol.tier === 'star' ? 'bg-blue-900/50 text-blue-300' :
                        kol.tier === 'rising' ? 'bg-green-900/50 text-green-300' :
                        'bg-gray-900/50 text-gray-300'
                      }`}>
                        {kol.tier}
                      </span>
                    </td>
                    <td className="p-3 text-green-300">{kol.stage.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-green-300">{kol.deviceStatus.replace(/_/g, ' ')}</td>
                    <td className="p-3 text-green-300">${kol.budget.toLocaleString()}</td>
                    <td className="p-3">
                      <span className={`px-2 py-1 text-xs rounded ${
                        kol.paymentStatus === 'paid' ? 'bg-green-900/50 text-green-300' :
                        kol.paymentStatus === 'approved' ? 'bg-blue-900/50 text-blue-300' :
                        kol.paymentStatus === 'rejected' ? 'bg-red-900/50 text-red-300' :
                        'bg-gray-900/50 text-gray-300'
                      }`}>
                        {kol.paymentStatus}
                      </span>
                    </td>
                    <td className="p-3 text-green-300">{(kol.totalViews || 0).toLocaleString()}</td>
                    <td className="p-3 text-green-300">{(kol.totalEngagement || 0).toLocaleString()}</td>
                    <td className="p-3 text-green-300">{(kol.score || 0).toFixed(0)}</td>
                    <td className="p-3">
                      <button
                        onClick={() => setEditingKOL(kol)}
                        className="text-green-400 hover:text-green-300 transition-colors"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Stage Progress */}
        <div className="mt-8 p-4 bg-green-900/20 border border-green-500 rounded-lg">
          <h3 className="text-lg font-semibold text-green-300 mb-4">Stage Distribution</h3>
          <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
            {Object.entries({
              reached_out: 'Reached Out',
              waiting_device: 'Waiting Device', 
              waiting_brief: 'Waiting Brief',
              posted: 'Posted',
              preparing: 'Preparing',
              done: 'Done'
            }).map(([stage, label]) => (
              <div key={stage} className="text-center">
                <div className="text-2xl font-bold text-green-300">
                  {stats.stageBreakdown[stage as CampaignStage] || 0}
                </div>
                <div className="text-sm text-green-400">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      
      {/* Modals */}
      {showAddModal && campaign && campaignId && (
        <AddKOLModal
          campaignId={campaignId}
          campaignName={campaign.name}
          onClose={() => setShowAddModal(false)}
          onKOLAdded={handleKOLAdded}
        />
      )}
      
      {editingKOL && campaignId && (
        <EditKOLModal
          campaignId={campaignId}
          kol={editingKOL}
          onClose={() => setEditingKOL(null)}
          onKOLUpdated={handleKOLUpdated}
          onKOLRemoved={handleKOLRemoved}
        />
      )}
      
      {showBriefComposer && campaign && campaignId && (
        <BriefComposer
          campaignId={campaignId}
          campaignName={campaign.name}
          initialBrief={campaign.brief}
          onClose={() => setShowBriefComposer(false)}
          onSave={handleSaveBrief}
        />
      )}
      
      {showBudgetCalculator && campaign && (
        <BudgetCalculator
          kols={kols}
          campaignName={campaign.name}
          onClose={() => setShowBudgetCalculator(false)}
        />
      )}
    </div>
  )
} 