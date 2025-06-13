import { NextRequest, NextResponse } from 'next/server'
import { DiscordService } from '@/lib/services/discord-service'

export async function POST(request: NextRequest) {
  try {
    // Parse the bot token from Authorization header
    const authHeader = request.headers.get('authorization')
    const botToken = process.env.DISCORD_BOT_TOKEN
    
    console.log('🔐 Discord Messages API - Auth check:')
    console.log('   Bot token configured:', !!botToken)
    console.log('   Auth header received:', authHeader?.substring(0, 20) + '...')
    console.log('   Expected header:', botToken ? `Bot ${botToken.substring(0, 20)}...` : 'Not configured')
    
    if (!botToken) {
      return NextResponse.json({ error: 'Discord bot token not configured' }, { status: 500 })
    }
    
    if (!authHeader || authHeader !== `Bot ${botToken}`) {
      console.log('   ❌ Auth failed - headers don\'t match')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('   ✅ Auth successful')

    const data = await request.json()
    
    // Save message using DiscordService which includes sentiment analysis
    const message = await DiscordService.saveMessage({
      messageId: data.messageId,
      projectId: data.projectId,
      channelId: data.channelId,
      channelName: data.channelName,
      userId: data.userId,
      username: data.username,
      userAvatar: data.userAvatar,
      content: data.content,
      timestamp: data.timestamp,
      hasAttachments: data.hasAttachments,
      replyToId: data.replyToId
    })

    return NextResponse.json(message)
  } catch (error) {
    console.error('Error saving Discord message:', error)
    return NextResponse.json({ error: 'Failed to save message' }, { status: 500 })
  }
} 