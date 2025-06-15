import { redis } from '@/lib/redis'

export interface UserStats {
  scoutCount: number
  contestCount: number
}

export async function getUserStats(userHandle: string): Promise<UserStats> {
  try {
    const normalizedHandle = userHandle.replace('@', '').toLowerCase()
    
    // Count scout submissions
    let scoutCount = 0
    try {
      // Get all scout submissions
      const scoutKeys = await redis.keys('scout:*')
      for (const key of scoutKeys) {
        const scoutData = await redis.json.get(key)
        if (scoutData && (scoutData as any).submittedBy === normalizedHandle) {
          scoutCount++
        }
      }
    } catch (error) {
      console.error('Error counting scouts:', error)
    }
    
    // Count contest participations
    let contestCount = 0
    try {
      // Get all contest submission keys
      const submissionKeys = await redis.keys('contest:submission:*')
      for (const key of submissionKeys) {
        // Check if this submission belongs to the user
        if (key.includes(`user:${normalizedHandle}`)) {
          contestCount++
        }
      }
      
      // Also check contest participation keys
      const participationKeys = await redis.keys(`contest:participant:${normalizedHandle}:*`)
      contestCount += participationKeys.length
    } catch (error) {
      console.error('Error counting contests:', error)
    }
    
    return {
      scoutCount,
      contestCount
    }
  } catch (error) {
    console.error('Error getting user stats:', error)
    return {
      scoutCount: 0,
      contestCount: 0
    }
  }
} 