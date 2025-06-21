import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { checkUserRoleFromSession } from '@/lib/user-identity'
import { isMasterAdmin } from '@/lib/admin-config'
import { redis } from '@/lib/redis'

// Default points configuration
const DEFAULT_CONFIG = {
  actions: [
    {
      id: 'action_tweet_post',
      name: 'Tweet Post',
      description: 'Points for posting campaign tweets',
      basePoints: 100,
      category: 'engagement'
    },
    {
      id: 'action_discord_msg',
      name: 'Discord Message',
      description: 'Points for Discord engagement',
      basePoints: 10,
      category: 'social'
    },
    {
      id: 'action_contest_entry',
      name: 'Contest Entry',
      description: 'Points for entering contests',
      basePoints: 50,
      category: 'engagement'
    },
    {
      id: 'action_referral',
      name: 'Referral',
      description: 'Points for successful referrals',
      basePoints: 200,
      category: 'referral'
    }
  ],
  tiers: [
    {
      id: 'tier_hero',
      name: 'Hero',
      minPoints: 10000,
      maxPoints: 999999,
      multiplier: 2.0,
      color: '#FFB800'
    },
    {
      id: 'tier_legend',
      name: 'Legend',
      minPoints: 5000,
      maxPoints: 9999,
      multiplier: 1.8,
      color: '#FF0000'
    },
    {
      id: 'tier_star',
      name: 'Star',
      minPoints: 2500,
      maxPoints: 4999,
      multiplier: 1.5,
      color: '#0080FF'
    },
    {
      id: 'tier_rising',
      name: 'Rising',
      minPoints: 1000,
      maxPoints: 2499,
      multiplier: 1.2,
      color: '#00FF00'
    },
    {
      id: 'tier_micro',
      name: 'Micro',
      minPoints: 0,
      maxPoints: 999,
      multiplier: 1.0,
      color: '#808080'
    }
  ],
  scenarios: [
    {
      id: 'scenario_hero_tweet',
      tier: 'tier_hero',
      action: 'action_tweet_post',
      points: 200,
      multiplier: 2.0
    },
    {
      id: 'scenario_legend_tweet',
      tier: 'tier_legend',
      action: 'action_tweet_post',
      points: 180,
      multiplier: 1.8
    },
    {
      id: 'scenario_star_tweet',
      tier: 'tier_star',
      action: 'action_tweet_post',
      points: 150,
      multiplier: 1.5
    },
    {
      id: 'scenario_rising_tweet',
      tier: 'tier_rising',
      action: 'action_tweet_post',
      points: 120,
      multiplier: 1.2
    },
    {
      id: 'scenario_micro_tweet',
      tier: 'tier_micro',
      action: 'action_tweet_post',
      points: 100,
      multiplier: 1.0
    }
  ]
}

// GET: Fetch points configuration
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session: any = await getServerSession(authOptions as any)
    
    if (!session?.twitterHandle) {
      return NextResponse.json(
        { error: 'Unauthorized - please log in' },
        { status: 401 }
      )
    }
    
    // Check admin access
    const normalizedHandle = session.twitterHandle.toLowerCase().replace('@', '')
    const isAdmin = isMasterAdmin(normalizedHandle) || 
                    (await checkUserRoleFromSession(session, ['admin', 'master'])).hasAccess
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Access denied - admin only' },
        { status: 403 }
      )
    }
    
    // Fetch configuration from Redis
    const configKey = 'points:config'
    let config = await redis.json.get(configKey)
    
    // If no config exists, use default
    if (!config) {
      config = DEFAULT_CONFIG
      // Save default config to Redis
      await redis.json.set(configKey, '$', config)
    }
    
    return NextResponse.json(config)
    
  } catch (error) {
    console.error('Error fetching points config:', error)
    return NextResponse.json(
      { error: 'Failed to fetch points configuration' },
      { status: 500 }
    )
  }
}

// POST: Save points configuration
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session: any = await getServerSession(authOptions as any)
    
    if (!session?.twitterHandle) {
      return NextResponse.json(
        { error: 'Unauthorized - please log in' },
        { status: 401 }
      )
    }
    
    // Check admin access
    const normalizedHandle = session.twitterHandle.toLowerCase().replace('@', '')
    const isAdmin = isMasterAdmin(normalizedHandle) || 
                    (await checkUserRoleFromSession(session, ['admin', 'master'])).hasAccess
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Access denied - admin only' },
        { status: 403 }
      )
    }
    
    // Parse request body
    const config = await request.json()
    
    // Validate configuration structure
    if (!config.actions || !Array.isArray(config.actions)) {
      return NextResponse.json(
        { error: 'Invalid configuration: actions must be an array' },
        { status: 400 }
      )
    }
    
    if (!config.tiers || !Array.isArray(config.tiers)) {
      return NextResponse.json(
        { error: 'Invalid configuration: tiers must be an array' },
        { status: 400 }
      )
    }
    
    if (!config.scenarios || !Array.isArray(config.scenarios)) {
      return NextResponse.json(
        { error: 'Invalid configuration: scenarios must be an array' },
        { status: 400 }
      )
    }
    
    // Save configuration to Redis
    const configKey = 'points:config'
    await redis.json.set(configKey, '$', config)
    
    // Also save a backup with timestamp
    const backupKey = `points:config:backup:${Date.now()}`
    await redis.json.set(backupKey, '$', {
      ...config,
      savedAt: new Date().toISOString(),
      savedBy: session.twitterHandle
    })
    
    // Set expiry on backup (30 days)
    await redis.expire(backupKey, 30 * 24 * 60 * 60)
    
    // Log the change
    console.log(`Points configuration updated by @${session.twitterHandle}`)
    
    return NextResponse.json({ 
      success: true,
      message: 'Points configuration saved successfully'
    })
    
  } catch (error) {
    console.error('Error saving points config:', error)
    return NextResponse.json(
      { error: 'Failed to save points configuration' },
      { status: 500 }
    )
  }
} 