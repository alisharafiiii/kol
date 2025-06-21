#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' })
const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function fixSharafiComplete() {
  console.log('🔧 Comprehensive fix for sharafi_eth...\n')
  
  try {
    // 1. Delete the null twitter_sharafi_eth
    console.log('1️⃣ Cleaning up null entries...')
    await redis.del('twitter_sharafi_eth')
    await redis.srem('idx:username:sharafi_eth', 'twitter_sharafi_eth')
    await redis.srem('idx:role:admin', 'twitter_sharafi_eth')
    
    // 2. Get the good profile data
    const goodProfile = await redis.json.get('user_sharafi_eth')
    console.log('✅ Found existing profile')
    
    // 3. Create the profile with ProfileService expected format
    const profileServiceId = 'profile:sharafi_eth'
    const profileData = {
      id: profileServiceId,
      twitterHandle: 'sharafi_eth', // No @ prefix for ProfileService
      name: 'sharafi_eth',
      profileImageUrl: goodProfile?.profileImageUrl || '',
      role: 'admin',
      approvalStatus: 'approved',
      isKOL: true,
      tier: 'hero',
      socialLinks: {
        twitter: 'https://twitter.com/sharafi_eth'
      },
      chains: ['Ethereum', 'Base'],
      tags: [],
      campaigns: [],
      notes: [],
      discordId: '918575895374082078',
      discordUsername: 'alinabu',
      socialAccounts: {
        twitter: { handle: 'sharafi_eth', connected: true },
        discord: { 
          id: '918575895374082078', 
          username: 'alinabu', 
          tag: 'alinabu',
          connected: true 
        }
      },
      createdAt: new Date('2025-06-20T19:31:57.949Z'),
      updatedAt: new Date(),
      lastLoginAt: new Date()
    }
    
    // Save for ProfileService
    console.log('\n2️⃣ Creating ProfileService compatible profile...')
    await redis.json.set(profileServiceId, '$', profileData)
    await redis.sadd('profiles:all', profileServiceId)
    await redis.sadd('profiles:sharafi_eth', profileServiceId)
    
    // 4. Update all indexes to include both formats
    console.log('\n3️⃣ Updating all indexes...')
    
    // Username indexes
    await redis.sadd('idx:username:sharafi_eth', 'user_sharafi_eth')
    await redis.sadd('idx:username:sharafi_eth', profileServiceId)
    
    // Role indexes
    await redis.sadd('idx:role:admin', 'user_sharafi_eth')
    await redis.sadd('idx:role:admin', profileServiceId)
    
    // Status indexes
    await redis.sadd('idx:status:approved', 'user_sharafi_eth')
    await redis.sadd('idx:status:approved', profileServiceId)
    
    // User sets
    await redis.sadd('users:approved', 'user_sharafi_eth')
    await redis.sadd('users:approved', profileServiceId)
    
    // 5. Ensure the auth lookup works
    console.log('\n4️⃣ Setting up auth lookup...')
    await redis.set('auth:twitter:sharafi_eth', 'user_sharafi_eth')
    
    // 6. Verify everything
    console.log('\n5️⃣ Verifying setup...')
    const verifyProfile = await redis.json.get(profileServiceId)
    console.log('ProfileService profile:', verifyProfile ? '✅ Created' : '❌ Failed')
    
    const authLookup = await redis.get('auth:twitter:sharafi_eth')
    console.log('Auth lookup:', authLookup ? '✅ Set' : '❌ Failed')
    
    const userIds = await redis.smembers('idx:username:sharafi_eth')
    console.log('Username index:', userIds)
    
    console.log('\n✅ Complete fix applied!')
    console.log('\nYou should now have:')
    console.log('  ✅ Admin panel access')
    console.log('  ✅ Campaign, Scout, Contest buttons visible')
    console.log('  ✅ Discord linked (alinabu)')
    console.log('  ✅ Admin role with hero tier')
    
    console.log('\n🔄 Please refresh your browser and try again.')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
    console.error(error.stack)
  }
}

fixSharafiComplete().catch(console.error) 