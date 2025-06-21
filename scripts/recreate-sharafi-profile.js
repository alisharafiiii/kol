require('dotenv').config({ path: '.env.local' })
const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function recreateSharafiProfile() {
  try {
    console.log('🔧 Recreating sharafi_eth profile...\n')
    
    // Get the best data from old system
    const oldProfile = await redis.json.get('user:IBTfzFIEGBqw9uUq0wpy3')
    
    if (!oldProfile) {
      console.log('❌ Could not find old profile data')
      return
    }
    
    // Delete the problematic new profile
    const profileKey = 'profile:user_sharafi_eth'
    console.log('🗑️  Deleting problematic profile...')
    await redis.del(profileKey)
    
    // Create new profile with all correct data
    const newProfile = {
      id: 'user_sharafi_eth',
      twitterHandle: 'sharafi_eth',
      name: 'nabu.base.eth',
      profileImageUrl: oldProfile.profileImageUrl || 'https://pbs.twimg.com/profile_images/1857125372593827840/WRQmT1JX_400x400.jpg',
      bio: oldProfile.bio,
      
      // Fix these critical fields
      role: 'admin',
      approvalStatus: 'approved',
      approvedBy: 'system',
      approvedAt: new Date().toISOString(),
      
      // KOL fields
      isKOL: false,
      tier: 'micro',
      
      // Discord data
      discordId: oldProfile.discordId,
      discordUsername: oldProfile.discordUsername,
      socialAccounts: oldProfile.socialAccounts,
      
      // Social links
      socialLinks: {
        twitter: 'https://twitter.com/sharafi_eth'
      },
      
      // Timestamps
      createdAt: oldProfile.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString()
    }
    
    console.log('✨ Creating new profile with correct data...')
    await redis.json.set(profileKey, '$', newProfile)
    
    console.log('✅ Profile recreated successfully!')
    console.log('\n📊 New profile summary:')
    console.log('  ID:', newProfile.id)
    console.log('  Handle:', newProfile.twitterHandle)
    console.log('  Name:', newProfile.name)
    console.log('  Approval Status:', newProfile.approvalStatus)
    console.log('  Role:', newProfile.role)
    console.log('  Discord ID:', newProfile.discordId)
    console.log('  Discord Username:', newProfile.discordUsername)
    
  } catch (error) {
    console.error('Error:', error)
  }
}

recreateSharafiProfile() 