import { redis } from '@/lib/redis'
import { InfluencerProfile } from '@/lib/redis'
import { UnifiedProfile } from '@/lib/types/profile'
import { ProfileService } from './profile-service'

export class ProfileMigrationService {
  /**
   * Migrate existing InfluencerProfile to UnifiedProfile
   * This ensures backward compatibility
   */
  static async migrateInfluencerProfile(oldProfile: InfluencerProfile): Promise<UnifiedProfile> {
    const unifiedProfile: UnifiedProfile = {
      // Core fields
      id: oldProfile.id,
      twitterHandle: oldProfile.twitterHandle ? oldProfile.twitterHandle.replace('@', '').toLowerCase() : '',
      name: oldProfile.name || oldProfile.twitterHandle || 'Unknown User',
      profileImageUrl: oldProfile.profileImageUrl,
      bio: oldProfile.bio,
      
      // Auth & Access
      role: oldProfile.role || 'user',
      approvalStatus: oldProfile.approvalStatus || 'pending',
      approvedBy: oldProfile.approvedBy,
      approvedAt: undefined, // Old profile doesn't have this field
      rejectedBy: oldProfile.rejectedBy,
      rejectedAt: undefined, // Old profile doesn't have this field
      
      // KOL fields - check if they have any campaign data
      isKOL: Boolean(oldProfile.campaigns && oldProfile.campaigns.length > 0),
      currentTier: undefined,
      tier: oldProfile.tier || 'micro',
      campaigns: [], // Will need to convert old campaign format
      
      // Contact info
      email: undefined, // Old profile doesn't have email field
      phone: undefined, // Old profile doesn't have phone
      contacts: {
        telegram: oldProfile.socialAccounts?.telegram?.handle,
      },
      
      // Social links
      socialLinks: {
        twitter: oldProfile.twitterHandle ? `https://twitter.com/${oldProfile.twitterHandle.replace('@', '')}` : undefined,
        instagram: oldProfile.socialAccounts?.instagram?.handle,
        youtube: oldProfile.socialAccounts?.youtube?.handle,
        tiktok: oldProfile.socialAccounts?.tiktok?.handle,
      },
      
      // Wallet info (legacy) - map old fields to new
      walletAddresses: oldProfile.walletAddresses ? {
        ethereum: oldProfile.walletAddresses.coinbase,
        base: oldProfile.walletAddresses.coinbase, // Using coinbase for base chain
        solana: oldProfile.walletAddresses.phantom,
      } : undefined,
      
      // Location
      country: oldProfile.country,
      city: undefined, // Old profile doesn't have city
      languages: oldProfile.primaryLanguage ? [oldProfile.primaryLanguage] : [],
      
      // Metadata
      tags: [],
      notes: [],
      createdAt: oldProfile.createdAt ? new Date(oldProfile.createdAt) : new Date(),
      updatedAt: new Date(),
    }
    
    return unifiedProfile
  }
  
  /**
   * Check if a profile needs migration
   */
  static async needsMigration(profileId: string): Promise<boolean> {
    try {
      const key = `user:${profileId}`
      const exists = await redis.exists(key)
      if (!exists) return false
      
      // Check if it's already a unified profile
      const profile = await redis.json.get(key)
      return profile !== null && typeof profile === 'object' && !('isKOL' in profile)
    } catch (error) {
      console.error('Error checking migration status:', error)
      return false
    }
  }
  
  /**
   * Migrate all existing profiles to unified format
   */
  static async migrateAllProfiles(): Promise<{
    migrated: number
    failed: number
    errors: string[]
  }> {
    const result = {
      migrated: 0,
      failed: 0,
      errors: [] as string[]
    }
    
    try {
      // Get all user keys
      const userKeys = await redis.keys('user:*')
      
      for (const key of userKeys) {
        try {
          const profileId = key.replace('user:', '')
          
          // Skip if already migrated
          if (!(await this.needsMigration(profileId))) {
            continue
          }
          
          // Get old profile
          const oldProfile = await redis.json.get(key) as InfluencerProfile
          if (!oldProfile) continue
          
          // Migrate to unified profile
          const unifiedProfile = await this.migrateInfluencerProfile(oldProfile)
          
          // Save using ProfileService (handles indexing)
          await ProfileService.saveProfile(unifiedProfile)
          
          // Delete old key
          await redis.del(key)
          
          result.migrated++
        } catch (error) {
          result.failed++
          result.errors.push(`Failed to migrate ${key}: ${error}`)
        }
      }
      
      return result
    } catch (error) {
      console.error('Migration failed:', error)
      throw error
    }
  }
  
  /**
   * Get profile by handle - checks both old and new format
   */
  static async getProfileByHandleCompat(handle: string): Promise<UnifiedProfile | null> {
    // First try new format
    const profile = await ProfileService.getProfileByHandle(handle)
    if (profile) return profile
    
    // Try old format
    const normalizedHandle = handle.replace('@', '').toLowerCase()
    const userIds = await redis.smembers(`idx:handle:${normalizedHandle}`)
    
    for (const userId of userIds) {
      const oldProfile = await redis.json.get(`user:${userId}`) as InfluencerProfile | null
      if (oldProfile) {
        // Migrate on the fly
        const unified = await this.migrateInfluencerProfile(oldProfile)
        await ProfileService.saveProfile(unified)
        await redis.del(`user:${userId}`)
        return unified
      }
    }
    
    return null
  }
} 