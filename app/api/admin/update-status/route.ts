import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redis, InfluencerProfile } from '@/lib/redis'

export async function POST(req: NextRequest) {
  try {
    // Check if user is logged in with Twitter and is admin
    const session: any = await getServerSession(authOptions as any)
    
    if (!session?.user) {
      return NextResponse.json({ error: 'Twitter login required' }, { status: 401 })
    }
    
    // Get Twitter handle from session
    const twitterHandle = session?.twitterHandle || session?.user?.twitterHandle || session?.user?.name
    const normalizedHandle = twitterHandle?.toLowerCase().replace('@', '')
    
    console.log('[ADMIN UPDATE-STATUS] Twitter handle:', twitterHandle, 'Normalized:', normalizedHandle)
    
    // Check if user is sharafi_eth (hardcoded admin) or has admin role
    if (normalizedHandle !== 'sharafi_eth') {
      const userRole = session?.user?.role || session?.role
      console.log('[ADMIN UPDATE-STATUS] User role:', userRole)
      
      if (userRole !== 'admin') {
        return NextResponse.json({ error: 'Admin access required' }, { status: 403 })
      }
    }
    
    const { userId, status } = await req.json()
    
    if (!userId || !status) {
      return NextResponse.json({ error: 'Missing userId or status' }, { status: 400 })
    }
    
    if (!['approved', 'pending', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    
    console.log(`[ADMIN UPDATE-STATUS] Updating user ${userId} to status ${status}`)
    
    try {
      // Handle userId that might already include 'user:' prefix
      const redisKey = userId.startsWith('user:') ? userId : `user:${userId}`
      
      // Get the user profile
      const profile = await redis.json.get(redisKey)
      if (!profile) {
        return NextResponse.json({ error: 'User not found' }, { status: 404 })
      }
      
      // Update the approval status - wrap in JSON.stringify for Upstash
      await redis.json.set(redisKey, '$.approvalStatus', JSON.stringify(status))
      
      console.log(`[ADMIN UPDATE-STATUS] Successfully updated ${redisKey} status to ${status}`)
      
      return NextResponse.json({ 
        success: true, 
        userId, 
        status,
        updatedBy: twitterHandle 
      })
      
    } catch (redisError) {
      console.error('[ADMIN UPDATE-STATUS] Redis error:', redisError)
      return NextResponse.json({ 
        error: 'Failed to update user status - database error' 
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('[ADMIN UPDATE-STATUS] Error:', error)
    return NextResponse.json({ 
      error: 'Failed to update user status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 