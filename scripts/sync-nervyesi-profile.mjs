#!/usr/bin/env node
import dotenv from 'dotenv';
import { Redis } from '@upstash/redis';

// Load environment variables
dotenv.config({ path: '.env.local' });

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

async function syncNervyesiProfile() {
  console.log('🔧 Syncing nervyesi profile between systems\n');
  
  try {
    // Get ProfileService data (the correct one)
    const profileServiceData = await redis.json.get('profile:user_nervyesi');
    
    if (!profileServiceData) {
      console.error('❌ ProfileService data not found for nervyesi!');
      return;
    }
    
    console.log('✅ ProfileService data:');
    console.log('   Role:', profileServiceData.role);
    console.log('   Status:', profileServiceData.approvalStatus);
    console.log('   Handle:', profileServiceData.twitterHandle);
    
    // Get old Redis data
    const oldRedisData = await redis.json.get('user:twitter_nervyesi');
    
    if (!oldRedisData) {
      console.error('❌ Old Redis data not found!');
      return;
    }
    
    console.log('\n❌ Old Redis data (incorrect):');
    console.log('   Role:', oldRedisData.role);
    console.log('   Status:', oldRedisData.approvalStatus);
    console.log('   Handle:', oldRedisData.twitterHandle);
    
    // Fix the old Redis data to match ProfileService
    console.log('\n🔧 Updating old Redis data...');
    
    const updatedData = {
      ...oldRedisData,
      role: profileServiceData.role,
      approvalStatus: profileServiceData.approvalStatus,
      updatedAt: new Date().toISOString()
    };
    
    await redis.json.set('user:twitter_nervyesi', '$', updatedData);
    
    // Verify the update
    const verifyData = await redis.json.get('user:twitter_nervyesi');
    console.log('\n✅ Updated Redis data:');
    console.log('   Role:', verifyData.role);
    console.log('   Status:', verifyData.approvalStatus);
    
    console.log('\n✅ Profile synchronized successfully!');
    console.log('nervyesi should now have full Core access.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

syncNervyesiProfile(); 