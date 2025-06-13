#!/usr/bin/env node

const { config } = require('dotenv')

// Load environment variables
config({ path: '.env.local' })

async function testAnalyticsAPI() {
  const projects = [
    { id: 'project:discord:GEpk5t8yZkQzaWYDHDZHS', name: 'Ledger' },
    { id: 'project:discord:jo9Eju5jcr_DVmG0Q_MTC', name: 'Ametaverse' }
  ]
  
  console.log('🧪 Testing Analytics API for Both Projects\n')
  
  for (const project of projects) {
    console.log(`\n📦 Project: ${project.name}`)
    console.log(`ID: ${project.id}`)
    
    // Test different timeframes
    const timeframes = ['daily', 'weekly', 'monthly', 'allTime']
    
    for (const timeframe of timeframes) {
      try {
        // Test as if we're the API (no auth needed for internal testing)
        const { DiscordService } = require('../lib/services/discord-service')
        const analytics = await DiscordService.getAnalytics(project.id, timeframe)
        
        console.log(`\n   ${timeframe}:`)
        console.log(`     Total Messages: ${analytics.metrics.totalMessages}`)
        console.log(`     Unique Users: ${analytics.metrics.uniqueUsers}`)
        console.log(`     Date Range: ${new Date(analytics.startDate).toLocaleDateString()} - ${new Date(analytics.endDate).toLocaleDateString()}`)
        
      } catch (error) {
        console.log(`   ${timeframe}: Error - ${error.message}`)
      }
    }
    
    console.log('\n' + '-'.repeat(60))
  }
}

// Need to compile TypeScript, so let's just check the raw data
async function checkRawData() {
  const { Redis } = require('@upstash/redis')
  
  // Parse Redis URL to get the required parts
  const redisUrl = process.env.REDIS_URL
  const matches = redisUrl.match(/redis:\/\/default:(.*)@(.*)\.upstash\.io:6379/)
  
  let redis
  if (matches) {
    const token = matches[1]
    const host = matches[2]
    redis = new Redis({
      url: `https://${host}.upstash.io`,
      token: token
    })
  }
  
  console.log('\n📊 Direct Redis Check:')
  
  const projects = [
    { id: 'project:discord:GEpk5t8yZkQzaWYDHDZHS', name: 'Ledger' },
    { id: 'project:discord:jo9Eju5jcr_DVmG0Q_MTC', name: 'Ametaverse' }
  ]
  
  for (const project of projects) {
    const messageCount = await redis.scard(`discord:messages:project:${project.id}`)
    const userCount = await redis.scard(`discord:users:project:${project.id}`)
    
    console.log(`\n${project.name}:`)
    console.log(`  Messages: ${messageCount}`)
    console.log(`  Users: ${userCount}`)
  }
}

checkRawData().catch(console.error) 