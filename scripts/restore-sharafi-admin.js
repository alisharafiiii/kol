#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' })
const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function restoreAdmin() {
  console.log('🔧 Restoring admin access for sharafi_eth...\n')
  
  try {
    // First, delete the problematic key
    console.log('🗑️  Deleting old user_sharafi_eth key...')
    await redis.del('user_sharafi_eth')
    
    // Get the current working profile
    const currentProfile = await redis.json.get('user:IBTfzFIEGBqw9uUq0wpy3')
    console.log('✅ Got current profile')
    
    // Create the admin profile with the expected key format
    const adminProfile = {
      id: 'user_sharafi_eth',
      twitterHandle: '@sharafi_eth',
      name: 'sharafi_eth',
      profileImageUrl: currentProfile?.profileImageUrl || '',
      approvalStatus: 'approved',
      role: 'admin',
      tier: 'hero',
      isKOL: true,
      discordId: '918575895374082078',
      discordUsername: 'alinabu',
      createdAt: currentProfile?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      socialAccounts: currentProfile?.socialAccounts || {
        twitter: { handle: 'sharafi_eth', connected: true },
        discord: { id: '918575895374082078', username: 'alinabu', connected: true }
      },
      adminNotes: 'Master admin - restored'
    }
    
    // Save the new profile
    console.log('📝 Creating new admin profile...')
    await redis.json.set('user_sharafi_eth', '$', adminProfile)
    console.log('✅ Admin profile created')
    
    // Update all indexes
    console.log('🔗 Updating indexes...')
    await redis.sadd('idx:username:sharafi_eth', 'user_sharafi_eth')
    await redis.sadd('idx:role:admin', 'user_sharafi_eth')
    await redis.sadd('idx:status:approved', 'user_sharafi_eth')
    await redis.sadd('users:approved', 'user_sharafi_eth')
    await redis.sadd('profiles:all', 'user_sharafi_eth')
    
    // Remove problematic entries
    await redis.srem('idx:username:sharafi_eth', 'twitter_sharafi_eth')
    await redis.srem('idx:role:admin', 'twitter_sharafi_eth')
    
    console.log('✅ All indexes updated')
    
    // Verify the fix
    const verifyProfile = await redis.json.get('user_sharafi_eth')
    console.log('\n✅ Profile verified:', JSON.stringify(verifyProfile, null, 2))
    
    console.log('\n🎉 Admin access restored!')
    console.log('You should now be able to access /admin')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
  }
}

restoreAdmin().catch(console.error) 