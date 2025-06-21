require('dotenv').config({ path: '.env.local' })
const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function forceProfileRefresh(handle) {
  try {
    const normalizedHandle = handle.toLowerCase().replace('@', '')
    console.log(`🔄 Force refreshing profile for @${normalizedHandle}...\n`)
    
    // Delete the new profile to force a re-migration
    const profileKey = `profile:user_${normalizedHandle}`
    console.log(`🗑️  Deleting ${profileKey}...`)
    await redis.del(profileKey)
    
    // Remove from profile index
    await redis.srem(`idx:profile:handle:${normalizedHandle}`, `user_${normalizedHandle}`)
    
    console.log('✅ Profile cache cleared!')
    console.log('\nThe next time this user accesses their profile, it will be re-migrated from the old system with all data preserved.')
    
  } catch (error) {
    console.error('Error:', error)
  }
}

// Get handle from command line
const handle = process.argv[2]
if (!handle) {
  console.log('Usage: node force-profile-refresh.js <twitter-handle>')
  process.exit(1)
}

forceProfileRefresh(handle) 