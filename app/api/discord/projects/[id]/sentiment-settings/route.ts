import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { redis } from '@/lib/redis'

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session as any)?.role || (session?.user as any)?.role
    if (!['admin', 'core'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const projectId = params.id
    const settingsKey = `discord:sentiment:${projectId}`
    
    const settings = await redis.json.get(settingsKey)
    
    // Return default settings if none exist
    if (!settings) {
      return NextResponse.json({
        bullishKeywords: '',
        bearishKeywords: '',
        bullishEmojis: '',
        bearishEmojis: '',
        ignoredChannels: [],
        minimumMessageLength: 3
      })
    }
    
    return NextResponse.json(settings)
  } catch (error) {
    console.error('Error fetching sentiment settings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch sentiment settings' },
      { status: 500 }
    )
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session as any)?.role || (session?.user as any)?.role
    if (!['admin', 'core'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const projectId = params.id
    const settingsKey = `discord:sentiment:${projectId}`
    
    const body = await req.json()
    
    // Validate the settings
    const settings = {
      bullishKeywords: body.bullishKeywords || '',
      bearishKeywords: body.bearishKeywords || '',
      bullishEmojis: body.bullishEmojis || '',
      bearishEmojis: body.bearishEmojis || '',
      ignoredChannels: Array.isArray(body.ignoredChannels) ? body.ignoredChannels : [],
      minimumMessageLength: typeof body.minimumMessageLength === 'number' ? body.minimumMessageLength : 3,
      updatedAt: new Date().toISOString(),
      updatedBy: (session.user as any)?.handle || session.user?.email
    }
    
    // Save to Redis
    await redis.json.set(settingsKey, '$', settings)
    
    // Also save a notification for the bots to reload settings
    await redis.set(`discord:sentiment:reload:${projectId}`, '1', { ex: 60 })
    
    return NextResponse.json({ success: true, settings })
  } catch (error) {
    console.error('Error saving sentiment settings:', error)
    return NextResponse.json(
      { error: 'Failed to save sentiment settings' },
      { status: 500 }
    )
  }
} 