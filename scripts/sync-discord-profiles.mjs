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

console.log('🔧 Fixing Discord profiles that are missing user data...\n')

async function fixDiscordProfiles() {
  try {
    // Get all engagement connections
    const engagementKeys = await redis.keys('engagement:connection:*')
    console.log(`Found ${engagementKeys.length} engagement connections\n`)
    
    let fixedCount = 0
    let alreadyGoodCount = 0
    
    for (const key of engagementKeys) {
      const connection = await redis.json.get(key)
      if (!connection) continue
      
      const discordId = key.split(':').pop()
      const twitterHandle = connection.twitterHandle
      
      console.log(`\n📱 Checking @${twitterHandle} (Discord: ${discordId})`)
      
      // Check if user profile exists
      const userIds = await redis.smembers(`idx:username:${twitterHandle}`)
      
      if (!userIds || userIds.length === 0) {
        console.log(`  ❌ No user profile found for @${twitterHandle}`)
        
        // Create the user profile
        const userId = `user_${twitterHandle}`
        console.log(`  🔨 Creating user profile: ${userId}`)
        
        const newProfile = {
          id: userId,
          twitterHandle: `@${twitterHandle}`,
          name: twitterHandle,
          profileImageUrl: '',
          approvalStatus: 'pending',
          role: connection.role || 'user',
          tier: connection.tier || 'micro',
          isKOL: false,
          discordId: discordId,
          discordUsername: connection.discordUsername || twitterHandle,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          socialAccounts: {
            twitter: {
              handle: twitterHandle,
              connected: true
            },
            discord: {
              id: discordId,
              username: connection.discordUsername || twitterHandle,
              tag: connection.discordTag || connection.discordUsername || twitterHandle,
              connected: true
            }
          }
        }
        
        // Save to Redis
        await redis.json.set(userId, '$', newProfile)
        
        // Create username index
        await redis.sadd(`idx:username:${twitterHandle}`, userId)
        
        // Add to pending users set
        await redis.sadd('users:pending', userId)
        
        console.log(`  ✅ Created user profile with Discord info`)
        fixedCount++
        
      } else {
        // User exists, check if Discord info is complete
        const userId = userIds[0]
        const profile = await redis.json.get(userId)
        
        if (!profile) {
          console.log(`  ⚠️  User ID exists but profile is empty`)
          continue
        }
        
        const hasDiscordFields = profile.discordId && profile.discordUsername
        const hasDiscordInSocial = profile.socialAccounts?.discord?.connected
        
        if (hasDiscordFields && hasDiscordInSocial) {
          console.log(`  ✅ Profile already has complete Discord info`)
          alreadyGoodCount++
        } else {
          console.log(`  ⚠️  Profile missing Discord info:`)
          console.log(`     - Discord fields: ${hasDiscordFields ? '✅' : '❌'}`)
          console.log(`     - socialAccounts.discord: ${hasDiscordInSocial ? '✅' : '❌'}`)
          
          // Update the profile with Discord info
          const updatedProfile = {
            ...profile,
            discordId: discordId,
            discordUsername: connection.discordUsername || profile.discordUsername || twitterHandle,
            updatedAt: new Date().toISOString(),
            socialAccounts: {
              ...(profile.socialAccounts || {}),
              twitter: {
                ...(profile.socialAccounts?.twitter || {}),
                handle: twitterHandle,
                connected: true
              },
              discord: {
                id: discordId,
                username: connection.discordUsername || profile.discordUsername || twitterHandle,
                tag: connection.discordTag || connection.discordUsername || profile.discordUsername || twitterHandle,
                connected: true
              }
            }
          }
          
          await redis.json.set(userId, '$', updatedProfile)
          console.log(`  ✅ Updated profile with Discord info`)
          fixedCount++
        }
      }
    }
    
    console.log('\n\n📊 Summary:')
    console.log(`  Total engagement connections: ${engagementKeys.length}`)
    console.log(`  Profiles already complete: ${alreadyGoodCount}`)
    console.log(`  Profiles fixed/created: ${fixedCount}`)
    
  } catch (error) {
    console.error('Error fixing Discord profiles:', error)
  }
}

// Run the fix
fixDiscordProfiles() 