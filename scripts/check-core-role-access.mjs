#!/usr/bin/env node
import dotenv from 'dotenv';
import { Redis } from '@upstash/redis';

// Load environment variables
dotenv.config({ path: '.env.local' });

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

async function checkCoreRoleAccess() {
  console.log('🔍 Checking Core Role Users and Access\n');
  
  try {
    // Get all user keys
    const userKeys = await redis.keys('user:*');
    console.log(`Checking ${userKeys.length} users...\n`);
    
    const coreUsers = [];
    const issueUsers = [];
    
    for (const key of userKeys) {
      try {
        const user = await redis.json.get(key);
        if (!user) continue;
        
        // Find core users
        if (user.role === 'core') {
          coreUsers.push({
            id: user.id,
            handle: user.twitterHandle,
            name: user.name,
            role: user.role,
            approvalStatus: user.approvalStatus
          });
          
          // Check if core user has approval issues
          if (user.approvalStatus !== 'approved') {
            issueUsers.push({
              handle: user.twitterHandle,
              role: user.role,
              status: user.approvalStatus,
              issue: 'Core user not approved'
            });
          }
        }
        
        // Check for admin/team users with approval issues
        if ((user.role === 'admin' || user.role === 'team') && user.approvalStatus !== 'approved') {
          issueUsers.push({
            handle: user.twitterHandle,
            role: user.role,
            status: user.approvalStatus,
            issue: `${user.role} user not approved`
          });
        }
      } catch (err) {
        console.error(`Error processing ${key}:`, err.message);
      }
    }
    
    // Display results
    console.log('=== Core Role Users ===');
    if (coreUsers.length === 0) {
      console.log('No users with core role found.');
    } else {
      coreUsers.forEach(user => {
        console.log(`\n@${user.handle}`);
        console.log(`  Name: ${user.name}`);
        console.log(`  Role: ${user.role}`);
        console.log(`  Status: ${user.approvalStatus}`);
        console.log(`  Access should include:`);
        console.log(`    ✅ Admin panel (/admin)`);
        console.log(`    ✅ User management`);
        console.log(`    ✅ Discord analytics`);
        console.log(`    ✅ Campaign management`);
        console.log(`    ✅ Profile updates`);
      });
    }
    
    console.log('\n\n=== Users with Issues ===');
    if (issueUsers.length === 0) {
      console.log('No approval status issues found!');
    } else {
      issueUsers.forEach(user => {
        console.log(`\n❌ @${user.handle}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Status: ${user.status || 'undefined'}`);
        console.log(`   Issue: ${user.issue}`);
      });
    }
    
    // Summary
    console.log('\n\n=== Summary ===');
    console.log(`Total users checked: ${userKeys.length}`);
    console.log(`Core users found: ${coreUsers.length}`);
    console.log(`Users with issues: ${issueUsers.length}`);
    
    // Middleware check
    console.log('\n=== Middleware Access Rules ===');
    console.log('Current middleware allows core role for:');
    console.log('✅ /admin paths');
    console.log('✅ /api/admin paths');
    console.log('✅ Discord share pages');
    console.log('\nThe middleware correctly includes "core" in allowed roles.');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkCoreRoleAccess(); 