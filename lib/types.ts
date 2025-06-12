export interface KOL {
  id: string
  handle: string
  name: string
  pfp: string
  tier: 'legend' | 'og' | 'common' | 'uncommon' | 'rare' | 'superrare'
  stage: 'dmd' | 'replied' | 'approved' | 'posted' | 'completed' | 'rejected'
  device: 'pending' | 'received' | 'lost'
  budget: string
  payment: 'pending' | 'partially-paid' | 'paid'
  views: number
  likes: number
  retweets: number
  comments: number
  contact: string
  links: string[]
  platform: ('x' | 'instagram' | 'tiktok' | 'youtube')[]
  lastUpdated?: Date
  productId?: string
  productAssignmentId?: string
  productCost?: number
} 