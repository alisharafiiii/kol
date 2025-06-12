import { redis } from '@/lib/redis'
import { Product, ProductAssignment, ProductAnalytics } from '@/lib/types/product'
import { generateId } from '@/lib/utils'

export class ProductService {
  private static readonly PRODUCTS_KEY = 'products:all'
  private static readonly PRODUCT_PREFIX = 'product:'
  private static readonly ASSIGNMENTS_PREFIX = 'product:assignments:'
  private static readonly ANALYTICS_KEY = 'products:analytics'
  
  /**
   * Create a new product
   */
  static async createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'totalAssigned' | 'totalRevenue' | 'activeInCampaigns'>): Promise<Product> {
    const product: Product = {
      ...data,
      id: generateId('prod'),
      createdAt: new Date(),
      updatedAt: new Date(),
      totalAssigned: 0,
      totalRevenue: 0,
      activeInCampaigns: 0
    }
    
    // Save product as JSON
    await redis.json.set(
      `${this.PRODUCT_PREFIX}${product.id}`,
      '$',
      JSON.parse(JSON.stringify(product)) // Ensure proper serialization
    )
    
    // Add to products set
    await redis.sadd(this.PRODUCTS_KEY, product.id)
    
    // Update analytics
    await this.updateAnalytics()
    
    return product
  }
  
  /**
   * Get all products
   */
  static async getAllProducts(): Promise<Product[]> {
    const productIds = await redis.smembers(this.PRODUCTS_KEY)
    const products: Product[] = []
    
    for (const id of productIds) {
      const product = await this.getProduct(id)
      if (product) {
        products.push(product)
      }
    }
    
    return products.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }
  
  /**
   * Get active products only
   */
  static async getActiveProducts(): Promise<Product[]> {
    const allProducts = await this.getAllProducts()
    return allProducts.filter(p => p.active)
  }
  
  /**
   * Get a single product
   */
  static async getProduct(productId: string): Promise<Product | null> {
    const data = await redis.json.get(`${this.PRODUCT_PREFIX}${productId}`, '$') as any
    
    if (!data || !data[0]) {
      return null
    }
    
    const product = data[0]
    return {
      ...product,
      createdAt: new Date(product.createdAt),
      updatedAt: new Date(product.updatedAt)
    } as Product
  }
  
  /**
   * Update a product
   */
  static async updateProduct(productId: string, updates: Partial<Product>): Promise<Product | null> {
    const existing = await this.getProduct(productId)
    if (!existing) {
      return null
    }
    
    const updated = {
      ...existing,
      ...updates,
      id: productId, // Ensure ID doesn't change
      updatedAt: new Date()
    }
    
    await redis.json.set(
      `${this.PRODUCT_PREFIX}${productId}`,
      '$',
      JSON.parse(JSON.stringify(updated))
    )
    
    // Update analytics if price or stock changed
    if (updates.price !== undefined || updates.stock !== undefined) {
      await this.updateAnalytics()
    }
    
    return updated
  }
  
  /**
   * Delete a product (soft delete - sets active to false)
   */
  static async deleteProduct(productId: string): Promise<boolean> {
    const product = await this.getProduct(productId)
    if (!product) {
      return false
    }
    
    // Check if product is assigned to any active campaigns
    if (product.activeInCampaigns && product.activeInCampaigns > 0) {
      throw new Error('Cannot delete product that is assigned to active campaigns')
    }
    
    // Soft delete
    await this.updateProduct(productId, { active: false })
    
    // Update analytics
    await this.updateAnalytics()
    
    return true
  }
  
  /**
   * Assign a product to a campaign KOL
   */
  static async assignProduct(
    productId: string,
    campaignId: string,
    kolId: string,
    notes?: string
  ): Promise<ProductAssignment> {
    const product = await this.getProduct(productId)
    if (!product) {
      throw new Error('Product not found')
    }
    
    // Check stock
    if (product.stock !== undefined && product.stock <= 0) {
      throw new Error('Product out of stock')
    }
    
    const assignment: ProductAssignment = {
      id: generateId('assign'),
      productId,
      campaignId,
      kolId,
      assignedAt: new Date(),
      status: 'assigned',
      notes
    }
    
    // Save assignment as JSON
    await redis.json.set(
      `${this.ASSIGNMENTS_PREFIX}${assignment.id}`,
      '$',
      JSON.parse(JSON.stringify(assignment))
    )
    
    // Add to campaign's assignments
    await redis.sadd(`campaign:${campaignId}:products`, assignment.id)
    
    // Update product stats
    await this.updateProduct(productId, {
      totalAssigned: (product.totalAssigned || 0) + 1,
      totalRevenue: (product.totalRevenue || 0) + product.price,
      activeInCampaigns: (product.activeInCampaigns || 0) + 1,
      stock: product.stock !== undefined ? product.stock - 1 : undefined
    })
    
    return assignment
  }
  
  /**
   * Update assignment status
   */
  static async updateAssignment(
    assignmentId: string,
    status: ProductAssignment['status'],
    returnedAt?: Date
  ): Promise<ProductAssignment | null> {
    const data = await redis.json.get(`${this.ASSIGNMENTS_PREFIX}${assignmentId}`, '$') as any
    if (!data || !data[0]) {
      return null
    }
    
    const assignment = {
      ...data[0],
      assignedAt: new Date(data[0].assignedAt),
      returnedAt: data[0].returnedAt ? new Date(data[0].returnedAt) : undefined
    } as ProductAssignment
    
    // Update assignment
    assignment.status = status
    if (returnedAt) {
      assignment.returnedAt = returnedAt
    }
    
    await redis.json.set(
      `${this.ASSIGNMENTS_PREFIX}${assignmentId}`,
      '$',
      JSON.parse(JSON.stringify(assignment))
    )
    
    // If returned, update product stats
    if (status === 'returned' && assignment.productId) {
      const product = await this.getProduct(assignment.productId)
      if (product) {
        await this.updateProduct(assignment.productId, {
          activeInCampaigns: Math.max(0, (product.activeInCampaigns || 0) - 1),
          stock: product.stock !== undefined ? product.stock + 1 : undefined
        })
      }
    }
    
    return assignment
  }
  
  /**
   * Get assignments for a campaign
   */
  static async getCampaignAssignments(campaignId: string): Promise<ProductAssignment[]> {
    const assignmentIds = await redis.smembers(`campaign:${campaignId}:products`)
    const assignments: ProductAssignment[] = []
    
    for (const id of assignmentIds) {
      const data = await redis.json.get(`${this.ASSIGNMENTS_PREFIX}${id}`, '$') as any
      if (data && data[0]) {
        assignments.push({
          ...data[0],
          assignedAt: new Date(data[0].assignedAt),
          returnedAt: data[0].returnedAt ? new Date(data[0].returnedAt) : undefined
        } as ProductAssignment)
      }
    }
    
    return assignments
  }
  
  /**
   * Get products by project
   */
  static async getProductsByProject(projectId: string): Promise<Product[]> {
    const allProducts = await this.getAllProducts()
    return allProducts.filter(p => p.projectId === projectId && p.active)
  }
  
  /**
   * Update analytics
   */
  private static async updateAnalytics(): Promise<void> {
    const products = await this.getAllProducts()
    const activeProducts = products.filter(p => p.active)
    
    const analytics: ProductAnalytics = {
      totalProducts: activeProducts.length,
      totalValue: activeProducts.reduce((sum, p) => sum + (p.price * (p.stock || 0)), 0),
      totalAssigned: activeProducts.reduce((sum, p) => sum + (p.totalAssigned || 0), 0),
      totalAvailable: activeProducts.reduce((sum, p) => sum + (p.stock || 0), 0),
      categoryBreakdown: {},
      topProducts: [],
      monthlyAssignments: []
    }
    
    // Category breakdown
    for (const product of activeProducts) {
      const category = product.category || 'other'
      analytics.categoryBreakdown[category] = (analytics.categoryBreakdown[category] || 0) + 1
    }
    
    // Top products by assignments
    analytics.topProducts = activeProducts
      .filter(p => (p.totalAssigned || 0) > 0)
      .sort((a, b) => (b.totalAssigned || 0) - (a.totalAssigned || 0))
      .slice(0, 10)
      .map(p => ({
        product: p,
        assignments: p.totalAssigned || 0,
        revenue: p.totalRevenue || 0
      }))
    
    // Save analytics
    await redis.set(this.ANALYTICS_KEY, JSON.stringify(analytics))
  }
  
  /**
   * Get analytics
   */
  static async getAnalytics(): Promise<ProductAnalytics> {
    try {
      // Always recalculate analytics when requested
      await this.updateAnalytics()
      
      const data = await redis.get(this.ANALYTICS_KEY)
      if (!data) {
        // Initialize analytics if not exists
        const defaultAnalytics: ProductAnalytics = {
          totalProducts: 0,
          totalValue: 0,
          totalAssigned: 0,
          totalAvailable: 0,
          categoryBreakdown: {},
          topProducts: [],
          monthlyAssignments: []
        }
        await redis.set(this.ANALYTICS_KEY, JSON.stringify(defaultAnalytics))
        return defaultAnalytics
      }
      
      // Upstash Redis auto-parses JSON, so check if data is already an object
      if (typeof data === 'object' && data !== null) {
        return data as ProductAnalytics
      }
      
      // Otherwise parse it
      return JSON.parse(data as string)
    } catch (error) {
      console.error('Error getting analytics:', error)
      // Return default analytics on error
      return {
        totalProducts: 0,
        totalValue: 0,
        totalAssigned: 0,
        totalAvailable: 0,
        categoryBreakdown: {},
        topProducts: [],
        monthlyAssignments: []
      }
    }
  }
} 