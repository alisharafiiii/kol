require('dotenv').config({ path: '.env.local' })
const { Redis } = require('@upstash/redis')

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function debugUserProfile(handle) {
  try {
    const normalizedHandle = handle.toLowerCase().replace('@', '')
    console.log(`🔍 Debugging ${normalizedHandle} profile...\n`)
    
    // Check old user system
    console.log('=== Checking old user system ===')
    const userIds = await redis.smembers(`idx:username:${normalizedHandle}`)
    console.log('User IDs found:', userIds)
    
    if (userIds && userIds.length > 0) {
      for (const userId of userIds) {
        const userData = await redis.json.get(userId)
        console.log(`\nUser data for ${userId}:`)
        console.log('  Name:', userData?.name)
        console.log('  Twitter Handle:', userData?.twitterHandle)
        console.log('  Approval Status:', userData?.approvalStatus)
        console.log('  Role:', userData?.role)
        console.log('  Discord ID:', userData?.discordId)
        console.log('  Discord Username:', userData?.discordUsername)
        console.log('  Social Accounts:', JSON.stringify(userData?.socialAccounts, null, 2))
      }
    }
    
    // Check new profile system
    console.log('\n=== Checking new profile system ===')
    const profileIds = await redis.smembers(`idx:profile:handle:${normalizedHandle}`)
    console.log('Profile IDs found:', profileIds)
    
    if (profileIds && profileIds.length > 0) {
      for (const profileId of profileIds) {
        const profileData = await redis.json.get(`profile:${profileId}`)
        console.log(`\nProfile data for profile:${profileId}:`)
        console.log('  Name:', profileData?.name)
        console.log('  Twitter Handle:', profileData?.twitterHandle)
        console.log('  Approval Status:', profileData?.approvalStatus)
        console.log('  Role:', profileData?.role)
        console.log('  Discord ID:', profileData?.discordId)
        console.log('  Discord Username:', profileData?.discordUsername)
        console.log('  Social Links:', JSON.stringify(profileData?.socialLinks, null, 2))
        console.log('  Social Accounts:', JSON.stringify(profileData?.socialAccounts, null, 2))
      }
    }
    
    // Check engagement connection
    console.log('\n=== Checking engagement connection ===')
    const discordId = await redis.get(`engagement:twitter:${normalizedHandle}`)
    console.log('Discord ID from engagement:', discordId)
    
    if (discordId) {
      const connection = await redis.json.get(`engagement:connection:${discordId}`)
      console.log('Engagement connection:', JSON.stringify(connection, null, 2))
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

// Get handle from command line
const handle = process.argv[2]
if (!handle) {
  console.log('Usage: node debug-user-profile.js <twitter-handle>')
  process.exit(1)
}

debugUserProfile(handle) 