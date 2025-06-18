#!/usr/bin/env node

import { Redis } from '@upstash/redis'
import { config } from 'dotenv'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

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

async function testSentimentSettings() {
  console.log('🧪 Testing Discord Sentiment Settings\n')
  
  // Find a Discord project
  const projectKeys = await redis.keys('project:discord:*')
  if (projectKeys.length === 0) {
    console.log('❌ No Discord projects found')
    return
  }
  
  const projectKey = projectKeys[0]
  const project = await redis.json.get(projectKey)
  console.log(`📊 Using project: ${project.name} (${project.id})\n`)
  
  // Set test sentiment settings
  const testSettings = {
    bullishKeywords: 'moon, pump, bullish, amazing, great',
    bearishKeywords: 'dump, crash, bearish, terrible, scam',
    bullishEmojis: '🚀, 🌙, 💎, 🔥, ✨',
    bearishEmojis: '📉, 💩, 🔴, ⬇️, 😢',
    ignoredChannels: [],
    minimumMessageLength: 3,
    updatedAt: new Date().toISOString(),
    updatedBy: 'test-script'
  }
  
  const settingsKey = `discord:sentiment:${project.id}`
  console.log('💾 Saving test sentiment settings...')
  await redis.json.set(settingsKey, '$', testSettings)
  
  // Also set reload flag
  await redis.set(`discord:sentiment:reload:${project.id}`, '1', { ex: 60 })
  
  console.log('✅ Settings saved successfully!\n')
  
  // Retrieve and display settings
  const savedSettings = await redis.json.get(settingsKey)
  console.log('📖 Saved settings:')
  console.log(JSON.stringify(savedSettings, null, 2))
  
  console.log('\n✨ The analytics bot will reload these settings within 30 seconds')
  console.log('📝 Test messages:')
  console.log('  - Bullish: "This is amazing! 🚀 To the moon!"')
  console.log('  - Bearish: "This is a scam, it\'s going to dump 📉"')
  console.log('  - Neutral: "The meeting is at 3pm today"')
}

testSentimentSettings().catch(console.error) 