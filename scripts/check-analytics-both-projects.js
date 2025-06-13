#!/usr/bin/env node

const { config } = require('dotenv')
const { Redis } = require('@upstash/redis')

// Load environment variables
config({ path: '.env.local' })

async function checkAnalytics() {
  try {
    // Parse Redis URL to get the required parts
    const redisUrl = process.env.REDIS_URL || process.env.UPSTASH_REDIS_REST_URL
    const matches = redisUrl.match(/redis:\/\/default:(.*)@(.*)\.upstash\.io:6379/)
    
    let redis
    if (matches) {
      // Convert redis:// URL to REST API format
      const token = matches[1]
      const host = matches[2]
      redis = new Redis({
        url: `https://${host}.upstash.io`,
        token: token
      })
    } else {
      // Use as-is if already in correct format
      redis = new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN
      })
    }

    console.log('📊 Checking Analytics for All Discord Projects\n')
    console.log('📅 Current system date:', new Date().toString())
    console.log()

    const projects = [
      { id: 'project:discord:GEpk5t8yZkQzaWYDHDZHS', name: 'Ledger (NABU LINES)' },
      { id: 'project:discord:jo9Eju5jcr_DVmG0Q_MTC', name: 'Ametaverse' }
    ]

    for (const project of projects) {
      console.log(`\n🔍 Project: ${project.name}`)
      console.log(`   ID: ${project.id}`)
      
      // Get message keys and check dates
      const messageSetKey = `discord:messages:project:${project.id}`
      const messageIds = await redis.smembers(messageSetKey)
      console.log(`   Total messages in Redis: ${messageIds.length}`)
      
      if (messageIds.length > 0) {
        // Sample first few messages to check dates
        console.log('\n   📝 Sample message timestamps:')
        for (let i = 0; i < Math.min(3, messageIds.length); i++) {
          const message = await redis.json.get(messageIds[i])
          if (message) {
            const date = new Date(message.timestamp)
            console.log(`      - ${date.toLocaleString()} - "${message.content.substring(0, 30)}..."`)
          }
        }
        
        // Calculate date ranges
        const now = new Date()
        const daily = new Date(now)
        daily.setDate(daily.getDate() - 1)
        
        const weekly = new Date(now)
        weekly.setDate(weekly.getDate() - 7)
        
        const monthly = new Date(now)
        monthly.setMonth(monthly.getMonth() - 1)
        
        console.log('\n   📈 Messages in different timeframes:')
        
        let dailyCount = 0, weeklyCount = 0, monthlyCount = 0
        
        for (const messageId of messageIds) {
          const message = await redis.json.get(messageId)
          if (message && message.timestamp) {
            const msgDate = new Date(message.timestamp)
            
            if (msgDate >= daily) dailyCount++
            if (msgDate >= weekly) weeklyCount++
            if (msgDate >= monthly) monthlyCount++
          }
        }
        
        console.log(`      Daily (last 24h): ${dailyCount}`)
        console.log(`      Weekly (last 7d): ${weeklyCount}`)
        console.log(`      Monthly (last 30d): ${monthlyCount}`)
        console.log(`      All time: ${messageIds.length}`)
        
        // Check users
        const userSetKey = `discord:users:project:${project.id}`
        const userCount = await redis.scard(userSetKey)
        console.log(`\n   👥 Unique users: ${userCount}`)
      }
      
      console.log('\n' + '-'.repeat(60))
    }

  } catch (error) {
    console.error('Error:', error.message)
  }
}

checkAnalytics() 