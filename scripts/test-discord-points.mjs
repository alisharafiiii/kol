#!/usr/bin/env node
import dotenv from 'dotenv';
import { Redis } from '@upstash/redis';

// Load environment variables
dotenv.config({ path: '.env.local' });

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

async function testDiscordPoints() {
  console.log('🧪 Testing Discord Points Integration\n');
  
  try {
    // Check points configuration
    console.log('=== Points Configuration ===');
    const pointsConfig = await redis.json.get('points:config');
    
    if (!pointsConfig) {
      console.error('❌ No points configuration found!');
      console.log('Please configure points in the admin panel first.');
      return;
    }
    
    // Find Discord message action
    const discordAction = pointsConfig.actions.find(a => a.id === 'action_discord_msg');
    console.log('Discord Message Action:', discordAction || 'Not found');
    
    if (!discordAction) {
      console.error('❌ Discord Message action not configured!');
      return;
    }
    
    // Check Discord user mappings
    console.log('\n=== Discord User Mappings ===');
    const mappingKeys = await redis.keys('discord:user:map:*');
    console.log(`Found ${mappingKeys.length} Discord user mappings`);
    
    if (mappingKeys.length > 0) {
      console.log('\nSample mappings:');
      for (const key of mappingKeys.slice(0, 3)) {
        const platformUser = await redis.get(key);
        const discordId = key.replace('discord:user:map:', '');
        console.log(`- Discord ID ${discordId} → ${platformUser}`);
        
        // Check if user has points
        const userData = await redis.json.get(platformUser);
        if (userData) {
          console.log(`  Points: ${userData.points || 0}`);
          if (userData.pointsBreakdown) {
            console.log(`  Discord points: ${userData.pointsBreakdown.discord || 0}`);
          }
        }
      }
    }
    
    // Check recent Discord points transactions
    console.log('\n=== Recent Discord Points Transactions ===');
    const transactions = await redis.zrange('points:discord:transactions', -10, -1, { rev: true });
    
    if (transactions.length === 0) {
      console.log('No Discord points transactions found yet.');
    } else {
      console.log(`Last ${transactions.length} transactions:`);
      transactions.forEach((t, i) => {
        try {
          const transaction = JSON.parse(t);
          console.log(`\n${i + 1}. @${transaction.twitterHandle} (Discord: ${transaction.discordUsername})`);
          console.log(`   Points: ${transaction.points}`);
          console.log(`   Project: ${transaction.projectName}`);
          console.log(`   Time: ${new Date(transaction.timestamp).toLocaleString()}`);
        } catch (e) {
          console.log(`${i + 1}. Failed to parse transaction`);
        }
      });
    }
    
    // Check daily limits
    console.log('\n=== Daily Limits ===');
    const today = new Date().toISOString().split('T')[0];
    const dailyKeys = await redis.keys(`points:discord:daily:*:${today}`);
    console.log(`Users with Discord activity today: ${dailyKeys.length}`);
    
    if (dailyKeys.length > 0) {
      console.log('\nDaily message counts:');
      for (const key of dailyKeys.slice(0, 5)) {
        const count = await redis.get(key);
        const discordId = key.split(':')[3];
        console.log(`- Discord ID ${discordId}: ${count}/50 messages`);
      }
    }
    
    // Check leaderboard
    console.log('\n=== Points Leaderboard (Top 5) ===');
    const leaderboard = await redis.zrange('points:leaderboard:alltime', -5, -1, { 
      rev: true, 
      withScores: true 
    });
    
    if (leaderboard.length > 0) {
      for (let i = 0; i < leaderboard.length; i += 2) {
        const userId = leaderboard[i];
        const points = leaderboard[i + 1];
        
        const userData = await redis.json.get(`user:${userId}`);
        if (userData) {
          console.log(`${Math.floor(i/2) + 1}. @${userData.twitterHandle || userData.handle || 'unknown'}: ${points} points`);
          if (userData.pointsBreakdown?.discord) {
            console.log(`   Discord contribution: ${userData.pointsBreakdown.discord} points`);
          }
        }
      }
    }
    
    // Test API endpoint
    console.log('\n=== API Endpoint Test ===');
    console.log('API URL:', process.env.POINTS_API_URL || 'http://localhost:3000/api/discord/award-points');
    console.log('Bot API Key configured:', process.env.DISCORD_BOT_API_KEY ? 'Yes' : 'No (using default)');
    
  } catch (error) {
    console.error('Error during test:', error);
  }
}

testDiscordPoints(); 