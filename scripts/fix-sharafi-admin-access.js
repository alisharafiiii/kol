#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' })
const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function fixAdminAccess() {
  console.log('🔧 Fixing admin access for sharafi_eth...\n')
  
  try {
    // Get the current profile
    const currentProfile = await redis.json.get('user:IBTfzFIEGBqw9uUq0wpy3')
    
    // Create/update the expected user_sharafi_eth profile
    const adminProfile = {
      ...currentProfile,
      id: 'user_sharafi_eth',
      approvalStatus: 'approved',
      role: 'admin',
      tier: 'hero',
      isKOL: true,
      twitterHandle: '@sharafi_eth',
      profileImageUrl: currentProfile.profileImageUrl || 'https://pbs.twimg.com/profile_images/1234567890/default_400x400.jpg',
      adminNotes: 'Master admin'
    }
    
    // Save as user_sharafi_eth (the key the auth system expects)
    await redis.json.set('user_sharafi_eth', '$', adminProfile)
    console.log('✅ Created user_sharafi_eth profile')
    
    // Ensure it's in all the right indexes
    await redis.sadd('idx:username:sharafi_eth', 'user_sharafi_eth')
    await redis.sadd('idx:role:admin', 'user_sharafi_eth')
    await redis.sadd('idx:status:approved', 'user_sharafi_eth')
    await redis.sadd('users:approved', 'user_sharafi_eth')
    
    // Also ensure the ProfileService can find it
    await redis.sadd('profiles:all', 'user_sharafi_eth')
    
    console.log('✅ Updated all indexes')
    
    // Clean up duplicates but keep both profiles for compatibility
    const userIds = await redis.smembers('idx:username:sharafi_eth')
    console.log('\nCurrent user IDs for sharafi_eth:', userIds)
    
    // Remove the problematic twitter_sharafi_eth
    if (userIds.includes('twitter_sharafi_eth')) {
      await redis.srem('idx:username:sharafi_eth', 'twitter_sharafi_eth')
      await redis.srem('idx:role:admin', 'twitter_sharafi_eth')
      console.log('✅ Removed twitter_sharafi_eth from indexes')
    }
    
    console.log('\n✅ Admin access fixed!')
    console.log('\nYou should now be able to access the admin panel.')
    console.log('The system will find your profile as user_sharafi_eth')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
  }
}

fixAdminAccess().catch(console.error) 