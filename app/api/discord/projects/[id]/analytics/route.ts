import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { DiscordService } from '@/lib/services/discord-service'
import { redis } from '@/lib/redis'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user has access to Discord analytics
    // First check JWT role
    const userRole = (session as any).role || (session.user as any)?.role
    
    // Check for hardcoded admins first
    const twitterHandle = (session as any)?.twitterHandle || 
                         (session as any)?.user?.twitterHandle ||
                         session?.user?.name
    const normalizedHandle = twitterHandle?.toLowerCase().replace('@', '')
    
    console.log('[Discord Analytics] Checking access for:', {
      handle: normalizedHandle,
      sessionRole: userRole,
      fullSession: session
    })
    
    if (normalizedHandle === 'sharafi_eth' || normalizedHandle === 'alinabu') {
      console.log('Analytics access granted: Hardcoded admin -', normalizedHandle)
      // Continue with admin access
    } else {
      // Then check current role from database for allowed roles
      const userId = (session as any).userId || (session.user as any)?.id
      const userKey = userId?.startsWith('user:') ? userId : `user:${userId}`
      
      let currentRole = userRole
      
      // Try multiple methods to get the user's current role
      try {
        // Method 1: Direct user key lookup
        const userData = await redis.json.get(userKey)
        if (userData && typeof userData === 'object' && 'role' in userData) {
          currentRole = (userData as any).role
          console.log('[Discord Analytics] Role from direct lookup:', currentRole)
        }
      } catch (error) {
        console.error('[Discord Analytics] Error fetching user role from Redis (method 1):', error)
      }
      
      // Method 2: Username index lookup if first method didn't work
      if (!currentRole || currentRole === 'user') {
        try {
          const userIds = await redis.smembers(`idx:username:${normalizedHandle}`)
          if (userIds && userIds.length > 0) {
            const userDataFromIndex = await redis.json.get(`user:${userIds[0]}`)
            if (userDataFromIndex && typeof userDataFromIndex === 'object' && 'role' in userDataFromIndex) {
              currentRole = (userDataFromIndex as any).role
              console.log('[Discord Analytics] Role from username index:', currentRole)
            }
          }
        } catch (error) {
          console.error('[Discord Analytics] Error fetching user role from username index:', error)
        }
      }
      
      const allowedRoles = ['admin', 'core', 'viewer', 'team']
      console.log('[Discord Analytics] Final role check:', {
        currentRole,
        allowedRoles,
        hasAccess: allowedRoles.includes(currentRole)
      })
      
      if (!allowedRoles.includes(currentRole)) {
        return NextResponse.json({ 
          error: 'Access denied', 
          userRole: currentRole,
          allowedRoles,
          debugInfo: {
            handle: normalizedHandle,
            sessionRole: userRole,
            databaseRole: currentRole
          }
        }, { status: 403 })
      }
    }

    // Convert back from URL-safe format
    const projectId = params.id.replace(/--/g, ':')
    
    // Get timeframe from query params
    const { searchParams } = new URL(req.url)
    const timeframe = searchParams.get('timeframe') as 'daily' | 'weekly' | 'monthly' | 'allTime' || 'weekly'
    
    console.log(`📊 Fetching analytics for project ${projectId}, timeframe: ${timeframe}`)
    
    // Get the project
    const project = await DiscordService.getProject(projectId)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }
    
    // Get analytics using the enhanced method
    const analytics = await DiscordService.getProjectAnalytics(projectId, timeframe)
    
    console.log(`✅ Analytics fetched: ${analytics.metrics.totalMessages} messages, ${analytics.metrics.uniqueUsers} users`)
    
    return NextResponse.json({ 
      project,
      analytics 
    })
  } catch (error) {
    console.error('Error fetching Discord analytics:', error)
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
} 