import { Redis } from '@upstash/redis'
import dotenv from 'dotenv'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

console.log('🔍 Checking engagement connections and user approval status...\n')

async function checkEngagementStatus() {
  try {
    // Get all engagement connections
    const engagementKeys = await redis.keys('engagement:connection:*')
    console.log(`Found ${engagementKeys.length} engagement connections:\n`)
    
    for (const key of engagementKeys) {
      const connection = await redis.json.get(key)
      if (!connection) continue
      
      const discordId = key.split(':').pop()
      console.log(`Discord User: ${discordId}`)
      console.log(`Twitter: @${connection.twitterHandle}`)
      console.log(`Tier: ${connection.tier || 'Not set'}`)
      console.log(`Role: ${connection.role || 'Not set'}`)
      
      // Check if user profile exists and is approved
      const userIds = await redis.smembers(`idx:username:${connection.twitterHandle}`)
      if (userIds && userIds.length > 0) {
        const profile = await redis.json.get(userIds[0])
        if (profile) {
          console.log(`✅ User profile found: ${userIds[0]}`)
          console.log(`   Approval Status: ${profile.approvalStatus}`)
          console.log(`   Role in profile: ${profile.role}`)
          console.log(`   Has Discord fields: ${profile.discordId ? 'Yes' : 'No'}`)
        } else {
          console.log(`❌ User profile ${userIds[0]} exists but is empty!`)
        }
      } else {
        console.log(`❌ No user profile found for @${connection.twitterHandle}`)
      }
      
      // Check tier scenarios
      const tier = connection.tier || 'micro'
      const scenarios = await redis.json.get(`engagement:scenarios:${tier}`)
      if (scenarios) {
        console.log(`📋 Tier scenarios for ${tier}:`)
        console.log(`   Daily limit: ${scenarios.dailyTweetLimit}`)
        console.log(`   Categories: ${scenarios.categories?.join(', ')}`)
      } else {
        console.log(`⚠️  No custom scenarios for tier ${tier}, will use defaults`)
      }
      
      console.log('\n---\n')
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

checkEngagementStatus() 