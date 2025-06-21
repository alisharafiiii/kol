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

export class PointsService {
  // Point values for different activities
  static readonly POINT_VALUES = {
    discord: {
      message: 1,
      positiveMessage: 2,
      dailyBonus: 5,
      weeklyActive: 10
    },
    contest: {
      submission: 10,
      topTen: 50,
      winner: 100
    },
    scout: {
      submission: 5,
      approved: 20
    },
    campaign: {
      participation: 25,
      completion: 50
    }
  }

  /**
   * Award points to a user
   */
  static async awardPoints(
    userIdentifier: string, // Can be handle or user ID
    amount: number,
    source: PointSource,
    description: string,
    metadata?: any
  ): Promise<UnifiedProfile | null> {
    try {
      // Validate amount
      if (amount < 0) {
        console.error('[PointsService] Cannot award negative points')
        return null
      }

      // Get user profile
      const profile = await ProfileService.getProfileByHandle(userIdentifier) || 
                     await ProfileService.getProfile(userIdentifier)
      
      if (!profile) {
        console.error(`[PointsService] User not found: ${userIdentifier}`)
        return null
      }

      // Initialize points if not set
      if (typeof profile.points !== 'number') {
        profile.points = 0
      }

      // Update total points
      profile.points += amount

      // Update breakdown
      if (!profile.pointsBreakdown) {
        profile.pointsBreakdown = {
          discord: 0,
          contests: 0,
          scouts: 0,
          campaigns: 0,
          other: 0
        }
      }
      profile.pointsBreakdown[source === 'contest' ? 'contests' : source] += amount

      // Add to history
      if (!profile.pointsHistory) {
        profile.pointsHistory = []
      }
      profile.pointsHistory.push({
        amount,
        source,
        description,
        timestamp: new Date(),
        metadata
      })

      // Keep only last 100 history entries
      if (profile.pointsHistory.length > 100) {
        profile.pointsHistory = profile.pointsHistory.slice(-100)
      }

      // Save updated profile
      await ProfileService.saveProfile(profile)

      // Log transaction
      await this.logPointTransaction({
        userId: profile.id,
        amount,
        source,
        description,
        timestamp: new Date(),
        metadata
      })

      // Update leaderboard
      await this.updateLeaderboard(profile.id, profile.points)

      console.log(`[PointsService] Awarded ${amount} points to ${profile.twitterHandle} (${source}: ${description})`)
      
      return profile
    } catch (error) {
      console.error('[PointsService] Error awarding points:', error)
      return null
    }
  }

  /**
   * Get user's current points
   */
  static async getUserPoints(userIdentifier: string): Promise<number> {
    try {
      const profile = await ProfileService.getProfileByHandle(userIdentifier) || 
                     await ProfileService.getProfile(userIdentifier)
      
      return profile?.points || 0
    } catch (error) {
      console.error('[PointsService] Error getting user points:', error)
      return 0
    }
  }

  /**
   * Get points leaderboard
   */
  static async getLeaderboard(limit: number = 10): Promise<Array<{
    userId: string
    handle: string
    name: string
    points: number
    rank: number
  }>> {
    try {
      // Get top users from sorted set
      const topUsers = await redis.zrange('idx:points:leaderboard', 0, limit - 1, {
        rev: true,
        withScores: true
      })

      const leaderboard = []
      let rank = 1

      for (let i = 0; i < topUsers.length; i += 2) {
        const userId = topUsers[i] as string
        const points = topUsers[i + 1] as number

        // Get user profile
        const profile = await ProfileService.getProfile(userId)
        if (profile) {
          leaderboard.push({
            userId,
            handle: profile.twitterHandle,
            name: profile.name,
            points,
            rank: rank++
          })
        }
      }

      return leaderboard
    } catch (error) {
      console.error('[PointsService] Error getting leaderboard:', error)
      return []
    }
  }

  /**
   * Update leaderboard sorted set
   */
  private static async updateLeaderboard(userId: string, points: number): Promise<void> {
    try {
      await redis.zadd('idx:points:leaderboard', {
        score: points,
        member: userId
      })
    } catch (error) {
      console.error('[PointsService] Error updating leaderboard:', error)
    }
  }

  /**
   * Log point transaction for audit trail
   */
  private static async logPointTransaction(transaction: PointTransaction): Promise<void> {
    try {
      const key = `points:transaction:${Date.now()}`
      await redis.json.set(key, '$', transaction)
      
      // Add to user's transaction list
      await redis.lpush(`points:transactions:${transaction.userId}`, key)
      
      // Keep only last 1000 transactions per user
      await redis.ltrim(`points:transactions:${transaction.userId}`, 0, 999)
    } catch (error) {
      console.error('[PointsService] Error logging transaction:', error)
    }
  }

  /**
   * Award Discord points based on activity
   */
  static async awardDiscordPoints(
    discordUserId: string,
    discordUsername: string,
    activity: 'message' | 'positiveMessage' | 'dailyBonus' | 'weeklyActive'
  ): Promise<void> {
    try {
      // Map Discord user to platform user
      const userKey = await redis.get(`discord:user:map:${discordUserId}`)
      if (!userKey) {
        console.log(`[PointsService] No platform user linked to Discord user ${discordUsername}`)
        return
      }

      const points = this.POINT_VALUES.discord[activity]
      const descriptions = {
        message: 'Posted a message in Discord',
        positiveMessage: 'Posted a positive message in Discord',
        dailyBonus: 'Daily Discord activity bonus',
        weeklyActive: 'Weekly Discord activity bonus'
      }

      await this.awardPoints(
        userKey,
        points,
        'discord',
        descriptions[activity],
        { discordUserId, discordUsername }
      )
    } catch (error) {
      console.error('[PointsService] Error awarding Discord points:', error)
    }
  }

  /**
   * Reset user points (admin only)
   */
  static async resetUserPoints(userId: string, adminId: string): Promise<boolean> {
    try {
      const profile = await ProfileService.getProfile(userId)
      if (!profile) return false

      profile.points = 0
      profile.pointsBreakdown = {
        discord: 0,
        contests: 0,
        scouts: 0,
        campaigns: 0,
        other: 0
      }
      profile.pointsHistory = [{
        amount: 0,
        source: 'other',
        description: `Points reset by admin`,
        timestamp: new Date(),
        metadata: { adminId }
      }]

      await ProfileService.saveProfile(profile)
      await redis.zrem('idx:points:leaderboard', userId)
      
      console.log(`[PointsService] Reset points for user ${userId} by admin ${adminId}`)
      return true
    } catch (error) {
      console.error('[PointsService] Error resetting points:', error)
      return false
    }
  }
} 