const { config } = require('dotenv')
const { Redis } = require('@upstash/redis')

// Load environment
config({ path: '.env.local' })

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

// Map numeric tiers to string tiers
const TIER_MAPPING = {
  3: 'star',    // Tier 3 -> star
  2: 'rising',  // Tier 2 -> rising
  1: 'micro',   // Tier 1 -> micro
}

async function unifyTierSystem() {
  console.log('🎯 Unifying Tier System to KOL Tiers (hero/legend/star/rising/micro) - V2\n')
  
  try {
    // 1. Update all InfluencerProfiles without tiers
    console.log('1️⃣ Updating InfluencerProfiles...')
    const userKeys = await redis.keys('user:*')
    let updatedProfiles = 0
    let profilesWithTiers = 0
    let errorCount = 0
    
    for (const key of userKeys) {
      try {
        const profile = await redis.json.get(key)
        if (profile) {
          // Check if profile already has a tier
          if (!profile.tier) {
            // Try to update the entire profile with tier added
            const updatedProfile = { ...profile, tier: 'micro' }
            await redis.json.set(key, '$', updatedProfile)
            updatedProfiles++
            console.log(`   ✅ Updated ${key} with tier: micro`)
          } else {
            profilesWithTiers++
          }
        }
      } catch (err) {
        errorCount++
        console.error(`   ⚠️ Error updating ${key}:`, err.message)
      }
    }
    
    console.log(`   ✅ Updated ${updatedProfiles} profiles with default 'micro' tier`)
    console.log(`   ℹ️ ${profilesWithTiers} profiles already had tiers`)
    console.log(`   ⚠️ ${errorCount} profiles had errors\n`)
    
    // 2. Convert engagement system numeric tiers to string tiers
    console.log('2️⃣ Converting Engagement System Tiers...')
    const connectionKeys = await redis.keys('engagement:connection:*')
    let convertedConnections = 0
    let connectionErrors = 0
    
    for (const key of connectionKeys) {
      try {
        const connection = await redis.json.get(key)
        if (connection && typeof connection.tier === 'number') {
          // Convert numeric tier to string tier
          const stringTier = TIER_MAPPING[connection.tier] || 'micro'
          const updatedConnection = { ...connection, tier: stringTier }
          await redis.json.set(key, '$', updatedConnection)
          convertedConnections++
          console.log(`   ✅ Converted ${connection.twitterHandle}: ${connection.tier} -> ${stringTier}`)
        } else if (connection && typeof connection.tier === 'string') {
          console.log(`   ℹ️ ${key} already has string tier: ${connection.tier}`)
        }
      } catch (err) {
        connectionErrors++
        console.error(`   ⚠️ Error converting ${key}:`, err.message)
      }
    }
    
    console.log(`   ✅ Converted ${convertedConnections} engagement connections`)
    console.log(`   ⚠️ ${connectionErrors} connections had errors\n`)
    
    // 3. Update tier scenarios to use string keys
    console.log('3️⃣ Updating Tier Scenarios...')
    
    const newScenarios = {
      'engagement:scenarios:micro': {
        dailyTweetLimit: 5,
        minFollowers: 100,
        bonusMultiplier: 1.0,
        categories: ['General', 'DeFi', 'NFT', 'Gaming', 'Infrastructure']
      },
      'engagement:scenarios:rising': {
        dailyTweetLimit: 10,
        minFollowers: 500,
        bonusMultiplier: 1.5,
        categories: ['General', 'DeFi', 'NFT', 'Gaming', 'Infrastructure', 'Memecoins', 'AI']
      },
      'engagement:scenarios:star': {
        dailyTweetLimit: 20,
        minFollowers: 1000,
        bonusMultiplier: 2.0,
        categories: ['General', 'DeFi', 'NFT', 'Gaming', 'Infrastructure', 'Memecoins', 'AI', 'L2', 'Privacy']
      },
      'engagement:scenarios:legend': {
        dailyTweetLimit: 30,
        minFollowers: 5000,
        bonusMultiplier: 2.5,
        categories: ['General', 'DeFi', 'NFT', 'Gaming', 'Infrastructure', 'Memecoins', 'AI', 'L2', 'Privacy', 'Special']
      },
      'engagement:scenarios:hero': {
        dailyTweetLimit: 50,
        minFollowers: 10000,
        bonusMultiplier: 3.0,
        categories: ['General', 'DeFi', 'NFT', 'Gaming', 'Infrastructure', 'Memecoins', 'AI', 'L2', 'Privacy', 'Special', 'VIP']
      }
    }
    
    // Delete old numeric tier scenarios
    await redis.del('engagement:scenarios:tier1')
    await redis.del('engagement:scenarios:tier2')
    await redis.del('engagement:scenarios:tier3')
    
    // Set new string tier scenarios
    for (const [key, scenarios] of Object.entries(newScenarios)) {
      await redis.json.set(key, '$', scenarios)
      console.log(`   ✅ Created ${key}`)
    }
    
    // 4. Update point rules to use string tiers
    console.log('\n4️⃣ Updating Point Rules...')
    
    // Delete old numeric rules
    const oldRuleKeys = await redis.keys('engagement:rules:*-*')
    for (const key of oldRuleKeys) {
      await redis.del(key)
    }
    
    const newRules = [
      // Micro tier
      { tier: 'micro', interactionType: 'like', points: 10 },
      { tier: 'micro', interactionType: 'retweet', points: 20 },
      { tier: 'micro', interactionType: 'reply', points: 30 },
      
      // Rising tier
      { tier: 'rising', interactionType: 'like', points: 15 },
      { tier: 'rising', interactionType: 'retweet', points: 30 },
      { tier: 'rising', interactionType: 'reply', points: 45 },
      
      // Star tier
      { tier: 'star', interactionType: 'like', points: 20 },
      { tier: 'star', interactionType: 'retweet', points: 40 },
      { tier: 'star', interactionType: 'reply', points: 60 },
      
      // Legend tier
      { tier: 'legend', interactionType: 'like', points: 25 },
      { tier: 'legend', interactionType: 'retweet', points: 50 },
      { tier: 'legend', interactionType: 'reply', points: 75 },
      
      // Hero tier
      { tier: 'hero', interactionType: 'like', points: 30 },
      { tier: 'hero', interactionType: 'retweet', points: 60 },
      { tier: 'hero', interactionType: 'reply', points: 90 },
    ]
    
    for (const rule of newRules) {
      const ruleData = {
        id: `${rule.tier}-${rule.interactionType}`,
        tier: rule.tier,
        interactionType: rule.interactionType,
        points: rule.points
      }
      
      await redis.json.set(`engagement:rules:${ruleData.id}`, '$', ruleData)
      console.log(`   ✅ Created rule: ${rule.tier} ${rule.interactionType} = ${rule.points} points`)
    }
    
    // 5. Check for profiles with special roles that might need higher tiers
    console.log('\n5️⃣ Checking Special Roles for Tier Upgrades...')
    let upgradedCount = 0
    
    for (const key of userKeys) {
      try {
        const profile = await redis.json.get(key)
        if (profile && profile.tier === 'micro') {
          // Upgrade based on role
          let newTier = 'micro'
          
          if (profile.role === 'admin') {
            newTier = 'hero'
          } else if (profile.role === 'core') {
            newTier = 'legend'
          } else if (profile.role === 'team') {
            newTier = 'star'
          } else if (profile.role === 'kol' && profile.followerCount) {
            // Upgrade KOLs based on follower count
            if (profile.followerCount >= 100000) {
              newTier = 'hero'
            } else if (profile.followerCount >= 50000) {
              newTier = 'legend'
            } else if (profile.followerCount >= 10000) {
              newTier = 'star'
            } else if (profile.followerCount >= 1000) {
              newTier = 'rising'
            }
          }
          
          if (newTier !== 'micro') {
            const updatedProfile = { ...profile, tier: newTier }
            await redis.json.set(key, '$', updatedProfile)
            console.log(`   ✅ Upgraded ${profile.name || profile.twitterHandle}: ${profile.role} -> ${newTier}`)
            upgradedCount++
          }
        }
      } catch (err) {
        console.error(`   ⚠️ Error checking ${key}:`, err.message)
      }
    }
    
    console.log(`   ✅ Upgraded ${upgradedCount} profiles based on role/followers\n`)
    
    // 6. Summary
    console.log('6️⃣ Summary:')
    console.log(`   📊 Total user profiles: ${userKeys.length}`)
    console.log(`   ✅ Profiles updated with default tier: ${updatedProfiles}`)
    console.log(`   🔄 Engagement connections converted: ${convertedConnections}`)
    console.log(`   ⬆️ Profiles upgraded based on role: ${upgradedCount}`)
    console.log(`   📋 Point rules created: ${newRules.length}`)
    console.log(`   🎯 Tier scenarios created: ${Object.keys(newScenarios).length}`)
    console.log(`   ⚠️ Total errors: ${errorCount + connectionErrors}`)
    
    console.log('\n✅ Tier system unification complete!')
    console.log('   All users now use the KOL tier system: hero/legend/star/rising/micro')
    
  } catch (error) {
    console.error('❌ Error unifying tier system:', error)
  }
}

// Run the unification
unifyTierSystem() 