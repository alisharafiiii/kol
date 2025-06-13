import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redis } from '@/lib/redis'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tier = searchParams.get('tier')

    if (tier) {
      // Get specific tier scenarios
      const scenarios = await redis.json.get(`engagement:scenarios:tier${tier}`)
      if (!scenarios) {
        // Return default scenarios
        const defaults = getDefaultScenarios(parseInt(tier))
        return NextResponse.json(defaults)
      }
      return NextResponse.json(scenarios)
    }

    // Get all tier scenarios
    const allScenarios: any = {}
    for (let i = 1; i <= 3; i++) {
      const scenarios = await redis.json.get(`engagement:scenarios:tier${i}`)
      allScenarios[`tier${i}`] = scenarios || getDefaultScenarios(i)
    }

    return NextResponse.json(allScenarios)
  } catch (error) {
    console.error('Error fetching scenarios:', error)
    return NextResponse.json({ error: 'Failed to fetch scenarios' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session || !session.user || (session.user as any).role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { tier, scenarios } = await request.json()

    if (!tier || tier < 1 || tier > 3) {
      return NextResponse.json({ error: 'Invalid tier' }, { status: 400 })
    }

    // Validate scenarios
    if (!scenarios.dailyTweetLimit || scenarios.dailyTweetLimit < 1) {
      return NextResponse.json({ error: 'Invalid daily tweet limit' }, { status: 400 })
    }

    if (!scenarios.minFollowers || scenarios.minFollowers < 0) {
      return NextResponse.json({ error: 'Invalid minimum followers' }, { status: 400 })
    }

    if (!scenarios.bonusMultiplier || scenarios.bonusMultiplier < 0.1) {
      return NextResponse.json({ error: 'Invalid bonus multiplier' }, { status: 400 })
    }

    if (!scenarios.categories || !Array.isArray(scenarios.categories) || scenarios.categories.length === 0) {
      return NextResponse.json({ error: 'Invalid categories' }, { status: 400 })
    }

    // Save scenarios
    await redis.json.set(`engagement:scenarios:tier${tier}`, '$', scenarios)

    return NextResponse.json({ success: true, scenarios })
  } catch (error) {
    console.error('Error saving scenarios:', error)
    return NextResponse.json({ error: 'Failed to save scenarios' }, { status: 500 })
  }
}

function getDefaultScenarios(tier: number) {
  const scenarios: Record<number, any> = {
    1: {
      dailyTweetLimit: 3,
      categories: ['General', 'DeFi', 'NFT'],
      minFollowers: 100,
      bonusMultiplier: 1.0
    },
    2: {
      dailyTweetLimit: 5,
      categories: ['General', 'DeFi', 'NFT', 'Gaming', 'Tech'],
      minFollowers: 500,
      bonusMultiplier: 1.5
    },
    3: {
      dailyTweetLimit: 10,
      categories: ['General', 'DeFi', 'NFT', 'Gaming', 'Tech', 'Memes', 'News'],
      minFollowers: 1000,
      bonusMultiplier: 2.0
    }
  }
  
  return scenarios[tier] || scenarios[1]
} 