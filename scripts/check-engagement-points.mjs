import dotenv from 'dotenv'
import { Redis } from '@upstash/redis'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// Load environment variables
dotenv.config({ path: path.join(__dirname, '..', '.env.local') })

// Initialize Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

console.log("Checking Engagement Points System\n")

// Get all engagement connections
const connections = await redis.keys('engagement:connection:*')
console.log(`Total connected users: ${connections.length}`)

if (connections.length > 0) {
  console.log('\n--- Connected Users with Points ---')
  for (const connKey of connections.slice(0, 10)) { // Show first 10
    const connection = await redis.json.get(connKey)
    if (connection) {
      console.log(`\n${connection.twitterHandle || 'Unknown'}:`)
      console.log(`- Discord: ${connection.discordUsername} (${connection.discordId})`)
      console.log(`- Tier: ${connection.tier}`)
      console.log(`- Total Points: ${connection.totalPoints || 0}`)
      console.log(`- Connected: ${new Date(connection.connectedAt).toLocaleString()}`)
    }
  }
}

// Check recent engagement logs
console.log('\n--- Recent Engagement Awards ---')
const logs = await redis.keys('engagement:log:*')
console.log(`Total engagement logs: ${logs.length}`)

if (logs.length > 0) {
  for (const logKey of logs.slice(-5)) { // Last 5 logs
    const log = await redis.json.get(logKey)
    if (log) {
      // Get the user info
      const connection = await redis.json.get(`engagement:connection:${log.userDiscordId}`)
      console.log(`\n${new Date(log.timestamp).toLocaleString()}:`)
      console.log(`- User: ${connection?.twitterHandle || 'Unknown'} (@${connection?.discordUsername})`)
      console.log(`- Action: ${log.interactionType} (${log.points} points)`)
      console.log(`- Tweet: ${log.tweetId}`)
      if (log.bonusMultiplier > 1) {
        console.log(`- Bonus: ${log.bonusMultiplier}x multiplier applied`)
      }
    }
  }
}

// Check recent tweets
console.log('\n--- Recent Submitted Tweets ---')
const recentTweets = await redis.zrange('engagement:tweets:recent', -5, -1, { withScores: true })
console.log(`Recent tweets: ${recentTweets.length}`)

for (const tweet of recentTweets) {
  const tweetData = await redis.json.get(`engagement:tweet:${tweet.member}`)
  if (tweetData) {
    console.log(`\n${new Date(tweet.score).toLocaleString()}:`)
    console.log(`- Tweet ID: ${tweetData.tweetId}`)
    console.log(`- URL: ${tweetData.tweetUrl}`)
    console.log(`- Submitted by: @${tweetData.discordUsername}`)
    if (tweetData.metrics) {
      console.log(`- Metrics: ${tweetData.metrics.likes} likes, ${tweetData.metrics.retweets} retweets`)
    }
  }
}

console.log('\n--- How Long Does It Take? ---')
console.log('1. Tweet submission: Instant (via Discord /submit command)')
console.log('2. Engagement checking: ')
console.log('   - Manual: Run "node discord-bots/engagement-batch-processor.js"')
console.log('   - Automatic: Every 30 minutes if cron is set up')
console.log('3. Points awarding: Immediate when engagement is detected')
console.log('4. Points visibility: ')
console.log('   - In Discord: Use engagement bot commands')
console.log('   - In Admin Panel: Points should show in user profiles')

console.log('\n--- To Run Manual Check Now ---')
console.log('Run: node discord-bots/engagement-batch-processor.js') 