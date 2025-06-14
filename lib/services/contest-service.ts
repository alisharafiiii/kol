import { redis } from '@/lib/redis'
import { v4 as uuidv4 } from 'uuid'
import {
  Contest,
  ContestSubmission,
  ContestLeaderboard,
  LeaderboardEntry,
  UserContestStats,
  TIER_MULTIPLIERS,
  ContestSponsor
} from '@/lib/types/contest'
import { getProjectById } from '@/lib/project'
import { getProfile } from '@/lib/redis'

export class ContestService {
  private static readonly PREFIX = 'contest:'
  private static readonly SUBMISSION_PREFIX = 'contest:submission:'
  private static readonly LEADERBOARD_PREFIX = 'contest:leaderboard:'
  private static readonly USER_STATS_PREFIX = 'contest:user:stats:'

  /**
   * Create a new contest
   */
  static async createContest(data: Omit<Contest, 'id' | 'createdAt' | 'updatedAt'>): Promise<Contest> {
    try {
      // Ensure dates are Date objects
      const startTime = data.startTime instanceof Date ? data.startTime : new Date(data.startTime)
      const endTime = data.endTime instanceof Date ? data.endTime : new Date(data.endTime)
      
      const contest: Contest = {
        ...data,
        startTime,
        endTime,
        id: uuidv4(),
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      console.log('ContestService.createContest - Creating contest:', {
        id: contest.id,
        name: contest.name,
        status: contest.status,
        visibility: contest.visibility,
        startTime: contest.startTime.toISOString(),
        endTime: contest.endTime.toISOString()
      })

      // Convert dates to ISO strings for JSON serialization
      const contestToSave = {
        ...contest,
        startTime: contest.startTime.toISOString(),
        endTime: contest.endTime.toISOString(),
        createdAt: contest.createdAt.toISOString(),
        updatedAt: contest.updatedAt.toISOString()
      }
      
      // Use Upstash Redis JSON operations for complex objects
      console.log(`ContestService - Saving contest with JSON.set`)
      
      await redis.json.set(
        `${this.PREFIX}${contest.id}`,
        '$',
        JSON.parse(JSON.stringify(contestToSave))
      )
      console.log(`ContestService - Saved contest to Redis key: ${this.PREFIX}${contest.id}`)

      // Index by status
      await redis.sadd(`idx:contest:status:${contest.status}`, contest.id)
      console.log(`ContestService - Added to status index: idx:contest:status:${contest.status}`)

      // Index by visibility
      await redis.sadd(`idx:contest:visibility:${contest.visibility}`, contest.id)
      console.log(`ContestService - Added to visibility index: idx:contest:visibility:${contest.visibility}`)

      // Add to all contests set
      await redis.sadd('contests:all', contest.id)
      console.log('ContestService - Added to contests:all')

      // Verify the contest was saved
      const savedContest = await redis.get(`${this.PREFIX}${contest.id}`)
      console.log('ContestService - Verification: Contest saved?', !!savedContest)

      return contest
    } catch (error) {
      console.error('Error creating contest:', error)
      throw error
    }
  }

  /**
   * Update a contest
   */
  static async updateContest(
    contestId: string,
    updates: Partial<Contest>,
    updatedBy: string
  ): Promise<Contest> {
    try {
      console.log('ContestService.updateContest - Starting update:', {
        contestId,
        updates: {
          status: updates.status,
          visibility: updates.visibility,
          name: updates.name
        }
      })

      const existing = await this.getContestById(contestId)
      if (!existing) throw new Error('Contest not found')

      console.log('ContestService.updateContest - Existing contest:', {
        status: existing.status,
        visibility: existing.visibility
      })

      // Handle status index updates
      if (updates.status && updates.status !== existing.status) {
        await redis.srem(`idx:contest:status:${existing.status}`, contestId)
        await redis.sadd(`idx:contest:status:${updates.status}`, contestId)
        console.log(`ContestService - Updated status index from ${existing.status} to ${updates.status}`)
      }

      // Handle visibility index updates
      if (updates.visibility && updates.visibility !== existing.visibility) {
        await redis.srem(`idx:contest:visibility:${existing.visibility}`, contestId)
        await redis.sadd(`idx:contest:visibility:${updates.visibility}`, contestId)
        console.log(`ContestService - Updated visibility index from ${existing.visibility} to ${updates.visibility}`)
      }

      // Ensure dates in updates are Date objects
      if (updates.startTime && !(updates.startTime instanceof Date)) {
        updates.startTime = new Date(updates.startTime)
      }
      if (updates.endTime && !(updates.endTime instanceof Date)) {
        updates.endTime = new Date(updates.endTime)
      }
      
      // Create updated contest, ensuring all fields are preserved
      const updated: Contest = {
        // Start with ALL existing fields
        ...existing,
        // Apply updates (but ensure arrays are properly handled)
        ...updates,
        // Preserve critical fields that should never change
        id: contestId,
        createdAt: existing.createdAt,
        // Update metadata
        updatedAt: new Date(),
        updatedBy,
        // Ensure arrays are not accidentally nullified
        sponsors: updates.sponsors !== undefined ? updates.sponsors : existing.sponsors,
        sentimentTags: updates.sentimentTags !== undefined ? updates.sentimentTags : existing.sentimentTags,
        prizeDistribution: updates.prizeDistribution !== undefined ? updates.prizeDistribution : existing.prizeDistribution,
      }

      // Convert dates to ISO strings for JSON serialization
      const contestToSave = {
        ...updated,
        startTime: updated.startTime instanceof Date ? updated.startTime.toISOString() : updated.startTime,
        endTime: updated.endTime instanceof Date ? updated.endTime.toISOString() : updated.endTime,
        createdAt: updated.createdAt instanceof Date ? updated.createdAt.toISOString() : updated.createdAt,
        updatedAt: updated.updatedAt instanceof Date ? updated.updatedAt.toISOString() : updated.updatedAt
      }
      
      await redis.json.set(
        `${this.PREFIX}${contestId}`,
        '$',
        JSON.parse(JSON.stringify(contestToSave))
      )

      console.log('ContestService.updateContest - Contest updated successfully')

      // Verify indices
      const inAllContests = await redis.sismember('contests:all', contestId)
      const inStatusIndex = await redis.sismember(`idx:contest:status:${updated.status}`, contestId)
      const inVisibilityIndex = await redis.sismember(`idx:contest:visibility:${updated.visibility}`, contestId)
      
      console.log('ContestService - Index verification:', {
        inAllContests,
        inStatusIndex,
        inVisibilityIndex
      })
      
      // CRITICAL FIX: Ensure contest is in 'contests:all' set
      if (!inAllContests) {
        console.log('WARNING: Contest was missing from contests:all, adding it back')
        await redis.sadd('contests:all', contestId)
      }

      return updated
    } catch (error) {
      console.error('Error updating contest:', error)
      throw error
    }
  }

  /**
   * Get a contest by ID
   */
  static async getContestById(contestId: string): Promise<Contest | null> {
    try {
      const contest = await redis.json.get(`${this.PREFIX}${contestId}`)
      if (!contest) return null

      return this.deserializeContest(contest)
    } catch (error) {
      console.error('Error getting contest:', error)
      return null
    }
  }

  /**
   * Get all contests with optional filters
   */
  static async getContests(filters?: {
    status?: Contest['status']
    visibility?: Contest['visibility']
  }): Promise<Contest[]> {
    try {
      console.log('ContestService.getContests - Called with filters:', filters)
      
      let contestIds: string[] = []

      if (filters?.status && filters?.visibility) {
        // Get intersection of both filters
        const statusIds = await redis.smembers(`idx:contest:status:${filters.status}`)
        const visibilityIds = await redis.smembers(`idx:contest:visibility:${filters.visibility}`)
        contestIds = statusIds.filter((id: string) => visibilityIds.includes(id))
        console.log(`ContestService - Status index (${filters.status}):`, statusIds.length, 'contests')
        console.log(`ContestService - Visibility index (${filters.visibility}):`, visibilityIds.length, 'contests')
        console.log('ContestService - Intersection:', contestIds.length, 'contests')
      } else if (filters?.status) {
        contestIds = await redis.smembers(`idx:contest:status:${filters.status}`)
        console.log(`ContestService - Status index (${filters.status}):`, contestIds.length, 'contests')
      } else if (filters?.visibility) {
        contestIds = await redis.smembers(`idx:contest:visibility:${filters.visibility}`)
        console.log(`ContestService - Visibility index (${filters.visibility}):`, contestIds.length, 'contests')
      } else {
        contestIds = await redis.smembers('contests:all')
        console.log('ContestService - All contests:', contestIds.length, 'contests')
      }

      console.log('ContestService - Contest IDs to fetch:', contestIds)

      const contests = await Promise.all(
        contestIds.map(async (id) => {
          try {
            const contest = await redis.json.get(`${this.PREFIX}${id}`)
            if (!contest) {
              console.log(`ContestService - WARNING: Contest ${id} exists in index but not in Redis`)
              // Remove from indices since it's missing
              await redis.srem('contests:all', id)
              await redis.srem(`idx:contest:status:active`, id)
              await redis.srem(`idx:contest:status:draft`, id)
              await redis.srem(`idx:contest:visibility:public`, id)
              await redis.srem(`idx:contest:visibility:hidden`, id)
              return null
            }
            
            return this.deserializeContest(contest)
          } catch (error) {
            console.error(`ContestService - Error fetching contest ${id}:`, error)
            return null
          }
        })
      )

      const validContests = contests.filter(Boolean) as Contest[]
      console.log('ContestService - Valid contests found:', validContests.length)
      
      return validContests
    } catch (error) {
      console.error('Error getting contests:', error)
      return []
    }
  }

  /**
   * Get active contests visible to users
   */
  static async getActiveContests(): Promise<Contest[]> {
    try {
      const now = new Date()
      const allContests = await this.getContests({
        status: 'active',
        visibility: 'public'
      })

      // Filter contests that are within their time range
      return allContests.filter(contest => {
        const startTime = new Date(contest.startTime)
        const endTime = new Date(contest.endTime)
        return now >= startTime && now <= endTime
      })
    } catch (error) {
      console.error('Error getting active contests:', error)
      return []
    }
  }

  /**
   * Delete a contest
   */
  static async deleteContest(contestId: string): Promise<boolean> {
    try {
      const contest = await this.getContestById(contestId)
      if (!contest) return false

      // Remove from indices
      await redis.srem(`idx:contest:status:${contest.status}`, contestId)
      await redis.srem(`idx:contest:visibility:${contest.visibility}`, contestId)
      await redis.srem('contests:all', contestId)

      // Delete contest data (using JSON del for Upstash)
      await redis.json.del(`${this.PREFIX}${contestId}`, '$')

      // Delete associated submissions
      const submissionIds = await redis.smembers(`${contestId}:submissions`)
      await Promise.all(
        submissionIds.map((id: string) => redis.del(`${this.SUBMISSION_PREFIX}${id}`))
      )
      await redis.del(`${contestId}:submissions`)

      // Delete leaderboard
      await redis.del(`${this.LEADERBOARD_PREFIX}${contestId}`)

      return true
    } catch (error) {
      console.error('Error deleting contest:', error)
      return false
    }
  }

  /**
   * Submit a tweet to a contest
   */
  static async submitTweet(data: {
    contestId: string
    userId: string
    userHandle: string
    userTier: ContestSubmission['userTier']
    tweetId: string
    tweetUrl: string
    tweetContent: string
  }): Promise<ContestSubmission> {
    try {
      // Check if tweet already submitted
      const existingSubmission = await this.getSubmissionByTweetId(data.contestId, data.tweetId)
      if (existingSubmission) {
        throw new Error('Tweet already submitted to this contest')
      }

      const submission: ContestSubmission = {
        id: uuidv4(),
        ...data,
        submittedAt: new Date(),
        views: 0,
        likes: 0,
        retweets: 0,
        replies: 0,
        bookmarks: 0,
        quotes: 0,
        rawEngagement: 0,
        tierMultiplier: TIER_MULTIPLIERS[data.userTier],
        finalScore: 0,
        verified: false,
      }

      // Convert dates to ISO strings for JSON serialization
      const submissionToSave = {
        ...submission,
        submittedAt: submission.submittedAt.toISOString()
      }
      
      // Save submission using JSON operations
      await redis.json.set(
        `${this.SUBMISSION_PREFIX}${submission.id}`,
        '$',
        JSON.parse(JSON.stringify(submissionToSave))
      )

      // Add to contest submissions
      await redis.sadd(`${data.contestId}:submissions`, submission.id)

      // Add to user submissions
      await redis.sadd(`user:${data.userId}:submissions`, submission.id)

      // Index by tweet ID for duplicate checking
      await redis.set(`idx:submission:tweet:${data.tweetId}`, submission.id)

      return submission
    } catch (error) {
      console.error('Error submitting tweet:', error)
      throw error
    }
  }

  /**
   * Get submission by tweet ID
   */
  static async getSubmissionByTweetId(
    contestId: string,
    tweetId: string
  ): Promise<ContestSubmission | null> {
    try {
      const submissionId = await redis.get(`idx:submission:tweet:${tweetId}`)
      if (!submissionId) return null

      const submissionStr = await redis.get(`${this.SUBMISSION_PREFIX}${submissionId}`)
      if (!submissionStr) return null

      const submission = JSON.parse(submissionStr)
      const deserialized = this.deserializeSubmission(submission)
      
      // Check if it's for the correct contest
      if (deserialized?.contestId !== contestId) return null

      return deserialized
    } catch (error) {
      console.error('Error getting submission by tweet ID:', error)
      return null
    }
  }

  /**
   * Update submission metrics
   */
  static async updateSubmissionMetrics(
    submissionId: string,
    metrics: {
      views: number
      likes: number
      retweets: number
      replies: number
      bookmarks?: number
      quotes?: number
    }
  ): Promise<void> {
    try {
      const submissionStr = await redis.get(`${this.SUBMISSION_PREFIX}${submissionId}`)
      if (!submissionStr) return

      const submission = JSON.parse(submissionStr)
      const updated = submission as ContestSubmission
      
      // Update metrics
      updated.views = metrics.views
      updated.likes = metrics.likes
      updated.retweets = metrics.retweets
      updated.replies = metrics.replies
      updated.bookmarks = metrics.bookmarks || 0
      updated.quotes = metrics.quotes || 0

      // Calculate raw engagement
      updated.rawEngagement = updated.likes + updated.retweets + updated.replies + 
                             updated.bookmarks + updated.quotes

      // Calculate final score with tier multiplier
      updated.finalScore = updated.rawEngagement * updated.tierMultiplier

      updated.lastSyncedAt = new Date()
      updated.verified = true
      updated.verifiedAt = new Date()

      // Convert dates to ISO strings for JSON serialization
      const submissionToSave = {
        ...updated,
        submittedAt: updated.submittedAt instanceof Date ? updated.submittedAt.toISOString() : updated.submittedAt,
        lastSyncedAt: updated.lastSyncedAt ? (updated.lastSyncedAt instanceof Date ? updated.lastSyncedAt.toISOString() : updated.lastSyncedAt) : undefined,
        verifiedAt: updated.verifiedAt ? (updated.verifiedAt instanceof Date ? updated.verifiedAt.toISOString() : updated.verifiedAt) : undefined
      }
      
      await redis.set(
        `${this.SUBMISSION_PREFIX}${submissionId}`,
        JSON.stringify(submissionToSave)
      )

      // Update leaderboard
      await this.updateLeaderboard(updated.contestId)
    } catch (error) {
      console.error('Error updating submission metrics:', error)
    }
  }

  /**
   * Get contest submissions
   */
  static async getContestSubmissions(contestId: string): Promise<ContestSubmission[]> {
    try {
      const submissionIds = await redis.smembers(`${contestId}:submissions`)
      
      const submissions = await Promise.all(
        submissionIds.map(async (id: string) => {
          const submissionStr = await redis.get(`${this.SUBMISSION_PREFIX}${id}`)
          if (!submissionStr) return null
          const submission = JSON.parse(submissionStr)
          return this.deserializeSubmission(submission)
        })
      )

      return submissions.filter(Boolean) as ContestSubmission[]
    } catch (error) {
      console.error('Error getting contest submissions:', error)
      return []
    }
  }

  /**
   * Get user submissions for a contest
   */
  static async getUserContestSubmissions(
    userId: string,
    contestId: string
  ): Promise<ContestSubmission[]> {
    try {
      const allSubmissionIds = await redis.smembers(`user:${userId}:submissions`)
      
      const submissions = await Promise.all(
        allSubmissionIds.map(async (id: string) => {
          const submissionStr = await redis.get(`${this.SUBMISSION_PREFIX}${id}`)
          if (!submissionStr) return null
          const submission = JSON.parse(submissionStr)
          return this.deserializeSubmission(submission)
        })
      )

      return submissions
        .filter(s => s && s.contestId === contestId) as ContestSubmission[]
    } catch (error) {
      console.error('Error getting user contest submissions:', error)
      return []
    }
  }

  /**
   * Update contest leaderboard
   */
  static async updateLeaderboard(contestId: string): Promise<void> {
    try {
      const submissions = await this.getContestSubmissions(contestId)
      
      // Group submissions by user
      const userScores = new Map<string, {
        userId: string
        userHandle: string
        userImage?: string
        userTier: ContestSubmission['userTier']
        totalScore: number
        tweetCount: number
        totalEngagements: number
      }>()

      for (const submission of submissions) {
        if (!submission.verified) continue

        const existing = userScores.get(submission.userId) || {
          userId: submission.userId,
          userHandle: submission.userHandle,
          userTier: submission.userTier,
          totalScore: 0,
          tweetCount: 0,
          totalEngagements: 0,
        }

        existing.totalScore += submission.finalScore
        existing.tweetCount += 1
        existing.totalEngagements += submission.rawEngagement

        userScores.set(submission.userId, existing)
      }

      // Get user profile images
      const userScoresArray = Array.from(userScores.entries())
      for (const [userId, stats] of userScoresArray) {
        const profile = await getProfile(userId)
        if (profile?.profileImageUrl) {
          stats.userImage = profile.profileImageUrl
        }
      }

      // Sort by total score
      const sortedEntries = Array.from(userScores.values())
        .sort((a, b) => b.totalScore - a.totalScore)

      // Get contest for prize calculation
      const contest = await this.getContestById(contestId)
      if (!contest) return

      // Create leaderboard entries with ranks and prizes
      const entries: LeaderboardEntry[] = sortedEntries.map((entry, index) => {
        const rank = index + 1
        const prizeAmount = this.calculatePrizeAmount(rank, contest.prizePool, contest.prizeDistribution)

        return {
          rank,
          ...entry,
          prizeAmount,
        }
      })

      const leaderboard: ContestLeaderboard = {
        contestId,
        lastUpdated: new Date(),
        entries,
      }

      // Convert date to ISO string for JSON serialization
      const leaderboardToSave = {
        ...leaderboard,
        lastUpdated: leaderboard.lastUpdated.toISOString()
      }
      
      // Save leaderboard
      await redis.set(
        `${this.LEADERBOARD_PREFIX}${contestId}`,
        JSON.stringify(leaderboardToSave)
      )

      // Update user stats
      for (const entry of entries) {
        const stats: UserContestStats = {
          userId: entry.userId,
          contestId,
          tweetsSubmitted: entry.tweetCount,
          totalEngagements: entry.totalEngagements,
          currentRank: entry.rank,
          totalScore: entry.totalScore,
          earnedPoints: entry.prizeAmount || 0,
          lastUpdated: new Date(),
        }

        // Convert date to ISO string for JSON serialization
        const statsToSave = {
          ...stats,
          lastUpdated: stats.lastUpdated.toISOString()
        }
        
        await redis.set(
          `${this.USER_STATS_PREFIX}${entry.userId}:${contestId}`,
          JSON.stringify(statsToSave)
        )
      }
    } catch (error) {
      console.error('Error updating leaderboard:', error)
    }
  }

  /**
   * Get contest leaderboard
   */
  static async getLeaderboard(contestId: string): Promise<ContestLeaderboard | null> {
    try {
      const leaderboardStr = await redis.get(`${this.LEADERBOARD_PREFIX}${contestId}`)
      if (!leaderboardStr) return null

      const leaderboard = JSON.parse(leaderboardStr)
      return this.deserializeLeaderboard(leaderboard)
    } catch (error) {
      console.error('Error getting leaderboard:', error)
      return null
    }
  }

  /**
   * Get user contest stats
   */
  static async getUserContestStats(
    userId: string,
    contestId: string
  ): Promise<UserContestStats | null> {
    try {
      const statsStr = await redis.get(`${this.USER_STATS_PREFIX}${userId}:${contestId}`)
      if (!statsStr) return null

      const stats = JSON.parse(statsStr)
      return {
        ...stats as UserContestStats,
        lastUpdated: new Date(stats.lastUpdated),
      }
    } catch (error) {
      console.error('Error getting user contest stats:', error)
      return null
    }
  }

  /**
   * Calculate prize amount for a given rank
   */
  private static calculatePrizeAmount(
    rank: number,
    prizePool: number,
    distribution: Contest['prizeDistribution']
  ): number {
    for (const tier of distribution.tiers) {
      if (typeof tier.position === 'number') {
        if (rank === tier.position) {
          return (prizePool * tier.percentage) / 100
        }
      } else {
        // Handle range positions like "4-10"
        const [start, end] = tier.position.split('-').map(Number)
        if (rank >= start && rank <= end) {
          // Split equally among range
          const count = end - start + 1
          return (prizePool * tier.percentage) / 100 / count
        }
      }
    }
    return 0
  }

  /**
   * Get sponsors with full project data
   */
  static async getContestSponsors(sponsors: ContestSponsor[]): Promise<ContestSponsor[]> {
    try {
      const sponsorsWithData = await Promise.all(
        sponsors.map(async (sponsor) => {
          const project = await getProjectById(sponsor.projectId)
          if (project) {
            return {
              projectId: sponsor.projectId,
              name: project.twitterHandle,
              imageUrl: project.profileImageUrl,
              twitterHandle: project.twitterHandle,
            }
          }
          return sponsor
        })
      )
      return sponsorsWithData
    } catch (error) {
      console.error('Error getting contest sponsors:', error)
      return sponsors
    }
  }

  /**
   * Deserialize contest from Redis
   */
  private static deserializeContest(data: any): Contest | null {
    if (!data) return null

    try {
      const contest = {
        ...data,
        startTime: new Date(data.startTime),
        endTime: new Date(data.endTime),
        createdAt: new Date(data.createdAt),
        updatedAt: new Date(data.updatedAt),
      }
      
      // Validate the contest has required fields
      if (!contest.id || !contest.status || !contest.visibility) {
        console.error('Contest missing required fields:', { 
          id: contest.id, 
          status: contest.status, 
          visibility: contest.visibility 
        })
        return null
      }
      
      return contest
    } catch (error) {
      console.error('Error deserializing contest:', error, 'Data:', data)
      return null
    }
  }

  /**
   * Deserialize submission from Redis
   */
  private static deserializeSubmission(data: any): ContestSubmission | null {
    if (!data) return null

    return {
      ...data,
      submittedAt: new Date(data.submittedAt),
      verifiedAt: data.verifiedAt ? new Date(data.verifiedAt) : undefined,
      lastSyncedAt: data.lastSyncedAt ? new Date(data.lastSyncedAt) : undefined,
    }
  }

  /**
   * Deserialize leaderboard from Redis
   */
  private static deserializeLeaderboard(data: any): ContestLeaderboard | null {
    if (!data) return null

    return {
      ...data,
      lastUpdated: new Date(data.lastUpdated),
    }
  }
} 