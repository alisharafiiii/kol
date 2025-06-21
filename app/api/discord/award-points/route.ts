import { NextRequest, NextResponse } from 'next/server'
import { DiscordPointsBridge } from '@/lib/services/discord-points-bridge'

// Simple API key authentication for bot isolation
const DISCORD_BOT_API_KEY = process.env.DISCORD_BOT_API_KEY || 'discord-bot-points-key-2024'

export async function POST(req: NextRequest) {
  try {
    // Check API key
    const apiKey = req.headers.get('x-api-key')
    if (apiKey !== DISCORD_BOT_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    // Parse request body
    const body = await req.json()
    const {
      discordUserId,
      discordUsername,
      projectId,
      projectName,
      messageId
    } = body
    
    // Validate required fields
    if (!discordUserId || !discordUsername || !projectId || !messageId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }
    
    // Award points using the bridge service
    const result = await DiscordPointsBridge.awardMessagePoints(
      discordUserId,
      discordUsername,
      projectId,
      projectName || 'Unknown Project',
      messageId
    )
    
    if (result.success) {
      return NextResponse.json({
        success: true,
        points: result.points || 0,
        message: result.points 
          ? `Awarded ${result.points} points for Discord message`
          : 'No points awarded (user not linked or daily limit reached)'
      })
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: result.error || 'Failed to award points' 
        },
        { status: 500 }
      )
    }
    
  } catch (error) {
    console.error('Error in Discord points API:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// GET endpoint to check recent transactions
export async function GET(req: NextRequest) {
  try {
    // Check API key
    const apiKey = req.headers.get('x-api-key')
    if (apiKey !== DISCORD_BOT_API_KEY) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    
    const { searchParams } = new URL(req.url)
    const limit = parseInt(searchParams.get('limit') || '50')
    
    const transactions = await DiscordPointsBridge.getRecentTransactions(limit)
    
    return NextResponse.json({
      success: true,
      count: transactions.length,
      transactions
    })
    
  } catch (error) {
    console.error('Error fetching Discord transactions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch transactions' },
      { status: 500 }
    )
  }
} 