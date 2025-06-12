import { redis } from '@/lib/redis'

export interface Category {
  id: string
  name: string
  color: string
  createdAt: Date
  createdBy: string
}

export class CategoryService {
  private static readonly CATEGORIES_KEY = 'product:categories'
  
  // Default categories
  private static readonly DEFAULT_CATEGORIES: Omit<Category, 'id' | 'createdAt' | 'createdBy'>[] = [
    { name: 'phone', color: '#9333ea' },
    { name: 'laptop', color: '#3b82f6' },
    { name: 'tablet', color: '#10b981' },
    { name: 'wearable', color: '#f59e0b' },
    { name: 'other', color: '#6b7280' }
  ]
  
  /**
   * Get all categories
   */
  static async getAllCategories(): Promise<Category[]> {
    try {
      const data = await redis.get(this.CATEGORIES_KEY)
      
      if (!data) {
        // Initialize with default categories
        const defaultCategories = this.DEFAULT_CATEGORIES.map((cat, index) => ({
          ...cat,
          id: `cat_${index}`,
          createdAt: new Date(),
          createdBy: 'system'
        }))
        
        await redis.set(this.CATEGORIES_KEY, JSON.stringify(defaultCategories))
        return defaultCategories
      }
      
      // Handle different data formats from Upstash Redis
      let categories: Category[]
      
      if (typeof data === 'object' && data !== null && !Array.isArray(data)) {
        // If data is already parsed as an object, it might be stored incorrectly
        // Try to extract the actual data
        console.log('CategoryService: Received object data:', data)
        categories = this.getDefaultCategories()
      } else if (typeof data === 'object' && Array.isArray(data)) {
        // Data is already an array
        categories = data as Category[]
      } else if (typeof data === 'string') {
        // Try to parse string data
        try {
          categories = JSON.parse(data)
        } catch (parseError) {
          console.error('Error parsing categories JSON:', parseError)
          categories = this.getDefaultCategories()
        }
      } else {
        console.error('Unexpected data type for categories:', typeof data)
        categories = this.getDefaultCategories()
      }
      
      return categories.map(cat => ({
        ...cat,
        createdAt: new Date(cat.createdAt)
      }))
    } catch (error) {
      console.error('Error getting categories:', error)
      return this.getDefaultCategories()
    }
  }
  
  /**
   * Get default categories
   */
  private static getDefaultCategories(): Category[] {
    return this.DEFAULT_CATEGORIES.map((cat, index) => ({
      ...cat,
      id: `cat_${index}`,
      createdAt: new Date(),
      createdBy: 'system'
    }))
  }
  
  /**
   * Add a new category
   */
  static async addCategory(name: string, color: string, createdBy: string): Promise<Category> {
    const categories = await this.getAllCategories()
    
    // Check if category already exists
    if (categories.some(cat => cat.name.toLowerCase() === name.toLowerCase())) {
      throw new Error('Category already exists')
    }
    
    const newCategory: Category = {
      id: `cat_${Date.now()}`,
      name: name.toLowerCase(),
      color,
      createdAt: new Date(),
      createdBy
    }
    
    categories.push(newCategory)
    await redis.set(this.CATEGORIES_KEY, JSON.stringify(categories))
    
    return newCategory
  }
  
  /**
   * Remove a category
   */
  static async removeCategory(categoryId: string): Promise<boolean> {
    const categories = await this.getAllCategories()
    
    // Don't allow removing default categories
    const defaultNames = this.DEFAULT_CATEGORIES.map(c => c.name)
    const categoryToRemove = categories.find(c => c.id === categoryId)
    if (categoryToRemove && defaultNames.includes(categoryToRemove.name)) {
      throw new Error('Cannot remove default categories')
    }
    
    const filtered = categories.filter(cat => cat.id !== categoryId)
    
    if (filtered.length === categories.length) {
      return false // Category not found
    }
    
    await redis.set(this.CATEGORIES_KEY, JSON.stringify(filtered))
    return true
  }
  
  /**
   * Update a category
   */
  static async updateCategory(categoryId: string, updates: { name?: string; color?: string }): Promise<Category | null> {
    const categories = await this.getAllCategories()
    const index = categories.findIndex(cat => cat.id === categoryId)
    
    if (index === -1) {
      return null
    }
    
    // Check if new name conflicts
    if (updates.name) {
      const newNameLower = updates.name.toLowerCase()
      if (categories.some((cat, i) => i !== index && cat.name.toLowerCase() === newNameLower)) {
        throw new Error('Category name already exists')
      }
    }
    
    categories[index] = {
      ...categories[index],
      ...(updates.name && { name: updates.name.toLowerCase() }),
      ...(updates.color && { color: updates.color })
    }
    
    await redis.set(this.CATEGORIES_KEY, JSON.stringify(categories))
    return categories[index]
  }
} 