import { Redis } from '@upstash/redis'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

// Get current directory (ES modules compatibility)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables
const envPath = join(__dirname, '..', '.env.local')
config({ path: envPath })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function processDiscordPoints() {
  console.log('🎯 Discord Points Processor Started')
  
  while (true) {
    try {
      // Get a point award request from the queue
      const request = await redis.rpop('points:queue:discord')
      
      if (!request) {
        // No requests in queue, wait a bit
        await new Promise(resolve => setTimeout(resolve, 5000))
        continue
      }
      
      const data = JSON.parse(request)
      console.log(`Processing points for ${data.discordUsername}...`)
      
      // Import PointsService dynamically to handle ES modules
      const { PointsService } = await import('../lib/services/points-service.js')
      
      // Award the points
      const profile = await PointsService.awardPoints(
        data.userId,
        data.points,
        'discord',
        data.description,
        {
          discordUserId: data.discordUserId,
          discordUsername: data.discordUsername,
          sentiment: data.sentiment,
          projectId: data.projectId
        }
      )
      
      if (profile) {
        console.log(`✅ Awarded ${data.points} points to ${data.discordUsername} (Total: ${profile.points})`)
      } else {
        console.log(`❌ Failed to award points to ${data.discordUsername}`)
      }
      
    } catch (error) {
      console.error('Error processing points:', error)
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, 5000))
    }
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down points processor...')
  process.exit(0)
})

// Start processing
processDiscordPoints().catch(console.error) 