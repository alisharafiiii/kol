import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '@/lib/auth-options'
import { redis } from '@/lib/redis'

export async function POST() {
  try {
    const session = await getServerSession(authOptions)
    
    // Check if user is admin
    const twitterHandle = (session as any)?.twitterHandle || 
                         (session as any)?.user?.twitterHandle ||
                         session?.user?.name ||
                         (session as any)?.user?.username;
    
    const normalizedHandle = twitterHandle?.toLowerCase().replace('@', '');
    if (normalizedHandle !== 'sharafi_eth') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
    }
    
    console.log('RESET: Starting complete contest data reset...')
    
    // Get all contest-related keys
    const allContestIds = await redis.smembers('contests:all')
    const activeIds = await redis.smembers('idx:contest:status:active')
    const draftIds = await redis.smembers('idx:contest:status:draft')
    const endedIds = await redis.smembers('idx:contest:status:ended')
    const cancelledIds = await redis.smembers('idx:contest:status:cancelled')
    const publicIds = await redis.smembers('idx:contest:visibility:public')
    const hiddenIds = await redis.smembers('idx:contest:visibility:hidden')
    
    // Combine all unique IDs
    const allIds = new Set([
      ...allContestIds, 
      ...activeIds, 
      ...draftIds, 
      ...endedIds,
      ...cancelledIds,
      ...publicIds, 
      ...hiddenIds
    ])
    
    let deletedCount = 0
    
    // Delete all contest data
    for (const id of Array.from(allIds)) {
      try {
        await redis.del(`contest:${id}`)
        deletedCount++
      } catch (e) {
        console.log(`Failed to delete contest:${id}`)
      }
    }
    
    // Clear all indices
    await redis.del('contests:all')
    await redis.del('idx:contest:status:active')
    await redis.del('idx:contest:status:draft')
    await redis.del('idx:contest:status:ended')
    await redis.del('idx:contest:status:cancelled')
    await redis.del('idx:contest:visibility:public')
    await redis.del('idx:contest:visibility:hidden')
    
    console.log(`RESET: Deleted ${deletedCount} contests and cleared all indices`)
    
    return NextResponse.json({
      success: true,
      message: 'All contest data has been reset',
      deletedContests: deletedCount,
      clearedIndices: 7
    })
  } catch (error) {
    console.error('Reset error:', error)
    return NextResponse.json({ 
      error: 'Failed to reset contest data', 
      details: error instanceof Error ? error.message : 'Unknown error' 
    }, { status: 500 })
  }
} 