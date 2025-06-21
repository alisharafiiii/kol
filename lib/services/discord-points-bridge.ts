import { redis } from '@/lib/redis'

/**
 * Discord Points Bridge Service
 * 
 * This service acts as a bridge between the Discord Analytics Bot and the Points Service.
 * It provides a simple API for the bot to award points without direct dependency on the main app.
 */

export interface DiscordPointsTransaction {
  userId: string
  twitterHandle: string
  discordUsername: string
  discordUserId: string
  projectId: string
  projectName: string
  messageId: string
  points: number
  timestamp: string
  metadata?: Record<string, any>
}

export class DiscordPointsBridge {
  private static readonly POINTS_ACTION_ID = 'action_discord_msg'
  private static readonly TRANSACTION_LOG_KEY = 'points:discord:transactions'
  private static readonly USER_DAILY_KEY_PREFIX = 'points:discord:daily:'
  
  /**
   * Award points for a Discord message
   * This method is designed to be called from the analytics bot
   */
  static async awardMessagePoints(
    discordUserId: string,
    discordUsername: string,
    projectId: string,
    projectName: string,
    messageId: string
  ): Promise<{ success: boolean; points?: number; error?: string }> {
    try {
      // Step 1: Find the user's platform profile by Discord ID
      const userKey = await redis.get(`discord:user:map:${discordUserId}`)
      if (!userKey) {
        // User not linked to platform, skip points
        return { success: true, points: 0 }
      }
      
      // Get user profile to get Twitter handle
      const userData = await redis.json.get(userKey)
      if (!userData) {
        return { success: false, error: 'User profile not found' }
      }
      
      const user = userData as any
      const userId = userKey.replace('user:', '')
      const twitterHandle = user.twitterHandle || user.handle || 'unknown'
      
      // Step 2: Check daily limit (prevent spam)
      const dailyKey = `${this.USER_DAILY_KEY_PREFIX}${discordUserId}:${new Date().toISOString().split('T')[0]}`
      const dailyCount = await redis.incr(dailyKey)
      
      if (dailyCount === 1) {
        // Set expiry to end of day
        await redis.expire(dailyKey, 86400)
      }
      
      // Limit: 50 messages per day can earn points
      if (dailyCount > 50) {
        return { success: true, points: 0 }
      }
      
      // Step 3: Load points configuration
      const config = await redis.json.get('points:config') as any
      if (!config) {
        return { success: false, error: 'Points configuration not found' }
      }
      
      // Find Discord message action
      const action = config.actions.find((a: any) => a.id === this.POINTS_ACTION_ID)
      if (!action) {
        return { success: false, error: 'Discord message action not configured' }
      }
      
      // Get user's current tier
      const currentTotal = user.points || 0
      const tier = config.tiers
        .sort((a: any, b: any) => b.minPoints - a.minPoints)
        .find((t: any) => currentTotal >= t.minPoints && currentTotal <= t.maxPoints)
      
      // Calculate points (check for tier-specific scenario)
      let pointsToAward = action.basePoints
      if (tier) {
        const scenario = config.scenarios.find(
          (s: any) => s.tier === tier.id && s.action === this.POINTS_ACTION_ID
        )
        if (scenario) {
          pointsToAward = scenario.points
        } else if (tier.multiplier) {
          pointsToAward = Math.round(action.basePoints * tier.multiplier)
        }
      }
      
      // Step 4: Award points
      const currentBreakdown = user.pointsBreakdown || {
        discord: 0,
        contests: 0,
        scouts: 0,
        campaigns: 0,
        other: 0,
        total: 0
      }
      
      currentBreakdown.discord += pointsToAward
      currentBreakdown.total = currentBreakdown.discord + currentBreakdown.contests + 
                              currentBreakdown.scouts + currentBreakdown.campaigns + 
                              currentBreakdown.other
      
      // Update user profile
      await redis.json.set(userKey, '$.points', currentTotal + pointsToAward)
      await redis.json.set(userKey, '$.pointsBreakdown', currentBreakdown)
      
      // Step 5: Log transaction
      const transaction: DiscordPointsTransaction = {
        userId,
        twitterHandle,
        discordUsername,
        discordUserId,
        projectId,
        projectName,
        messageId,
        points: pointsToAward,
        timestamp: new Date().toISOString(),
        metadata: {
          tier: tier?.id || 'none',
          dailyCount,
          actionId: this.POINTS_ACTION_ID
        }
      }
      
      // Store in sorted set for history
      await redis.zadd(`points:history:${userId}`, {
        score: Date.now(),
        member: JSON.stringify({
          ...transaction,
          actionId: this.POINTS_ACTION_ID,
          category: 'discord',
          description: `Discord message in ${projectName}`
        })
      })
      
      // Log to transaction history
      await redis.zadd(this.TRANSACTION_LOG_KEY, {
        score: Date.now(),
        member: JSON.stringify(transaction)
      })
      
      // Update leaderboards
      const today = new Date().toISOString().split('T')[0]
      await redis.zincrby(`points:leaderboard:${today}`, pointsToAward, userId)
      await redis.zincrby('points:leaderboard:alltime', pointsToAward, userId)
      
      console.log(`[DiscordPointsBridge] Awarded ${pointsToAward} points to @${twitterHandle} for Discord message`)
      
      return { success: true, points: pointsToAward }
      
    } catch (error) {
      console.error('[DiscordPointsBridge] Error awarding points:', error)
      return { success: false, error: String(error) }
    }
  }
  
  /**
   * Get recent Discord points transactions
   */
  static async getRecentTransactions(limit = 50): Promise<DiscordPointsTransaction[]> {
    try {
      const transactions = await redis.zrange(
        this.TRANSACTION_LOG_KEY,
        -limit,
        -1,
        { rev: true }
      )
      
      return transactions.map((t: string) => {
        try {
          return JSON.parse(t)
        } catch {
          return null
        }
      }).filter(Boolean)
    } catch (error) {
      console.error('[DiscordPointsBridge] Error fetching transactions:', error)
      return []
    }
  }
  
  /**
   * Link Discord user to platform user
   * Called when user connects their Discord account
   */
  static async linkDiscordUser(
    discordUserId: string,
    platformUserId: string
  ): Promise<boolean> {
    try {
      await redis.set(`discord:user:map:${discordUserId}`, `user:${platformUserId}`)
      console.log(`[DiscordPointsBridge] Linked Discord user ${discordUserId} to platform user ${platformUserId}`)
      return true
    } catch (error) {
      console.error('[DiscordPointsBridge] Error linking user:', error)
      return false
    }
  }
} 