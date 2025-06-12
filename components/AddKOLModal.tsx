'use client'

import { useState, useEffect } from 'react'
import { X, Search, Upload, Check } from './icons'
import { KOL } from '@/lib/campaign'
import { Product } from '@/lib/types/product'
import { UnifiedProfile } from '@/lib/types/profile'
import { ProfileService } from '@/lib/services/profile-service'
import { Campaign } from '@/lib/campaign'

interface AddKOLModalProps {
  campaign: Campaign
  onClose: () => void
  onAdd: (kol: Omit<KOL, 'id' | 'lastUpdated'>) => Promise<void>
}

export default function AddKOLModal({ campaign, onClose, onAdd }: AddKOLModalProps) {
  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<UnifiedProfile[]>([])
  const [searching, setSearching] = useState(false)
  const [selectedProfile, setSelectedProfile] = useState<UnifiedProfile | null>(null)
  
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
  
  // Search for approved KOLs
  useEffect(() => {
    const searchKOLs = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([])
        return
      }
      
      setSearching(true)
      try {
        const res = await fetch(`/api/profile/search?q=${encodeURIComponent(searchQuery)}&approved=true`)
        if (res.ok) {
          const data = await res.json()
          setSearchResults(data)
        }
      } catch (err) {
        console.error('Search error:', err)
      } finally {
        setSearching(false)
      }
    }
    
    const debounce = setTimeout(searchKOLs, 300)
    return () => clearTimeout(debounce)
  }, [searchQuery])
  
  // Handle KOL selection from search
  const selectKOL = (kol: UnifiedProfile) => {
    setFormData({
      ...formData,
      handle: kol.twitterHandle || '',
      name: kol.name || '',
      pfp: kol.profileImageUrl || '',
      tier: kol.currentTier || 'micro'
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
        throw new Error('Failed to add KOL')
      }
      
      const newKOL = await res.json()
      await onAdd(newKOL)
      onClose()
    } catch (err) {
      setError('Failed to add KOL. Please try again.')
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
              </div>
              
              {/* Search results */}
              {searchResults.length > 0 && (
                <div className="mt-2 border border-green-500 rounded max-h-40 overflow-y-auto">
                  {searchResults.map((kol) => (
                    <button
                      key={kol.id}
                      type="button"
                      onClick={() => selectKOL(kol)}
                      className="w-full p-2 hover:bg-green-900/50 text-left flex items-center gap-2 transition-colors"
                    >
                      {kol.profileImageUrl && (
                        <img
                          src={kol.profileImageUrl}
                          alt={kol.name}
                          className="w-8 h-8 rounded-full"
                        />
                      )}
                      <div>
                        <div className="text-green-300">{kol.name}</div>
                        <div className="text-xs text-green-500">@{kol.twitterHandle}</div>
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