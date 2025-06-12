import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { DiscordService } from '@/lib/services/discord-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check authentication and role
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session as any)?.role || (session.user as any)?.role
    const allowedRoles = ['admin', 'core', 'team', 'viewer']
    
    if (!allowedRoles.includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden - insufficient role permissions' }, { status: 403 })
    }

    const project = await DiscordService.getProject(params.id)
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    // Return limited project data
    return NextResponse.json({
      id: project.id,
      name: project.name,
      serverId: project.serverId,
      serverName: project.serverName,
      trackedChannels: project.trackedChannels,
      scoutProjectId: project.scoutProjectId
    })
  } catch (error) {
    console.error('Error fetching Discord project:', error)
    return NextResponse.json({ error: 'Failed to fetch project' }, { status: 500 })
  }
} 