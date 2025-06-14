import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export async function POST() {
  try {
    console.log('Starting contest cleanup...')
    
    // Get all contest IDs from all indices
    const allContestIds = await redis.smembers('contests:all')
    const activeIds = await redis.smembers('idx:contest:status:active')
    const draftIds = await redis.smembers('idx:contest:status:draft')
    const publicIds = await redis.smembers('idx:contest:visibility:public')
    const hiddenIds = await redis.smembers('idx:contest:visibility:hidden')
    
    // Combine all unique IDs
    const allIds = new Set([...allContestIds, ...activeIds, ...draftIds, ...publicIds, ...hiddenIds])
    
    let cleanedCount = 0
    let validCount = 0
    
    for (const id of Array.from(allIds)) {
      const contest = await redis.json.get(`contest:${id}`)
      
      if (!contest) {
        // Remove from all indices
        await redis.srem('contests:all', id)
        await redis.srem('idx:contest:status:active', id)
        await redis.srem('idx:contest:status:draft', id)
        await redis.srem('idx:contest:visibility:public', id)
        await redis.srem('idx:contest:visibility:hidden', id)
        console.log(`Removed missing contest ${id} from indices`)
        cleanedCount++
      } else {
        // Contest exists and is valid JSON (since json.get worked)
        validCount++
      }
    }
    
    console.log(`Cleanup complete. Cleaned: ${cleanedCount}, Valid: ${validCount}`)
    
    return NextResponse.json({
      success: true,
      cleaned: cleanedCount,
      valid: validCount,
      totalChecked: allIds.size
    })
  } catch (error) {
    console.error('Cleanup error:', error)
    return NextResponse.json({ 
      error: 'Failed to cleanup contests', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
} 