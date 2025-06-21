require('dotenv').config({ path: '.env.local' })
const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function fixSharafiProfile() {
  try {
    console.log('🔧 Fixing sharafi_eth profile...\n')
    
    // Fix the new profile system
    const profileKey = 'profile:user_sharafi_eth'
    
    // Update approval status
    console.log('📝 Updating approval status to approved...')
    await redis.json.set(profileKey, '$.approvalStatus', 'approved')
    
    // Get Discord data from old profile
    const oldProfile = await redis.json.get('user:IBTfzFIEGBqw9uUq0wpy3')
    
    if (oldProfile && oldProfile.socialAccounts) {
      console.log('📝 Adding socialAccounts with Discord data...')
      await redis.json.set(profileKey, '$.socialAccounts', oldProfile.socialAccounts)
    }
    
    // Add Discord fields directly
    if (oldProfile) {
      console.log('📝 Adding Discord fields...')
      await redis.json.set(profileKey, '$.discordId', oldProfile.discordId)
      await redis.json.set(profileKey, '$.discordUsername', oldProfile.discordUsername)
    }
    
    // Verify the updates
    const updatedProfile = await redis.json.get(profileKey)
    console.log('\n✅ Profile updated successfully!')
    console.log('  Approval Status:', updatedProfile.approvalStatus)
    console.log('  Role:', updatedProfile.role)
    console.log('  Discord ID:', updatedProfile.discordId)
    console.log('  Discord Username:', updatedProfile.discordUsername)
    console.log('  Has socialAccounts:', !!updatedProfile.socialAccounts)
    
  } catch (error) {
    console.error('Error:', error)
  }
}

fixSharafiProfile() 