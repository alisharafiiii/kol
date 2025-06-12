import { redis } from '@/lib/redis'
import { CampaignKOL, CampaignParticipation, KOLTier } from '@/lib/types/profile'
import { ProfileService } from './profile-service'
import { v4 as uuidv4 } from 'uuid'

export class CampaignKOLService {
  private static readonly PREFIX = 'campaign:kol:'
  private static readonly CAMPAIGN_PREFIX = 'campaign:'
  
  /**
   * Add a KOL to a campaign
   */
  static async addKOLToCampaign(data: {
    campaignId: string
    campaignName: string
    kolHandle: string
    kolName: string
    kolImage?: string
    tier: KOLTier
    budget: number
    platform: string
    addedBy: string
  }): Promise<CampaignKOL> {
    try {
      // First, ensure the KOL has a profile
      let profile = await ProfileService.getProfileByHandle(data.kolHandle)
      
      if (!profile) {
        // Create a basic profile for the KOL
        profile = await ProfileService.saveProfile({
          id: uuidv4(),
          twitterHandle: data.kolHandle,
          name: data.kolName,
          profileImageUrl: data.kolImage,
          role: 'kol',
          approvalStatus: 'approved', // Auto-approve KOLs added to campaigns
          isKOL: true,
          currentTier: data.tier,
          createdAt: new Date(),
          updatedAt: new Date(),
        })
      }
      
      // Create campaign KOL entry
      const campaignKOL: CampaignKOL = {
        id: uuidv4(),
        campaignId: data.campaignId,
        kolId: profile.id,
        kolHandle: data.kolHandle,
        kolName: data.kolName,
        kolImage: data.kolImage,
        tier: data.tier,
        stage: 'reached_out',
        deviceStatus: 'na',
        budget: data.budget,
        paymentStatus: 'pending',
        links: [],
        platform: data.platform as any,
        contentType: 'tweet',
        totalViews: 0,
        totalEngagement: 0,
        engagementRate: 0,
        score: 0,
        addedAt: new Date(),
        addedBy: data.addedBy,
      }
      
      // Save campaign KOL
      await redis.json.set(
        `${this.PREFIX}${campaignKOL.id}`,
        '$',
        JSON.parse(JSON.stringify(campaignKOL))
      )
      
      // Add to campaign's KOL list
      const redisKey = data.campaignId.startsWith('campaign:') 
        ? `${data.campaignId}:kols`
        : `${this.CAMPAIGN_PREFIX}${data.campaignId}:kols`
      await redis.sadd(redisKey, campaignKOL.id)
      
      // Update profile with campaign participation
      const participation: CampaignParticipation = {
        campaignId: data.campaignId,
        campaignName: data.campaignName,
        role: 'kol',
        tier: data.tier,
        stage: 'reached_out',
        deviceStatus: 'na',
        budget: data.budget,
        paymentStatus: 'pending',
        links: [],
        platform: data.platform as any,
        totalViews: 0,
        totalEngagement: 0,
        joinedAt: new Date(),
      }
      
      await ProfileService.addCampaignParticipation(profile.id, participation)
      
      return campaignKOL
    } catch (error) {
      console.error('Error adding KOL to campaign:', error)
      throw error
    }
  }
  
  /**
   * Update a campaign KOL
   */
  static async updateCampaignKOL(
    kolId: string,
    updates: Partial<CampaignKOL>
  ): Promise<CampaignKOL> {
    try {
      const existing = await redis.json.get(`${this.PREFIX}${kolId}`)
      if (!existing) throw new Error('Campaign KOL not found')
      
      const updated = {
        ...(existing as CampaignKOL),
        ...updates,
        id: kolId, // Preserve ID
      }
      
      await redis.json.set(
        `${this.PREFIX}${kolId}`,
        '$',
        JSON.parse(JSON.stringify(updated))
      )
      
      // Also update profile participation if needed
      if (updates.stage || updates.paymentStatus || updates.budget) {
        const kol = existing as CampaignKOL
        const profile = await ProfileService.getProfileById(kol.kolId)
        
        if (profile && profile.campaigns) {
          const participationIndex = profile.campaigns.findIndex(
            c => c.campaignId === kol.campaignId
          )
          
          if (participationIndex >= 0) {
            const participation = profile.campaigns[participationIndex]
            if (updates.stage) participation.stage = updates.stage
            if (updates.paymentStatus) participation.paymentStatus = updates.paymentStatus
            if (updates.budget !== undefined) participation.budget = updates.budget
            
            await ProfileService.saveProfile(profile)
          }
        }
      }
      
      return updated
    } catch (error) {
      console.error('Error updating campaign KOL:', error)
      throw error
    }
  }
  
  /**
   * Get all KOLs for a campaign
   */
  static async getCampaignKOLs(campaignId: string): Promise<CampaignKOL[]> {
    try {
      // Check if campaignId already has the campaign: prefix
      const redisKey = campaignId.startsWith('campaign:') 
        ? `${campaignId}:kols`
        : `${this.CAMPAIGN_PREFIX}${campaignId}:kols`
      
      const kolIds = await redis.smembers(redisKey)
      
      const kols = await Promise.all(
        kolIds.map(async (id: string) => {
          const kol = await redis.json.get(`${this.PREFIX}${id}`)
          return this.deserializeKOL(kol)
        })
      )
      
      return kols.filter(Boolean) as CampaignKOL[]
    } catch (error) {
      console.error('Error getting campaign KOLs:', error)
      return []
    }
  }
  
  /**
   * Remove a KOL from a campaign
   */
  static async removeKOLFromCampaign(
    campaignId: string,
    kolId: string
  ): Promise<void> {
    try {
      // Get the campaign KOL
      const campaignKOL = await redis.json.get(`${this.PREFIX}${kolId}`) as CampaignKOL
      if (!campaignKOL) return
      
      // Remove from Redis
      await redis.del(`${this.PREFIX}${kolId}`)
      const redisKey = campaignId.startsWith('campaign:') 
        ? `${campaignId}:kols`
        : `${this.CAMPAIGN_PREFIX}${campaignId}:kols`
      await redis.srem(redisKey, kolId)
      
      // Remove from profile campaigns
      const profile = await ProfileService.getProfileById(campaignKOL.kolId)
      if (profile && profile.campaigns) {
        profile.campaigns = profile.campaigns.filter(
          c => c.campaignId !== campaignId
        )
        await ProfileService.saveProfile(profile)
      }
    } catch (error) {
      console.error('Error removing KOL from campaign:', error)
      throw error
    }
  }
  
  /**
   * Update campaign KOL metrics (after tweet sync)
   */
  static async updateKOLMetrics(
    kolId: string,
    metrics: {
      views: number
      likes: number
      retweets: number
      replies: number
    }
  ): Promise<void> {
    try {
      const campaignKOL = await redis.json.get(`${this.PREFIX}${kolId}`) as CampaignKOL
      if (!campaignKOL) return
      
      // Update metrics
      campaignKOL.totalViews = metrics.views
      campaignKOL.totalEngagement = metrics.likes + metrics.retweets + metrics.replies
      campaignKOL.engagementRate = campaignKOL.totalViews > 0 
        ? (campaignKOL.totalEngagement / campaignKOL.totalViews) * 100 
        : 0
      
      // Calculate score (basic formula - can be enhanced)
      campaignKOL.score = this.calculateKOLScore(campaignKOL)
      
      campaignKOL.lastSyncedAt = new Date()
      
      await redis.json.set(
        `${this.PREFIX}${kolId}`,
        '$',
        JSON.parse(JSON.stringify(campaignKOL))
      )
      
      // Update profile metrics too
      const profile = await ProfileService.getProfileById(campaignKOL.kolId)
      if (profile && profile.campaigns) {
        const participationIndex = profile.campaigns.findIndex(
          c => c.campaignId === campaignKOL.campaignId
        )
        
        if (participationIndex >= 0) {
          profile.campaigns[participationIndex].totalViews = campaignKOL.totalViews
          profile.campaigns[participationIndex].totalEngagement = campaignKOL.totalEngagement
          profile.campaigns[participationIndex].score = campaignKOL.score
          
          await ProfileService.saveProfile(profile)
        }
      }
    } catch (error) {
      console.error('Error updating KOL metrics:', error)
    }
  }
  
  /**
   * Calculate KOL score based on performance
   */
  private static calculateKOLScore(kol: CampaignKOL): number {
    // Base score components
    const viewScore = Math.min(kol.totalViews / 1000, 100) // Max 100 points for 100k+ views
    const engagementScore = kol.engagementRate * 10 // Engagement rate * 10
    const completionScore = kol.stage === 'done' ? 20 : 0
    
    // Tier multipliers
    const tierMultipliers: Record<KOLTier, number> = {
      hero: 1.0,
      legend: 0.9,
      star: 0.8,
      rising: 0.7,
      micro: 0.6,
    }
    
    const tierMultiplier = tierMultipliers[kol.tier]
    
    // Calculate final score
    const rawScore = (viewScore + engagementScore + completionScore) * tierMultiplier
    
    // Normalize to 0-100
    return Math.min(Math.round(rawScore), 100)
  }
  
  /**
   * Search approved KOLs for adding to campaign
   */
  static async searchApprovedKOLs(searchTerm: string): Promise<Array<{
    id: string
    handle: string
    name: string
    image?: string
    tier?: KOLTier
  }>> {
    try {
      const profiles = await ProfileService.searchProfiles({
        approvalStatus: 'approved',
        searchTerm,
      })
      
      return profiles.map(p => ({
        id: p.id,
        handle: p.twitterHandle,
        name: p.name,
        image: p.profileImageUrl,
        tier: p.currentTier,
      }))
    } catch (error) {
      console.error('Error searching KOLs:', error)
      return []
    }
  }
  
  /**
   * Parse contact field and convert @ handles to links
   */
  static parseContact(contact: string): string {
    // If it starts with @, convert to Telegram link
    if (contact.startsWith('@')) {
      return `https://t.me/${contact.substring(1)}`
    }
    
    // If it's already a URL, return as is
    if (contact.startsWith('http://') || contact.startsWith('https://')) {
      return contact
    }
    
    // Otherwise, assume it's a phone number or email
    return contact
  }
  
  /**
   * Deserialize campaign KOL from Redis
   */
  private static deserializeKOL(data: any): CampaignKOL | null {
    if (!data) return null
    
    return {
      ...data,
      addedAt: new Date(data.addedAt),
      postedAt: data.postedAt ? new Date(data.postedAt) : undefined,
      completedAt: data.completedAt ? new Date(data.completedAt) : undefined,
      lastSyncedAt: data.lastSyncedAt ? new Date(data.lastSyncedAt) : undefined,
    }
  }
} 