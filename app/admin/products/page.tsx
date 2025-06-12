'use client'

import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { Product, ProductAnalytics } from '@/lib/types/product'
import { Project } from '@/lib/project'
import { Category } from '@/lib/services/category-service'
import { Trash2, Edit2, Plus, Package, DollarSign, TrendingUp, AlertCircle, Upload, X } from 'lucide-react'
import { ResponsiveContainer, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts'

const CATEGORY_COLORS = {
  phone: '#9333ea',
  laptop: '#3b82f6',
  tablet: '#10b981',
  wearable: '#f59e0b',
  other: '#6b7280'
}

export default function AdminProductsPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [analytics, setAnalytics] = useState<ProductAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddModal, setShowAddModal] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [categories, setCategories] = useState<Category[]>([])
  const [showCategoryModal, setShowCategoryModal] = useState(false)
  
  useEffect(() => {
    if (status === 'loading') return
    
    const userRole = (session as any)?.role || (session as any)?.user?.role
    if (!session || userRole !== 'admin') {
      router.push('/')
      return
    }
    
    loadData()
  }, [session, status])
  
  const loadCategories = async () => {
    try {
      const categoriesRes = await fetch('/api/products/categories')
      if (!categoriesRes.ok) {
        throw new Error('Failed to load categories')
      }
      const categoriesData = await categoriesRes.json()
      setCategories(categoriesData)
    } catch (err: any) {
      console.error('Failed to load categories:', err)
    }
  }
  
  const loadData = async () => {
    try {
      setLoading(true)
      setError(null)
      
      // Load products, projects, analytics, and categories in parallel
      const [productsRes, projectsRes, analyticsRes, categoriesRes] = await Promise.all([
        fetch('/api/products'),
        fetch('/api/projects/all'),
        fetch('/api/products/analytics'),
        fetch('/api/products/categories')
      ])
      
      if (!productsRes.ok || !projectsRes.ok || !analyticsRes.ok || !categoriesRes.ok) {
        throw new Error('Failed to load data')
      }
      
      const [productsData, projectsData, analyticsData, categoriesData] = await Promise.all([
        productsRes.json(),
        projectsRes.json(),
        analyticsRes.json(),
        categoriesRes.json()
      ])
      
      setProducts(productsData)
      setProjects(Array.isArray(projectsData) ? projectsData : projectsData.projects || [])
      setAnalytics(analyticsData)
      setCategories(categoriesData)
    } catch (err: any) {
      setError(err.message || 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }
  
  // Build dynamic category colors map
  const categoryColors = categories.reduce((acc, cat) => {
    acc[cat.name] = cat.color
    return acc
  }, {} as Record<string, string>)
  
  const handleDelete = async (productId: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return
    
    try {
      const res = await fetch(`/api/products/${productId}`, {
        method: 'DELETE'
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete product')
      }
      
      await loadData()
    } catch (err: any) {
      alert(err.message || 'Failed to delete product')
    }
  }
  
  const filteredProducts = products.filter(product =>
    product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    product.description?.toLowerCase().includes(searchTerm.toLowerCase())
  )
  
  if (loading) {
    return (
      <div className="min-h-screen bg-black text-green-300 p-8 flex items-center justify-center">
        <div className="flex items-center gap-4">
          <div className="w-8 h-8 border-2 border-green-300 border-t-transparent rounded-full animate-spin" />
          <span>Loading products...</span>
        </div>
      </div>
    )
  }
  
  if (error) {
    return (
      <div className="min-h-screen bg-black text-green-300 p-8">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-900/20 border border-red-500 rounded-lg p-6">
            <p className="text-red-400">{error}</p>
            <button
              onClick={() => router.push('/admin')}
              className="mt-4 px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors"
            >
              Back to Admin
            </button>
          </div>
        </div>
      </div>
    )
  }
  
  const categoryData = analytics ? Object.entries(analytics.categoryBreakdown).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value
  })) : []
  
  return (
    <div className="min-h-screen bg-black text-green-300 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold text-green-300">Products Management</h1>
              <p className="text-green-400 mt-2">Manage products and track assignments</p>
            </div>
            <button
              onClick={() => router.push('/admin')}
              className="px-4 py-2 text-green-300 hover:text-green-100 transition-colors"
            >
              Back to Admin
            </button>
          </div>
        </div>
        
        {/* Analytics Cards */}
        {analytics && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-green-900/20 border border-green-500 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Package className="w-5 h-5 text-green-400" />
                <span className="text-xs text-green-500">Products</span>
              </div>
              <p className="text-2xl font-bold text-green-300">{analytics.totalProducts}</p>
              <p className="text-xs text-green-400 mt-1">Active products</p>
            </div>
            
            <div className="bg-green-900/20 border border-green-500 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <DollarSign className="w-5 h-5 text-green-400" />
                <span className="text-xs text-green-500">Total Value</span>
              </div>
              <p className="text-2xl font-bold text-green-300">${analytics.totalValue.toLocaleString()}</p>
              <p className="text-xs text-green-400 mt-1">Inventory value</p>
            </div>
            
            <div className="bg-green-900/20 border border-green-500 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <TrendingUp className="w-5 h-5 text-green-400" />
                <span className="text-xs text-green-500">Assigned</span>
              </div>
              <p className="text-2xl font-bold text-green-300">{analytics.totalAssigned}</p>
              <p className="text-xs text-green-400 mt-1">Total assignments</p>
            </div>
            
            <div className="bg-green-900/20 border border-green-500 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <AlertCircle className="w-5 h-5 text-green-400" />
                <span className="text-xs text-green-500">Available</span>
              </div>
              <p className="text-2xl font-bold text-green-300">{analytics.totalAvailable}</p>
              <p className="text-xs text-green-400 mt-1">In stock</p>
            </div>
          </div>
        )}
        
        {/* Charts */}
        {analytics && analytics.totalProducts > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            {/* Category Distribution */}
            <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Category Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={categoryData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {categoryData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={categoryColors[entry.name.toLowerCase()] || '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            
            {/* Top Products */}
            {analytics.topProducts.length > 0 && (
              <div className="bg-green-900/20 border border-green-500 rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Top Products by Assignments</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={analytics.topProducts.slice(0, 5)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="product.name" 
                      stroke="#10b981"
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis stroke="#10b981" />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#000', border: '1px solid #10b981' }}
                      labelStyle={{ color: '#10b981' }}
                    />
                    <Bar dataKey="assignments" fill="#10b981" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}
        
        {/* Actions Bar */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-4 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCategoryModal(true)}
              className="px-4 py-2 text-green-300 hover:text-green-100 border border-green-500 rounded hover:bg-green-900/50 transition-colors"
            >
              Manage Categories
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Product
            </button>
          </div>
        </div>
        
        {/* Products Table */}
        <div className="bg-green-900/20 border border-green-500 rounded-lg overflow-hidden">
          <table className="w-full">
            <thead className="bg-green-900/40 border-b border-green-500">
              <tr>
                <th className="p-4 text-left text-xs uppercase tracking-wider">Product</th>
                <th className="p-4 text-left text-xs uppercase tracking-wider">Category</th>
                <th className="p-4 text-left text-xs uppercase tracking-wider">Price</th>
                <th className="p-4 text-left text-xs uppercase tracking-wider">Stock</th>
                <th className="p-4 text-left text-xs uppercase tracking-wider">Assigned</th>
                <th className="p-4 text-left text-xs uppercase tracking-wider">Project</th>
                <th className="p-4 text-left text-xs uppercase tracking-wider">Status</th>
                <th className="p-4 text-left text-xs uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-green-500/30">
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-green-400">
                    {searchTerm ? 'No products found matching your search' : 'No products added yet'}
                  </td>
                </tr>
              ) : (
                filteredProducts.map((product) => {
                  const project = projects.find(p => p.id === product.projectId)
                  return (
                    <tr key={product.id} className="hover:bg-green-900/10 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="w-10 h-10 rounded object-cover"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-green-900/50 rounded flex items-center justify-center">
                              <Package className="w-5 h-5 text-green-400" />
                            </div>
                          )}
                          <div>
                            <p className="font-medium text-green-300">{product.name}</p>
                            {product.description && (
                              <p className="text-xs text-green-500 truncate max-w-xs">{product.description}</p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <span 
                          className={`px-2 py-1 text-xs rounded`}
                          style={{
                            backgroundColor: `${categoryColors[product.category || 'other']}20`,
                            color: categoryColors[product.category || 'other'] || '#6b7280',
                            borderColor: categoryColors[product.category || 'other'] || '#6b7280',
                            borderWidth: '1px',
                            borderStyle: 'solid'
                          }}
                        >
                          {product.category || 'other'}
                        </span>
                      </td>
                      <td className="p-4 text-green-300">${product.price.toLocaleString()}</td>
                      <td className="p-4 text-green-300">{product.stock ?? 'N/A'}</td>
                      <td className="p-4 text-green-300">{product.totalAssigned || 0}</td>
                      <td className="p-4">
                        {project ? (
                          <div className="flex items-center gap-2">
                            <img
                              src={project.profileImageUrl || `https://unavatar.io/twitter/${project.twitterHandle}`}
                              alt={project.twitterHandle}
                              className="w-6 h-6 rounded-full"
                            />
                            <span className="text-xs text-green-400">{project.twitterHandle}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-500">None</span>
                        )}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-1 text-xs rounded ${
                          product.active ? 'bg-green-900/50 text-green-300' : 'bg-red-900/50 text-red-300'
                        }`}>
                          {product.active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setEditingProduct(product)}
                            className="p-1 text-green-400 hover:text-green-300 transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id)}
                            className="p-1 text-red-400 hover:text-red-300 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
      
      {/* Add/Edit Product Modal */}
      {(showAddModal || editingProduct) && (
        <ProductModal
          product={editingProduct}
          projects={projects}
          categories={categories}
          onClose={() => {
            setShowAddModal(false)
            setEditingProduct(null)
          }}
          onSave={async (productData) => {
            try {
              const url = editingProduct 
                ? `/api/products/${editingProduct.id}`
                : '/api/products'
              
              const res = await fetch(url, {
                method: editingProduct ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(productData)
              })
              
              if (!res.ok) {
                const data = await res.json()
                throw new Error(data.error || 'Failed to save product')
              }
              
              await loadData()
              setShowAddModal(false)
              setEditingProduct(null)
            } catch (err: any) {
              alert(err.message || 'Failed to save product')
            }
          }}
        />
      )}
      
      {/* Category Management Modal */}
      {showCategoryModal && (
        <CategoryModal
          categories={categories}
          onClose={() => setShowCategoryModal(false)}
          onUpdate={() => loadCategories()}
        />
      )}
    </div>
  )
}

// Product Modal Component
function ProductModal({ 
  product, 
  projects,
  categories,
  onClose, 
  onSave 
}: { 
  product: Product | null
  projects: Project[]
  categories: Category[]
  onClose: () => void
  onSave: (data: any) => Promise<void>
}) {
  const [formData, setFormData] = useState({
    name: product?.name || '',
    price: product?.price || 0,
    image: product?.image || '',
    description: product?.description || '',
    projectId: product?.projectId || '',
    category: product?.category || (categories.length > 0 ? categories[0].name : 'other'),
    stock: product?.stock ?? 0,
    active: product?.active ?? true
  })
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [imagePreview, setImagePreview] = useState(product?.image || '')
  
  // Update formData when product changes (for editing)
  useEffect(() => {
    if (product) {
      setFormData({
        name: product.name,
        price: product.price,
        image: product.image || '',
        description: product.description || '',
        projectId: product.projectId || '',
        category: product.category || (categories.length > 0 ? categories[0].name : 'other'),
        stock: product.stock ?? 0,
        active: product.active ?? true
      })
      setImagePreview(product.image || '')
    }
  }, [product, categories])
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      
      const res = await fetch('/api/upload/image', {
        method: 'POST',
        body: formData
      })
      
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to upload image')
      }
      
      const data = await res.json()
      setFormData(prev => ({ ...prev, image: data.imageUrl }))
      setImagePreview(data.imageUrl)
    } catch (error: any) {
      alert(error.message || 'Failed to upload image')
    } finally {
      setUploading(false)
    }
  }
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave(formData)
    } finally {
      setSaving(false)
    }
  }
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-black border border-green-500 rounded-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-green-500">
          <h2 className="text-xl font-bold text-green-300">
            {product ? 'Edit Product' : 'Add New Product'}
          </h2>
        </div>
        
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-green-300 mb-1">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-green-300 mb-1">
                Price *
              </label>
              <input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                min="0"
                step="0.01"
                required
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-green-300 mb-1">
                Category
              </label>
              <select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as any })}
                className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 focus:outline-none focus:border-green-400"
              >
                {categories.map(category => (
                  <option key={category.id} value={category.name}>
                    {category.name.charAt(0).toUpperCase() + category.name.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-green-300 mb-1">
                Stock
              </label>
              <input
                type="number"
                value={formData.stock}
                onChange={(e) => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                min="0"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              Product Image
            </label>
            <div className="space-y-2">
              {imagePreview && (
                <div className="relative w-32 h-32">
                  <img
                    src={imagePreview}
                    alt="Product preview"
                    className="w-full h-full object-cover rounded border border-green-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setFormData({ ...formData, image: '' })
                      setImagePreview('')
                    }}
                    className="absolute -top-2 -right-2 p-1 bg-red-600 rounded-full text-white hover:bg-red-700"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              )}
              <label className="flex items-center justify-center gap-2 px-4 py-2 bg-green-900/50 border border-green-500 rounded cursor-pointer hover:bg-green-900/70 transition-colors">
                <Upload className="w-4 h-4" />
                <span>{uploading ? 'Uploading...' : 'Upload Image'}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                  onChange={handleImageUpload}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
              <p className="text-xs text-green-500">Max size: 5MB. Formats: JPEG, PNG, GIF, WebP</p>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              Link to Project
            </label>
            <select
              value={formData.projectId}
              onChange={(e) => setFormData({ ...formData, projectId: e.target.value })}
              className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 focus:outline-none focus:border-green-400"
            >
              <option value="">None</option>
              {projects.map(project => (
                <option key={project.id} value={project.id}>
                  {project.twitterHandle}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-green-300 mb-1">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
              rows={3}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="active"
              checked={formData.active}
              onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
              className="text-green-300"
            />
            <label htmlFor="active" className="text-sm text-green-300">
              Active (available for assignment)
            </label>
          </div>
          
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
              disabled={saving || uploading}
              className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// Category Management Modal
function CategoryModal({
  categories,
  onClose,
  onUpdate
}: {
  categories: Category[]
  onClose: () => void
  onUpdate: () => void
}) {
  const [newCategory, setNewCategory] = useState({ name: '', color: '#10b981' })
  const [adding, setAdding] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  
  const handleAddCategory = async () => {
    if (!newCategory.name.trim()) return
    
    setAdding(true)
    try {
      const res = await fetch('/api/products/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newCategory)
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to add category')
      }
      
      setNewCategory({ name: '', color: '#10b981' })
      onUpdate()
    } catch (error: any) {
      alert(error.message || 'Failed to add category')
    } finally {
      setAdding(false)
    }
  }
  
  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Are you sure you want to delete this category?')) return
    
    setDeleting(categoryId)
    try {
      const res = await fetch(`/api/products/categories?id=${categoryId}`, {
        method: 'DELETE'
      })
      
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete category')
      }
      
      onUpdate()
    } catch (error: any) {
      alert(error.message || 'Failed to delete category')
    } finally {
      setDeleting(null)
    }
  }
  
  // Separate default and custom categories
  const defaultCategoryNames = ['phone', 'laptop', 'tablet', 'wearable', 'other']
  const defaultCategories = categories.filter(cat => defaultCategoryNames.includes(cat.name))
  const customCategories = categories.filter(cat => !defaultCategoryNames.includes(cat.name))
  
  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="bg-black border border-green-500 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="p-6 border-b border-green-500">
          <h2 className="text-xl font-bold text-green-300">Manage Categories</h2>
        </div>
        
        <div className="p-6 space-y-6">
          {/* Add New Category */}
          <div>
            <h3 className="text-lg font-semibold text-green-300 mb-3">Add New Category</h3>
            <div className="flex items-end gap-3">
              <div className="flex-1">
                <label className="block text-sm font-medium text-green-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(e) => setNewCategory({ ...newCategory, name: e.target.value })}
                  placeholder="e.g., accessory"
                  className="w-full px-3 py-2 bg-black border border-green-500 rounded text-green-300 placeholder-green-700 focus:outline-none focus:border-green-400"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-green-300 mb-1">
                  Color
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={newCategory.color}
                    onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                    className="h-10 w-20 bg-black border border-green-500 rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newCategory.color}
                    onChange={(e) => setNewCategory({ ...newCategory, color: e.target.value })}
                    className="w-24 px-2 py-2 bg-black border border-green-500 rounded text-green-300 focus:outline-none focus:border-green-400"
                  />
                </div>
              </div>
              <button
                onClick={handleAddCategory}
                disabled={adding || !newCategory.name.trim()}
                className="px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {adding ? 'Adding...' : 'Add'}
              </button>
            </div>
          </div>
          
          {/* Default Categories */}
          <div>
            <h3 className="text-lg font-semibold text-green-300 mb-3">Default Categories</h3>
            <div className="space-y-2">
              {defaultCategories.map(category => (
                <div key={category.id} className="flex items-center justify-between p-3 bg-green-900/20 border border-green-500/50 rounded">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-6 h-6 rounded"
                      style={{ backgroundColor: category.color }}
                    />
                    <span className="text-green-300">
                      {category.name.charAt(0).toUpperCase() + category.name.slice(1)}
                    </span>
                  </div>
                  <span className="text-xs text-green-500">Default</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Custom Categories */}
          {customCategories.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-green-300 mb-3">Custom Categories</h3>
              <div className="space-y-2">
                {customCategories.map(category => (
                  <div key={category.id} className="flex items-center justify-between p-3 bg-green-900/20 border border-green-500/50 rounded">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-6 h-6 rounded"
                        style={{ backgroundColor: category.color }}
                      />
                      <span className="text-green-300">
                        {category.name.charAt(0).toUpperCase() + category.name.slice(1)}
                      </span>
                    </div>
                    <button
                      onClick={() => handleDeleteCategory(category.id)}
                      disabled={deleting === category.id}
                      className="p-1 text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
                    >
                      {deleting === category.id ? (
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="p-6 border-t border-green-500">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-green-900 text-green-100 rounded hover:bg-green-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
} 