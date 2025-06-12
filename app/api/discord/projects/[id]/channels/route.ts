import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { DiscordService } from '@/lib/services/discord-service'

export async function GET(
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

    // Get the project to find the tracked channels
    const project = await DiscordService.getProject(params.id)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Get channel metadata for names
    const channelMetadata = await DiscordService.getChannelMetadata(project.trackedChannels)

    // Return tracked channels with their names
    const channels = project.trackedChannels.map((channelId, index) => ({
      id: channelId,
      name: channelMetadata[channelId]?.name || `Channel ${channelId}`,
      type: 'text' as const,
      projectId: params.id,
      isTracked: true,
      parent: null,
      position: index
    }))

    return NextResponse.json(channels)
  } catch (error) {
    console.error('Error fetching Discord channels:', error)
    return NextResponse.json({ error: 'Failed to fetch channels' }, { status: 500 })
  }
}

export async function PUT(
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

    const { trackedChannels } = await request.json()
    await DiscordService.updateTrackedChannels(params.id, trackedChannels)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating tracked channels:', error)
    return NextResponse.json({ error: 'Failed to update channels' }, { status: 500 })
  }
} 