import { NextRequest, NextResponse } from 'next/server'
import { redis, InfluencerProfile } from '@/lib/redis'

export async function GET(req: NextRequest) {
  try {
    console.time('[API] Fetch users total')
    
    // Parse query params
    const searchParams = req.nextUrl.searchParams
    const approvedOnly = searchParams.get('approved') === 'true'

    let userKeys: string[] = []
    
    // Optimized path for approved users using index
    if (approvedOnly) {
      console.time('[API] Get approved user IDs from index')
      const approvedIds = await redis.smembers('idx:status:approved')
      console.timeEnd('[API] Get approved user IDs from index')
      console.log(`[API] Found ${approvedIds.length} approved user IDs in index`)
      
      // Convert IDs to Redis keys
      userKeys = approvedIds.map((id: string) => id.startsWith('user:') ? id : `user:${id}`)
    } else {
      // Fallback to scanning all keys (slower)
      console.time('[API] Scan all user keys')
      userKeys = await redis.keys('user:*')
      console.timeEnd('[API] Scan all user keys')
      console.log(`[API] Found ${userKeys.length} total user keys`)
    }

    if (userKeys.length === 0) {
      console.timeEnd('[API] Fetch users total')
      return NextResponse.json([])
    }

    // Batch fetch users - don't use pipeline with JSON operations
    console.time('[API] Batch fetch users')
    const users: InfluencerProfile[] = []
    
    // Fetch in smaller batches to avoid timeouts
    const BATCH_SIZE = 10
    for (let i = 0; i < userKeys.length; i += BATCH_SIZE) {
      const batch = userKeys.slice(i, i + BATCH_SIZE)
      const promises = batch.map(key => redis.json.get(key))
      const results = await Promise.all(promises)
      
      for (let j = 0; j < results.length; j++) {
        const profile = results[j]
        if (!profile) continue
        
        // Double-check approval status if not using index
        if (!approvedOnly || profile.approvalStatus === 'approved') {
          users.push({ 
            ...profile, 
            id: profile.id || batch[j].replace('user:', '') 
          })
        }
      }
    }
    
    console.timeEnd('[API] Batch fetch users')
    console.log(`[API] Returning ${users.length} users`)
    console.timeEnd('[API] Fetch users total')
    
    // Set cache headers for approved users (they don't change often)
    if (approvedOnly) {
      return NextResponse.json(users, {
        headers: {
          'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
        }
      })
    }
    
    return NextResponse.json(users)
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
} 