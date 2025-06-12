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
  } catch (error) {
    console.error('Failed to parse REDIS_URL:', error);
    process.exit(1);
  }
}

const redis = new Redis({
  url: upstashUrl,
  token: upstashToken
});

async function testAnalytics() {
  console.log('\n📊 Testing Analytics (All Time)\n');
  
  try {
    // Get first project
    const projectIds = await redis.smembers('discord:projects:all');
    if (projectIds.length === 0) {
      console.log('No projects found');
      return;
    }
    
    // Find project with messages
    let projectId = null;
    let messageCount = 0;
    
    for (const pid of projectIds) {
      const msgKeys = await redis.smembers(`discord:messages:project:${pid}`);
      if (msgKeys.length > 0) {
        projectId = pid;
        messageCount = msgKeys.length;
        break;
      }
    }
    
    // If no project has messages, check using pattern
    if (!projectId) {
      const allMsgKeys = await redis.keys('message:discord:*');
      if (allMsgKeys.length > 0) {
        // Extract project ID from first message
        const firstMsg = await redis.json.get(allMsgKeys[0]);
        projectId = firstMsg.projectId;
        messageCount = allMsgKeys.length;
      }
    }
    
    if (!projectId) {
      console.log('No messages found in any project');
      return;
    }
    
    console.log(`Project ID: ${projectId}`);
    console.log(`Total Messages: ${messageCount}`);
    
    // Get all messages for analytics
    const messageKeys = await redis.keys(`message:discord:${projectId}:*`);
    const messages = [];
    
    for (const key of messageKeys) {
      const msg = await redis.json.get(key);
      if (msg) messages.push(msg);
    }
    
    // Calculate analytics manually
    const userMap = new Map();
    const channelMap = new Map();
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    
    messages.forEach(msg => {
      // User stats
      if (!userMap.has(msg.userId)) {
        userMap.set(msg.userId, { username: msg.username, count: 0 });
      }
      userMap.get(msg.userId).count++;
      
      // Channel stats
      if (!channelMap.has(msg.channelId)) {
        channelMap.set(msg.channelId, { name: msg.channelName, count: 0 });
      }
      channelMap.get(msg.channelId).count++;
      
      // Sentiment
      if (msg.sentiment) {
        sentimentCounts[msg.sentiment.score]++;
      }
    });
    
    console.log('\n📈 Analytics Summary:');
    console.log(`- Unique Users: ${userMap.size}`);
    console.log(`- Active Channels: ${channelMap.size}`);
    console.log(`- Sentiment Breakdown:`);
    console.log(`  - Positive: ${sentimentCounts.positive}`);
    console.log(`  - Neutral: ${sentimentCounts.neutral}`);
    console.log(`  - Negative: ${sentimentCounts.negative}`);
    
    console.log('\n👥 Top Users:');
    const topUsers = Array.from(userMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 5);
    
    topUsers.forEach(([userId, data], index) => {
      console.log(`${index + 1}. @${data.username}: ${data.count} messages`);
    });
    
    console.log('\n📢 Channel Activity:');
    Array.from(channelMap.entries()).forEach(([channelId, data]) => {
      console.log(`- ${data.name}: ${data.count} messages`);
    });
    
    // Test the API endpoint
    console.log('\n🔗 Test these URLs in your browser (requires login):');
    console.log(`- Admin Panel: http://localhost:3000/admin/discord/${projectId} (admin/core only)`);
    console.log(`- Share Page: http://localhost:3000/discord/share/${projectId} (admin/core/team/viewer)`);
    console.log(`- API Test: http://localhost:3000/api/public/discord/${projectId}/analytics?timeframe=weekly`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

testAnalytics(); 