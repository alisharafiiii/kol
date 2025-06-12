'use client'

import { useState, useEffect } from 'react'
import { KOL } from '@/lib/campaign'
import { Product } from '@/lib/types/product'

interface EditKOLModalProps {
  kol: KOL
  campaignId: string
  onClose: () => void
  onUpdate: (updatedKol: KOL) => void
}

export default function EditKOLModal({ kol, campaignId, onClose, onUpdate }: EditKOLModalProps) {
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(true)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [kolData, setKolData] = useState({
    handle: kol.handle || '',
    name: kol.name || '',
    pfp: kol.pfp || '',
    tier: kol.tier || 'micro' as KOL['tier'],
    stage: kol.stage || 'reached out',
    device: kol.device || 'na',
    budget: kol.budget || '',
    payment: kol.payment || 'pending',
    views: kol.views || 0,
    likes: kol.likes || 0,
    retweets: kol.retweets || 0,
    comments: kol.comments || 0,
    contact: kol.contact || '',
    links: kol.links?.join(', ') || '',
    platform: kol.platform || ['twitter'],
    productId: kol.productId || '',
    productCost: kol.productCost || 0
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  
  // Fetch products on mount
  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch('/api/products/active')
        if (res.ok) {
          const data = await res.json()
          setProducts(data)
          
          // If KOL has a product assigned, find and select it
          if (kol.productId) {
            const product = data.find((p: Product) => p.id === kol.productId)
            setSelectedProduct(product || null)
          }
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
  }, [kol.productId])
  
  // Handle product selection
  const handleProductSelect = (productId: string) => {
    const product = products.find(p => p.id === productId)
    setSelectedProduct(product || null)
    setKolData({
      ...kolData,
      productId,
      productCost: product?.price || 0,
      device: product ? 'owned' : 'na'
    })
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!kolData.handle || !kolData.name) {
      setError('Please fill in all required fields')
      return
    }
    
    setIsSubmitting(true)
    setError('')
    
    try {
      const res = await fetch(`/api/campaigns/${campaignId}/kols/${kol.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...kolData,
          handle: kolData.handle.replace('@', ''),
          links: kolData.links.split(',').map(l => l.trim()).filter(Boolean),
          views: parseInt(kolData.views.toString()) || 0,
          likes: parseInt(kolData.likes.toString()) || 0,
          retweets: parseInt(kolData.retweets.toString()) || 0,
          comments: parseInt(kolData.comments.toString()) || 0,
          productId: selectedProduct?.id,
          productCost: selectedProduct?.price || 0
        })
      })
      
      if (!res.ok) {
        throw new Error('Failed to update KOL')
      }
      
      const updatedKol = await res.json()
      onUpdate(updatedKol)
      onClose()
    } catch (err) {
      setError('Failed to update KOL. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-50">
      <div className="bg-black border border-green-300 p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-bold">Edit KOL</h2>
          <button 
            onClick={onClose}
            className="text-green-300 hover:text-green-100"
          >
            ✕
          </button>
        </div>
        
        {/* KOL Info Header */}
        <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-4">
            {kolData.pfp && (
              <img
                src={kolData.pfp}
                alt={kolData.name}
                className="w-16 h-16 rounded-full object-cover"
              />
            )}
            <div>
              <h3 className="text-lg font-semibold text-green-300">@{kolData.handle}</h3>
              <p className="text-sm text-green-400">{kolData.name}</p>
            </div>
          </div>
        </div>
        
        {error && (
          <div className="bg-red-900/20 border border-red-500 p-3 mb-4 text-sm text-red-400">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm mb-1">Handle *</label>
              <input
                type="text"
                value={kolData.handle}
                onChange={e => setKolData({...kolData, handle: e.target.value})}
                placeholder="@username"
                className="w-full bg-black border border-green-300 p-2 text-sm"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm mb-1">Name *</label>
              <input
                type="text"
                value={kolData.name}
                onChange={e => setKolData({...kolData, name: e.target.value})}
                placeholder="Display Name"
                className="w-full bg-black border border-green-300 p-2 text-sm"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm mb-1">Tier</label>
              <select 
                value={kolData.tier}
                onChange={e => setKolData({...kolData, tier: e.target.value as NonNullable<KOL['tier']>})}
                className="w-full bg-black border border-green-300 p-2 text-sm"
              >
                <option value="hero">Hero</option>
                <option value="legend">Legend</option>
                <option value="star">Star</option>
                <option value="rising">Rising</option>
                <option value="micro">Micro</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm mb-1">Stage</label>
              <select 
                value={kolData.stage}
                onChange={e => setKolData({...kolData, stage: e.target.value as KOL['stage']})}
                className="w-full bg-black border border-green-300 p-2 text-sm"
              >
                <option value="reached out">Reached Out</option>
                <option value="preparing">Preparing</option>
                <option value="posted">Posted</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-green-300 mb-1">
                Product/Device
              </label>
              {loadingProducts ? (
                <div className="w-full bg-black border border-green-500 rounded px-3 py-2 text-gray-500">
                  Loading products...
                </div>
              ) : (
                <select
                  value={selectedProduct?.id || ''}
                  onChange={(e) => {
                    const product = products.find(p => p.id === e.target.value)
                    setSelectedProduct(product || null)
                    setKolData({
                      ...kolData,
                      productId: e.target.value,
                      productCost: product?.price || 0,
                      device: product ? 'owned' : 'na'
                    })
                  }}
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 focus:outline-none focus:border-green-400 cursor-pointer"
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
                  Product value: ${selectedProduct.price} (tracked separately from cash budget)
                </p>
              )}
            </div>
            
            <div>
              <label className="block text-sm mb-1">Cash Budget</label>
              <input
                type="text"
                value={kolData.budget}
                onChange={e => setKolData({...kolData, budget: e.target.value})}
                placeholder="e.g. $500 or $0 for product-only"
                className="w-full bg-black border border-green-300 p-2 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm mb-1">Payment Status</label>
              <select 
                value={kolData.payment}
                onChange={e => setKolData({...kolData, payment: e.target.value as KOL['payment']})}
                className="w-full bg-black border border-green-300 p-2 text-sm"
              >
                <option value="pending">Pending</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm mb-1">Contact</label>
              <input
                type="text"
                value={kolData.contact}
                onChange={e => setKolData({...kolData, contact: e.target.value})}
                placeholder="Email or @telegram"
                className="w-full bg-black border border-green-300 p-2 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm mb-1">Platform</label>
              <select 
                value={kolData.platform[0]}
                onChange={e => setKolData({...kolData, platform: [e.target.value]})}
                className="w-full bg-black border border-green-300 p-2 text-sm"
              >
                <option value="twitter">Twitter</option>
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
                <option value="tiktok">TikTok</option>
                <option value="linkedin">LinkedIn</option>
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm mb-1">Views</label>
              <input
                type="number"
                value={kolData.views}
                onChange={e => setKolData({...kolData, views: parseInt(e.target.value) || 0})}
                placeholder="0"
                className="w-full bg-black border border-green-300 p-2 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm mb-1">Likes</label>
              <input
                type="number"
                value={kolData.likes}
                onChange={e => setKolData({...kolData, likes: parseInt(e.target.value) || 0})}
                placeholder="0"
                className="w-full bg-black border border-green-300 p-2 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm mb-1">Retweets</label>
              <input
                type="number"
                value={kolData.retweets}
                onChange={e => setKolData({...kolData, retweets: parseInt(e.target.value) || 0})}
                placeholder="0"
                className="w-full bg-black border border-green-300 p-2 text-sm"
              />
            </div>
            
            <div>
              <label className="block text-sm mb-1">Comments</label>
              <input
                type="number"
                value={kolData.comments}
                onChange={e => setKolData({...kolData, comments: parseInt(e.target.value) || 0})}
                placeholder="0"
                className="w-full bg-black border border-green-300 p-2 text-sm"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm mb-1">Links (comma separated)</label>
            <textarea
              value={kolData.links}
              onChange={e => setKolData({...kolData, links: e.target.value})}
              placeholder="https://twitter.com/username/status/123, https://..."
              rows={3}
              className="w-full bg-black border border-green-300 p-2 text-sm"
            />
          </div>
          
          <div className="flex justify-end gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-green-300 hover:bg-green-900"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-green-900 hover:bg-green-800 disabled:opacity-50"
            >
              {isSubmitting ? 'Updating...' : 'Update KOL'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
} 