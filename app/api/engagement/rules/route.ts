import { NextRequest, NextResponse } from 'next/server'
import { EngagementService } from '@/lib/services/engagement-service'
import { checkAuth } from '@/lib/auth-utils'

export async function GET(request: NextRequest) {
  try {
    // Check auth
    const auth = await checkAuth(request, ['admin', 'core', 'viewer'])
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const rules = await EngagementService.getAllPointRules()
    return NextResponse.json({ rules })
  } catch (error) {
    console.error('Error fetching rules:', error)
    return NextResponse.json({ error: 'Failed to fetch rules' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check auth - only admin can modify rules
    const auth = await checkAuth(request, ['admin'])
    if (!auth.authenticated || !auth.hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const { tier, interactionType, points } = await request.json()
    
    if (!tier || !interactionType || points === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    if (!['like', 'retweet', 'reply'].includes(interactionType)) {
      return NextResponse.json({ error: 'Invalid interaction type' }, { status: 400 })
    }
    
    const rule = await EngagementService.setPointRule(tier, interactionType, points)
    return NextResponse.json({ rule })
  } catch (error) {
    console.error('Error creating rule:', error)
    return NextResponse.json({ error: 'Failed to create rule' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Setup default rules - admin only
    const auth = await checkAuth(request, ['admin'])
    if (!auth.authenticated || !auth.hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    
    if (action === 'setup-defaults') {
      await EngagementService.setupDefaultRules()
      return NextResponse.json({ success: true, message: 'Default rules created' })
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
  } catch (error) {
    console.error('Error in rules PUT:', error)
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 })
  }
} 