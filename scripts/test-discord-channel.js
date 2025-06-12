#!/usr/bin/env node

const { Redis } = require('@upstash/redis');
require('dotenv').config({ path: '.env.local' });

// Parse REDIS_URL
let upstashUrl, upstashToken;
if (process.env.REDIS_URL) {
  try {
    const url = new URL(process.env.REDIS_URL);
    upstashToken = url.password;
    const host = url.hostname;
    upstashUrl = `https://${host}`;
    console.log('✅ Redis configuration loaded');
  } catch (error) {
    console.error('Failed to parse REDIS_URL:', error);
    process.exit(1);
  }
}

const redis = new Redis({
  url: upstashUrl,
  token: upstashToken
});

async function testDiscordProjects() {
  console.log('\n📊 Discord Projects Test\n');
  
  try {
    // Get all Discord projects
    const projectIds = await redis.smembers('discord:projects:all');
    console.log(`Found ${projectIds.length} Discord projects\n`);
    
    for (const projectId of projectIds) {
      const project = await redis.json.get(projectId);
      console.log(`📁 Project: ${project.name}`);
      console.log(`   ID: ${projectId}`);
      console.log(`   Server ID: ${project.serverId}`);
      console.log(`   Active: ${project.isActive}`);
      console.log(`   Tracked Channels: ${project.trackedChannels.length}`);
      
      if (project.trackedChannels.length > 0) {
        console.log('   Channel IDs:');
        for (const channelId of project.trackedChannels) {
          // Check for channel metadata
          const metadataKey = `channel:discord:${channelId}`;
          const metadata = await redis.json.get(metadataKey);
          
          if (metadata) {
            console.log(`     - ${channelId} (${metadata.name})`);
          } else {
            console.log(`     - ${channelId} (no metadata)`);
          }
        }
      }
      console.log('');
    }
    
    // Test stats
    console.log('📈 Testing project stats update...');
    if (projectIds.length > 0) {
      const testProjectId = projectIds[0];
      const project = await redis.json.get(testProjectId);
      
      // Update stats
      project.stats = {
        totalMessages: project.stats?.totalMessages || 0,
        totalUsers: project.stats?.totalUsers || 0,
        lastActivity: new Date().toISOString()
      };
      
      await redis.json.set(testProjectId, '$', project);
      console.log('✅ Stats updated successfully');
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

testDiscordProjects(); 