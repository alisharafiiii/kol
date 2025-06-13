import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redis } from '@/lib/redis'

export async function GET(req: NextRequest) {
  try {
    // Get session
    const session = await getServerSession(authOptions)
    
    // Get various session properties
    const sessionData = {
      authenticated: !!session,
      user: session?.user || null,
      userId: (session as any)?.userId || (session?.user as any)?.id || null,
      twitterHandle: (session as any)?.twitterHandle || 
                      (session as any)?.user?.twitterHandle ||
                      session?.user?.name || null,
      role: (session as any)?.role || (session?.user as any)?.role || null,
      raw: session
    }
    
    // Try to get role from Redis if we have a handle
    if (sessionData.twitterHandle) {
      const normalizedHandle = sessionData.twitterHandle.toLowerCase().replace('@', '')
      try {
        const userIds = await redis.smembers(`idx:username:${normalizedHandle}`)
        if (userIds && userIds.length > 0) {
          const userData = await redis.json.get(`user:${userIds[0]}`) as any
          if (userData) {
            sessionData.role = userData.role || sessionData.role
          }
        }
      } catch (error) {
        console.error('Redis error:', error)
      }
    }
    
    return NextResponse.json({
      success: true,
      session: sessionData
    })
  } catch (error) {
    console.error('Debug session error:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
} 