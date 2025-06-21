require('dotenv').config({ path: '.env.local' })
const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function testConnection() {
  const discordId = '918575895374082078' // alinabu
  
  console.log('🔍 Testing engagement connection for alinabu...\n')
  
  // Get the connection
  const connection = await redis.json.get(`engagement:connection:${discordId}`)
  
  if (connection) {
    console.log('✅ Connection found!')
    console.log('📊 Connection details:')
    console.log(`   Discord ID: ${connection.discordId}`)
    console.log(`   Twitter: @${connection.twitterHandle}`)
    console.log(`   Tier: ${connection.tier}`)
    console.log(`   Role: ${connection.role}`)
    console.log(`   Total Points: ${connection.totalPoints}`)
    console.log(`   Connected At: ${connection.connectedAt}`)
    
    // Check if the user profile exists
    const userIds = await redis.smembers(`idx:username:${connection.twitterHandle}`)
    if (userIds && userIds.length > 0) {
      const profile = await redis.json.get(userIds[0])
      console.log('\n📋 Profile details:')
      console.log(`   Approval Status: ${profile.approvalStatus}`)
      console.log(`   Role: ${profile.role}`)
      console.log(`   Tier: ${profile.tier}`)
    }
    
    console.log('\n✅ Your accounts are properly linked!')
    console.log('💡 You can use these commands:')
    console.log('   /stats - View your engagement stats')
    console.log('   /submit <tweet_url> - Submit a tweet for engagement')
    console.log('   /recent - View recent tweets')
    console.log('   /leaderboard - View the leaderboard')
  } else {
    console.log('❌ No connection found')
  }
  
  // Clean up expired sessions
  const sessions = await redis.keys('discord:verify:*')
  let cleaned = 0
  for (const key of sessions) {
    const ttl = await redis.ttl(key)
    if (ttl <= 0) {
      await redis.del(key)
      cleaned++
    }
  }
  console.log(`\n🧹 Cleaned up ${cleaned} expired sessions`)
  
  process.exit(0)
}

testConnection().catch(console.error) 