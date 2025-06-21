require('dotenv').config({ path: '.env.local' })
const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function fixSharafiProfile() {
  try {
    console.log('🔧 Fixing sharafi_eth profile...\n')
    
    // Get the best data from old system (user:IBTfzFIEGBqw9uUq0wpy3 has all the data)
    const bestOldProfile = await redis.json.get('user:IBTfzFIEGBqw9uUq0wpy3')
    
    if (!bestOldProfile) {
      console.log('❌ Could not find old profile data')
      return
    }
    
    console.log('✅ Found complete old profile with Discord data')
    console.log('  Discord ID:', bestOldProfile.discordId)
    console.log('  Discord Username:', bestOldProfile.discordUsername)
    console.log('  Approval Status:', bestOldProfile.approvalStatus)
    console.log('  Role:', bestOldProfile.role)
    
    // Update the new profile with all the correct data
    const profileKey = 'profile:user_sharafi_eth'
    const currentProfile = await redis.json.get(profileKey) || {}
    
    const updatedProfile = {
      ...currentProfile,
      id: 'user_sharafi_eth',
      twitterHandle: 'sharafi_eth',
      name: 'nabu.base.eth',
      profileImageUrl: bestOldProfile.profileImageUrl || currentProfile.profileImageUrl,
      approvalStatus: 'approved', // Fix the approval status!
      role: 'admin',
      tier: 'micro',
      isKOL: false,
      
      // Add Discord fields directly to profile
      discordId: bestOldProfile.discordId,
      discordUsername: bestOldProfile.discordUsername,
      
      // Add socialAccounts for backward compatibility
      socialAccounts: bestOldProfile.socialAccounts,
      
      // Keep existing socialLinks
      socialLinks: {
        twitter: 'https://twitter.com/sharafi_eth',
        ...(currentProfile.socialLinks || {})
      },
      
      createdAt: currentProfile.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
    
    console.log('\n📝 Updating profile with complete data...')
    await redis.json.set(profileKey, '$', updatedProfile)
    
    // Also update the old user record to ensure consistency
    await redis.json.set('user:IBTfzFIEGBqw9uUq0wpy3', '$.approvalStatus', 'approved')
    await redis.json.set('twitter_sharafi_eth', '$.approvalStatus', 'approved')
    await redis.json.set('user_sharafi_eth', '$.approvalStatus', 'approved')
    
    console.log('✅ Profile fixed successfully!')
    console.log('\n📊 Updated profile summary:')
    console.log('  Approval Status: approved')
    console.log('  Role: admin')
    console.log('  Discord ID:', updatedProfile.discordId)
    console.log('  Discord Username:', updatedProfile.discordUsername)
    console.log('  Social Accounts:', JSON.stringify(updatedProfile.socialAccounts, null, 2))
    
  } catch (error) {
    console.error('Error:', error)
  }
}

fixSharafiProfile() 