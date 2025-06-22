#!/usr/bin/env node
import dotenv from 'dotenv';
import { Redis } from '@upstash/redis';

dotenv.config({ path: '.env.local' });

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

const handle = process.argv[2];

if (!handle) {
  console.log('Usage: node scripts/approve-user.mjs <handle>');
  console.log('Example: node scripts/approve-user.mjs nervyesi');
  process.exit(1);
}

async function approveUser(handle) {
  const normalizedHandle = handle.toLowerCase().replace('@', '');
  console.log(`\n🔄 Approving user: ${normalizedHandle}\n`);
  
  let updated = false;
  
  // Check ProfileService
  const profileKey = `profile:user_${normalizedHandle}`;
  const profile = await redis.json.get(profileKey);
  
  if (profile) {
    console.log('Found in ProfileService:');
    console.log(`  Current status: ${profile.approvalStatus}`);
    console.log(`  Role: ${profile.role}`);
    
    if (profile.approvalStatus !== 'approved') {
      profile.approvalStatus = 'approved';
      profile.approvedAt = new Date().toISOString();
      profile.updatedAt = new Date().toISOString();
      
      await redis.json.set(profileKey, '$', profile);
      console.log('  ✅ Updated to approved!');
      updated = true;
    } else {
      console.log('  Already approved!');
    }
  }
  
  // Check legacy Redis
  const userIds = await redis.smembers(`idx:username:${normalizedHandle}`);
  
  if (userIds && userIds.length > 0) {
    for (const userId of userIds) {
      const user = await redis.json.get(`user:${userId}`);
      
      if (user) {
        console.log(`\nFound in legacy Redis (${userId}):`);
        console.log(`  Current status: ${user.approvalStatus}`);
        console.log(`  Role: ${user.role}`);
        
        if (user.approvalStatus !== 'approved') {
          user.approvalStatus = 'approved';
          user.approvedAt = new Date().toISOString();
          user.updatedAt = new Date().toISOString();
          
          await redis.json.set(`user:${userId}`, '$', user);
          console.log('  ✅ Updated to approved!');
          updated = true;
        } else {
          console.log('  Already approved!');
        }
      }
    }
  }
  
  if (!profile && (!userIds || userIds.length === 0)) {
    console.log('❌ User not found in any system!');
    console.log('\nMake sure the handle is correct. Try:');
    console.log('- Without @ symbol');
    console.log('- Exact Twitter handle');
    return;
  }
  
  if (updated) {
    // Set session invalidation flag
    const invalidationKey = `auth:invalidate:${normalizedHandle}`;
    await redis.set(invalidationKey, Date.now(), { ex: 86400 });
    
    console.log('\n✅ User approved successfully!');
    console.log('\n📋 Next steps for the user:');
    console.log('1. Log out completely');
    console.log('2. Log back in with Twitter');
    console.log('3. They should now have access to campaigns');
  } else {
    console.log('\n✅ User was already approved!');
  }
}

approveUser(handle).catch(console.error); 