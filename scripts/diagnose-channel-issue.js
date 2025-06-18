const { Redis } = require('@upstash/redis')
require('dotenv').config({ path: '../.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function diagnoseChannelIssue() {
  const channelId = '1382583759907459123'
  const projectId = 'project:discord:pype0pAxNMSU9k0LDSkF4'
  
  console.log('🔍 Diagnosing channel issue for:', channelId)
  console.log('================================================\n')
  
  // 1. Check if channel metadata exists
  const channelKey = `channel:discord:${channelId}`
  const metadata = await redis.json.get(channelKey)
  console.log('1. Channel Metadata:', metadata || 'None')
  
  // 2. Check project info
  const project = await redis.json.get(projectId)
  console.log('\n2. Project Info:')
  console.log('   Name:', project.name)
  console.log('   Server ID:', project.serverId)
  console.log('   Server Name:', project.serverName)
  console.log('   Is channel tracked?', project.trackedChannels.includes(channelId))
  
  // 3. Check for any messages from this channel
  const messageKeys = await redis.keys(`message:discord:${projectId}:*`)
  let channelMessages = 0
  let sampleMessage = null
  
  for (const key of messageKeys) {
    const msg = await redis.json.get(key)
    if (msg && msg.channelId === channelId) {
      channelMessages++
      if (!sampleMessage) sampleMessage = msg
    }
  }
  
  console.log('\n3. Message Analysis:')
  console.log('   Messages from this channel:', channelMessages)
  if (sampleMessage) {
    console.log('   Sample message channel name:', sampleMessage.channelName)
  }
  
  // 4. Check all channel metadata
  console.log('\n4. All Channel Metadata in System:')
  const allChannelKeys = await redis.keys('channel:discord:*')
  for (const key of allChannelKeys) {
    const data = await redis.json.get(key)
    if (data) {
      console.log(`   ${data.id}: "${data.name}" (Project: ${data.projectId})`)
    }
  }
  
  console.log('\n================================================')
  console.log('📋 Summary:')
  console.log('- Channel ID:', channelId)
  console.log('- Has metadata:', !!metadata)
  console.log('- Metadata name:', metadata?.name || 'N/A')
  console.log('- Messages found:', channelMessages)
  console.log('- Real name from messages:', sampleMessage?.channelName || 'Unknown')
  
  console.log('\n💡 Likely Issues:')
  if (channelMessages === 0) {
    console.log('- No messages from this channel (bot may not have access)')
  }
  if (!metadata) {
    console.log('- No metadata stored (bot couldn\'t fetch channel info)')
  }
  if (metadata && sampleMessage && metadata.name !== sampleMessage.channelName) {
    console.log('- Metadata name doesn\'t match actual channel name')
  }
}

diagnoseChannelIssue().catch(console.error) 