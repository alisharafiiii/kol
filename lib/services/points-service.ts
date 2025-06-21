import { redis } from '@/lib/redis'
import { ProfileService } from './profile-service'
import { UnifiedProfile } from '@/lib/types/profile'

export type PointSource = 'discord' | 'contest' | 'scout' | 'campaign' | 'other'

export interface PointTransaction {
  userId: string
  amount: number
  source: PointSource
  description: string
  timestamp: Date
  metadata?: any
}

/**
 * Points Service - Centralized service for managing points
 * 
 * This service handles:
 * - Loading points configuration
 * - Calculating points based on actions and tiers
 * - Awarding points to users
 * - Retrieving user points
 */

// Types
export interface PointAction {
  id: string
  name: string
  description: string
  basePoints: number
  category: string
}

export interface Tier {
  id: string
  name: string
  minPoints: number
  maxPoints: number
  multiplier: number
  color: string
}

export interface Scenario {
  id: string
  tier: string
  action: string
  points: number
  multiplier: number
}

export interface PointsConfig {
  actions: PointAction[]
  tiers: Tier[]
  scenarios: Scenario[]
}

export interface PointsBreakdown {
  discord: number
  contests: number
  scouts: number
  campaigns: number
  other: number
  total: number
}

export class PointsService {
  private config: PointsConfig | null = null
  private configKey = 'points:config'

  /**
   * Load points configuration from Redis
   */
  async loadConfig(): Promise<PointsConfig> {
    if (this.config) {
      return this.config
    }

    try {
      const config = await redis.json.get(this.configKey) as PointsConfig | null
      
      if (!config) {
        // Return default config if none exists
        this.config = this.getDefaultConfig()
      } else {
        this.config = config
      }
      
      return this.config
    } catch (error) {
      console.error('Error loading points config:', error)
      // Return default config on error
      this.config = this.getDefaultConfig()
      return this.config
    }
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): PointsConfig {
    return {
      actions: [
        {
          id: 'action_tweet_post',
          name: 'Tweet Post',
          description: 'Points for posting campaign tweets',
          basePoints: 100,
          category: 'engagement'
        },
        {
          id: 'action_discord_msg',
          name: 'Discord Message',
          description: 'Points for Discord engagement',
          basePoints: 10,
          category: 'social'
        },
        {
          id: 'action_contest_entry',
          name: 'Contest Entry',
          description: 'Points for entering contests',
          basePoints: 50,
          category: 'engagement'
        },
        {
          id: 'action_referral',
          name: 'Referral',
          description: 'Points for successful referrals',
          basePoints: 200,
          category: 'referral'
        }
      ],
      tiers: [
        {
          id: 'tier_hero',
          name: 'Hero',
          minPoints: 10000,
          maxPoints: 999999,
          multiplier: 2.0,
          color: '#FFB800'
        },
        {
          id: 'tier_legend',
          name: 'Legend',
          minPoints: 5000,
          maxPoints: 9999,
          multiplier: 1.8,
          color: '#FF0000'
        },
        {
          id: 'tier_star',
          name: 'Star',
          minPoints: 2500,
          maxPoints: 4999,
          multiplier: 1.5,
          color: '#0080FF'
        },
        {
          id: 'tier_rising',
          name: 'Rising',
          minPoints: 1000,
          maxPoints: 2499,
          multiplier: 1.2,
          color: '#00FF00'
        },
        {
          id: 'tier_micro',
          name: 'Micro',
          minPoints: 0,
          maxPoints: 999,
          multiplier: 1.0,
          color: '#808080'
        }
      ],
      scenarios: []
    }
  }

  /**
   * Calculate points for an action based on user tier
   */
  async calculatePoints(actionId: string, userTier?: string): Promise<number> {
    const config = await this.loadConfig()
    
    // Find the action
    const action = config.actions.find(a => a.id === actionId)
    if (!action) {
      console.error(`Action not found: ${actionId}`)
      return 0
    }
    
    // If no tier specified, use base points
    if (!userTier) {
      return action.basePoints
    }
    
    // Find scenario for this tier and action
    const scenario = config.scenarios.find(
      s => s.tier === userTier && s.action === actionId
    )
    
    if (scenario) {
      return scenario.points
    }
    
    // If no specific scenario, apply tier multiplier to base points
    const tier = config.tiers.find(t => t.id === userTier)
    if (tier) {
      return Math.round(action.basePoints * tier.multiplier)
    }
    
    // Default to base points
    return action.basePoints
  }

  /**
   * Get tier based on user's total points
   */
  async getTierByPoints(totalPoints: number): Promise<Tier | null> {
    const config = await this.loadConfig()
    
    // Sort tiers by minPoints descending to check from highest to lowest
    const sortedTiers = [...config.tiers].sort((a, b) => b.minPoints - a.minPoints)
    
    for (const tier of sortedTiers) {
      if (totalPoints >= tier.minPoints && totalPoints <= tier.maxPoints) {
        return tier
      }
    }
    
    // Default to lowest tier
    return config.tiers.find(t => t.id === 'tier_micro') || null
  }

  /**
   * Award points to a user
   */
  async awardPoints(
    userId: string, 
    actionId: string, 
    category: 'discord' | 'contests' | 'scouts' | 'campaigns' | 'other' = 'other',
    metadata?: Record<string, any>
  ): Promise<number> {
    try {
      // Get user's current points
      const userData = await redis.json.get(`user:${userId}`)
      if (!userData) {
        throw new Error(`User not found: ${userId}`)
      }
      
      const user = userData as any
      const currentTotal = user.points || 0
      const currentBreakdown = user.pointsBreakdown || {
        discord: 0,
        contests: 0,
        scouts: 0,
        campaigns: 0,
        other: 0,
        total: 0
      }
      
      // Get user's current tier based on total points
      const tier = await this.getTierByPoints(currentTotal)
      
      // Calculate points for this action
      const pointsAwarded = await this.calculatePoints(actionId, tier?.id)
      
      // Update breakdown
      currentBreakdown[category] += pointsAwarded
      currentBreakdown.total += pointsAwarded
      
      // Update user profile
      await redis.json.set(`user:${userId}`, '$.points', currentTotal + pointsAwarded)
      await redis.json.set(`user:${userId}`, '$.pointsBreakdown', currentBreakdown)
      
      // Log the points award
      const logEntry = {
        userId,
        actionId,
        category,
        points: pointsAwarded,
        tierUsed: tier?.id || 'none',
        timestamp: new Date().toISOString(),
        metadata
      }
      
      // Store in a sorted set for history (score is timestamp)
      await redis.zadd(`points:history:${userId}`, {
        score: Date.now(),
        member: JSON.stringify(logEntry)
      })
      
      // Also store in daily leaderboard
      const today = new Date().toISOString().split('T')[0]
      await redis.zincrby(`points:leaderboard:${today}`, pointsAwarded, userId)
      
      // Update all-time leaderboard
      await redis.zincrby('points:leaderboard:alltime', pointsAwarded, userId)
      
      console.log(`Awarded ${pointsAwarded} points to user ${userId} for action ${actionId}`)
      
      return pointsAwarded
    } catch (error) {
      console.error('Error awarding points:', error)
      throw error
    }
  }

  /**
   * Get user's points and breakdown
   */
  async getUserPoints(userId: string): Promise<PointsBreakdown | null> {
    try {
      const userData = await redis.json.get(`user:${userId}`)
      if (!userData) {
        return null
      }
      
      const user = userData as any
      const breakdown = user.pointsBreakdown || {
        discord: 0,
        contests: 0,
        scouts: 0,
        campaigns: 0,
        other: 0,
        total: user.points || 0
      }
      
      // Ensure total matches the sum
      breakdown.total = breakdown.discord + breakdown.contests + 
                       breakdown.scouts + breakdown.campaigns + breakdown.other
      
      return breakdown
    } catch (error) {
      console.error('Error getting user points:', error)
      return null
    }
  }

  /**
   * Get points history for a user
   */
  async getUserPointsHistory(userId: string, limit = 50): Promise<any[]> {
    try {
      const history = await redis.zrange(
        `points:history:${userId}`, 
        -limit, 
        -1,
        { rev: true }
      )
      
      return history.map((entry: string) => {
        try {
          return JSON.parse(entry)
        } catch {
          return entry
        }
      })
    } catch (error) {
      console.error('Error getting points history:', error)
      return []
    }
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(type: 'daily' | 'alltime' = 'alltime', limit = 100): Promise<Array<{userId: string, points: number}>> {
    try {
      const key = type === 'daily' 
        ? `points:leaderboard:${new Date().toISOString().split('T')[0]}`
        : 'points:leaderboard:alltime'
      
      const leaderboard = await redis.zrange(key, 0, limit - 1, {
        rev: true,
        withScores: true
      })
      
      // Convert to array of objects
      const result: Array<{userId: string, points: number}> = []
      for (let i = 0; i < leaderboard.length; i += 2) {
        result.push({
          userId: leaderboard[i] as string,
          points: Number(leaderboard[i + 1])
        })
      }
      
      return result
    } catch (error) {
      console.error('Error getting leaderboard:', error)
      return []
    }
  }

  /**
   * Reset configuration cache (useful after updates)
   */
  resetConfigCache() {
    this.config = null
  }
}

// Export singleton instance
export const pointsService = new PointsService() 