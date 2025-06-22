/**
 * ✅ STABLE & VERIFIED - DO NOT MODIFY WITHOUT EXPLICIT REVIEW
 * 
 * Tweet synchronization API endpoint.
 * Last verified: December 2024
 * 
 * Key functionality:
 * - Authentication check for admin/core/team roles
 * - Calls TwitterSyncService to sync campaign tweets
 * - Returns sync results with proper error handling
 * 
 * CRITICAL: This endpoint is working correctly and syncing tweets successfully.
 * Do not modify the core logic without thorough testing.
 * 
 * NOTE: Debug logging can be safely removed after verification period.
 */

import { NextRequest, NextResponse } from 'next/server'
import { checkAuth } from '@/lib/auth-utils'
import { TwitterSyncService } from '@/lib/services/twitter-sync-service'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Debug logging - can be removed after verification period
  const startTime = Date.now()
  console.log('\n🔍 SYNC TWEETS API CALLED')
  console.log('='.repeat(80))
  console.log('Time:', new Date().toISOString())
  console.log('Campaign ID:', params.id)
  
  try {
    // Check auth - allow admin, core, and team to sync tweets
    console.log('\n1. Checking authentication...')
    const auth = await checkAuth(request, ['admin', 'core', 'team'])
    console.log('   Auth result:', {
      authenticated: auth.authenticated,
      hasAccess: auth.hasAccess,
      user: auth.user ? { 
        twitterHandle: auth.user.twitterHandle, 
        name: auth.user.name, 
        image: auth.user.image 
      } : null,
      role: auth.role
    })
    
    if (!auth.authenticated) {
      console.log('   ❌ Not authenticated')
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }
    
    if (!auth.hasAccess) {
      console.log('   ❌ No access - user role:', auth.role)
      return NextResponse.json(
        { error: 'Forbidden - You need admin, core, or team role to sync tweets' },
        { status: 403 }
      )
    }
    
    console.log('   ✅ Authentication passed')
    
    const campaignId = params.id
    console.log('\n2. Starting sync process for campaign:', campaignId)
    
    // Start sync process
    const result = await TwitterSyncService.syncCampaignTweets(campaignId)
    
    console.log('\n3. Sync result:', JSON.stringify(result, null, 2))
    console.log('   Time taken:', Date.now() - startTime, 'ms')
    
    if (result.rateLimited) {
      console.log('   ⚠️  Rate limited - campaign queued')
      return NextResponse.json({
        message: 'Campaign queued for sync due to rate limit',
        queued: true,
        result
      })
    }
    
    console.log('   ✅ Sync completed successfully')
    console.log('='.repeat(80))
    
    return NextResponse.json({
      message: 'Sync completed',
      result
    })
  } catch (error) {
    console.error('\n❌ ERROR in sync-tweets API:')
    console.error('   Error type:', error instanceof Error ? error.constructor.name : 'Unknown')
    console.error('   Error message:', error instanceof Error ? error.message : String(error))
    console.error('   Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('   Time taken:', Date.now() - startTime, 'ms')
    console.error('='.repeat(80))
    
    return NextResponse.json(
      { error: 'Failed to sync tweets', details: error instanceof Error ? error.message : String(error) },
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