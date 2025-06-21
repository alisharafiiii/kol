#!/usr/bin/env node

require('dotenv').config({ path: '.env.local' })
const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function fixSharafiProfile() {
  console.log('🔧 Fixing sharafi_eth profile...\n')
  
  try {
    // The new profile that was created
    const userId = 'user:IBTfzFIEGBqw9uUq0wpy3'
    const discordId = '918575895374082078'
    
    // Get the current profile
    const profile = await redis.json.get(userId)
    console.log('Current profile:', JSON.stringify(profile, null, 2))
    
    // Update to approved admin status
    const updatedProfile = {
      ...profile,
      approvalStatus: 'approved',
      role: 'admin',
      tier: 'hero',
      isKOL: true,
      updatedAt: new Date().toISOString(),
      adminNotes: 'Master admin - sharafi_eth'
    }
    
    console.log('\n📝 Updating profile to admin...')
    
    // Save the updated profile
    await redis.json.set(userId, '$', updatedProfile)
    
    // Update sets
    await redis.sadd('users:approved', userId)
    await redis.srem('users:pending', userId)
    await redis.sadd('idx:role:admin', userId)
    await redis.sadd('idx:status:approved', userId)
    
    // Update the engagement connection
    const connection = await redis.json.get(`engagement:connection:${discordId}`)
    if (connection) {
      const updatedConnection = {
        ...connection,
        role: 'admin',
        tier: 'hero'
      }
      await redis.json.set(`engagement:connection:${discordId}`, '$', updatedConnection)
      console.log('✅ Updated engagement connection')
    }
    
    // Clean up duplicate entries
    console.log('\n🧹 Cleaning up duplicate entries...')
    const userIds = await redis.smembers('idx:username:sharafi_eth')
    for (const id of userIds) {
      if (id !== userId && id !== 'user_sharafi_eth') {
        await redis.srem('idx:username:sharafi_eth', id)
        console.log(`  Removed duplicate index: ${id}`)
      }
    }
    
    console.log('\n✅ Profile fixed successfully!')
    console.log('\nUpdated profile:', JSON.stringify(updatedProfile, null, 2))
    
    console.log('\n📊 You now have:')
    console.log('  - Admin role')
    console.log('  - Hero tier')
    console.log('  - Approved status')
    console.log('  - Discord linked: alinabu')
    console.log('\nYou can now use all engagement bot features!')
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

fixSharafiProfile().catch(console.error) 