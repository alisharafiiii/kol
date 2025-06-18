import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { DiscordService } from '@/lib/services/discord-service'
import { redis } from '@/lib/redis'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session as any)?.role || (session.user as any)?.role
    if (!['admin', 'core'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { channelId } = await request.json()
    
    if (!channelId) {
      return NextResponse.json({ error: 'Channel ID is required' }, { status: 400 })
    }

    // Get the project to verify ownership
    const project = await DiscordService.getProject(params.id)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Create a request for the bot to fetch channel info
    const requestKey = `discord:channel-info-request:${channelId}`
    const requestData = {
      channelId,
      projectId: params.id,
      serverId: project.serverId,
      timestamp: new Date().toISOString()
    }
    
    // Use set with ex option for Upstash Redis
    await redis.set(requestKey, JSON.stringify(requestData), {
      ex: 30 // expire in 30 seconds
    })

    // Wait a bit for the bot to process
    await new Promise(resolve => setTimeout(resolve, 1000))

    // Check if bot has responded
    const responseKey = `discord:channel-info-response:${channelId}`
    const response = await redis.get(responseKey)

    if (response) {
      const channelInfo = JSON.parse(response as string)
      // Store in metadata
      await DiscordService.updateChannelMetadata(params.id, channelId, {
        name: channelInfo.name
      })
      
      // Store the channel info in Redis for future use
      const channelKey = `channel:discord:${channelId}`
      await redis.json.set(channelKey, '$', {
        id: channelId,
        name: channelInfo.name,
        type: channelInfo.type,
        projectId: params.id,
        updatedAt: new Date().toISOString()
      })
      
      console.log(`✅ Saved channel metadata for ${channelInfo.name} (${channelId})`)
      
      return NextResponse.json(channelInfo)
    }

    // If no response, return basic info
    return NextResponse.json({
      id: channelId,
      name: `Channel ${channelId}`,
      type: 'text'
    })
  } catch (error) {
    console.error('Error fetching channel info:', error)
    return NextResponse.json({ error: 'Failed to fetch channel info' }, { status: 500 })
  }
} 