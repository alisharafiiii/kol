import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redis, InfluencerProfile } from '@/lib/redis'
import { ProfileService } from '@/lib/services/profile-service'
import { hasAdminAccess, logAdminAccess } from '@/lib/admin-config'

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
    const userRole = session?.user?.role || session?.role
    
    console.log('[ADMIN UPDATE-STATUS] Twitter handle:', twitterHandle, 'Normalized:', normalizedHandle)
    console.log('[ADMIN UPDATE-STATUS] User role:', userRole)
    
    // Check admin access
    if (!hasAdminAccess(normalizedHandle, userRole) && userRole !== 'admin' && userRole !== 'core') {
      return NextResponse.json({ error: 'Admin or core access required' }, { status: 403 })
    }
    
    const { userId, status } = await req.json()
    
    if (!userId || !status) {
      return NextResponse.json({ error: 'Missing userId or status' }, { status: 400 })
    }
    
    if (!['approved', 'pending', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }
    
    console.log(`[ADMIN UPDATE-STATUS] Updating user ${userId} to status ${status}`)
    
    // Log admin access
    logAdminAccess(normalizedHandle, 'status_update', {
      method: userRole,
      targetUserId: userId,
      newStatus: status,
      api: 'update_status'
    })
    
    // First, try to find by Twitter handle in ProfileService
    // The userId might be a handle or an actual ID
    let profileUpdated = false
    
    // Try to extract handle from userId if it's in format like "user_username"
    let possibleHandle = userId
    if (userId.startsWith('user_')) {
      possibleHandle = userId.substring(5) // Remove 'user_' prefix
    }
    
    console.log(`[ADMIN UPDATE-STATUS] Checking ProfileService for handle: ${possibleHandle}`)
    
    // Try ProfileService first
    let profile = await ProfileService.getProfileByHandle(possibleHandle)
    
    if (profile) {
      console.log('[ADMIN UPDATE-STATUS] Found profile in ProfileService')
      profile.approvalStatus = status
      await ProfileService.saveProfile(profile)
      profileUpdated = true
      
      return NextResponse.json({ 
        success: true, 
        userId, 
        status,
        updatedBy: twitterHandle,
        system: 'ProfileService'
      })
    }
    
    // If not found by handle, try by ID
    if (!profileUpdated && userId.startsWith('user_')) {
      profile = await ProfileService.getProfileById(userId)
      
      if (profile) {
        console.log('[ADMIN UPDATE-STATUS] Found profile in ProfileService by ID')
        profile.approvalStatus = status
        await ProfileService.saveProfile(profile)
        profileUpdated = true
        
        return NextResponse.json({ 
          success: true, 
          userId, 
          status,
          updatedBy: twitterHandle,
          system: 'ProfileService'
        })
      }
    }
    
    // Fall back to old Redis system
    if (!profileUpdated) {
      console.log('[ADMIN UPDATE-STATUS] Profile not found in ProfileService, trying old Redis system')
      
      try {
        // Handle userId that might already include 'user:' prefix
        const redisKey = userId.startsWith('user:') ? userId : `user:${userId}`
        
        // Get the user profile
        const redisProfile = await redis.json.get(redisKey)
        if (!redisProfile) {
          return NextResponse.json({ error: 'User not found in any system' }, { status: 404 })
        }
        
        // Update the approval status - wrap in JSON.stringify for Upstash
        await redis.json.set(redisKey, '$.approvalStatus', JSON.stringify(status))
        
        console.log(`[ADMIN UPDATE-STATUS] Successfully updated ${redisKey} status to ${status} in old Redis system`)
        
        return NextResponse.json({ 
          success: true, 
          userId, 
          status,
          updatedBy: twitterHandle,
          system: 'Redis'
        })
        
      } catch (redisError) {
        console.error('[ADMIN UPDATE-STATUS] Redis error:', redisError)
        return NextResponse.json({ 
          error: 'Failed to update user status - database error' 
        }, { status: 500 })
      }
    }
    
  } catch (error) {
    console.error('[ADMIN UPDATE-STATUS] Error:', error)
    return NextResponse.json({ 
      error: 'Failed to update user status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}