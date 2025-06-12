import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { DiscordService } from '@/lib/services/discord-service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin or core
    const userRole = (session as any)?.role || (session.user as any)?.role
    if (!['admin', 'core'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const projects = await DiscordService.getAllProjects()
    return NextResponse.json(projects)
  } catch (error) {
    console.error('Error fetching Discord projects:', error)
    return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session as any)?.role || (session.user as any)?.role
    if (!['admin', 'core'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await request.json()
    const { name, serverId, serverName, iconUrl } = data

    if (!name || !serverId || !serverName) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const userHandle = (session.user as any).twitterHandle || session.user.name || 'unknown'
    
    const project = await DiscordService.createProject({
      name,
      serverId,
      serverName,
      iconUrl,
      createdBy: userHandle
    })

    return NextResponse.json(project)
  } catch (error) {
    console.error('Error creating Discord project:', error)
    return NextResponse.json({ error: 'Failed to create project' }, { status: 500 })
  }
} 