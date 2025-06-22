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

console.log('🔍 Checking Discord connections in user profiles...\n')

async function checkDiscordConnections() {
  try {
    // 1. Check engagement connections
    const engagementKeys = await redis.keys('engagement:connection:*')
    console.log(`Found ${engagementKeys.length} engagement connections\n`)
    
    // 2. Check all user profiles for Discord data
    const userKeys = await redis.keys('user*')
    console.log(`Found ${userKeys.length} user profiles\n`)
    
    let usersWithDiscord = 0
    let usersWithSocialDiscord = 0
    let discordConnections = []
    let errorCount = 0
    
    for (const key of userKeys) {
      try {
        const profile = await redis.json.get(key)
        if (!profile) continue
        
        // Check if user has Discord fields
        const hasDiscordFields = profile.discordId || profile.discordUsername
        
        // Check if user has Discord in socialAccounts
        const hasDiscordInSocial = profile.socialAccounts?.discord?.connected
        
        if (hasDiscordFields || hasDiscordInSocial) {
          const handle = profile.twitterHandle || profile.handle || 'Unknown'
          
          console.log(`\n📱 User: ${handle}`)
          console.log(`  ID: ${key}`)
          
          if (hasDiscordFields) {
            usersWithDiscord++
            console.log(`  ✅ Discord fields found:`)
            console.log(`     - discordId: ${profile.discordId || 'Not set'}`)
            console.log(`     - discordUsername: ${profile.discordUsername || 'Not set'}`)
          }
          
          if (hasDiscordInSocial) {
            usersWithSocialDiscord++
            console.log(`  ✅ Discord in socialAccounts:`)
            console.log(`     - ${JSON.stringify(profile.socialAccounts.discord, null, 2)}`)
          }
          
          if (!hasDiscordInSocial && hasDiscordFields) {
            console.log(`  ⚠️  Discord fields exist but NOT in socialAccounts!`)
          }
          
          discordConnections.push({
            userId: key,
            handle,
            hasDiscordFields,
            hasDiscordInSocial,
            discordId: profile.discordId,
            discordUsername: profile.discordUsername,
            socialDiscord: profile.socialAccounts?.discord
          })
        }
      } catch (error) {
        // Skip keys that aren't JSON objects (might be old string keys)
        errorCount++
        console.log(`  ⚠️  Skipping ${key} - not a JSON object`)
      }
    }
    
    // 3. Check engagement connections and cross-reference
    console.log('\n\n🔗 Checking engagement connections...')
    for (const key of engagementKeys) {
      try {
        const connection = await redis.json.get(key)
        if (!connection) continue
        
        const discordId = key.split(':').pop()
        console.log(`\n  Discord ID: ${discordId}`)
        console.log(`  Twitter: @${connection.twitterHandle}`)
        console.log(`  Connected: ${connection.connectedAt}`)
        
        // Find corresponding user profile
        const userIds = await redis.smembers(`idx:username:${connection.twitterHandle}`)
        if (userIds && userIds.length > 0) {
          try {
            const profile = await redis.json.get(userIds[0])
            if (profile) {
              const hasDiscord = profile.discordId || profile.socialAccounts?.discord
              console.log(`  User profile found: ${hasDiscord ? '✅ Has Discord' : '❌ Missing Discord'}`)
              
              if (!hasDiscord) {
                console.log(`  ❗ This user needs Discord info added to their profile!`)
              }
            }
          } catch (err) {
            console.log(`  ⚠️  Could not check user profile`)
          }
        } else {
          console.log(`  ❌ No user profile found for @${connection.twitterHandle}`)
        }
      } catch (error) {
        console.log(`  ⚠️  Error checking ${key}`)
      }
    }
    
    // Summary
    console.log('\n\n📊 Summary:')
    console.log(`  Total user keys found: ${userKeys.length}`)
    console.log(`  Keys that were not JSON objects: ${errorCount}`)
    console.log(`  Valid profiles checked: ${userKeys.length - errorCount}`)
    console.log(`  Users with Discord fields: ${usersWithDiscord}`)
    console.log(`  Users with Discord in socialAccounts: ${usersWithSocialDiscord}`)
    console.log(`  Users with Discord fields but NOT in socialAccounts: ${usersWithDiscord - usersWithSocialDiscord}`)
    console.log(`  Total engagement connections: ${engagementKeys.length}`)
    
    return discordConnections
    
  } catch (error) {
    console.error('Error checking Discord connections:', error)
  }
}

// Run the check
checkDiscordConnections() 