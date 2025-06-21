require('dotenv').config({ path: '.env.local' })
const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function checkDiscordLink() {
  console.log('🔍 Checking Discord link status...\n')
  
  // Check for any Discord verification sessions
  const keys = await redis.keys('discord:verify:*')
  console.log(`📍 Active verification sessions: ${keys.length}`)
  
  if (keys.length > 0) {
    for (const key of keys.slice(0, 5)) {
      const session = await redis.get(key)
      const ttl = await redis.ttl(key)
      console.log(`\n🔑 Session: ${key}`)
      console.log(`⏱️  Expires in: ${ttl} seconds`)
      console.log(`📝 Data:`, session)
    }
  }
  
  // Check for engagement connections
  const connections = await redis.keys('engagement:connection:*')
  console.log(`\n🔗 Total engagement connections: ${connections.length}`)
  
  if (connections.length > 0) {
    console.log('\nRecent connections:')
    for (const key of connections.slice(0, 3)) {
      const connection = await redis.json.get(key)
      console.log(`- Discord: ${connection.discordId} → Twitter: @${connection.twitterHandle}`)
    }
  }
  
  process.exit(0)
}

checkDiscordLink().catch(console.error) 