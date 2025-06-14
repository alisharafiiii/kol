const { config } = require('dotenv')
const { Redis } = require('@upstash/redis')
const { TwitterApi } = require('twitter-api-v2')
const { nanoid } = require('nanoid')

// Load environment variables
config({ path: '.env.local' })

// Initialize Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

// Initialize Twitter API
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
})

const readOnlyClient = twitterClient.readOnly

// Process batch job
async function processBatch() {
  console.log('🔄 Starting batch processing...')
  
  // Create batch job
  const batchId = nanoid()
  const batchJob = {
    id: batchId,
    startedAt: new Date(),
    status: 'running',
    tweetsProcessed: 0,
    engagementsFound: 0
  }
  
  await redis.json.set(`engagement:batch:${batchId}`, '$', batchJob)
  await redis.zadd('engagement:batches', { score: Date.now(), member: batchId })
  
  try {
    // Get recent tweets from last 24 hours (stored as sorted set)
    const cutoff = Date.now() - (24 * 60 * 60 * 1000)
    const tweetIds = await redis.zrange('engagement:tweets:recent', cutoff, '+inf', { byScore: true })
    
    console.log(`📊 Found ${tweetIds.length} tweets from last 24 hours to process`)
    
    let tweetsProcessed = 0
    let engagementsFound = 0
    
    for (const tweetId of tweetIds) {
      try {
        const tweet = await redis.json.get(`engagement:tweet:${tweetId}`)
        if (!tweet) continue
        
        console.log(`Processing tweet ${tweet.tweetId}...`)
        
        // Get tweet metrics and engagements from Twitter API
        const tweetData = await readOnlyClient.v2.singleTweet(tweet.tweetId, {
          'tweet.fields': ['public_metrics', 'author_id'],
          expansions: ['author_id']
        })
        
        if (!tweetData.data) {
          console.log(`Tweet ${tweet.tweetId} not found`)
          continue
        }
        
        // Update tweet metrics
        const metrics = tweetData.data.public_metrics
        await redis.json.set(`engagement:tweet:${tweetId}`, '$.metrics', {
          likes: metrics.like_count,
          retweets: metrics.retweet_count,
          replies: metrics.reply_count
        })
        
        // Get users who liked the tweet
        const likers = await readOnlyClient.v2.tweetLikedBy(tweet.tweetId, {
          max_results: 100,
          'user.fields': ['username']
        })
        
        for await (const liker of likers) {
          const connection = await redis.get(`engagement:twitter:${liker.username.toLowerCase()}`)
          if (connection) {
            // User is connected, award points
            const userConnection = await redis.json.get(`engagement:connection:${connection}`)
            if (userConnection) {
              const pointRule = await redis.json.get(`engagement:rules:${userConnection.tier}-like`)
              const basePoints = pointRule?.points || 1
              
              // Get tier scenarios for bonus multiplier
              const scenarios = await redis.json.get(`engagement:scenarios:tier${userConnection.tier}`)
              const bonusMultiplier = scenarios?.bonusMultiplier || 1.0
              const points = Math.round(basePoints * bonusMultiplier)
              
              // Check if already logged
              const existingLog = await redis.get(`engagement:interaction:${tweet.tweetId}:${connection}:like`)
              if (!existingLog) {
                // Log engagement
                const logId = nanoid()
                const log = {
                  id: logId,
                  tweetId: tweet.tweetId,
                  userDiscordId: connection,
                  interactionType: 'like',
                  points,
                  timestamp: new Date(),
                  batchId,
                  bonusMultiplier
                }
                
                await redis.json.set(`engagement:log:${logId}`, '$', log)
                await redis.zadd(`engagement:user:${connection}:logs`, { score: Date.now(), member: logId })
                await redis.zadd(`engagement:tweet:${tweet.tweetId}:logs`, { score: Date.now(), member: logId })
                await redis.set(`engagement:interaction:${tweet.tweetId}:${connection}:like`, logId)
                
                // Update user points
                await redis.json.numincrby(`engagement:connection:${connection}`, '$.totalPoints', points)
                
                engagementsFound++
                console.log(`✅ Awarded ${points} points to ${liker.username} for liking (x${bonusMultiplier} bonus)`)
              }
            }
          }
        }
        
        // Get users who retweeted
        const retweeters = await readOnlyClient.v2.tweetRetweetedBy(tweet.tweetId, {
          max_results: 100,
          'user.fields': ['username']
        })
        
        for await (const retweeter of retweeters) {
          const connection = await redis.get(`engagement:twitter:${retweeter.username.toLowerCase()}`)
          if (connection) {
            const userConnection = await redis.json.get(`engagement:connection:${connection}`)
            if (userConnection) {
              const pointRule = await redis.json.get(`engagement:rules:${userConnection.tier}-retweet`)
              const basePoints = pointRule?.points || 2
              
              // Get tier scenarios for bonus multiplier
              const scenarios = await redis.json.get(`engagement:scenarios:tier${userConnection.tier}`)
              const bonusMultiplier = scenarios?.bonusMultiplier || 1.0
              const points = Math.round(basePoints * bonusMultiplier)
              
              const existingLog = await redis.get(`engagement:interaction:${tweet.tweetId}:${connection}:retweet`)
              if (!existingLog) {
                const logId = nanoid()
                const log = {
                  id: logId,
                  tweetId: tweet.tweetId,
                  userDiscordId: connection,
                  interactionType: 'retweet',
                  points,
                  timestamp: new Date(),
                  batchId,
                  bonusMultiplier
                }
                
                await redis.json.set(`engagement:log:${logId}`, '$', log)
                await redis.zadd(`engagement:user:${connection}:logs`, { score: Date.now(), member: logId })
                await redis.zadd(`engagement:tweet:${tweet.tweetId}:logs`, { score: Date.now(), member: logId })
                await redis.set(`engagement:interaction:${tweet.tweetId}:${connection}:retweet`, logId)
                
                await redis.json.numincrby(`engagement:connection:${connection}`, '$.totalPoints', points)
                
                engagementsFound++
                console.log(`✅ Awarded ${points} points to ${retweeter.username} for retweeting (x${bonusMultiplier} bonus)`)
              }
            }
          }
        }
        
        tweetsProcessed++
        
      } catch (error) {
        console.error(`Error processing tweet ${tweetId}:`, error)
      }
    }
    
    // Update batch job
    await redis.json.set(`engagement:batch:${batchId}`, '$', {
      ...batchJob,
      completedAt: new Date(),
      status: 'completed',
      tweetsProcessed,
      engagementsFound
    })
    
    console.log(`✅ Batch processing completed: ${tweetsProcessed} tweets, ${engagementsFound} engagements`)
    
  } catch (error) {
    console.error('Batch processing error:', error)
    
    // Update batch job with error
    await redis.json.set(`engagement:batch:${batchId}`, '$.status', 'failed')
    await redis.json.set(`engagement:batch:${batchId}`, '$.error', error.message)
  }
}

// Run immediately if called directly
if (require.main === module) {
  processBatch()
    .then(() => process.exit(0))
    .catch(error => {
      console.error(error)
      process.exit(1)
    })
}

module.exports = { processBatch } 