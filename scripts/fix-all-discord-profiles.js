require('dotenv').config({ path: '.env.local' })
const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function fixAllDiscordProfiles() {
  try {
    console.log('🔧 Fixing all profiles with missing Discord data...\n')
    
    let fixed = 0
    let errors = 0
    
    // Get all profile keys from new system
    const profileKeys = await redis.keys('profile:*')
    console.log(`Found ${profileKeys.length} profiles to check\n`)
    
    for (const profileKey of profileKeys) {
      try {
        const profile = await redis.json.get(profileKey)
        if (!profile || !profile.twitterHandle) continue
        
        const handle = profile.twitterHandle.toLowerCase().replace('@', '')
        
        // Check if this profile is missing Discord data
        if (!profile.socialAccounts?.discord && !profile.discordId) {
          // Look for old user data
          const userIds = await redis.smembers(`idx:username:${handle}`)
          
          let bestOldProfile = null
          let hasDiscord = false
          
          // Find the best old profile with Discord data
          for (const userId of userIds) {
            const oldProfile = await redis.json.get(userId)
            if (oldProfile && (oldProfile.discordId || oldProfile.socialAccounts?.discord)) {
              bestOldProfile = oldProfile
              hasDiscord = true
              break
            }
          }
          
          if (hasDiscord && bestOldProfile) {
            console.log(`\n📝 Fixing @${handle}`)
            console.log(`  Current status: ${profile.approvalStatus} -> ${bestOldProfile.approvalStatus}`)
            console.log(`  Adding Discord: ${bestOldProfile.discordUsername || bestOldProfile.socialAccounts?.discord?.username}`)
            
            // Update the profile with Discord data and correct approval status
            const updates = {
              ...profile,
              approvalStatus: bestOldProfile.approvalStatus || profile.approvalStatus,
              role: bestOldProfile.role || profile.role,
              discordId: bestOldProfile.discordId,
              discordUsername: bestOldProfile.discordUsername,
              socialAccounts: {
                ...(profile.socialAccounts || {}),
                ...(bestOldProfile.socialAccounts || {})
              },
              updatedAt: new Date().toISOString()
            }
            
            // Save the updated profile
            await redis.json.set(profileKey, '$', updates)
            fixed++
          }
        }
      } catch (error) {
        console.error(`Error processing ${profileKey}:`, error.message)
        errors++
      }
    }
    
    console.log('\n📊 Summary:')
    console.log(`  Profiles fixed: ${fixed}`)
    console.log(`  Errors: ${errors}`)
    
  } catch (error) {
    console.error('Fatal error:', error)
  }
}

// Run the fix
fixAllDiscordProfiles() 