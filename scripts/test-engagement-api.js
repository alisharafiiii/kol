const { config } = require('dotenv')
const { Redis } = require('@upstash/redis')

// Load environment
config({ path: '.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function testEngagementAPI() {
  console.log('🔍 Testing Engagement API Data...\n')
  
  try {
    // 1. Check tweets in sorted set
    console.log('1️⃣ Checking tweets in sorted set:')
    const tweetCount = await redis.zcard('engagement:tweets:recent')
    console.log(`   Total tweets in sorted set: ${tweetCount}`)
    
    // Get recent tweet IDs
    const recentTweetIds = await redis.zrange('engagement:tweets:recent', 0, 4, { rev: true })
    console.log(`   Recent tweet IDs: ${recentTweetIds.join(', ')}`)
    
    // 2. Check if tweets have data
    console.log('\n2️⃣ Checking tweet data:')
    for (const tweetId of recentTweetIds.slice(0, 2)) {
      const tweet = await redis.json.get(`engagement:tweet:${tweetId}`)
      console.log(`   Tweet ${tweetId}:`)
      console.log(`     - Author: @${tweet?.authorHandle}`)
      console.log(`     - URL: ${tweet?.url}`)
      console.log(`     - Submitted: ${tweet?.submittedAt}`)
    }
    
    // 3. Check how EngagementService would fetch them
    console.log('\n3️⃣ Testing EngagementService.getRecentTweets logic:')
    const hours = 24
    const cutoff = Date.now() - (hours * 60 * 60 * 1000)
    const tweetIds = await redis.zrange('engagement:tweets:recent', cutoff, '+inf', { byScore: true })
    console.log(`   Tweets from last ${hours} hours: ${tweetIds.length}`)
    console.log(`   IDs: ${tweetIds.join(', ')}`)
    
    // 4. Check connections
    console.log('\n4️⃣ Checking connections:')
    const connectionKeys = await redis.keys('engagement:connection:*')
    console.log(`   Total connections: ${connectionKeys.length}`)
    
    // 5. Check rules
    console.log('\n5️⃣ Checking rules:')
    const ruleKeys = await redis.keys('engagement:rules:*')
    console.log(`   Total rules: ${ruleKeys.length}`)
    if (ruleKeys.length > 0) {
      const firstRule = await redis.json.get(ruleKeys[0])
      console.log(`   Sample rule: Tier ${firstRule?.tier} ${firstRule?.interactionType} = ${firstRule?.points} points`)
    }
    
    // 6. Check tier scenarios
    console.log('\n6️⃣ Checking tier scenarios:')
    const tier1 = await redis.json.get('engagement:scenarios:tier1')
    if (tier1) {
      console.log(`   Tier 1 scenarios found:`)
      console.log(`     - Daily limit: ${tier1.dailyTweetLimit}`)
      console.log(`     - Multiplier: ${tier1.bonusMultiplier}x`)
    }
    
    console.log('\n✅ API data check complete!')
    
  } catch (error) {
    console.error('❌ Error testing API:', error)
  }
}

// Run the test
testEngagementAPI() 