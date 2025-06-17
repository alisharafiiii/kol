import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export async function POST(request: NextRequest) {
  try {
    const { currentHandle, newHandle } = await request.json()
    
    if (!currentHandle || !newHandle) {
      return NextResponse.json({ error: 'Both currentHandle and newHandle are required' }, { status: 400 })
    }

    // Normalize handles (remove @ if present)
    const normalizedCurrent = currentHandle.toLowerCase().replace('@', '')
    const normalizedNew = newHandle.toLowerCase().replace('@', '')

    // Find the user
    const userId = `user_${normalizedCurrent}`
    const userKey = `user:${userId}`
    
    const userDataStr = await redis.get(userKey)
    if (!userDataStr) {
      return NextResponse.json({ error: `User not found: ${currentHandle}` }, { status: 404 })
    }

    const userData = JSON.parse(userDataStr)
    console.log('Current user data:', userData)

    // Update the Twitter handle
    userData.twitterHandle = normalizedNew
    if (userData.socialAccounts?.twitter) {
      userData.socialAccounts.twitter.handle = normalizedNew
    }

    // Save the updated data
    await redis.set(userKey, JSON.stringify(userData))
    console.log(`Updated Twitter handle from ${currentHandle} to ${newHandle}`)

    // Also update in the unified profile if it exists
    const profileKey = `profile:${normalizedCurrent}`
    const profileDataStr = await redis.get(profileKey)
    if (profileDataStr) {
      const profileData = JSON.parse(profileDataStr)
      profileData.twitterHandle = normalizedNew
      
      // Create new profile key with new handle
      const newProfileKey = `profile:${normalizedNew}`
      await redis.set(newProfileKey, JSON.stringify(profileData))
      
      // Delete old profile key
      await redis.del(profileKey)
      console.log('Updated unified profile as well')
    }

    return NextResponse.json({ 
      success: true, 
      message: `Updated Twitter handle from ${currentHandle} to ${newHandle}` 
    })
  } catch (error) {
    console.error('Error updating handle:', error)
    return NextResponse.json({ error: 'Failed to update handle' }, { status: 500 })
  }
} 