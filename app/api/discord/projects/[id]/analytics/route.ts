import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { DiscordService } from '@/lib/services/discord-service'
import { redis } from '@/lib/redis'
import { hasAdminAccess, logAdminAccess } from '@/lib/admin-config'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Get query parameters
    const { searchParams } = new URL(req.url)
    const isPublicRequest = searchParams.get('public') === 'true'
    const timeframe = searchParams.get('timeframe') as 'daily' | 'weekly' | 'monthly' | 'allTime' || 'weekly'
    
    // Convert back from URL-safe format
    const projectId = params.id.replace(/--/g, ':')
    
    console.log('[Discord Analytics] Request for project:', projectId)
    console.log('[Discord Analytics] Is public request:', isPublicRequest)
    console.log('[Discord Analytics] Timeframe:', timeframe)
    
    // For public requests, check if the project ID matches the public share pattern
    if (isPublicRequest && projectId.startsWith('project:discord:')) {
      console.log('[Discord Analytics] Public share link detected, allowing public access')
      
      // Get the project
      const project = await DiscordService.getProject(projectId)
      if (!project) {
        return NextResponse.json({ error: 'Project not found' }, { status: 404 })
      }
      
      // Get analytics
      const analytics = await DiscordService.getProjectAnalytics(projectId, timeframe)
      
      console.log(`✅ Public analytics fetched: ${analytics.metrics.totalMessages} messages, ${analytics.metrics.uniqueUsers} users`)
      
      return NextResponse.json({ 
        project: {
          id: project.id,
          name: project.name,
          serverId: project.serverId,
          serverName: project.serverName,
          iconUrl: project.iconUrl,
        },
        analytics 
      })
    }
    
    // For non-public requests, require authentication
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
    
    if (hasAdminAccess(normalizedHandle, userRole)) {
      console.log('Analytics access granted: Admin user -', normalizedHandle)
      logAdminAccess(normalizedHandle, 'discord_analytics_access', { 
        method: 'admin_check',
        api: 'discord_analytics',
        projectId: params.id
      })
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