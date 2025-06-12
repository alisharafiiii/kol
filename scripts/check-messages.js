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

async function checkRecentMessages() {
  console.log('\n📊 Recent Discord Messages\n');
  
  const projectId = 'project:discord:0Hf4-2DxyzgHrqP0vdtXq'; // Your project ID
  
  try {
    // Get all message keys for this project
    const messageKeys = await redis.smembers(`discord:messages:project:${projectId}`);
    
    if (messageKeys.length === 0) {
      console.log('No messages found. Make sure to send some messages in your tracked Discord channel!');
      return;
    }
    
    console.log(`Found ${messageKeys.length} total messages\n`);
    console.log('Last 5 messages:\n');
    
    // Get last 5 messages
    const recentKeys = messageKeys.slice(-5);
    const messages = [];
    
    for (const key of recentKeys) {
      const message = await redis.json.get(key);
      if (message) {
        messages.push(message);
      }
    }
    
    // Sort by timestamp
    messages.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Display messages
    messages.forEach((msg, index) => {
      console.log(`📝 Message ${index + 1}:`);
      console.log(`   User: @${msg.username}`);
      console.log(`   Channel: ${msg.channelName}`);
      console.log(`   Content: "${msg.content}"`);
      console.log(`   Sentiment: ${msg.sentiment.score} (confidence: ${msg.sentiment.confidence})`);
      console.log(`   Time: ${new Date(msg.timestamp).toLocaleString()}`);
      console.log('');
    });
    
    // Calculate sentiment statistics
    const sentimentCounts = { positive: 0, neutral: 0, negative: 0 };
    const allMessages = [];
    
    for (const key of messageKeys) {
      const message = await redis.json.get(key);
      if (message && message.sentiment) {
        allMessages.push(message);
        sentimentCounts[message.sentiment.score]++;
      }
    }
    
    console.log('📊 Sentiment Statistics:');
    console.log(`   Positive: ${sentimentCounts.positive} (${(sentimentCounts.positive / allMessages.length * 100).toFixed(1)}%)`);
    console.log(`   Neutral: ${sentimentCounts.neutral} (${(sentimentCounts.neutral / allMessages.length * 100).toFixed(1)}%)`);
    console.log(`   Negative: ${sentimentCounts.negative} (${(sentimentCounts.negative / allMessages.length * 100).toFixed(1)}%)`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
  
  console.log('\n💡 Note: Currently using placeholder sentiment (all neutral).');
  console.log('   To enable real sentiment analysis, add your Gemini API key.');
  console.log('   See SENTIMENT_ANALYSIS_GUIDE.md for instructions.\n');
  
  process.exit(0);
}

checkRecentMessages(); 