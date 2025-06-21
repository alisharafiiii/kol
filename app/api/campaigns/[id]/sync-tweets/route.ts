import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/auth-utils'
import { TwitterSyncService } from '@/lib/services/twitter-sync-service'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check auth - allow admin, core, and team to sync tweets
    const auth = await checkAuth(request, ['admin', 'core', 'team'])
    if (!auth.authenticated) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    if (!auth.hasAccess) {
      return NextResponse.json(
        { error: 'Forbidden - You need admin, core, or team role to sync tweets' },
        { status: 403 }
      )
    }
    
    const campaignId = params.id
    
    // Start sync process
    const result = await TwitterSyncService.syncCampaignTweets(campaignId)
    
    if (result.rateLimited) {
      return NextResponse.json({
        message: 'Campaign queued for sync due to rate limit',
        queued: true,
        result
      })
    }
    
    return NextResponse.json({
      message: 'Sync completed',
      result
    })
  } catch (error) {
    console.error('Error syncing tweets:', error)
    return NextResponse.json(
      { error: 'Failed to sync tweets' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const campaignId = params.id
    
    // Get sync status
    const status = await TwitterSyncService.getCampaignSyncStatus(campaignId)
    
    return NextResponse.json(status)
  } catch (error) {
    console.error('Error getting sync status:', error)
    return NextResponse.json(
      { error: 'Failed to get sync status' },
      { status: 500 }
    )
  }
} 