import { Product, ProductAssignment, ProductAnalytics } from '@/lib/types/product'

export class ProductServiceClient {
  /**
   * Get all products
   */
  static async getAllProducts(): Promise<Product[]> {
    const response = await fetch('/api/products/all')
    if (!response.ok) {
      throw new Error('Failed to fetch products')
    }
    return response.json()
  }
  
  /**
   * Get active products only
   */
  static async getActiveProducts(): Promise<Product[]> {
    const response = await fetch('/api/products/active')
    if (!response.ok) {
      throw new Error('Failed to fetch active products')
    }
    return response.json()
  }
  
  /**
   * Get a single product
   */
  static async getProduct(productId: string): Promise<Product | null> {
    const response = await fetch(`/api/products/${productId}`)
    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error('Failed to fetch product')
    }
    return response.json()
  }
  
  /**
   * Create a new product
   */
  static async createProduct(data: Omit<Product, 'id' | 'createdAt' | 'updatedAt' | 'totalAssigned' | 'totalRevenue' | 'activeInCampaigns'>): Promise<Product> {
    const response = await fetch('/api/products', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    if (!response.ok) {
      throw new Error('Failed to create product')
    }
    return response.json()
  }
  
  /**
   * Update a product
   */
  static async updateProduct(productId: string, updates: Partial<Product>): Promise<Product | null> {
    const response = await fetch(`/api/products/${productId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(updates),
    })
    if (!response.ok) {
      if (response.status === 404) return null
      throw new Error('Failed to update product')
    }
    return response.json()
  }
  
  /**
   * Delete a product
   */
  static async deleteProduct(productId: string): Promise<boolean> {
    const response = await fetch(`/api/products/${productId}`, {
      method: 'DELETE',
    })
    if (!response.ok) {
      throw new Error('Failed to delete product')
    }
    return true
  }
  
  /**
   * Get analytics
   */
  static async getAnalytics(): Promise<ProductAnalytics> {
    const response = await fetch('/api/products/analytics')
    if (!response.ok) {
      throw new Error('Failed to fetch analytics')
    }
    return response.json()
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
    const response = await fetch('/api/products/assign', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ productId, campaignId, kolId, notes }),
    })
    if (!response.ok) {
      throw new Error('Failed to assign product')
    }
    return response.json()
  }
} 