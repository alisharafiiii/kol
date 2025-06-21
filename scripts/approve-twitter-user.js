const { config } = require('dotenv')
const { Redis } = require('@upstash/redis')
const path = require('path')

// Load environment
config({ path: path.join(__dirname, '..', '.env.local') })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function approveUser(twitterHandle) {
  try {
    const handle = twitterHandle.toLowerCase().replace('@', '')
    console.log(`🔍 Looking for user: @${handle}`)
    
    // Check if user exists
    const userIds = await redis.smembers(`idx:username:${handle}`)
    
    if (!userIds || userIds.length === 0) {
      console.log('❌ User not found in database')
      console.log('   They need to use /connect in Discord first to create a profile')
      return
    }
    
    const userId = userIds[0]
    const userData = await redis.json.get(userId)
    
    if (!userData) {
      console.log('❌ User data not found')
      return
    }
    
    console.log(`📋 Found user: ${userData.name} (@${handle})`)
    console.log(`   Current status: ${userData.approvalStatus}`)
    console.log(`   Role: ${userData.role || 'user'}`)
    
    // Update approval status - need to update the whole object
    userData.approvalStatus = 'approved'
    userData.updatedAt = new Date().toISOString()
    
    await redis.json.set(userId, '$', userData)
    
    // Also add to approved users set
    await redis.sadd('users:approved', userId)
    
    // Remove from pending if exists
    await redis.srem('users:pending', userId)
    
    console.log('✅ User approved successfully!')
    console.log('   They can now use /connect to link their Discord account')
    
  } catch (error) {
    console.error('Error approving user:', error)
  }
}

// Get handle from command line
const handle = process.argv[2]
if (!handle) {
  console.log('Usage: node approve-twitter-user.js <twitter_handle>')
  console.log('Example: node approve-twitter-user.js nabu')
  process.exit(1)
}

approveUser(handle) 