const { config } = require('dotenv')
const { Redis } = require('@upstash/redis')

// Load environment
config({ path: '.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

async function fixEngagementMetrics() {
  console.log('🔧 Fixing engagement metrics...\n')
  
  try {
    // 1. Migrate tweets from list to sorted set
    console.log('1️⃣ Migrating tweets from list to sorted set...')
    
    // Check if we have any tweets in the old list format
    const listTweets = await redis.lrange('engagement:tweets:recent', 0, -1)
    
    if (listTweets && listTweets.length > 0) {
      console.log(`   Found ${listTweets.length} tweets in old list format`)
      
      // Store tweets temporarily
      const tweetsToMigrate = []
      for (const tweetId of listTweets) {
        const tweet = await redis.json.get(`engagement:tweet:${tweetId}`)
        if (tweet) {
          tweetsToMigrate.push({ tweetId, timestamp: new Date(tweet.submittedAt).getTime() })
        }
      }
      
      // Delete the old list
      await redis.del('engagement:tweets:recent')
      console.log('   Deleted old list format')
      
      // Add tweets to sorted set
      for (const { tweetId, timestamp } of tweetsToMigrate) {
        await redis.zadd('engagement:tweets:recent', { score: timestamp, member: tweetId })
        console.log(`   ✅ Migrated tweet ${tweetId}`)
      }
      
      console.log('   ✅ Migration complete\n')
    } else {
      console.log('   No tweets to migrate\n')
    }
    
    // 2. Setup default point rules
    console.log('2️⃣ Setting up default point rules...')
    
    const defaultRules = [
      // Tier 1 (Basic)
      { tier: 1, interactionType: 'like', points: 10 },
      { tier: 1, interactionType: 'retweet', points: 20 },
      { tier: 1, interactionType: 'reply', points: 30 },
      
      // Tier 2 (Active)
      { tier: 2, interactionType: 'like', points: 15 },
      { tier: 2, interactionType: 'retweet', points: 30 },
      { tier: 2, interactionType: 'reply', points: 45 },
      
      // Tier 3 (Power User)
      { tier: 3, interactionType: 'like', points: 20 },
      { tier: 3, interactionType: 'retweet', points: 40 },
      { tier: 3, interactionType: 'reply', points: 60 }
    ]
    
    for (const rule of defaultRules) {
      const ruleData = {
        id: `${rule.tier}-${rule.interactionType}`,
        tier: rule.tier,
        interactionType: rule.interactionType,
        points: rule.points
      }
      
      await redis.json.set(`engagement:rules:${ruleData.id}`, '$', ruleData)
      console.log(`   ✅ Set rule: Tier ${rule.tier} ${rule.interactionType} = ${rule.points} points`)
    }
    
    console.log('   ✅ Point rules setup complete\n')
    
    // 3. Setup default tier scenarios
    console.log('3️⃣ Setting up default tier scenarios...')
    
    const defaultScenarios = {
      tier1: {
        dailyTweetLimit: 5,
        minFollowers: 100,
        bonusMultiplier: 1.0,
        categories: ['General', 'DeFi', 'NFT', 'Gaming', 'Infrastructure']
      },
      tier2: {
        dailyTweetLimit: 10,
        minFollowers: 500,
        bonusMultiplier: 1.5,
        categories: ['General', 'DeFi', 'NFT', 'Gaming', 'Infrastructure', 'Memecoins', 'AI']
      },
      tier3: {
        dailyTweetLimit: 20,
        minFollowers: 1000,
        bonusMultiplier: 2.0,
        categories: ['General', 'DeFi', 'NFT', 'Gaming', 'Infrastructure', 'Memecoins', 'AI', 'L2', 'Privacy']
      }
    }
    
    for (const [key, scenarios] of Object.entries(defaultScenarios)) {
      await redis.json.set(`engagement:scenarios:${key}`, '$', scenarios)
      console.log(`   ✅ Set ${key} scenarios`)
    }
    
    console.log('   ✅ Tier scenarios setup complete\n')
    
    // 4. Check current stats
    console.log('4️⃣ Current engagement stats:')
    
    // Count tweets
    const tweetCount = await redis.zcard('engagement:tweets:recent')
    console.log(`   📊 Total tweets: ${tweetCount}`)
    
    // Count connections
    const connectionKeys = await redis.keys('engagement:connection:*')
    console.log(`   👥 Connected users: ${connectionKeys.length}`)
    
    // Count rules
    const ruleKeys = await redis.keys('engagement:rules:*')
    console.log(`   📋 Point rules: ${ruleKeys.length}`)
    
    // Count batch jobs
    const batchCount = await redis.zcard('engagement:batches')
    console.log(`   🔄 Batch jobs: ${batchCount}`)
    
    console.log('\n✅ Engagement metrics fixed successfully!')
    
  } catch (error) {
    console.error('❌ Error fixing engagement metrics:', error)
  }
}

// Run the fix
fixEngagementMetrics() 