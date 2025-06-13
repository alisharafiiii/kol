#!/usr/bin/env node

const { config } = require('dotenv')
const { Redis } = require('@upstash/redis')

// Load environment variables
config({ path: '.env.local' })

async function checkProjectIds() {
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

    console.log('✅ Redis configuration loaded\n')

    // Get all message keys
    const messageKeys = await redis.keys('message:discord:*')
    console.log(`Found ${messageKeys.length} message keys\n`)

    // Extract project IDs
    const projectIds = new Set()
    messageKeys.forEach(key => {
      const parts = key.split(':')
      if (parts.length >= 3) {
        projectIds.add(parts[2])
      }
    })

    console.log('📦 Project IDs found in messages:')
    projectIds.forEach(id => console.log(`   - ${id}`))

    // Get all Discord projects
    console.log('\n📋 Discord projects in system:')
    const projectKeys = await redis.smembers('discord:projects:all')
    for (const projectKey of projectKeys) {
      const project = await redis.json.get(projectKey)
      if (project) {
        console.log(`   - ${project.id} (${project.name})`)
      }
    }

    // Check for tracked channels
    console.log('\n📡 Checking channel configurations:')
    const channelKeys = await redis.keys('channels:scan:*')
    console.log(`Found ${channelKeys.length} channel configurations`)
    
    for (const key of channelKeys) {
      const projectId = await redis.get(key)
      console.log(`   Channel ${key.split(':')[2]} → Project ${projectId}`)
    }

  } catch (error) {
    console.error('Error:', error.message)
  }
}

checkProjectIds() 