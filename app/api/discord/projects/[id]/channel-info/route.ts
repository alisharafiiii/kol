import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

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

    // For now, we'll return the channel ID as the name
    // In the future, we can use Discord API or bot to fetch actual channel info
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