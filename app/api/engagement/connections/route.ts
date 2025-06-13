import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { EngagementService } from '@/lib/services/engagement-service'
import { checkAuth } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    // Check auth - only admin and core can view all connections
    const auth = await checkAuth(request, ['admin', 'core'])
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get query params
    const { searchParams } = new URL(request.url)
    const discordId = searchParams.get('discordId')
    const twitterHandle = searchParams.get('twitterHandle')
    
    if (discordId) {
      const connection = await EngagementService.getConnection(discordId)
      return NextResponse.json({ connection })
    }
    
    if (twitterHandle) {
      const connection = await EngagementService.getConnectionByTwitter(twitterHandle)
      return NextResponse.json({ connection })
    }
    
    // Return empty for now - full list would be paginated
    return NextResponse.json({ connections: [] })
  } catch (error) {
    console.error('Error fetching connections:', error)
    return NextResponse.json({ error: 'Failed to fetch connections' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check auth - only admin can manually create connections
    const auth = await checkAuth(request, ['admin'])
    if (!auth.authenticated || !auth.hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const { discordId, twitterHandle, tier } = await request.json()
    
    if (!discordId || !twitterHandle) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    // Check if already connected
    const existing = await EngagementService.getConnection(discordId)
    if (existing) {
      return NextResponse.json({ error: 'Discord user already connected' }, { status: 409 })
    }
    
    const connection = await EngagementService.connectTwitter(discordId, twitterHandle, tier || 1)
    return NextResponse.json({ connection })
  } catch (error) {
    console.error('Error creating connection:', error)
    return NextResponse.json({ error: 'Failed to create connection' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Check auth
    const auth = await checkAuth(request, ['admin', 'core'])
    if (!auth.authenticated || !auth.hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const { discordId, tier } = await request.json()
    
    if (!discordId || !tier) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    await EngagementService.updateUserTier(discordId, tier)
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating tier:', error)
    return NextResponse.json({ error: 'Failed to update tier' }, { status: 500 })
  }
} 