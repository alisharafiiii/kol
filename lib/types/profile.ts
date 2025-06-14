// Unified Profile System Types

export type UserRole = 'admin' | 'core' | 'team' | 'kol' | 'scout' | 'user' | 'viewer' | 'intern'
export type ApprovalStatus = 'pending' | 'approved' | 'rejected'
export type KOLTier = 'hero' | 'legend' | 'star' | 'rising' | 'micro'
export type CampaignStage = 'reached_out' | 'waiting_device' | 'waiting_brief' | 'posted' | 'preparing' | 'done'
export type DeviceStatus = 'na' | 'preparing' | 'on_way' | 'received' | 'issue' | 'sent_before'
export type PaymentStatus = 'pending' | 'approved' | 'rejected' | 'paid' | 'revision'
export type SocialPlatform = 'twitter' | 'instagram' | 'youtube' | 'tiktok' | 'twitch' | 'linkedin'

export interface ShippingAddress {
  street: string
  city: string
  state?: string
  country: string
  postalCode: string
  phone?: string
}

export interface ContactInfo {
  telegram?: string
  telegramGroups?: string[]
  email?: string
  phone?: string
  discord?: string
}

export interface Note {
  id: string
  authorId: string
  authorName: string
  authorImage?: string
  content: string
  createdAt: Date
  campaignId?: string
}

export interface TweetMetrics {
  tweetId: string
  url: string
  views: number
  likes: number
  retweets: number
  replies: number
  bookmarks?: number
  quotes?: number
  impressions?: number
  lastSynced: Date
}

export interface CampaignParticipation {
  campaignId: string
  campaignName: string
  role: 'kol' | 'team_member'
  tier?: KOLTier
  stage: CampaignStage
  deviceStatus: DeviceStatus
  budget: number
  paymentStatus: PaymentStatus
  links: string[]
  platform: SocialPlatform
  metrics?: TweetMetrics[]
  totalViews: number
  totalEngagement: number
  score?: number
  joinedAt: Date
  completedAt?: Date
}

export interface KOLMetrics {
  totalCampaigns: number
  totalEarnings: number
  totalViews: number
  totalEngagement: number
  averageEngagementRate: number
  topPlatform: SocialPlatform
  tierHistory: Array<{
    tier: KOLTier
    date: Date
    campaignId: string
  }>
}

export interface UnifiedProfile {
  // Core Identity
  id: string
  twitterHandle: string
  name: string
  profileImageUrl?: string
  bio?: string
  
  // Authentication & Access
  role: UserRole
  approvalStatus: ApprovalStatus
  approvedBy?: string
  approvedAt?: Date
  rejectedBy?: string
  rejectedAt?: Date
  
  // Universal Tier (now for all users)
  tier: KOLTier  // Required for all users, defaults to 'micro'
  
  // KOL Specific Fields
  isKOL: boolean
  currentTier?: KOLTier  // Deprecated - use tier instead
  kolMetrics?: KOLMetrics
  campaigns?: CampaignParticipation[]
  
  // Contact Information
  email?: string
  phone?: string
  contacts?: ContactInfo
  
  // Shipping Information
  shippingAddress?: ShippingAddress
  
  // Social Media
  socialLinks?: {
    twitter?: string
    instagram?: string
    youtube?: string
    tiktok?: string
    twitch?: string
    linkedin?: string
    website?: string
  }
  
  // Wallet Information (legacy support)
  walletAddresses?: {
    ethereum?: string
    solana?: string
    base?: string
  }
  
  // Preferences
  languages?: string[]
  timezone?: string
  country?: string
  city?: string
  
  // Internal
  notes?: Note[]
  tags?: string[]
  createdAt: Date
  updatedAt: Date
  lastLoginAt?: Date
  
  // Computed Score
  overallScore?: number
  scoreBreakdown?: {
    performance: number
    reliability: number
    engagement: number
    reach: number
  }
}

// Campaign KOL specific type
export interface CampaignKOL {
  id: string
  campaignId: string
  kolId: string
  kolHandle: string
  kolName: string
  kolImage?: string
  
  // KOL Details for this campaign
  tier: KOLTier
  stage: CampaignStage
  deviceStatus: DeviceStatus
  budget: number
  paymentStatus: PaymentStatus
  
  // Content & Platform
  links: string[]
  platform: SocialPlatform
  contentType: 'tweet' | 'thread' | 'video' | 'stream' | 'post' | 'story'
  
  // Metrics
  metrics?: TweetMetrics[]
  totalViews: number
  totalEngagement: number
  engagementRate: number
  score: number
  
  // Timestamps
  addedAt: Date
  addedBy: string
  postedAt?: Date
  completedAt?: Date
  lastSyncedAt?: Date
}

// Scoring Configuration
export interface ScoringConfig {
  campaignId: string
  tierMultipliers: {
    hero: number
    legend: number
    star: number
    rising: number
    micro: number
  }
  platformMultipliers: {
    twitter: number
    instagram: number
    youtube: number
    tiktok: number
    twitch: number
    linkedin: number
  }
  contentTypeMultipliers: {
    tweet: number
    thread: number
    video: number
    stream: number
    post: number
    story: number
  }
  engagementWeights: {
    views: number
    likes: number
    comments: number
    shares: number
  }
  multiPlatformBonus: number
  multiPostBonus: number
}

// Analytics Types
export interface CampaignAnalytics {
  campaignId: string
  totalBudget: number
  totalViews: number
  totalEngagement: number
  averageEngagementRate: number
  costPerView: number
  costPerEngagement: number
  
  tierDistribution: Array<{
    tier: KOLTier
    count: number
    views: number
    budget: number
    efficiency: number
  }>
  
  topPerformers: Array<{
    kolId: string
    name: string
    handle: string
    score: number
    views: number
    engagement: number
    roi: number
  }>
  
  platformBreakdown: Array<{
    platform: SocialPlatform
    posts: number
    views: number
    engagement: number
  }>
  
  timelineData: Array<{
    date: Date
    views: number
    engagement: number
    posts: number
  }>
} 