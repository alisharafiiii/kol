import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

// Lightweight endpoint for approved users search
export async function GET(req: NextRequest) {
  try {
    // Get approved user IDs from index
    const approvedIds = await redis.smembers('idx:status:approved')
    
    if (approvedIds.length === 0) {
      return NextResponse.json([])
    }
    
    // Convert to Redis keys
    const userKeys = approvedIds.map((id: string) => 
      id.startsWith('user:') ? id : `user:${id}`
    )
    
    // Batch fetch users with minimal fields
    const BATCH_SIZE = 20
    const users: any[] = []
    
    for (let i = 0; i < userKeys.length; i += BATCH_SIZE) {
      const batch = userKeys.slice(i, i + BATCH_SIZE)
      const promises = batch.map((key: string) => redis.json.get(key))
      const results = await Promise.all(promises)
      
      for (let j = 0; j < results.length; j++) {
        const profile = results[j]
        if (!profile || profile.approvalStatus !== 'approved') continue
        
        // Return only essential fields for search
        users.push({
          id: profile.id || batch[j].replace('user:', ''),
          name: profile.name || '',
          twitterHandle: profile.twitterHandle || profile.handle || '',
          profileImageUrl: profile.profileImageUrl || '',
          tier: profile.tier || 'micro',
          role: profile.role || 'user',
          email: profile.email || '',
          contact: profile.contact || ''
        })
      }
    }
    
    return NextResponse.json(users, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300'
      }
    })
  } catch (error: any) {
    console.error('Error fetching search list:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
} 