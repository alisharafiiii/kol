'use client'

import { useState, useEffect } from 'react'
import type { KOL } from '@/lib/campaign'
import type { Product } from '@/lib/types/product'
import KOLProfileModal from './KOLProfileModal'
import { ProductServiceClient } from '@/lib/services/product-service-client'

interface KOLTableProps {
  kols: KOL[]
  campaignId: string
  onUpdate: (kolId: string, updates: Partial<KOL>) => void
  onDelete: (kolId: string) => void
  canEdit: boolean
}

export default function KOLTable({ kols, campaignId, onUpdate, onDelete, canEdit }: KOLTableProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<any>(null)
  const [selectedKOL, setSelectedKOL] = useState<{ handle: string; name: string } | null>(null)
  const [products, setProducts] = useState<Product[]>([])
  const [loadingProducts, setLoadingProducts] = useState(false)
  const [showProductModal, setShowProductModal] = useState<string | null>(null)
  const [updatingProduct, setUpdatingProduct] = useState<string | null>(null)
  const [selectedProducts, setSelectedProducts] = useState<string[]>([])
  const [newLinkInput, setNewLinkInput] = useState('')

  const stages: KOL['stage'][] = ['reached out', 'preparing', 'posted', 'done', 'cancelled']
  const devices: KOL['device'][] = ['na', 'on the way', 'received', 'owns', 'sent before', 'problem']
  const payments: KOL['payment'][] = ['pending', 'approved', 'paid', 'rejected']
  const tiers: KOL['tier'][] = ['hero', 'legend', 'star', 'rising', 'micro']

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoadingProducts(true)
        const activeProducts = await ProductServiceClient.getActiveProducts()
        setProducts(activeProducts)
      } catch (error) {
        console.error('Error fetching products:', error)
      } finally {
        setLoadingProducts(false)
      }
    }
    fetchProducts()
  }, [])
  
  // Get all products for a specific KOL handle
  const getKOLProducts = (handle: string) => {
    return kols.filter(k => k.handle === handle)
  }

  const startEdit = (kolId: string, field: string, value: any) => {
    if (!canEdit) return
    setEditingId(kolId)
    setEditingField(field)
    setEditValue(value)
  }

  const saveEdit = async (kolId: string, field: string) => {
    let value: any = editValue
    
    if (field === 'views' || field === 'likes' || field === 'retweets' || field === 'comments') {
      value = parseInt(String(editValue)) || 0
    } else if (field === 'links') {
      // For links, editValue is already an array
      value = editValue
    } else if (field === 'platform') {
      value = String(editValue).split(',').map((v: string) => v.trim()).filter(Boolean)
    }
    
    // Find the KOL being edited
    const editedKOL = kols.find(k => k.id === kolId)
    if (!editedKOL) return
    
    // If editing a non-product field, update all entries for this handle
    if (!['productId', 'productCost', 'productQuantity'].includes(field)) {
      const kolsWithSameHandle = kols.filter(k => k.handle === editedKOL.handle)
      
      // Update all KOL entries with the same handle
      try {
        await Promise.all(
          kolsWithSameHandle.map(k => onUpdate(k.id, { [field]: value }))
        )
        setEditingId(null)
        setEditingField(null)
        setEditValue('')
        setNewLinkInput('')
      } catch (error) {
        console.error('Error updating KOLs:', error)
        alert('Failed to update. Please try again.')
      }
    } else {
      // For product fields, only update the specific entry
      try {
        await onUpdate(kolId, { [field]: value })
        setEditingId(null)
        setEditingField(null)
        setEditValue('')
      } catch (error) {
        console.error('Error updating KOL:', error)
        alert('Failed to update. Please try again.')
      }
    }
  }

  const handleProductChange = async (kolId: string, productId: string | null) => {
    setUpdatingProduct(kolId)
    try {
      if (productId === null) {
        // Remove product - use empty strings instead of null
        await onUpdate(kolId, { 
          productId: '', 
          productCost: 0,
          productAssignmentId: ''
        })
      } else {
        // Add/change product
        const product = products.find(p => p.id === productId)
        if (product) {
          await onUpdate(kolId, { 
            productId: product.id,
            productCost: product.price
          })
        }
      }
      // Close modal only after successful update
      setShowProductModal(null)
      
      // Optionally refresh products list to ensure we have latest data
      const updatedProducts = await ProductServiceClient.getActiveProducts()
      setProducts(updatedProducts)
    } catch (error) {
      console.error('Error updating product:', error)
      alert('Failed to update product. Please try again.')
    } finally {
      setUpdatingProduct(null)
    }
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditingField(null)
    setEditValue('')
    setNewLinkInput('')
  }

  const getStageColor = (stage: KOL['stage']) => {
    switch (stage) {
      case 'done': return 'text-green-400'
      case 'posted': return 'text-blue-400'
      case 'cancelled': return 'text-red-400'
      case 'preparing': return 'text-yellow-400'
      default: return 'text-gray-400'
    }
  }

  const getPaymentColor = (payment: KOL['payment']) => {
    switch (payment) {
      case 'paid': return 'text-green-400'
      case 'approved': return 'text-blue-400'
      case 'rejected': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const getDeviceColor = (device?: KOL['device']) => {
    switch (device) {
      case 'received': return 'bg-green-600 text-white w-24'
      case 'owns': return 'bg-green-500 text-white w-24'
      case 'on the way': return 'bg-yellow-500 text-black w-24'
      case 'sent before': return 'bg-blue-500 text-white w-24'
      case 'problem': return 'bg-red-600 text-white w-24'
      case 'na': 
      default: return 'bg-gray-600 text-white w-24'
    }
  }

  const getTierBadge = (tier?: KOL['tier']) => {
    switch (tier) {
      case 'hero': return { text: 'HERO', color: 'bg-purple-600 text-white' }
      case 'legend': return { text: 'LEGEND', color: 'bg-orange-600 text-white' }
      case 'star': return { text: 'STAR', color: 'bg-yellow-500 text-black' }
      case 'rising': return { text: 'RISING', color: 'bg-blue-500 text-white' }
      case 'micro': return { text: 'MICRO', color: 'bg-gray-600 text-white' }
      default: return null
    }
  }

  const getPlatformIcon = (platform: string) => {
    switch (platform.toLowerCase()) {
      case 'twitter': case 'x': return '𝕏'
      case 'instagram': return '📷'
      case 'youtube': return '▶️'
      case 'tiktok': return '🎵'
      case 'linkedin': return '💼'
      case 'facebook': return 'f'
      default: return platform[0]?.toUpperCase() || '?'
    }
  }

  const formatContactLink = (contact: string) => {
    // Add protocol if missing
    if (contact && !contact.match(/^https?:\/\//) && !contact.startsWith('mailto:')) {
      if (contact.includes('@') && !contact.includes('/')) {
        return `mailto:${contact}`
      } else if (contact.startsWith('t.me/') || contact.includes('telegram')) {
        return `https://${contact}`
      } else {
        return `https://${contact}`
      }
    }
    return contact
  }

  const getContactDisplay = (contact: string) => {
    if (contact.includes('@') && !contact.includes('/')) {
      return '✉️ Email'
    } else if (contact.includes('t.me') || contact.includes('telegram')) {
      return '💬 Telegram'
    } else if (contact.includes('wa.me') || contact.includes('whatsapp')) {
      return '📱 WhatsApp'
    } else {
      return '🔗 Contact'
    }
  }

  const shortenUrl = (url: string, maxLength: number = 25) => {
    try {
      const urlObj = new URL(url)
      const domain = urlObj.hostname.replace('www.', '')
      const path = urlObj.pathname
      
      // For Twitter/X links, show the username
      if (domain.includes('twitter.com') || domain.includes('x.com')) {
        const match = path.match(/\/([^\/]+)\/status/)
        if (match) return `x.com/${match[1]}/...`
      }
      
      // For other links, show domain + shortened path
      if (path.length > 1) {
        const shortPath = path.length > 15 ? path.substring(0, 12) + '...' : path
        return domain + shortPath
      }
      
      return domain
    } catch {
      // If URL parsing fails, just truncate
      return url.length > maxLength ? url.substring(0, maxLength) + '...' : url
    }
  }

  if (kols.length === 0) {
    return (
      <div className="border border-green-300 p-8 text-center">
        <p className="text-gray-500">No KOLs added yet</p>
      </div>
    )
  }

  // Group KOLs by handle to consolidate entries
  const groupedKOLs = kols.reduce((acc, kol) => {
    if (!acc[kol.handle]) {
      acc[kol.handle] = {
        mainKOL: kol,
        products: []
      }
    }
    // Update main KOL data with latest non-product info
    Object.keys(kol).forEach(key => {
      if (!['id', 'productId', 'productCost', 'productQuantity', 'productAssignmentId'].includes(key)) {
        (acc[kol.handle].mainKOL as any)[key] = (kol as any)[key]
      }
    })
    // Add product info if exists
    if (kol.productId) {
      acc[kol.handle].products.push({
        kolEntryId: kol.id,
        productId: kol.productId,
        productCost: kol.productCost || 0,
        productQuantity: kol.productQuantity || 1
      })
    } else if (!acc[kol.handle].mainKOL.id) {
      // Ensure we have the main KOL ID for entries without products
      acc[kol.handle].mainKOL.id = kol.id
    }
    return acc
  }, {} as Record<string, { mainKOL: KOL, products: Array<{ kolEntryId: string, productId: string, productCost: number, productQuantity: number }> }>)

  return (
    <>
      <div className="overflow-x-auto">
        <table className="w-full border border-green-300">
          <thead>
            <tr className="border-b border-green-300 bg-green-950">
              <th className="p-2 text-left text-xs uppercase">KOL</th>
              <th className="p-2 text-left text-xs uppercase">Tier</th>
              <th className="p-2 text-left text-xs uppercase">Stage</th>
              <th className="p-2 text-left text-xs uppercase">Device</th>
              <th className="p-2 text-left text-xs uppercase">Budget</th>
              <th className="p-2 text-left text-xs uppercase">Product(s)</th>
              <th className="p-2 text-left text-xs uppercase">Payment</th>
              <th className="p-2 text-left text-xs uppercase">Views</th>
              <th className="p-2 text-left text-xs uppercase">Likes</th>
              <th className="p-2 text-left text-xs uppercase">RTs</th>
              <th className="p-2 text-left text-xs uppercase">Comments</th>
              <th className="p-2 text-left text-xs uppercase">Contact</th>
              <th className="p-2 text-left text-xs uppercase">Links</th>
              <th className="p-2 text-left text-xs uppercase">Platform</th>
              {canEdit && <th className="p-2 text-left text-xs uppercase">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {Object.values(groupedKOLs).map(({ mainKOL: kol, products: kolProductEntries }) => (
              <tr key={kol.handle} className={`border-b border-green-300 hover:bg-green-950/30 ${editingId === kol.id ? 'bg-green-950/20' : ''}`}>
                <td className="p-2">
                  <div className="flex items-center gap-2">
                    {kol.pfp ? (
                      <img src={kol.pfp} alt={kol.handle} className="w-8 h-8 rounded-full" />
                    ) : (
                      <img src={`https://unavatar.io/twitter/${kol.handle}`} alt={kol.handle} className="w-8 h-8 rounded-full" />
                    )}
                    <div>
                      <div 
                        className="font-medium cursor-pointer hover:text-green-400 transition-colors"
                        onClick={() => setSelectedKOL({ handle: kol.handle, name: kol.name })}
                      >
                        <span title={kol.name}>
                          {kol.name}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">@{kol.handle}</div>
                    </div>
                  </div>
                </td>
                
                <td className="p-2">
                  {editingId === kol.id && editingField === 'tier' ? (
                    <select
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(kol.id, 'tier')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(kol.id, 'tier')
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="bg-black border border-green-300 text-xs p-1"
                      autoFocus
                    >
                      <option value="">None</option>
                      {tiers.map(t => (
                        <option key={t} value={t}>{t ? t.toUpperCase() : ''}</option>
                      ))}
                    </select>
                  ) : (
                    <div 
                      className="cursor-pointer"
                      onClick={() => canEdit && startEdit(kol.id, 'tier', kol.tier || '')}
                    >
                      {kol.tier && getTierBadge(kol.tier) ? (
                        <span className={`text-xs px-2 py-1 rounded font-bold ${getTierBadge(kol.tier)!.color}`}>
                          {getTierBadge(kol.tier)!.text}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-500">-</span>
                      )}
                    </div>
                  )}
                </td>
                
                <td className="p-2">
                  {editingId === kol.id && editingField === 'stage' ? (
                    <select
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(kol.id, 'stage')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(kol.id, 'stage')
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="bg-black border border-green-300 text-xs p-1"
                      autoFocus
                    >
                      {stages.map(s => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  ) : (
                    <button 
                      className={`px-2 py-1 rounded text-xs ${getStageColor(kol.stage || 'reached out')} bg-gray-800 hover:bg-gray-700 transition-all ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
                      onClick={() => canEdit && startEdit(kol.id, 'stage', kol.stage)}
                      disabled={!canEdit}
                    >
                      {kol.stage || 'reached out'}
                    </button>
                  )}
                </td>
                
                <td className="p-2">
                  {editingId === kol.id && editingField === 'device' ? (
                    <select
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(kol.id, 'device')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(kol.id, 'device')
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="bg-black border border-green-300 text-xs p-1"
                      autoFocus
                    >
                      {devices.map(d => (
                        <option key={d} value={d}>
                          {d === 'na' ? '➖ N/A' : 
                           d === 'on the way' ? '📦 On the Way' : 
                           d === 'received' ? '✅ Received' : 
                           d === 'owns' ? '🏠 Owns' :
                           d === 'sent before' ? '📤 Sent Before' :
                           d === 'problem' ? '⚠️ Problem' :
                           d}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <button
                      onClick={() => startEdit(kol.id, 'device', kol.device || 'na')}
                      className={`px-2 py-1 rounded text-xs ${getDeviceColor(kol.device)} transition-all hover:opacity-80 ${canEdit ? 'cursor-pointer' : 'cursor-default'} text-center`}
                      disabled={!canEdit}
                    >
                      {kol.device === 'na' && '➖ N/A'}
                      {kol.device === 'on the way' && '📦 Shipping'}
                      {kol.device === 'received' && '✅ Received'}
                      {kol.device === 'owns' && '🏠 Owns'}
                      {kol.device === 'sent before' && '📤 Sent'}
                      {kol.device === 'problem' && '⚠️ Issue'}
                    </button>
                  )}
                </td>
                
                <td className="p-2">
                  {editingId === kol.id && editingField === 'budget' ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(kol.id, 'budget')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(kol.id, 'budget')
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="bg-black border border-green-300 text-xs p-1 w-24"
                      autoFocus
                    />
                  ) : (
                    <span 
                      className="text-xs cursor-pointer"
                      onClick={() => canEdit && startEdit(kol.id, 'budget', kol.budget)}
                    >
                      {kol.budget}
                    </span>
                  )}
                </td>
                
                <td className="p-2">
                  {(() => {
                    if (loadingProducts) {
                      return (
                        <div className="text-xs text-gray-500 animate-pulse">
                          Loading...
                        </div>
                      )
                    }
                    
                    // Get all products for this KOL
                    const kolProducts = kolProductEntries.map(pe => {
                      const product = products.find(p => p.id === pe.productId)
                      return product ? { 
                        ...product, 
                        kolEntryId: pe.kolEntryId, 
                        productCost: pe.productCost,
                        productQuantity: pe.productQuantity 
                      } : null
                    }).filter(Boolean) as (Product & { kolEntryId: string; productCost: number; productQuantity: number })[]
                    
                    const currentProduct = kol.productId && kol.productId !== '' ? products.find(p => p.id === kol.productId) : null
                    
                    if (showProductModal === kol.id) {
                      return (
                        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50" onClick={() => setShowProductModal(null)}>
                          <div className="bg-black border border-green-300 p-4 rounded-lg max-w-3xl max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-between mb-3">
                              <h3 className="text-sm font-bold text-green-300">Manage Products for @{kol.handle}</h3>
                              <button
                                onClick={() => setShowProductModal(null)}
                                className="text-gray-400 hover:text-gray-200 text-lg"
                              >
                                ✕
                              </button>
                            </div>
                            
                            {/* Current products */}
                            {kolProducts.length > 0 && (
                              <div className="mb-4">
                                <p className="text-xs text-gray-400 mb-2">Current products:</p>
                                <div className="space-y-2">
                                  {kolProducts.map(p => (
                                    <div key={p.kolEntryId} className="flex items-center justify-between bg-gray-900 p-2 rounded">
                                      <div className="flex items-center gap-2">
                                        {p.image ? (
                                          <img src={p.image} alt={p.name} className="w-10 h-10 object-cover rounded" />
                                        ) : (
                                          <div className="w-10 h-10 bg-gray-800 rounded flex items-center justify-center text-gray-500">
                                            📦
                                          </div>
                                        )}
                                        <div>
                                          <div className="text-xs text-green-300">{p.name}</div>
                                          <div className="text-xs text-purple-400">
                                            ${p.productCost || p.price} × {p.productQuantity} = ${(p.productCost || p.price) * p.productQuantity}
                                          </div>
                                        </div>
                                      </div>
                                      <button
                                        onClick={async () => {
                                          try {
                                            // Confirm before removing
                                            if (!confirm(`Remove ${p.name} from @${kol.handle}?`)) {
                                              return
                                            }
                                            
                                            // Check if this is the only product for this KOL
                                            if (kolProducts.length === 1) {
                                              // This is the only product, so we update the KOL to remove product fields
                                              await onUpdate(p.kolEntryId, {
                                                productId: '',
                                                productCost: 0,
                                                productQuantity: 1
                                              })
                                            } else {
                                              // Multiple products exist, so we need to delete this specific entry
                                              await onDelete(p.kolEntryId)
                                            }
                                            
                                            // Trigger parent refresh
                                            if ((window as any).refreshCampaignData) {
                                              await (window as any).refreshCampaignData()
                                            }
                                            // Close modal after refresh
                                            setShowProductModal(null)
                                          } catch (error) {
                                            console.error('Error removing product:', error)
                                            alert('Failed to remove product')
                                          }
                                        }}
                                        className="text-red-400 hover:text-red-300 text-xs px-2 py-1 border border-red-500 rounded"
                                      >
                                        Remove
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            
                            {products.length === 0 ? (
                              <div className="text-center py-8">
                                <p className="text-xs text-gray-500">No products available in database</p>
                              </div>
                            ) : (
                              <>
                                <p className="text-xs text-gray-400 mb-3">Add products:</p>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                                  {/* Show all products - allow adding same product multiple times */}
                                  {products.map(p => (
                                    <button
                                      key={p.id}
                                      onClick={async (e) => {
                                        e.preventDefault()
                                        
                                        // Ask for quantity
                                        const quantityStr = prompt(`How many ${p.name} do you want to add?`, '1')
                                        if (!quantityStr) return
                                        
                                        const quantity = parseInt(quantityStr)
                                        if (isNaN(quantity) || quantity < 1) {
                                          alert('Please enter a valid quantity')
                                          return
                                        }
                                        
                                        // Create a new KOL entry with this product
                                        try {
                                          const res = await fetch(`/api/campaigns/${campaignId}/kols`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                              handle: kol.handle,
                                              name: kol.name,
                                              pfp: kol.pfp,
                                              tier: kol.tier,
                                              stage: kol.stage,
                                              device: kol.device,
                                              budget: "0",
                                              payment: kol.payment,
                                              platform: kol.platform || ['x'],
                                              contact: kol.contact || '',
                                              links: kol.links || [],
                                              views: kol.views || 0,
                                              productId: p.id,
                                              productCost: p.price,
                                              productQuantity: quantity
                                            })
                                          })
                                          if (res.ok) {
                                            // Close modal and trigger parent refresh
                                            setShowProductModal(null)
                                            // Call the parent's fetch function if available
                                            if ((window as any).refreshCampaignData) {
                                              (window as any).refreshCampaignData()
                                            } else {
                                              // Fallback to reload if no refresh function
                                              window.location.reload()
                                            }
                                          } else {
                                            const error = await res.json()
                                            alert(error.error || 'Failed to add product')
                                          }
                                        } catch (error) {
                                          console.error('Error adding product:', error)
                                          alert('Failed to add product')
                                        }
                                      }}
                                      disabled={updatingProduct === kol.id}
                                      className={`border border-gray-600 p-2 rounded hover:border-green-400 transition-colors ${updatingProduct === kol.id ? 'opacity-50 cursor-not-allowed' : ''}`}
                                    >
                                      {p.image ? (
                                        <img src={p.image} alt={p.name} className="w-16 h-16 object-cover rounded mx-auto mb-1" />
                                      ) : (
                                        <div className="w-16 h-16 bg-gray-800 rounded mx-auto mb-1 flex items-center justify-center text-gray-500">
                                          📦
                                        </div>
                                      )}
                                      <div className="text-xs text-green-300 truncate">{p.name}</div>
                                      <div className="text-xs text-purple-400">${p.price}</div>
                                    </button>
                                  ))}
                                </div>
                              </>
                            )}
                            
                            <div className="flex justify-end items-center mt-4 gap-2">
                              <button
                                onClick={() => setShowProductModal(null)}
                                className="px-3 py-1 bg-gray-800 text-gray-300 text-xs rounded hover:bg-gray-700"
                              >
                                Close
                              </button>
                              <button
                                onClick={() => {
                                  // Refresh products list
                                  setLoadingProducts(true)
                                  ProductServiceClient.getActiveProducts()
                                    .then(setProducts)
                                    .catch(console.error)
                                    .finally(() => setLoadingProducts(false))
                                }}
                                className="px-3 py-1 bg-blue-900/50 border border-blue-500 text-blue-300 text-xs rounded hover:bg-blue-800/50"
                              >
                                🔄 Refresh List
                              </button>
                            </div>
                          </div>
                        </div>
                      )
                    }
                    
                    return (
                      <div 
                        className={`cursor-pointer ${canEdit && !loadingProducts ? 'hover:bg-green-900/20' : ''} p-1 rounded ${loadingProducts ? 'cursor-not-allowed opacity-50' : ''}`}
                        onClick={() => canEdit && !loadingProducts && setShowProductModal(kol.id)}
                      >
                        {kolProducts.length > 0 ? (
                          <div className="space-y-1">
                            {/* Group products by ID to show quantities */}
                            {(() => {
                              const productGroups = kolProducts.reduce((acc, p) => {
                                if (!acc[p.id]) {
                                  acc[p.id] = { ...p, totalQuantity: 0, entries: [] }
                                }
                                acc[p.id].totalQuantity += p.productQuantity
                                acc[p.id].entries.push(p)
                                return acc
                              }, {} as Record<string, any>)
                              
                              return Object.values(productGroups).map((group: any, idx) => (
                                <div key={group.id} className="flex items-center gap-1">
                                  {group.image ? (
                                    <img src={group.image} alt={group.name} className="w-6 h-6 object-cover rounded" />
                                  ) : (
                                    <div className="w-6 h-6 bg-gray-800 rounded flex items-center justify-center text-gray-500 text-xs">
                                      📦
                                    </div>
                                  )}
                                  <div>
                                    <div className="text-xs text-purple-400">
                                      ${group.price} {group.totalQuantity > 1 && `× ${group.totalQuantity}`}
                                    </div>
                                    <div className="text-xs text-gray-500 truncate max-w-[60px]" title={group.name}>
                                      {group.name}
                                    </div>
                                  </div>
                                </div>
                              ))
                            })()}
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 hover:text-green-400">
                            {canEdit ? '+ Add' : '-'}
                          </div>
                        )}
                      </div>
                    )
                  })()}
                </td>
                
                <td className="p-2">
                  {editingId === kol.id && editingField === 'payment' ? (
                    <select
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(kol.id, 'payment')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(kol.id, 'payment')
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="bg-black border border-green-300 text-xs p-1"
                      autoFocus
                    >
                      {payments.map(p => (
                        <option key={p} value={p}>{p}</option>
                      ))}
                    </select>
                  ) : (
                    <button 
                      className={`px-2 py-1 rounded text-xs ${getPaymentColor(kol.payment || 'pending')} bg-gray-800 hover:bg-gray-700 transition-all ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
                      onClick={() => canEdit && startEdit(kol.id, 'payment', kol.payment)}
                      disabled={!canEdit}
                    >
                      {kol.payment || 'pending'}
                    </button>
                  )}
                </td>
                
                <td className="p-2">
                  {editingId === kol.id && editingField === 'views' ? (
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(kol.id, 'views')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(kol.id, 'views')
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="bg-black border border-green-300 text-xs p-1 w-20"
                      autoFocus
                    />
                  ) : (
                    <span 
                      className="text-xs cursor-pointer flex items-center gap-1"
                      onClick={() => canEdit && startEdit(kol.id, 'views', kol.views)}
                    >
                      <span className="opacity-50">👁️</span>
                      {(kol.views || 0).toLocaleString()}
                    </span>
                  )}
                </td>
                
                <td className="p-2">
                  {editingId === kol.id && editingField === 'likes' ? (
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(kol.id, 'likes')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(kol.id, 'likes')
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="bg-black border border-green-300 text-xs p-1 w-20"
                      autoFocus
                    />
                  ) : (
                    <span 
                      className="text-xs cursor-pointer flex items-center gap-1"
                      onClick={() => canEdit && startEdit(kol.id, 'likes', kol.likes || 0)}
                    >
                      <span className="opacity-50">❤️</span>
                      {(kol.likes || 0).toLocaleString()}
                    </span>
                  )}
                </td>
                
                <td className="p-2">
                  {editingId === kol.id && editingField === 'retweets' ? (
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(kol.id, 'retweets')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(kol.id, 'retweets')
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="bg-black border border-green-300 text-xs p-1 w-20"
                      autoFocus
                    />
                  ) : (
                    <span 
                      className="text-xs cursor-pointer flex items-center gap-1"
                      onClick={() => canEdit && startEdit(kol.id, 'retweets', kol.retweets || 0)}
                    >
                      <span className="opacity-50">🔁</span>
                      {(kol.retweets || 0).toLocaleString()}
                    </span>
                  )}
                </td>
                
                <td className="p-2">
                  {editingId === kol.id && editingField === 'comments' ? (
                    <input
                      type="number"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(kol.id, 'comments')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(kol.id, 'comments')
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="bg-black border border-green-300 text-xs p-1 w-20"
                      autoFocus
                    />
                  ) : (
                    <span 
                      className="text-xs cursor-pointer flex items-center gap-1"
                      onClick={() => canEdit && startEdit(kol.id, 'comments', kol.comments || 0)}
                    >
                      <span className="opacity-50">💬</span>
                      {(kol.comments || 0).toLocaleString()}
                    </span>
                  )}
                </td>
                
                <td className="p-2">
                  {editingId === kol.id && editingField === 'contact' ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(kol.id, 'contact')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(kol.id, 'contact')
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="bg-black border border-green-300 text-xs p-1 w-32"
                      placeholder="Email, Telegram, etc"
                      autoFocus
                    />
                  ) : (
                    <div 
                      className="text-xs cursor-pointer"
                      onClick={() => canEdit && startEdit(kol.id, 'contact', kol.contact || '')}
                    >
                      {kol.contact ? (
                        kol.contact.startsWith('@') ? (
                          <a 
                            href={`https://t.me/${kol.contact.substring(1)}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-400 hover:underline"
                          >
                            {kol.contact}
                          </a>
                        ) : kol.contact.includes('@') ? (
                          <a 
                            href={`mailto:${kol.contact}`}
                            className="text-green-400 hover:underline"
                          >
                            {kol.contact}
                          </a>
                        ) : (
                          kol.contact
                        )
                      ) : (
                        <span className="text-gray-500">No contact</span>
                      )}
                    </div>
                  )}
                </td>
                
                <td className="p-2">
                  {editingId === kol.id && editingField === 'links' ? (
                    <div className="space-y-2 bg-black border border-green-300 p-2 rounded min-w-[200px]">
                      {/* Existing links */}
                      {((editValue as string[]) || kol.links || []).map((link, i) => (
                        <div key={i} className="flex items-center gap-1">
                          <input
                            type="text"
                            value={link}
                            onChange={(e) => {
                              const currentLinks = editValue as string[] || kol.links || []
                              const newLinks = [...currentLinks]
                              newLinks[i] = e.target.value
                              setEditValue(newLinks)
                            }}
                            className="bg-gray-900 border border-gray-600 text-xs p-1 flex-1"
                            placeholder="https://..."
                          />
                          <button
                            onClick={() => {
                              const currentLinks = editValue as string[] || kol.links || []
                              const newLinks = currentLinks.filter((_, idx) => idx !== i)
                              setEditValue(newLinks)
                            }}
                            className="text-red-400 hover:text-red-300 text-xs px-1"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      
                      {/* Add new link input */}
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={newLinkInput}
                          onChange={(e) => setNewLinkInput(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && newLinkInput.trim()) {
                              e.preventDefault()
                              const currentLinks = editValue as string[] || kol.links || []
                              const newLinks = [...currentLinks, newLinkInput.trim()]
                              setEditValue(newLinks)
                              setNewLinkInput('')
                            }
                          }}
                          className="bg-gray-900 border border-gray-600 text-xs p-1 flex-1"
                          placeholder="Add new link..."
                        />
                        <button
                          onClick={() => {
                            if (newLinkInput.trim()) {
                              const currentLinks = editValue as string[] || kol.links || []
                              const newLinks = [...currentLinks, newLinkInput.trim()]
                              setEditValue(newLinks)
                              setNewLinkInput('')
                            }
                          }}
                          className="text-green-400 hover:text-green-300 text-xs px-1"
                        >
                          +
                        </button>
                      </div>
                      
                      {/* Save/Cancel buttons */}
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => saveEdit(kol.id, 'links')}
                          className="text-xs bg-green-900/50 border border-green-500 text-green-300 px-2 py-1 rounded hover:bg-green-800/50"
                        >
                          Save
                        </button>
                        <button
                          onClick={() => {
                            cancelEdit()
                          }}
                          className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded hover:bg-gray-700"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div 
                      className="text-xs cursor-pointer hover:bg-green-900/20 p-1 rounded"
                      onClick={() => canEdit && startEdit(kol.id, 'links', kol.links || [])}
                    >
                      {(kol.links || []).length > 0 ? (
                        <div className="space-y-1">
                          {(kol.links || []).map((link, i) => (
                            <a 
                              key={i} 
                              href={link} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="block text-blue-400 hover:underline truncate max-w-xs"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {shortenUrl(link)}
                            </a>
                          ))}
                          {canEdit && (
                            <div className="text-gray-500 hover:text-green-400 mt-1">
                              + Add link
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-gray-500 hover:text-green-400">
                          {canEdit ? '+ Add link' : 'No links'}
                        </span>
                      )}
                    </div>
                  )}
                </td>
                
                <td className="p-2">
                  {editingId === kol.id && editingField === 'platform' ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={() => saveEdit(kol.id, 'platform')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit(kol.id, 'platform')
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      className="bg-black border border-green-300 text-xs p-1 w-24"
                      placeholder="Comma separated"
                      autoFocus
                    />
                  ) : (
                    <div 
                      className="flex gap-1 cursor-pointer"
                      onClick={() => canEdit && startEdit(kol.id, 'platform', kol.platform)}
                    >
                      {(kol.platform || []).length > 0 ? (
                        (kol.platform || []).map(p => (
                          <span key={p} className="text-lg" title={p}>
                            {getPlatformIcon(p)}
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-gray-500">None</span>
                      )}
                    </div>
                  )}
                </td>
                
                {canEdit && (
                  <td className="p-2">
                    <button
                      onClick={async () => {
                        if (!confirm(`Are you sure you want to remove ${kol.name} completely from this campaign?`)) return
                        
                        // Delete all entries for this KOL (including product entries)
                        try {
                          // Get all entries for this KOL handle
                          const allKolEntries = kols.filter(k => k.handle === kol.handle)
                          
                          for (const entry of allKolEntries) {
                            await onDelete(entry.id)
                          }
                        } catch (error) {
                          console.error('Error removing KOL:', error)
                          alert('Failed to remove KOL')
                        }
                      }}
                      className="text-red-500 hover:text-red-400 text-xs"
                    >
                      Remove
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {/* KOL Profile Modal */}
      {selectedKOL && (
        <KOLProfileModal
          kolHandle={selectedKOL.handle}
          kolName={selectedKOL.name}
          isOpen={!!selectedKOL}
          onClose={() => setSelectedKOL(null)}
        />
      )}
    </>
  )
} 