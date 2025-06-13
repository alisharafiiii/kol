#!/usr/bin/env node

const { config } = require('dotenv')

// Load environment variables
config({ path: '.env.local' })

async function testAnalyticsAPI() {
  const projectId = 'project:discord:GEpk5t8yZkQzaWYDHDZHS'
  
  console.log('🧪 Testing Analytics API directly...\n')
  
  // Test different timeframes
  const timeframes = ['daily', 'weekly', 'monthly', 'allTime']
  
  for (const timeframe of timeframes) {
    try {
      console.log(`\n📊 Testing ${timeframe}:`)
      
      // Get session cookie from your browser (you'll need to add this)
      // For testing, we'll use a direct approach
      const response = await fetch(`http://localhost:3000/api/discord/projects/${encodeURIComponent(projectId)}/analytics?timeframe=${timeframe}`, {
        headers: {
          'Cookie': process.env.SESSION_COOKIE || '' // You can add your session cookie here for testing
        }
      })
      
      console.log(`   Status: ${response.status} ${response.statusText}`)
      
      if (response.ok) {
        const data = await response.json()
        if (data.analytics) {
          console.log(`   Total Messages: ${data.analytics.metrics.totalMessages}`)
          console.log(`   Unique Users: ${data.analytics.metrics.uniqueUsers}`)
          console.log(`   Date Range: ${new Date(data.analytics.startDate).toLocaleDateString()} - ${new Date(data.analytics.endDate).toLocaleDateString()}`)
        } else {
          console.log('   No analytics data returned')
        }
      } else {
        const error = await response.text()
        console.log(`   Error: ${error}`)
      }
    } catch (error) {
      console.log(`   Failed: ${error.message}`)
    }
  }
  
  // Also test the raw service
  console.log('\n\n🔧 Testing DiscordService directly:')
  const { DiscordService } = require('../lib/services/discord-service')
  const { redis } = require('../lib/redis')
  
  try {
    // Test if Redis is working
    const testKey = await redis.get('test')
    console.log('   Redis connection: ✅')
    
    const allTimeAnalytics = await DiscordService.getAnalytics(projectId, 'allTime')
    console.log(`   All Time Messages: ${allTimeAnalytics.metrics.totalMessages}`)
    console.log(`   Date Range: ${new Date(allTimeAnalytics.startDate).toLocaleDateString()} - ${new Date(allTimeAnalytics.endDate).toLocaleDateString()}`)
    
    // Check a specific date range
    const now = new Date()
    const weekAgo = new Date(now)
    weekAgo.setDate(weekAgo.getDate() - 7)
    
    const weeklyAnalytics = await DiscordService.getAnalytics(projectId, 'weekly')
    console.log(`\n   Weekly Messages: ${weeklyAnalytics.metrics.totalMessages}`)
    console.log(`   Weekly Date Range: ${new Date(weeklyAnalytics.startDate).toLocaleDateString()} - ${new Date(weeklyAnalytics.endDate).toLocaleDateString()}`)
    
  } catch (error) {
    console.log(`   Service Error: ${error.message}`)
  }
}

testAnalyticsAPI() 