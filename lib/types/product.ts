export interface Product {
  id: string
  name: string
  price: number
  image?: string
  description?: string
  projectId?: string // Link to project from scout list
  category?: 'phone' | 'laptop' | 'tablet' | 'wearable' | 'other'
  stock?: number
  active: boolean
  createdAt: Date
  updatedAt: Date
  createdBy: string
  
  // Analytics data
  totalAssigned?: number // Total times assigned to campaigns
  totalRevenue?: number // Total revenue from assignments
  activeInCampaigns?: number // Currently active in campaigns
}

export interface ProductAssignment {
  id: string
  productId: string
  campaignId: string
  kolId: string
  assignedAt: Date
  returnedAt?: Date
  status: 'assigned' | 'shipped' | 'delivered' | 'returned' | 'lost'
  notes?: string
}

export interface ProductAnalytics {
  totalProducts: number
  totalValue: number // Sum of all product prices * stock
  totalAssigned: number
  totalAvailable: number
  categoryBreakdown: Record<string, number>
  topProducts: Array<{
    product: Product
    assignments: number
    revenue: number
  }>
  monthlyAssignments: Array<{
    month: string
    count: number
    revenue: number
  }>
} 