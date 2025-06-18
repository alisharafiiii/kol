const { Redis } = require('@upstash/redis')
require('dotenv').config({ path: '../.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function fixChannelMetadata() {
  // NABULINES project channels with their names
  const channels = [
    { id: '980162754365235300', name: '🧲〉share-your-stuff' },
    { id: '1382583759907459123', name: 'engagement-tracker' },
    { id: '984154482168434728', name: '💬〉general' }
  ]
  
  const projectId = 'project:discord:pype0pAxNMSU9k0LDSkF4'
  
  for (const channel of channels) {
    const channelKey = `channel:discord:${channel.id}`
    
    try {
      await redis.json.set(channelKey, '$', {
        id: channel.id,
        name: channel.name,
        type: 'text',
        projectId: projectId,
        updatedAt: new Date().toISOString()
      })
      
      console.log(`✅ Fixed metadata for #${channel.name} (${channel.id})`)
    } catch (error) {
      console.error(`❌ Error fixing channel ${channel.id}:`, error)
    }
  }
  
  console.log('\nDone! Channel metadata has been updated.')
}

fixChannelMetadata().catch(console.error) 