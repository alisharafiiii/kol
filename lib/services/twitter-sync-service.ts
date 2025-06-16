import { redis } from '@/lib/redis'
import { TweetMetrics } from '@/lib/types/profile'
import { CampaignKOLService } from './campaign-kol-service'

interface RateLimitInfo {
  remaining: number
  reset: number
  limit: number
}

interface TweetData {
  id: string
  text: string
  public_metrics: {
    impression_count: number
    like_count: number
    retweet_count: number
    reply_count: number
    quote_count: number
    bookmark_count: number
  }
}

export class TwitterSyncService {
  private static readonly RATE_LIMIT_KEY = 'twitter:ratelimit'
  private static readonly SYNC_QUEUE_KEY = 'twitter:sync:queue'
  private static readonly BEARER_TOKEN = process.env.TWITTER_BEARER_TOKEN
  
  // Twitter API v2 rate limits (Free tier)
  private static readonly RATE_LIMITS = {
    TWEETS_LOOKUP: { limit: 300, window: 15 * 60 * 1000 }, // 300 requests per 15 min
    USERS_LOOKUP: { limit: 300, window: 15 * 60 * 1000 },
  }
  
  /**
   * Extract tweet ID from URL
   */
  private static extractTweetId(url: string): string | null {
    const match = url.match(/status\/(\d+)/)
    return match ? match[1] : null
  }
  
  /**
   * Get current rate limit status
   */
  static async getRateLimitStatus(): Promise<RateLimitInfo> {
    try {
      const cached = await redis.get(this.RATE_LIMIT_KEY)
      if (cached) {
        const cachedStr = typeof cached === 'string' ? cached : JSON.stringify(cached)
        return JSON.parse(cachedStr)
      }
      
      return {
        remaining: this.RATE_LIMITS.TWEETS_LOOKUP.limit,
        reset: Date.now() + this.RATE_LIMITS.TWEETS_LOOKUP.window,
        limit: this.RATE_LIMITS.TWEETS_LOOKUP.limit,
      }
    } catch (error) {
      console.error('Error getting rate limit:', error)
      return {
        remaining: this.RATE_LIMITS.TWEETS_LOOKUP.limit,
        reset: Date.now() + this.RATE_LIMITS.TWEETS_LOOKUP.window,
        limit: this.RATE_LIMITS.TWEETS_LOOKUP.limit,
      }
    }
  }
  
  /**
   * Update rate limit after API call
   */
  private static async updateRateLimit(headers: Headers): Promise<void> {
    try {
      const remaining = parseInt(headers.get('x-rate-limit-remaining') || '0')
      const reset = parseInt(headers.get('x-rate-limit-reset') || '0') * 1000
      const limit = parseInt(headers.get('x-rate-limit-limit') || '300')
      
      const rateLimitInfo: RateLimitInfo = {
        remaining,
        reset,
        limit,
      }
      
      await redis.setex(
        this.RATE_LIMIT_KEY,
        Math.floor((reset - Date.now()) / 1000),
        JSON.stringify(rateLimitInfo)
      )
    } catch (error) {
      console.error('Error updating rate limit:', error)
    }
  }
  
  /**
   * Check if we can make an API call
   */
  private static async canMakeRequest(): Promise<boolean> {
    const rateLimit = await this.getRateLimitStatus()
    
    if (rateLimit.remaining <= 0 && Date.now() < rateLimit.reset) {
      console.log(`Rate limited until ${new Date(rateLimit.reset).toISOString()}`)
      return false
    }
    
    return true
  }
  
  /**
   * Fetch tweet metrics from Twitter API
   */
  static async fetchTweetMetrics(tweetId: string): Promise<TweetData | null> {
    try {
      if (!this.BEARER_TOKEN) {
        throw new Error('Twitter Bearer Token not configured')
      }
      
      if (!(await this.canMakeRequest())) {
        throw new Error('Rate limited')
      }
      
      const response = await fetch(
        `https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=public_metrics`,
        {
          headers: {
            'Authorization': `Bearer ${this.BEARER_TOKEN}`,
          },
        }
      )
      
      await this.updateRateLimit(response.headers)
      
      if (!response.ok) {
        const error = await response.json()
        throw new Error(`Twitter API error: ${error.detail || response.statusText}`)
      }
      
      const data = await response.json()
      return data.data
    } catch (error) {
      console.error(`Error fetching tweet ${tweetId}:`, error)
      return null
    }
  }
  
  /**
   * Batch fetch multiple tweets (up to 100 per request)
   */
  static async batchFetchTweets(tweetIds: string[]): Promise<Map<string, TweetData>> {
    const results = new Map<string, TweetData>()
    
    try {
      if (!this.BEARER_TOKEN) {
        throw new Error('Twitter Bearer Token not configured')
      }
      
      if (!(await this.canMakeRequest())) {
        throw new Error('Rate limited')
      }
      
      // Twitter allows up to 100 tweets per request
      const batchSize = 100
      for (let i = 0; i < tweetIds.length; i += batchSize) {
        const batch = tweetIds.slice(i, i + batchSize)
        const ids = batch.join(',')
        
        const response = await fetch(
          `https://api.twitter.com/2/tweets?ids=${ids}&tweet.fields=public_metrics`,
          {
            headers: {
              'Authorization': `Bearer ${this.BEARER_TOKEN}`,
            },
          }
        )
        
        await this.updateRateLimit(response.headers)
        
        if (!response.ok) {
          console.error('Batch fetch failed:', await response.text())
          continue
        }
        
        const data = await response.json()
        if (data.data) {
          data.data.forEach((tweet: TweetData) => {
            results.set(tweet.id, tweet)
          })
        }
        
        // Small delay between batches
        if (i + batchSize < tweetIds.length) {
          await new Promise(resolve => setTimeout(resolve, 1000))
        }
      }
    } catch (error) {
      console.error('Error batch fetching tweets:', error)
    }
    
    return results
  }
  
  /**
   * Sync tweets for a campaign
   */
  static async syncCampaignTweets(campaignId: string): Promise<{
    synced: number
    failed: number
    rateLimited: boolean
  }> {
    const result = {
      synced: 0,
      failed: 0,
      rateLimited: false,
    }
    
    try {
      // First try to get KOLs from CampaignKOLService (new format)
      let kols = await CampaignKOLService.getCampaignKOLs(campaignId)
      
      // If no KOLs found, try getting from campaign object (old format)
      if (kols.length === 0) {
        console.log('No KOLs in service, checking campaign object...')
        const { getCampaign } = await import('@/lib/campaign')
        const campaign = await getCampaign(campaignId)
        
        if (campaign && campaign.kols && campaign.kols.length > 0) {
          console.log(`Found ${campaign.kols.length} KOLs in campaign object`)
          // Convert old format KOLs to format expected by sync
          kols = campaign.kols.map(kol => ({
            id: kol.id,
            campaignId: campaignId,
            kolId: kol.id,
            kolHandle: kol.handle,
            kolName: kol.name,
            kolImage: kol.pfp,
            tier: kol.tier as any,
            stage: kol.stage as any,
            deviceStatus: kol.device as any,
            budget: typeof kol.budget === 'string' ? parseFloat(kol.budget) || 0 : kol.budget || 0,
            paymentStatus: kol.payment as any,
            links: kol.links || [],
            platform: Array.isArray(kol.platform) ? kol.platform[0] as any : kol.platform as any,
            contentType: 'tweet' as any,
            totalViews: kol.views || 0,
            totalEngagement: (kol.likes || 0) + (kol.retweets || 0) + (kol.comments || 0),
            engagementRate: 0,
            score: 0,
            addedAt: kol.lastUpdated || new Date(),
            addedBy: 'system',
          }))
        }
      }
      
      // Collect all tweet IDs grouped by KOL
      const kolTweetMap = new Map<string, string[]>() // kolId -> tweetIds[]
      const allTweetIds = new Set<string>()
      
      for (const kol of kols) {
        const tweetIds: string[] = []
        for (const link of kol.links) {
          const tweetId = this.extractTweetId(link)
          if (tweetId) {
            tweetIds.push(tweetId)
            allTweetIds.add(tweetId)
          }
        }
        if (tweetIds.length > 0) {
          kolTweetMap.set(kol.id, tweetIds)
        }
      }
      
      if (allTweetIds.size === 0) {
        console.log('No tweets to sync for campaign', campaignId)
        return result
      }
      
      console.log(`Found ${allTweetIds.size} tweets to sync`)
      
      // Check rate limit
      const rateLimit = await this.getRateLimitStatus()
      if (rateLimit.remaining < allTweetIds.size) {
        console.log(`Need ${allTweetIds.size} requests but only ${rateLimit.remaining} remaining`)
        result.rateLimited = true
        
        // Queue for later processing
        await this.queueCampaignForSync(campaignId)
        return result
      }
      
      // Batch fetch tweets
      const tweetIds = Array.from(allTweetIds)
      const tweets = await this.batchFetchTweets(tweetIds)
      
      // Update KOL metrics - aggregate all tweets for each KOL
      for (const [kolId, kolTweetIds] of Array.from(kolTweetMap)) {
        try {
          // Find the original KOL to update
          const kol = kols.find(k => k.id === kolId)
          if (!kol) continue
          
          // Aggregate metrics from all tweets for this KOL
          let totalViews = 0
          let totalLikes = 0
          let totalRetweets = 0
          let totalComments = 0
          let tweetsFound = 0
          
          for (const tweetId of kolTweetIds) {
            const tweet = tweets.get(tweetId)
            if (tweet) {
              totalViews += tweet.public_metrics.impression_count
              totalLikes += tweet.public_metrics.like_count
              totalRetweets += tweet.public_metrics.retweet_count
              totalComments += tweet.public_metrics.reply_count
              tweetsFound++
            }
          }
          
          if (tweetsFound === 0) {
            console.log(`No tweets found for KOL ${kol.kolHandle}`)
            continue
          }
          
          console.log(`Updating KOL ${kol.kolHandle} with aggregated metrics from ${tweetsFound} tweets:`, {
            totalViews,
            totalLikes,
            totalRetweets,
            totalComments
          })
          
          // If it's from old format, update the campaign directly
          if (kols.length > 0 && !await CampaignKOLService.getCampaignKOLs(campaignId).then(k => k.length)) {
            // Directly update the campaign in Redis to bypass authorization
            const campaign = await redis.json.get(campaignId, '$') as any
            if (campaign && campaign[0]) {
              const campaignData = campaign[0]
              const kolIndex = campaignData.kols.findIndex((k: any) => k.id === kolId)
              if (kolIndex >= 0) {
                campaignData.kols[kolIndex].views = totalViews
                campaignData.kols[kolIndex].likes = totalLikes
                campaignData.kols[kolIndex].retweets = totalRetweets
                campaignData.kols[kolIndex].comments = totalComments
                campaignData.kols[kolIndex].lastUpdated = new Date()
                
                await redis.json.set(campaignId, '$', campaignData)
              }
            }
          } else {
            // Update using CampaignKOLService
            await CampaignKOLService.updateKOLMetrics(kolId, {
              views: totalViews,
              likes: totalLikes,
              retweets: totalRetweets,
              replies: totalComments,
            })
          }
          
          result.synced += tweetsFound
        } catch (error) {
          console.error(`Error updating metrics for KOL ${kolId}:`, error)
          result.failed++
        }
      }
      
      // Mark campaign as synced
      await redis.setex(
        `campaign:${campaignId}:lastSync`,
        3600, // Cache for 1 hour
        new Date().toISOString()
      )
      
    } catch (error) {
      console.error('Error syncing campaign tweets:', error)
      if (error instanceof Error && error.message.includes('Rate limited')) {
        result.rateLimited = true
      }
    }
    
    return result
  }
  
  /**
   * Queue a campaign for later sync
   */
  static async queueCampaignForSync(campaignId: string): Promise<void> {
    await redis.sadd(this.SYNC_QUEUE_KEY, campaignId)
  }
  
  /**
   * Process queued campaigns (run periodically)
   */
  static async processQueuedCampaigns(): Promise<void> {
    try {
      const campaignIds = await redis.smembers(this.SYNC_QUEUE_KEY)
      
      for (const campaignId of campaignIds) {
        const result = await this.syncCampaignTweets(campaignId)
        
        if (!result.rateLimited) {
          // Remove from queue if successful
          await redis.srem(this.SYNC_QUEUE_KEY, campaignId)
        } else {
          // Stop processing if rate limited
          break
        }
        
        // Delay between campaigns
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    } catch (error) {
      console.error('Error processing queued campaigns:', error)
    }
  }
  
  /**
   * Get sync status for a campaign
   */
  static async getCampaignSyncStatus(campaignId: string): Promise<{
    lastSync: Date | null
    inQueue: boolean
    rateLimit: RateLimitInfo
  }> {
    const [lastSyncStr, inQueue, rateLimit] = await Promise.all([
      redis.get(`campaign:${campaignId}:lastSync`),
      redis.sismember(this.SYNC_QUEUE_KEY, campaignId),
      this.getRateLimitStatus(),
    ])
    
    return {
      lastSync: lastSyncStr ? new Date(lastSyncStr as string) : null,
      inQueue: Boolean(inQueue),
      rateLimit,
    }
  }
} 