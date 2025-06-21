import { Redis } from '@upstash/redis'
import { config } from 'dotenv'

config({ path: '.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function checkChannels() {
  console.log('🔍 Checking Discord Project Channel Configuration\n')
  
  try {
    // Get all Discord projects
    const projectKeys = await redis.keys('project:discord:*')
    console.log(`Found ${projectKeys.length} Discord projects\n`)
    
    for (const key of projectKeys) {
      const project = await redis.json.get(key)
      if (!project) continue
      
      console.log(`📌 Project: ${project.name}`)
      console.log(`   ID: ${project.id}`)
      console.log(`   Server ID: ${project.serverId}`)
      console.log(`   Server Name: ${project.serverName}`)
      console.log(`   Active: ${project.isActive}`)
      console.log(`   Tracked Channels: ${project.trackedChannels?.length || 0}`)
      
      if (project.trackedChannels && project.trackedChannels.length > 0) {
        console.log('   Channel IDs:')
        for (const channelId of project.trackedChannels) {
          console.log(`     - ${channelId}`)
        }
      }
      
      // Check recent messages
      const messageIds = await redis.smembers(`discord:messages:project:${project.id}`)
      console.log(`   Total Messages: ${messageIds.length}`)
      
      if (messageIds.length > 0) {
        // Get the most recent message
        const recentMsgId = messageIds[messageIds.length - 1]
        const recentMsg = await redis.json.get(recentMsgId)
        if (recentMsg) {
          console.log(`   Last Message: ${new Date(recentMsg.timestamp).toLocaleString()}`)
          console.log(`     Channel: #${recentMsg.channelName} (${recentMsg.channelId})`)
          console.log(`     Author: ${recentMsg.username}`)
        }
      }
      
      console.log('\n' + '-'.repeat(60) + '\n')
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

checkChannels() 