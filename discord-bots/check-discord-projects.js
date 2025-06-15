import { Redis } from '@upstash/redis'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Get current directory
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
const envPath = join(__dirname, '..', '.env.local')
config({ path: envPath })

// Initialize Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function checkDiscordProjects() {
  console.log('🔍 Checking Discord Projects...\n')
  
  try {
    // Get all Discord project keys
    const projectKeys = await redis.keys('project:discord:*')
    console.log(`Found ${projectKeys.length} Discord project keys\n`)
    
    if (projectKeys.length === 0) {
      console.log('❌ No Discord projects found!')
      console.log('\n📝 To fix this:')
      console.log('1. Go to http://localhost:3000/admin/discord')
      console.log('2. Click "Add Server"')
      console.log('3. Fill in:')
      console.log('   - Project Name: Any name you want')
      console.log('   - Server ID: Your Discord server ID')
      console.log('   - Server Name: Your Discord server name')
      console.log('   - Scout Project: Select from dropdown')
      console.log('4. After creating, click on the project')
      console.log('5. In Settings, add channel IDs to track')
      process.exit(0)
    }
    
    // Check each project
    for (const key of projectKeys) {
      const project = await redis.json.get(key)
      console.log(`📌 Project: ${project.name}`)
      console.log(`   ID: ${project.id}`)
      console.log(`   Server: ${project.serverName} (${project.serverId})`)
      console.log(`   Active: ${project.isActive ? '✅' : '❌'}`)
      console.log(`   Tracked Channels: ${project.trackedChannels?.length || 0}`)
      
      if (project.trackedChannels && project.trackedChannels.length > 0) {
        console.log('   Channel IDs:')
        project.trackedChannels.forEach(channelId => {
          console.log(`     - ${channelId}`)
        })
      } else {
        console.log('   ⚠️  No channels being tracked!')
      }
      console.log('')
    }
    
    // Check for any stored messages
    const messageKeys = await redis.keys('message:discord:*')
    console.log(`\n📊 Total Discord messages stored: ${messageKeys.length}`)
    
    if (messageKeys.length > 0) {
      // Get last 5 messages
      const recentMessages = messageKeys.slice(-5)
      console.log('\n📝 Recent messages:')
      for (const msgKey of recentMessages) {
        const msg = await redis.json.get(msgKey)
        if (msg) {
          console.log(`   - ${msg.username} in #${msg.channelName}: "${msg.content.substring(0, 50)}..."`)
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message)
  }
}

checkDiscordProjects() 