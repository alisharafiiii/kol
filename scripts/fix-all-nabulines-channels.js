const { Redis } = require('@upstash/redis')
require('dotenv').config({ path: '../.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function fixAllNabulinesChannels() {
  const projectId = 'project:discord:pype0pAxNMSU9k0LDSkF4'
  
  console.log('🔧 Fixing all NABULINES channel metadata...\n')
  
  // Get project info
  const project = await redis.json.get(projectId)
  console.log('Project:', project.name)
  console.log('Tracked channels:', project.trackedChannels.length)
  console.log('')
  
  // For each tracked channel, find its real name from messages
  for (const channelId of project.trackedChannels) {
    console.log(`\nChecking channel ${channelId}...`)
    
    // Check existing metadata
    const channelKey = `channel:discord:${channelId}`
    const existingMetadata = await redis.json.get(channelKey)
    
    // Find real name from messages
    const messageKeys = await redis.keys(`message:discord:${projectId}:*`)
    let realChannelName = null
    let messageCount = 0
    
    for (const key of messageKeys) {
      const msg = await redis.json.get(key)
      if (msg && msg.channelId === channelId) {
        messageCount++
        if (!realChannelName && msg.channelName) {
          realChannelName = msg.channelName
        }
      }
    }
    
    console.log(`  Current metadata name: ${existingMetadata?.name || 'None'}`)
    console.log(`  Real name from messages: ${realChannelName || 'Unknown'}`)
    console.log(`  Message count: ${messageCount}`)
    
    // Update metadata if we found the real name
    if (realChannelName) {
      await redis.json.set(channelKey, '$', {
        id: channelId,
        name: realChannelName,
        type: 'text',
        projectId: projectId,
        updatedAt: new Date().toISOString()
      })
      console.log(`  ✅ Updated metadata to: "${realChannelName}"`)
    } else if (!existingMetadata) {
      console.log(`  ⚠️  No messages found and no metadata exists`)
    }
  }
  
  console.log('\n✅ Channel metadata fix complete!')
  
  // Show final state
  console.log('\nFinal channel configuration:')
  for (const channelId of project.trackedChannels) {
    const metadata = await redis.json.get(`channel:discord:${channelId}`)
    console.log(`  - ${metadata?.name || `Channel ${channelId}`} (${channelId})`)
  }
}

fixAllNabulinesChannels().catch(console.error) 