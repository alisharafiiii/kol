'use client'

import { useState, useEffect } from 'react'
import { X, Search, Upload, Check } from './icons'
import { KOL } from '@/lib/campaign'
import { Product } from '@/lib/types/product'
import { Campaign } from '@/lib/campaign'

// Simple interface for search results
interface SearchResult {
  id: string
  name: string
  twitterHandle: string
  profileImageUrl?: string
  currentTier?: string
  role?: string
  approvalStatus?: string
  contacts?: {
    email?: string
    telegram?: string
  }
  campaigns?: any[]
}

// Global cache for approved users to avoid re-fetching
let globalApprovedUsersCache: any[] | null = null
let globalCacheTime = 0
const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes

interface AddKOLModalProps {
  campaign: Campaign
  onClose: () => void
  onAdd: (kol: Omit<KOL, 'id' | 'lastUpdated'>) => Promise<void>
}

export default function AddKOLModal({ campaign, onClose, onAdd }: AddKOLModalProps) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [selectedProfile, setSelectedProfile] = useState<SearchResult | null>(null)
  
  // Cache for all approved users
  const [allApprovedUsers, setAllApprovedUsers] = useState<any[]>([])
  const [usersLoaded, setUsersLoaded] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [processedUsers, setProcessedUsers] = useState<any[]>([])
  
  // Product state
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<string>('')
  
  // KOL form data
  const [formData, setFormData] = useState({
    handle: '',
    name: '',
    pfp: '',
    tier: 'micro' as KOL['tier'],
    stage: 'reached out' as KOL['stage'],
    device: 'na' as KOL['device'],
    budget: '',
    payment: 'pending' as KOL['payment'],
    platform: ['x'] as string[],
    contact: '',
    links: [''] as string[],
    views: 0,
    productId: '',
    productCost: 0,
    productQuantity: 1
  })
  
  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  // Search through cached users with small debounce
  const [debouncedQuery, setDebouncedQuery] = useState('')
  
  // Load approved users once when modal opens
  useEffect(() => {
    const fetchApprovedUsers = async () => {
      try {
        // Check if we have valid cached data
        if (globalApprovedUsersCache && Date.now() - globalCacheTime < CACHE_DURATION) {
          console.log('[AddKOLModal] Using cached users:', globalApprovedUsersCache.length)
          
          // Pre-process cached users
          const processed = globalApprovedUsersCache.map((user: any) => ({
            ...user,
            _searchName: (user.name || '').toLowerCase(),
            _searchHandle: (user.twitterHandle || user.handle || '').toLowerCase().replace('@', '')
          }))
          
          setAllApprovedUsers(globalApprovedUsersCache)
          setProcessedUsers(processed)
          setUsersLoaded(true)
          return
        }
        
        console.log('[AddKOLModal] Fetching all approved users...')
        const startTime = Date.now()
        
        const res = await fetch('/api/users/search-list')
        
        if (!res.ok) {
          const errorText = await res.text()
          console.error('[AddKOLModal] API error:', res.status, errorText)
          throw new Error(`API error: ${res.status}`)
        }
        
        const users = await res.json()
        const fetchTime = Date.now() - startTime
        console.log('[AddKOLModal] Loaded', users.length, 'approved users in', fetchTime, 'ms')
        
        // Update global cache
        globalApprovedUsersCache = users
        globalCacheTime = Date.now()
        
        // Pre-process users for faster searching
        const processed = users.map((user: any) => ({
          ...user,
          _searchName: (user.name || '').toLowerCase(),
          _searchHandle: (user.twitterHandle || user.handle || '').toLowerCase().replace('@', '')
        }))
        
        setAllApprovedUsers(users)
        setProcessedUsers(processed)
        setUsersLoaded(true)
      } catch (err: any) {
        console.error('[AddKOLModal] Failed to load users:', {
          message: err.message,
          stack: err.stack,
          type: err.name
        })
        setLoadError(err.message || 'Failed to load users')
        setUsersLoaded(true)
      }
    }
    
    fetchApprovedUsers()
  }, [])
  
  // Load products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products/active')
        if (res.ok) {
          const data = await res.json()
          setProducts(data)
        } else {
          console.error('Failed to fetch products:', res.status)
        }
      } catch (err) {
        console.error('Error fetching products:', err)
      } finally {
        setLoadingProducts(false)
      }
    }
    
    fetchProducts()
  }, [])
  
  // Search through cached users with small debounce
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery)
    }, 100) // Small 100ms debounce for smoother typing
    
    return () => clearTimeout(timer)
  }, [searchQuery])
  
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSearchResults([])
      return
    }
    
    if (!usersLoaded || processedUsers.length === 0) {
      return
    }
    
    // Instant local filtering using pre-computed values
    const searchLower = debouncedQuery.toLowerCase().trim()
    const filtered = processedUsers.filter((user: any) => {
      return user._searchName.includes(searchLower) || user._searchHandle.includes(searchLower)
    })
    
    console.log('[AddKOLModal] Local filter:', filtered.length, 'results for:', debouncedQuery)
    
    // Convert to SearchResult format
    const results = filtered.slice(0, 10).map((user: any) => {
      const result: SearchResult = {
        id: user.id || `user_${Date.now()}_${Math.random()}`,
        name: user.name || 'Unknown User',
        twitterHandle: (user.twitterHandle || user.handle || '').replace('@', ''),
        profileImageUrl: user.profileImageUrl || '',
        currentTier: user.tier || 'micro',
        role: user.role || 'user',
        approvalStatus: user.approvalStatus || 'approved',
        contacts: {
          email: user.email || '',
          telegram: user.contact?.includes('@') ? user.contact : ''
        },
        campaigns: []
      }
      return result
    })
    
    setSearchResults(results)
  }, [debouncedQuery, processedUsers, usersLoaded])
  
  // Handle KOL selection from search
  const selectKOL = (kol: SearchResult) => {
    setSelectedProfile(kol)
    setFormData({
      ...formData,
      handle: kol.twitterHandle || '',
      name: kol.name || '',
      pfp: kol.profileImageUrl || '',
      tier: kol.currentTier as KOL['tier'] || formData.tier,
      // Preserve existing contact info if available
      contact: kol.contacts?.telegram || kol.contacts?.email || formData.contact,
      // Merge any existing campaign data if this KOL has participated before
      ...(kol.campaigns && kol.campaigns.length > 0 && {
        platform: [kol.campaigns[0].platform || 'x'],
        budget: kol.campaigns[0].budget ? `$${kol.campaigns[0].budget}` : formData.budget
      })
    })
    setSearchQuery('')
    setSearchResults([])
  }
  
  // Handle image upload
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Check file size (max 500KB to be safe)
    if (file.size > 500 * 1024) {
      setError('Image size must be less than 500KB')
      return
    }
    
    // For now, convert to base64 - in production, upload to a service
    const reader = new FileReader()
    reader.onload = (e) => {
      setFormData({ ...formData, pfp: e.target?.result as string })
    }
    reader.readAsDataURL(file)
  }
  
  // Submit form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    
    if (!formData.handle || !formData.name) {
      setError('Please fill in all required fields')
      return
    }
    
    setIsSubmitting(true)
    
    try {
      const res = await fetch(`/api/campaigns/${campaign.id}/kols`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          handle: formData.handle.replace('@', ''),
          links: formData.links.filter(Boolean),
          views: formData.views,
          productId: selectedProduct,
          productCost: selectedProduct ? products.find(p => p.id === selectedProduct)?.price || 0 : 0,
          productQuantity: formData.productQuantity
        })
      })
      
      if (!res.ok) {
        const errorData = await res.json().catch(() => null)
        throw new Error(errorData?.error || `Failed to add KOL (${res.status})`)
      }
      
      const newKOL = await res.json()
      
      // Call onAdd but catch any errors
      try {
        await onAdd(newKOL)
        onClose()
      } catch (onAddError) {
        console.error('Error in onAdd callback:', onAddError)
        // Still close the modal since the KOL was added successfully
        onClose()
      }
    } catch (err: any) {
      console.error('Error adding KOL:', err)
      setError(err.message || 'Failed to add KOL. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-black border border-green-500 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-green-500">
          <h2 className="text-xl font-bold text-green-300">Add KOL to Campaign</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-green-900/50 rounded transition-colors"
          >
            <X className="w-5 h-5 text-green-300" />
          </button>
        </div>
        
        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(90vh-120px)]">
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Search existing KOLs */}
            <div>
              <label className="block text-sm font-medium text-green-300 mb-1">
                Search Approved KOLs
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-green-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or handle..."
                  className="w-full pl-10 pr-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                />
                {!usersLoaded && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-green-400">
                    Loading...
                  </div>
                )}
              </div>
              
              {/* Loading message when not searching */}
              {!usersLoaded && searchQuery.length < 2 && (
                <div className="mt-2 text-xs text-gray-400">
                  Loading approved users...
                </div>
              )}
              
              {/* Search results */}
              {!usersLoaded && searchQuery.length >= 2 && (
                <div className="mt-2 p-4 text-center text-green-400 text-sm">
                  <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-green-400 mr-2"></div>
                  Loading users...
                </div>
              )}
              
              {usersLoaded && searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="mt-2 p-4 text-center text-gray-400 text-sm">
                  No approved users found matching "{searchQuery}"
                  {loadError && (
                    <div className="text-red-400 text-xs mt-2">
                      Error: {loadError}
                    </div>
                  )}
                </div>
              )}
              
              {searchResults.length > 0 && (
                <div className="mt-2 border border-green-500 rounded max-h-40 overflow-y-auto">
                  {searchResults.map((kol) => (
                    <button
                      key={kol.id}
                      type="button"
                      onClick={() => selectKOL(kol)}
                      className="w-full p-2 hover:bg-green-900/50 text-left flex items-center gap-2 transition-colors"
                    >
                      {kol.profileImageUrl ? (
                        <img
                          src={kol.profileImageUrl}
                          alt={kol.name}
                          className="w-8 h-8 rounded-full object-cover"
                          onError={(e) => {
                            e.currentTarget.src = `https://unavatar.io/twitter/${kol.twitterHandle}`
                          }}
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-green-900 flex items-center justify-center text-xs text-green-300">
                          {kol.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1">
                        <div className="text-green-300 font-medium">{kol.name || 'Unknown'}</div>
                        <div className="text-xs text-green-500">
                          @{kol.twitterHandle || 'no-handle'}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            
            <div className="border-t border-green-500/30 pt-4">
              <p className="text-sm text-green-400 mb-4">Or add manually:</p>
              
              {/* Two column layout */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Handle */}
                <div>
                  <label className="block text-sm font-medium text-green-300 mb-1">
                    Handle *
                  </label>
                  <input
                    type="text"
                    value={formData.handle}
                    onChange={(e) => setFormData({...formData, handle: e.target.value})}
                    placeholder="@username"
                    className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                    required
                  />
                </div>
                
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-green-300 mb-1">
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                    placeholder="Display name"
                    className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                    required
                  />
                </div>
                
                {/* Profile Picture */}
                <div>
                  <label className="block text-sm font-medium text-green-300 mb-1">
                    Profile Picture
                  </label>
                  <div className="flex items-center gap-2">
                    <label className="flex-1 cursor-pointer">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImageUpload}
                        className="hidden"
                      />
                      <div className="flex items-center gap-2 px-3 py-2 bg-black border border-green-500 rounded hover:bg-green-900/30 transition-colors">
                        <Upload className="w-4 h-4 text-green-300" />
                        <span className="text-green-300">Upload</span>
                      </div>
                    </label>
                    {formData.pfp && (
                      <img
                        src={formData.pfp}
                        alt="Preview"
                        className="w-10 h-10 rounded-full object-cover"
                      />
                    )}
                  </div>
                </div>
                
                {/* Tier */}
                <div>
                  <label className="block text-sm font-medium text-green-300 mb-1">
                    Tier
                  </label>
                  <select
                    value={formData.tier}
                    onChange={(e) => setFormData({...formData, tier: e.target.value as NonNullable<KOL['tier']>})}
                    className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 focus:outline-none focus:border-green-400"
                  >
                    <option value="hero">Hero</option>
                    <option value="legend">Legend</option>
                    <option value="star">Star</option>
                    <option value="rising">Rising</option>
                    <option value="micro">Micro</option>
                  </select>
                </div>
                
                {/* Contact */}
                <div>
                  <label className="block text-sm font-medium text-green-300 mb-1">
                    Contact
                  </label>
                  <input
                    type="text"
                    value={formData.contact}
                    onChange={(e) => setFormData({...formData, contact: e.target.value})}
                    placeholder="@telegram or email"
                    className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                  />
                </div>
                
                {/* Stage */}
                <div>
                  <label className="block text-sm font-medium text-green-300 mb-1">
                    Stage
                  </label>
                  <select
                    value={formData.stage}
                    onChange={(e) => setFormData({...formData, stage: e.target.value as KOL['stage']})}
                    className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 focus:outline-none focus:border-green-400"
                  >
                    <option value="reached out">Reached Out</option>
                    <option value="preparing">Preparing</option>
                    <option value="posted">Posted</option>
                    <option value="done">Done</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                </div>
                
                {/* Product */}
                <div>
                  <label className="block text-sm font-medium text-green-300 mb-1">
                    Product
                  </label>
                  {loadingProducts ? (
                    <div className="w-full bg-black border border-green-500 rounded px-3 py-2 text-gray-500">
                      Loading products...
                    </div>
                  ) : (
                    <select
                      value={selectedProduct}
                      onChange={(e) => {
                        const productId = e.target.value
                        const product = products.find(p => p.id === productId)
                        setSelectedProduct(productId)
                        setFormData({
                          ...formData,
                          productId,
                          productCost: product?.price || 0
                        })
                      }}
                      className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 focus:outline-none focus:border-green-400 cursor-pointer relative z-10"
                    >
                      <option value="">No product assigned</option>
                      {products.map(product => (
                        <option key={product.id} value={product.id}>
                          {product.name} - ${product.price} {product.stock !== undefined && product.stock > 0 ? `(${product.stock} available)` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                  {selectedProduct && (
                    <p className="text-xs text-green-400 mt-1">
                      Product value: ${products.find(p => p.id === selectedProduct)?.price || 0}
                    </p>
                  )}
                </div>
                
                {/* Device */}
                <div>
                  <label className="block text-sm font-medium text-green-300 mb-1">
                    Device Status
                  </label>
                  <select
                    value={formData.device}
                    onChange={(e) => setFormData({...formData, device: e.target.value as KOL['device']})}
                    className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 focus:outline-none focus:border-green-400"
                  >
                    <option value="na">➖ N/A</option>
                    <option value="on the way">📦 On the Way</option>
                    <option value="received">✅ Received</option>
                    <option value="owns">🏠 Owns</option>
                    <option value="sent before">📤 Sent Before</option>
                    <option value="problem">⚠️ Problem</option>
                  </select>
                  <p className="text-xs text-gray-400 mt-1">
                    Track device delivery status for this KOL
                  </p>
                </div>
                
                {/* Budget */}
                <div>
                  <label className="block text-sm font-medium text-green-300 mb-1">
                    Cash Budget
                  </label>
                  <input
                    type="text"
                    value={formData.budget}
                    onChange={(e) => setFormData({...formData, budget: e.target.value})}
                    placeholder="e.g. $500 or $0 for product-only"
                    className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                  />
                </div>
                
                {/* Payment Status */}
                <div>
                  <label className="block text-sm font-medium text-green-300 mb-1">
                    Payment
                  </label>
                  <select
                    value={formData.payment}
                    onChange={(e) => setFormData({...formData, payment: e.target.value as KOL['payment']})}
                    className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 focus:outline-none focus:border-green-400"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
                
                {/* Platform */}
                <div>
                  <label className="block text-sm font-medium text-green-300 mb-1">
                    Platform
                  </label>
                  <select
                    value={formData.platform[0]}
                    onChange={(e) => setFormData({...formData, platform: [e.target.value]})}
                    className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 focus:outline-none focus:border-green-400"
                  >
                    <option value="twitter">Twitter</option>
                    <option value="instagram">Instagram</option>
                    <option value="youtube">YouTube</option>
                    <option value="tiktok">TikTok</option>
                    <option value="twitch">Twitch</option>
                    <option value="linkedin">LinkedIn</option>
                  </select>
                </div>
                
                {/* Initial Views */}
                <div>
                  <label className="block text-sm font-medium text-green-300 mb-1">
                    Initial Views
                  </label>
                  <input
                    type="number"
                    value={formData.views}
                    onChange={(e) => setFormData({...formData, views: parseInt(e.target.value) || 0})}
                    placeholder="0"
                    className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                  />
                </div>
              </div>
              
              {/* Links - full width */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-green-300 mb-1">
                  Links
                </label>
                <textarea
                  value={formData.links.join(', ')}
                  onChange={(e) => setFormData({...formData, links: e.target.value.split(',').map(l => l.trim()).filter(Boolean)})}
                  placeholder="Enter links separated by commas"
                  rows={2}
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                />
                <p className="text-xs text-green-400 mt-1">
                  Separate multiple links with commas
                </p>
              </div>
            </div>
            
            {/* Error message */}
            {error && (
              <div className="bg-red-900/20 border border-red-500 p-3 rounded text-sm text-red-400">
                {error}
              </div>
            )}
            
            {/* Submit buttons */}
            <div className="flex justify-end gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-green-300 hover:text-green-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Adding...' : 'Add KOL'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
} 