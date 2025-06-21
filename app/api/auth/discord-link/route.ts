import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { redis } from '@/lib/redis'
import { nanoid } from 'nanoid'
import { DiscordPointsBridge } from '@/lib/services/discord-points-bridge'

export async function POST(request: NextRequest) {
  try {
    // Get the current session
    const session = await getServerSession(authOptions)
    console.log('Discord link API - Session:', JSON.stringify(session, null, 2))
    
    const twitterHandleFromSession = session?.twitterHandle || (session?.user as any)?.twitterHandle
    
    if (!session?.user || !twitterHandleFromSession) {
      console.log('Discord link API - No session or Twitter handle')
      return NextResponse.json(
        { error: 'Not authenticated or missing Twitter handle' },
        { status: 401 }
      )
    }
    
    const { sessionId } = await request.json()
    console.log('Discord link API - Session ID:', sessionId)
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'No session ID provided' },
        { status: 400 }
      )
    }
    
    // Get the Discord verification session
    const sessionKey = `discord:verify:${sessionId}`
    const sessionData = await redis.get(sessionKey)
    
    if (!sessionData) {
      return NextResponse.json(
        { error: 'Verification session expired or not found' },
        { status: 404 }
      )
    }
    
    const parsedData = typeof sessionData === 'string' ? JSON.parse(sessionData) : sessionData
    const { discordId, discordUsername, discordTag } = parsedData
    const twitterHandle = twitterHandleFromSession.toLowerCase().replace('@', '')
    
    // Check if user profile exists
    const userIds = await redis.smembers(`idx:username:${twitterHandle}`)
    let userId: string
    let isNewUser = false
    
    if (!userIds || userIds.length === 0) {
      // Create new profile
      userId = `user_${twitterHandle}`
      isNewUser = true
      
      const newProfile = {
        id: userId,
        twitterHandle: `@${twitterHandle}`,
        name: session.user.name,
        profileImageUrl: session.user.image || '',
        approvalStatus: 'pending',
        role: 'user',
        tier: 'micro',
        isKOL: false,
        discordId: discordId,
        discordUsername: discordUsername,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        socialAccounts: {
          twitter: {
            handle: twitterHandle,
            connected: true
          },
          discord: {
            id: discordId,
            username: discordUsername,
            tag: discordTag,
            connected: true
          }
        }
      }
      
      // Save to Redis
      await redis.json.set(userId, '$', newProfile)
      
      // Create username index
      await redis.sadd(`idx:username:${twitterHandle}`, userId)
      
      // Add to pending users set
      await redis.sadd('users:pending', userId)
    } else {
      // Update existing profile
      userId = userIds[0]
      
      // Get the existing profile first
      const existingProfile = await redis.json.get(userId) as any
      
      // If profile doesn't exist in Redis, create a new one
      if (!existingProfile) {
        const newProfile = {
          id: userId,
          twitterHandle: `@${twitterHandle}`,
          name: session.user.name,
          profileImageUrl: session.user.image || '',
          approvalStatus: 'approved', // Existing user, likely already approved
          role: session.role || 'user',
          tier: 'micro',
          isKOL: false,
          discordId: discordId,
          discordUsername: discordUsername,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          socialAccounts: {
            twitter: {
              handle: twitterHandle,
              connected: true
            },
            discord: {
              id: discordId,
              username: discordUsername,
              tag: discordTag,
              connected: true
            }
          }
        }
        
        await redis.json.set(userId, '$', newProfile)
      } else {
        // Update the profile with Discord info
        const updatedProfile = {
          ...existingProfile,
          discordId: discordId,
          discordUsername: discordUsername,
          updatedAt: new Date().toISOString(),
          socialAccounts: {
            ...(existingProfile.socialAccounts || {}),
            discord: {
              id: discordId,
              username: discordUsername,
              tag: discordTag,
              connected: true
            }
          }
        }
        
        await redis.json.set(userId, '$', updatedProfile)
      }
    }
    
    // Get the profile data
    const profile = await redis.json.get(userId) as any
    
    // Create engagement connection
    const connection = {
      discordId: discordId,
      twitterHandle: twitterHandle,
      tier: profile?.tier || 'micro',
      connectedAt: new Date(),
      totalPoints: 0,
      role: profile?.role || 'user'
    }
    
    await redis.json.set(`engagement:connection:${discordId}`, '$', connection)
    await redis.set(`engagement:twitter:${twitterHandle}`, discordId)
    
    // Link Discord user to platform user for points system
    const platformUserId = userId.replace('user:', '') // Extract just the ID part
    await DiscordPointsBridge.linkDiscordUser(discordId, platformUserId)
    
    // Clean up verification session
    await redis.del(sessionKey)
    
    return NextResponse.json({
      success: true,
      message: isNewUser ? 'Account created and linked successfully' : 'Accounts linked successfully',
      profile: {
        twitterHandle: `@${twitterHandle}`,
        discordUsername: discordUsername,
        approvalStatus: profile?.approvalStatus || 'pending',
        isNewUser
      }
    })
    
  } catch (error) {
    console.error('Error linking Discord account:', error)
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json(
      { error: 'Failed to link accounts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 