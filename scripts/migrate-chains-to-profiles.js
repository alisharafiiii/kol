require('dotenv').config({ path: '.env.local' })
const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

async function migrateChainsToProfiles() {
  try {
    console.log('Migrating chains data to profiles...\n')
    
    let migrated = 0
    let skipped = 0
    let errors = 0
    
    // First, migrate chains from old profiles to new profiles
    const userKeys = await redis.keys('user:*')
    console.log(`Found ${userKeys.length} user:* keys to check`)
    
    for (const key of userKeys) {
      try {
        const oldProfile = await redis.json.get(key)
        if (oldProfile && oldProfile.chains && oldProfile.chains.length > 0) {
          // Check if there's a corresponding new profile
          const profileKey = `profile:${oldProfile.id}`
          const newProfile = await redis.json.get(profileKey)
          
          if (newProfile) {
            // Update the new profile with chains data
            newProfile.activeChains = oldProfile.chains
            await redis.json.set(profileKey, '$', newProfile)
            migrated++
            console.log(`✓ Migrated chains for ${oldProfile.twitterHandle}: ${oldProfile.chains.join(', ')}`)
          }
        }
      } catch (error) {
        errors++
        console.log(`✗ Error with ${key}:`, error.message)
      }
    }
    
    // Also check profile:* keys that might not have activeChains
    const profileKeys = await redis.keys('profile:*')
    console.log(`\nChecking ${profileKeys.length} profile:* keys for missing activeChains`)
    
    for (const key of profileKeys) {
      try {
        const profile = await redis.json.get(key)
        if (profile && !profile.activeChains) {
          // Try to find corresponding old profile
          const userKey = `user:${profile.id.replace('user_', 'twitter_')}`
          const oldProfile = await redis.json.get(userKey)
          
          if (oldProfile && oldProfile.chains && oldProfile.chains.length > 0) {
            profile.activeChains = oldProfile.chains
            await redis.json.set(key, '$', profile)
            migrated++
            console.log(`✓ Added chains to ${profile.twitterHandle}: ${oldProfile.chains.join(', ')}`)
          } else {
            // Initialize with empty array if no chains found
            profile.activeChains = []
            await redis.json.set(key, '$', profile)
            skipped++
          }
        }
      } catch (error) {
        errors++
        console.log(`✗ Error with ${key}:`, error.message)
      }
    }
    
    console.log(`\nMigration Summary:`)
    console.log(`- Migrated: ${migrated} profiles`)
    console.log(`- Initialized empty: ${skipped} profiles`)
    console.log(`- Errors: ${errors} profiles`)
    
  } catch (error) {
    console.error('Error:', error)
  }
}

migrateChainsToProfiles()
