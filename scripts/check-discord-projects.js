#!/usr/bin/env node

const { config } = require('dotenv')
const { Redis } = require('@upstash/redis')

// Load environment variables
config({ path: '.env.local' })

async function checkDiscordProjects() {
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

    console.log('🔍 Checking Discord Projects Configuration\n')

    // Get all Discord projects
    const projectIds = await redis.smembers('discord:projects:all')
    console.log(`Found ${projectIds.length} Discord projects:\n`)

    for (const projectId of projectIds) {
      const project = await redis.json.get(projectId)
      if (project) {
        console.log(`📦 Project: ${project.name}`)
        console.log(`   ID: ${projectId}`)
        console.log(`   Server ID: ${project.serverId}`)
        console.log(`   Server Name: ${project.serverName}`)
        console.log(`   Active: ${project.isActive}`)
        console.log(`   Tracked Channels: ${project.trackedChannels?.length || 0}`)
        
        if (project.trackedChannels && project.trackedChannels.length > 0) {
          for (const channelId of project.trackedChannels) {
            const channelKey = `channel:discord:${channelId}`
            const channelData = await redis.json.get(channelKey)
            if (channelData) {
              console.log(`      - #${channelData.name} (${channelId})`)
            } else {
              console.log(`      - Channel ${channelId} (no metadata)`)
            }
          }
        }
        
        // Check message count for this project
        const messageSetKey = `discord:messages:project:${projectId}`
        const messageCount = await redis.scard(messageSetKey)
        console.log(`   Messages: ${messageCount}`)
        
        console.log()
      }
    }

  } catch (error) {
    console.error('Error:', error.message)
  }
}

checkDiscordProjects() 