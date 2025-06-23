import { redis } from '../redis'
import { nanoid } from 'nanoid'
import { TwitterConnection, Tweet, EngagementLog, PointRule, LeaderboardEntry, BatchJob } from '../types/engagement'

export class EngagementService {
  // Twitter Connection Management
  static async connectTwitter(discordId: string, twitterHandle: string, tier: TwitterConnection['tier'] = 'micro'): Promise<TwitterConnection> {
    const connection: TwitterConnection = {
      discordId,
      twitterHandle: twitterHandle.toLowerCase().replace('@', ''),
      tier,
      connectedAt: new Date(),
      totalPoints: 0
    }
    
    await redis.json.set(`engagement:connection:${discordId}`, '$', connection as any)
    await redis.set(`engagement:twitter:${connection.twitterHandle}`, discordId)
    
    return connection
  }
  
  static async getConnection(discordId: string): Promise<TwitterConnection | null> {
    const connection = await redis.json.get(`engagement:connection:${discordId}`) as any
    return connection || null
  }
  
  static async getConnectionByTwitter(twitterHandle: string): Promise<TwitterConnection | null> {
    const handle = twitterHandle.toLowerCase().replace('@', '')
    const discordId = await redis.get(`engagement:twitter:${handle}`)
    if (!discordId) return null
    
    return this.getConnection(discordId)
  }
  
  static async updateUserTier(discordId: string, tier: TwitterConnection['tier']): Promise<void> {
    await redis.json.set(`engagement:connection:${discordId}`, '$.tier', tier)
  }
  
  // Tweet Management
  static async submitTweet(
    tweetId: string, 
    submitterDiscordId: string, 
    authorHandle: string,
    url: string,
    category?: string
  ): Promise<Tweet> {
    const tweet: Tweet = {
      id: nanoid(),
      tweetId: tweetId.split('/').pop() || tweetId, // Extract ID from URL if needed
      submitterDiscordId,
      submittedAt: new Date(),
      category,
      url,
      authorHandle: authorHandle.toLowerCase().replace('@', '')
    }
    
    await redis.json.set(`engagement:tweet:${tweet.id}`, '$', tweet as any)
    await redis.zadd('engagement:tweets:recent', { score: Date.now(), member: tweet.id })
    
    // Store by tweet ID for duplicate checking
    await redis.set(`engagement:tweetid:${tweet.tweetId}`, tweet.id)
    
    return tweet
  }
  
  static async getTweet(id: string): Promise<Tweet | null> {
    const tweet = await redis.json.get(`engagement:tweet:${id}`) as any
    return tweet || null
  }
  
  static async getRecentTweets(hours: number = 24): Promise<Tweet[]> {
    // Due to server clock issues, we'll get all tweets and sort by date
    // instead of using the time-based filter
    const limit = 100; // Get last 100 tweets
    const tweetIds = await redis.zrange('engagement:tweets:recent', 0, limit - 1, { rev: true })
    
    const tweets: Tweet[] = []
    for (const id of tweetIds) {
      const tweet = await this.getTweet(id)
      if (tweet) tweets.push(tweet)
    }
    
    // Sort by submittedAt date in descending order
    tweets.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
    
    return tweets
  }
  
  static async checkDuplicateTweet(tweetId: string): Promise<boolean> {
    const exists = await redis.exists(`engagement:tweetid:${tweetId}`)
    return exists === 1
  }
  
  // Point Rules Management
  static async setPointRule(tier: number, interactionType: string, points: number): Promise<PointRule> {
    const rule: PointRule = {
      id: `${tier}-${interactionType}`,
      tier,
      interactionType: interactionType as any,
      points
    }
    
    await redis.json.set(`engagement:rules:${rule.id}`, '$', rule as any)
    return rule
  }
  
  static async getPointRule(tier: number, interactionType: string): Promise<PointRule | null> {
    const rule = await redis.json.get(`engagement:rules:${tier}-${interactionType}`) as any
    return rule || null
  }
  
  static async getAllPointRules(): Promise<PointRule[]> {
    const keys = await redis.keys('engagement:rules:*')
    const rules: PointRule[] = []
    
    for (const key of keys) {
      const rule = await redis.json.get(key) as any
      if (rule) rules.push(rule)
    }
    
    return rules
  }
  
  // Engagement Logging
  static async logEngagement(
    tweetId: string,
    userDiscordId: string,
    interactionType: string,
    points: number,
    batchId: string
  ): Promise<EngagementLog> {
    const log: EngagementLog = {
      id: nanoid(),
      tweetId,
      userDiscordId,
      interactionType: interactionType as any,
      points,
      timestamp: new Date(),
      batchId
    }
    
    await redis.json.set(`engagement:log:${log.id}`, '$', log as any)
    
    // Update user points
    const connection = await this.getConnection(userDiscordId)
    if (connection) {
      await redis.json.numincrby(`engagement:connection:${userDiscordId}`, '$.totalPoints', points)
    }
    
    // Add to user's engagement history
    await redis.zadd(`engagement:user:${userDiscordId}:logs`, { score: Date.now(), member: log.id })
    
    // Add to tweet's engagement logs
    await redis.zadd(`engagement:tweet:${tweetId}:logs`, { score: Date.now(), member: log.id })
    
    return log
  }
  
  static async getUserEngagements(discordId: string, limit: number = 50): Promise<EngagementLog[]> {
    const logIds = await redis.zrange(`engagement:user:${discordId}:logs`, 0, limit - 1, { rev: true })
    const logs: EngagementLog[] = []
    
    for (const id of logIds) {
      const log = await redis.json.get(`engagement:log:${id}`) as any
      if (log) logs.push(log)
    }
    
    return logs
  }
  
  // Batch Job Management
  static async createBatchJob(): Promise<BatchJob> {
    const job: BatchJob = {
      id: nanoid(),
      startedAt: new Date(),
      status: 'pending',
      tweetsProcessed: 0,
      engagementsFound: 0
    }
    
    await redis.json.set(`engagement:batch:${job.id}`, '$', job as any)
    await redis.zadd('engagement:batches', { score: Date.now(), member: job.id })
    
    return job
  }
  
  static async updateBatchJob(id: string, updates: Partial<BatchJob>): Promise<void> {
    for (const [key, value] of Object.entries(updates)) {
      await redis.json.set(`engagement:batch:${id}`, `$.${key}`, value as any)
    }
  }
  
  static async getRecentBatchJobs(limit: number = 10): Promise<BatchJob[]> {
    const jobIds = await redis.zrange('engagement:batches', 0, limit - 1, { rev: true })
    const jobs: BatchJob[] = []
    
    for (const id of jobIds) {
      const job = await redis.json.get(`engagement:batch:${id}`) as any
      if (job) jobs.push(job)
    }
    
    return jobs
  }
  
  // Leaderboard
  static async getLeaderboard(limit: number = 50): Promise<LeaderboardEntry[]> {
    const keys = await redis.keys('engagement:connection:*')
    const entries: LeaderboardEntry[] = []
    
    for (const key of keys) {
      const connection = await redis.json.get(key) as TwitterConnection
      if (connection) {
        // Calculate weekly points from recent logs
        const weekCutoff = Date.now() - (7 * 24 * 60 * 60 * 1000)
        const weeklyLogIds = await redis.zrange(
          `engagement:user:${connection.discordId}:logs`,
          weekCutoff,
          '+inf',
          { byScore: true }
        )
        
        let weeklyPoints = 0
        for (const logId of weeklyLogIds) {
          const log = await redis.json.get(`engagement:log:${logId}`) as EngagementLog
          if (log) weeklyPoints += log.points
        }
        
        entries.push({
          discordId: connection.discordId,
          twitterHandle: connection.twitterHandle,
          tier: connection.tier,
          totalPoints: connection.totalPoints,
          weeklyPoints,
          rank: 0
        })
      }
    }
    
    // Sort by total points and assign ranks
    entries.sort((a, b) => b.totalPoints - a.totalPoints)
    entries.forEach((entry, index) => {
      entry.rank = index + 1
    })
    
    return entries.slice(0, limit)
  }
  
  // Default point rules setup
  static async setupDefaultRules(): Promise<void> {
    // Tier 1 (Basic)
    await this.setPointRule(1, 'like', 1)
    await this.setPointRule(1, 'retweet', 2)
    await this.setPointRule(1, 'reply', 3)
    
    // Tier 2 (Active)
    await this.setPointRule(2, 'like', 2)
    await this.setPointRule(2, 'retweet', 4)
    await this.setPointRule(2, 'reply', 6)
    
    // Tier 3 (Power User)
    await this.setPointRule(3, 'like', 3)
    await this.setPointRule(3, 'retweet', 6)
    await this.setPointRule(3, 'reply', 9)
  }
} 