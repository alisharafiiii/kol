import { NextRequest, NextResponse } from 'next/server'
import { EngagementService } from '@/lib/services/engagement-service'
import { checkAuth } from '@/lib/auth-utils'
import { redis } from '@/lib/redis'

export async function GET(request: NextRequest) {
  try {
    // Check auth
    const auth = await checkAuth(request, ['admin', 'core', 'viewer'])
    if (!auth.authenticated) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Get query params
    const { searchParams } = new URL(request.url)
    const hours = parseInt(searchParams.get('hours') || '24')
    const tweetId = searchParams.get('id')
    
    if (tweetId) {
      const tweet = await EngagementService.getTweet(tweetId)
      return NextResponse.json({ tweet })
    }
    
    const tweets = await EngagementService.getRecentTweets(hours)
    return NextResponse.json({ tweets })
  } catch (error) {
    console.error('Error fetching tweets:', error)
    return NextResponse.json({ error: 'Failed to fetch tweets' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check auth - only admin can manually submit tweets via API
    const auth = await checkAuth(request, ['admin'])
    if (!auth.authenticated || !auth.hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const { tweetId, url, submitterDiscordId, authorHandle, category } = await request.json()
    
    if (!tweetId || !url || !submitterDiscordId || !authorHandle) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }
    
    // Check for duplicate
    const isDuplicate = await EngagementService.checkDuplicateTweet(tweetId)
    if (isDuplicate) {
      return NextResponse.json({ error: 'Tweet already exists' }, { status: 409 })
    }
    
    const tweet = await EngagementService.submitTweet(
      tweetId,
      submitterDiscordId,
      authorHandle,
      url,
      category
    )
    
    return NextResponse.json({ tweet })
  } catch (error) {
    console.error('Error creating tweet:', error)
    return NextResponse.json({ error: 'Failed to create tweet' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    // Check auth - only admin can delete tweets
    const auth = await checkAuth(request, ['admin'])
    if (!auth.authenticated || !auth.hasAccess) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
    
    const { searchParams } = new URL(request.url)
    const tweetId = searchParams.get('id')
    
    if (!tweetId) {
      return NextResponse.json({ error: 'Tweet ID required' }, { status: 400 })
    }
    
    // Delete tweet and related data
    await Promise.all([
      redis.del(`engagement:tweet:${tweetId}`),
      redis.zrem('engagement:tweets:recent', tweetId),
      // Also delete the tweet ID mapping
      (async () => {
        const tweet = await EngagementService.getTweet(tweetId)
        if (tweet) {
          await redis.del(`engagement:tweetid:${tweet.tweetId}`)
        }
      })()
    ])
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting tweet:', error)
    return NextResponse.json({ error: 'Failed to delete tweet' }, { status: 500 })
  }
} 