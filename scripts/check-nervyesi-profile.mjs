#!/usr/bin/env node
import dotenv from 'dotenv';
import { Redis } from '@upstash/redis';

// Load environment variables
dotenv.config({ path: '.env.local' });

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

async function checkNervyesiProfile() {
  console.log('🔍 Checking nervyesi profile and access\n');
  
  try {
    // Search for nervyesi in different ways
    console.log('=== Searching for nervyesi ===');
    
    // Method 1: Direct username search
    const userIds1 = await redis.smembers('idx:username:nervyesi');
    console.log('Username index search:', userIds1);
    
    // Method 2: Search all users
    const userKeys = await redis.keys('user:*');
    let foundUsers = [];
    
    for (const key of userKeys) {
      try {
        const user = await redis.json.get(key);
        if (user && (
          user.twitterHandle?.toLowerCase() === 'nervyesi' ||
          user.twitterHandle?.toLowerCase() === '@nervyesi' ||
          user.name?.toLowerCase()?.includes('nervyesi')
        )) {
          foundUsers.push({ key, user });
        }
      } catch (err) {
        // Skip
      }
    }
    
    console.log(`\nFound ${foundUsers.length} users matching 'nervyesi'`);
    
    if (foundUsers.length === 0) {
      console.log('❌ User nervyesi not found in the system!');
      console.log('\nThis could be why they have access issues - they may not be properly registered.');
      return;
    }
    
    // Display all found profiles
    for (const { key, user } of foundUsers) {
      console.log(`\n=== Profile: ${key} ===`);
      console.log('Handle:', user.twitterHandle);
      console.log('Name:', user.name);
      console.log('Role:', user.role);
      console.log('Approval Status:', user.approvalStatus);
      console.log('Created:', user.createdAt);
      console.log('Updated:', user.updatedAt);
      
      // Check profile service too
      const profileKeys = await redis.keys(`profile:*nervyesi*`);
      console.log('\nProfileService keys:', profileKeys);
      
      for (const pKey of profileKeys) {
        try {
          const profile = await redis.json.get(pKey);
          console.log(`\nProfileService ${pKey}:`, {
            role: profile?.role,
            approvalStatus: profile?.approvalStatus
          });
        } catch (err) {
          console.log(`Error reading ${pKey}:`, err.message);
        }
      }
    }
    
    // Check if there might be case sensitivity issues
    console.log('\n=== Checking case variations ===');
    const variations = ['nervyesi', 'Nervyesi', 'NERVYESI', '@nervyesi'];
    for (const variation of variations) {
      const ids = await redis.smembers(`idx:username:${variation}`);
      if (ids.length > 0) {
        console.log(`Found with variation "${variation}":`, ids);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkNervyesiProfile(); 