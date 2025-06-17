import { redis } from '@/lib/redis'
import { getProfile, saveProfileWithDuplicateCheck, InfluencerProfile } from '@/lib/redis'
import { nanoid } from 'nanoid'

/**
 * Link a contract to a user's profile
 * @param twitterHandle - The Twitter handle of the user (without @)
 * @param contractId - The contract ID
 * @param role - 'creator' or 'recipient'
 */
export async function linkContractToProfile(
  twitterHandle: string,
  contractId: string,
  role: 'creator' | 'recipient'
): Promise<void> {
  if (!twitterHandle || !contractId) {
    throw new Error('Twitter handle and contract ID are required')
  }

  // Normalize the handle
  const normalizedHandle = twitterHandle.toLowerCase().replace('@', '')
  
  try {
    // Find the user profile by Twitter handle
    const userIds = await redis.smembers(`idx:username:${normalizedHandle}`)
    let profile: InfluencerProfile | null = null
    
    if (userIds && userIds.length > 0) {
      // User exists, get their profile
      profile = await getProfile(userIds[0])
    }
    
    if (!profile) {
      // Create a basic profile for the user if they don't exist
      console.log(`Creating new profile for ${normalizedHandle}`)
      profile = {
        id: `user_${normalizedHandle}`,
        name: normalizedHandle,
        twitterHandle: normalizedHandle,
        approvalStatus: 'pending',
        role: 'user',
        createdAt: new Date().toISOString(),
        contracts: []
      } as InfluencerProfile
    }
    
    // Initialize contracts array if it doesn't exist
    if (!profile.contracts) {
      profile.contracts = []
    }
    
    // Check if contract is already linked
    const existingContract = profile.contracts.find(c => c.id === contractId)
    
    if (!existingContract) {
      // Add the contract to the profile
      profile.contracts.push({
        id: contractId,
        role: role,
        linkedAt: new Date().toISOString()
      })
      
      // Update the profile
      await saveProfileWithDuplicateCheck(profile)
      
      // Also create an index for quick contract lookups
      await redis.sadd(`idx:contract:${contractId}:users`, profile.id)
      await redis.sadd(`idx:user:${profile.id}:contracts`, contractId)
      
      console.log(`Contract ${contractId} linked to ${normalizedHandle} as ${role}`)
    } else {
      console.log(`Contract ${contractId} already linked to ${normalizedHandle}`)
    }
  } catch (error) {
    console.error(`Error linking contract to profile:`, error)
    throw error
  }
}

/**
 * Get all contracts for a user
 * @param twitterHandle - The Twitter handle of the user
 * @returns Array of contract IDs
 */
export async function getUserContracts(twitterHandle: string): Promise<string[]> {
  const normalizedHandle = twitterHandle.toLowerCase().replace('@', '')
  
  try {
    // Find the user profile
    const userIds = await redis.smembers(`idx:username:${normalizedHandle}`)
    
    if (!userIds || userIds.length === 0) {
      return []
    }
    
    // Get contracts from the index
    const contractIds = await redis.smembers(`idx:user:${userIds[0]}:contracts`)
    return contractIds || []
  } catch (error) {
    console.error(`Error getting user contracts:`, error)
    return []
  }
}

/**
 * Get all users associated with a contract
 * @param contractId - The contract ID
 * @returns Array of user IDs
 */
export async function getContractUsers(contractId: string): Promise<string[]> {
  try {
    const userIds = await redis.smembers(`idx:contract:${contractId}:users`)
    return userIds || []
  } catch (error) {
    console.error(`Error getting contract users:`, error)
    return []
  }
} 