import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'
import { nanoid } from 'nanoid'

export async function POST(request: NextRequest) {
  try {
    const { sessionId, twitterHandle } = await request.json()
    
    if (!sessionId || !twitterHandle) {
      return NextResponse.json(
        { error: 'Missing sessionId or twitterHandle' },
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
    const normalizedHandle = twitterHandle.toLowerCase().replace('@', '')
    
    // Check if user profile exists
    const userIds = await redis.smembers(`idx:username:${normalizedHandle}`)
    let userId: string
    let isNewUser = false
    
    if (!userIds || userIds.length === 0) {
      // Create new profile
      userId = `user:${nanoid()}`
      isNewUser = true
      
      const newProfile = {
        id: userId,
        twitterHandle: `@${normalizedHandle}`,
        name: normalizedHandle,
        profileImageUrl: '',
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
            handle: normalizedHandle,
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
      await redis.sadd(`idx:username:${normalizedHandle}`, userId)
      
      // Add to pending users set
      await redis.sadd('users:pending', userId)
    } else {
      // Update existing profile
      userId = userIds[0]
      
      // Get the existing profile first
      const existingProfile = await redis.json.get(userId) as any
      
      if (!existingProfile) {
        // Profile key exists in index but actual profile is missing
        // Remove from index and treat as new user
        await redis.srem(`idx:username:${normalizedHandle}`, userId)
        
        // Create new profile
        userId = `user:${nanoid()}`
        isNewUser = true
        
        const newProfile = {
          id: userId,
          twitterHandle: `@${normalizedHandle}`,
          name: normalizedHandle,
          profileImageUrl: '',
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
              handle: normalizedHandle,
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
        await redis.sadd(`idx:username:${normalizedHandle}`, userId)
        
        // Add to pending users set
        await redis.sadd('users:pending', userId)
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
        
        // Save the entire updated profile
        await redis.json.set(userId, '$', updatedProfile)
      }
    }
    
    // Get the profile data
    const profile = await redis.json.get(userId) as any
    
    // Create engagement connection
    const connection = {
      discordId: discordId,
      twitterHandle: normalizedHandle,
      tier: profile?.tier || 'micro',
      connectedAt: new Date().toISOString(),
      totalPoints: 0,
      role: profile?.role || 'user'
    }
    
    await redis.json.set(`engagement:connection:${discordId}`, '$', connection)
    await redis.set(`engagement:twitter:${normalizedHandle}`, discordId)
    
    // Clean up verification session
    await redis.del(sessionKey)
    
    return NextResponse.json({
      success: true,
      message: isNewUser ? 'Account created and linked successfully' : 'Accounts linked successfully',
      profile: {
        twitterHandle: `@${normalizedHandle}`,
        discordUsername: discordUsername,
        approvalStatus: profile?.approvalStatus || 'pending',
        isNewUser
      }
    })
    
  } catch (error) {
    console.error('Error in test Discord link:', error)
    return NextResponse.json(
      { error: 'Failed to link accounts', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
} 