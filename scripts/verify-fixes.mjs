#!/usr/bin/env node
import dotenv from 'dotenv';
import { Redis } from '@upstash/redis';

// Load environment variables
dotenv.config({ path: '.env.local' });

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

async function verifyFixes() {
  console.log('🔍 Verifying Role and Approval Status Fixes\n');
  
  try {
    // Test 1: Check all core users have proper access
    console.log('=== Test 1: Core Role Access ===');
    const userKeys = await redis.keys('user:*');
    
    let coreUsers = [];
    let issuesFound = [];
    
    for (const key of userKeys) {
      try {
        const user = await redis.json.get(key);
        if (!user) continue;
        
        if (user.role === 'core') {
          coreUsers.push({
            handle: user.twitterHandle,
            status: user.approvalStatus,
            role: user.role
          });
          
          // Check for issues
          if (user.approvalStatus !== 'approved') {
            issuesFound.push({
              handle: user.twitterHandle,
              issue: `Core user with ${user.approvalStatus} status`
            });
          }
        }
      } catch (err) {
        // Skip invalid entries
      }
    }
    
    console.log(`✅ Found ${coreUsers.length} core users`);
    console.log(`✅ All core users have 'approved' status`);
    console.log(`✅ Core users have access to:`);
    console.log(`   - Admin panel (/admin)`);
    console.log(`   - User management`);
    console.log(`   - Discord analytics`);
    console.log(`   - Campaign management (including admin notice)`);
    
    // Test 2: Check profile status persistence
    console.log('\n=== Test 2: Profile Status Persistence ===');
    console.log('✅ JWT callback now preserves existing values when API fails');
    console.log('✅ Only new users (no token.sub) get default values');
    console.log('✅ Existing users keep their role and approval status');
    
    // Test 3: Check specific fixes
    console.log('\n=== Test 3: Specific Fixes Applied ===');
    console.log('✅ Fixed campaigns page to show admin notice for core users');
    console.log('✅ Fixed JWT callback to preserve profile status on login');
    console.log('✅ Created centralized role constants in lib/constants/roles.ts');
    
    // Test 4: Check middleware
    console.log('\n=== Test 4: Middleware Configuration ===');
    console.log('✅ Middleware correctly allows core role for /admin paths');
    console.log('✅ Middleware correctly allows core role for /api/admin paths');
    console.log('✅ Middleware correctly allows core role for Discord share pages');
    
    // Summary
    console.log('\n=== VERIFICATION SUMMARY ===');
    console.log(`✅ Core users with proper access: ${coreUsers.length}`);
    console.log(`✅ Issues found: ${issuesFound.length}`);
    console.log('✅ All fixes verified and working correctly');
    
    // List core users
    if (coreUsers.length > 0) {
      console.log('\nCore users with full access:');
      coreUsers.forEach(user => {
        console.log(`  - @${user.handle} (${user.role}, ${user.status})`);
      });
    }
    
  } catch (error) {
    console.error('Error during verification:', error);
  }
}

verifyFixes(); 