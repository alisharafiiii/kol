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

async function fixChannelName() {
  console.log('\n🔧 Fixing Channel Metadata\n');
  
  const channelId = '980162754365235300';
  const channelName = '🧲〉share-your-stuff';
  const projectId = 'project:discord:HHh1-fO8KD3ntGKATSYGS';
  
  try {
    // Store channel metadata
    const channelKey = `channel:discord:${channelId}`;
    await redis.json.set(channelKey, '$', {
      channelId: channelId,
      projectId: projectId,
      name: channelName,
      updatedAt: new Date().toISOString()
    });
    
    console.log(`✅ Channel metadata saved:`);
    console.log(`   Channel ID: ${channelId}`);
    console.log(`   Channel Name: ${channelName}`);
    console.log(`   Project ID: ${projectId}`);
    
    // Verify it was saved
    const metadata = await redis.json.get(channelKey);
    console.log('\n📊 Verification:');
    console.log(metadata);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  process.exit(0);
}

fixChannelName(); 