import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redis } from '@/lib/redis'

export async function POST(request: NextRequest) {
  try {
    // Check if contracts feature is enabled
    if (process.env.ENABLE_CONTRACTS !== 'true') {
      return NextResponse.json(
        { error: 'Contracts feature is disabled' },
        { status: 403 }
      )
    }

    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session?.user?.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()
    const { twitterHandle, walletAddress, contractId, contractDetails } = data

    // Validate input
    if (!twitterHandle || !walletAddress || !contractId) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Normalize the handle
    const normalizedHandle = twitterHandle.replace('@', '').toLowerCase()
    
    // Check if user profile exists
    const userKey = `user_${normalizedHandle}`
    const existingUser = await redis.get(userKey)

    if (existingUser) {
      // Update existing profile
      const userData = typeof existingUser === 'string' ? JSON.parse(existingUser) : existingUser
      
      // Initialize wallets array if it doesn't exist
      if (!userData.walletAddresses) {
        userData.walletAddresses = []
      }
      
      // Add wallet if not already present
      if (!userData.walletAddresses.includes(walletAddress)) {
        userData.walletAddresses.push(walletAddress)
      }
      
      // Initialize contracts array if it doesn't exist
      if (!userData.contracts) {
        userData.contracts = []
      }
      
      // Add contract info
      userData.contracts.push({
        contractId,
        walletAddress,
        signedAt: contractDetails.signedAt || new Date().toISOString(),
        ...contractDetails
      })
      
      // Update the user data
      await redis.set(userKey, JSON.stringify(userData))
      
      return NextResponse.json({
        success: true,
        message: 'Profile updated with wallet and contract information',
        isNewProfile: false
      })
    } else {
      // Create new profile
      const newUserData = {
        id: userKey,
        twitterHandle: `@${normalizedHandle}`,
        name: session.user.name,
        profileImageUrl: session.user.image || '',
        walletAddresses: [walletAddress],
        contracts: [{
          contractId,
          walletAddress,
          signedAt: contractDetails.signedAt || new Date().toISOString(),
          ...contractDetails
        }],
        approvalStatus: 'pending',
        role: 'user',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        // Default fields
        tier: 'micro',
        followerCount: 0,
        audienceTypes: [],
        chains: [],
        postPricePerPost: 0,
        monthlySupportBudget: 0
      }
      
      // Save the new profile
      await redis.set(userKey, JSON.stringify(newUserData))
      
      // Also add to the user index
      await redis.sadd('users', normalizedHandle)
      await redis.sadd('users', `twitter_${normalizedHandle}`)
      await redis.sadd('users', userKey)
      
      return NextResponse.json({
        success: true,
        message: 'New profile created with wallet and contract information',
        isNewProfile: true
      })
    }
  } catch (error) {
    console.error('Error updating profile:', error)
    return NextResponse.json(
      { error: 'Failed to update profile' },
      { status: 500 }
    )
  }
} 