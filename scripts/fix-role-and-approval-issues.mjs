#!/usr/bin/env node
import dotenv from 'dotenv';
import { Redis } from '@upstash/redis';

// Load environment variables
dotenv.config({ path: '.env.local' });

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

async function fixRoleAndApprovalIssues() {
  console.log('🔧 Fixing Role and Approval Status Issues\n');
  
  try {
    // Get all user keys
    const userKeys = await redis.keys('user:*');
    console.log(`Found ${userKeys.length} users to check\n`);
    
    let fixedApprovalCount = 0;
    let coreRoleCount = 0;
    let issues = [];
    
    for (const key of userKeys) {
      const user = await redis.json.get(key);
      if (!user) continue;
      
      let needsUpdate = false;
      const updates = {};
      
      // Check for users with 'core' role who might have incorrect approval status
      if (user.role === 'core' && user.approvalStatus !== 'approved') {
        console.log(`❌ Core user with non-approved status:`);
        console.log(`   Handle: @${user.twitterHandle}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Status: ${user.approvalStatus} → approved`);
        
        updates.approvalStatus = 'approved';
        needsUpdate = true;
        fixedApprovalCount++;
      }
      
      // Check for admin/team users who should be approved
      if ((user.role === 'admin' || user.role === 'team') && user.approvalStatus !== 'approved') {
        console.log(`❌ ${user.role} user with non-approved status:`);
        console.log(`   Handle: @${user.twitterHandle}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Status: ${user.approvalStatus} → approved`);
        
        updates.approvalStatus = 'approved';
        needsUpdate = true;
        fixedApprovalCount++;
      }
      
      // Count core users for verification
      if (user.role === 'core') {
        coreRoleCount++;
      }
      
      // Check for undefined or null approval status
      if (user.approvalStatus === undefined || user.approvalStatus === null) {
        console.log(`❌ User with undefined approval status:`);
        console.log(`   Handle: @${user.twitterHandle}`);
        console.log(`   Role: ${user.role}`);
        
        // Set appropriate default based on role
        if (['admin', 'core', 'team'].includes(user.role)) {
          updates.approvalStatus = 'approved';
          console.log(`   Status: undefined → approved (privileged role)`);
        } else {
          updates.approvalStatus = 'pending';
          console.log(`   Status: undefined → pending`);
        }
        
        needsUpdate = true;
        fixedApprovalCount++;
      }
      
      // Apply updates if needed
      if (needsUpdate) {
        updates.updatedAt = new Date().toISOString();
        const updatedUser = { ...user, ...updates };
        await redis.json.set(key, '$', updatedUser);
        console.log(`   ✅ Fixed\n`);
      }
    }
    
    // Also check ProfileService profiles
    console.log('\n=== Checking ProfileService Profiles ===');
    const profileKeys = await redis.keys('profile:*');
    console.log(`Found ${profileKeys.length} profiles to check\n`);
    
    let profileFixedCount = 0;
    
    for (const key of profileKeys) {
      const profile = await redis.json.get(key);
      if (!profile) continue;
      
      let needsUpdate = false;
      const updates = {};
      
      // Same checks for profiles
      if (profile.role === 'core' && profile.approvalStatus !== 'approved') {
        console.log(`❌ Core profile with non-approved status:`);
        console.log(`   Handle: @${profile.twitterHandle}`);
        console.log(`   Status: ${profile.approvalStatus} → approved`);
        
        updates.approvalStatus = 'approved';
        needsUpdate = true;
        profileFixedCount++;
      }
      
      if ((profile.role === 'admin' || profile.role === 'team') && profile.approvalStatus !== 'approved') {
        console.log(`❌ ${profile.role} profile with non-approved status:`);
        console.log(`   Handle: @${profile.twitterHandle}`);
        console.log(`   Status: ${profile.approvalStatus} → approved`);
        
        updates.approvalStatus = 'approved';
        needsUpdate = true;
        profileFixedCount++;
      }
      
      if (profile.approvalStatus === undefined || profile.approvalStatus === null) {
        console.log(`❌ Profile with undefined approval status:`);
        console.log(`   Handle: @${profile.twitterHandle}`);
        console.log(`   Role: ${profile.role}`);
        
        if (['admin', 'core', 'team'].includes(profile.role)) {
          updates.approvalStatus = 'approved';
          console.log(`   Status: undefined → approved`);
        } else {
          updates.approvalStatus = 'pending';
          console.log(`   Status: undefined → pending`);
        }
        
        needsUpdate = true;
        profileFixedCount++;
      }
      
      if (needsUpdate) {
        updates.updatedAt = new Date().toISOString();
        const updatedProfile = { ...profile, ...updates };
        await redis.json.set(key, '$', updatedProfile);
        console.log(`   ✅ Fixed\n`);
      }
    }
    
    // Summary
    console.log('\n=== Summary ===');
    console.log(`Total users checked: ${userKeys.length}`);
    console.log(`Users with 'core' role: ${coreRoleCount}`);
    console.log(`Approval status issues fixed: ${fixedApprovalCount}`);
    console.log(`\nProfiles checked: ${profileKeys.length}`);
    console.log(`Profile issues fixed: ${profileFixedCount}`);
    
    // Test access for a core user
    if (coreRoleCount > 0) {
      console.log('\n=== Testing Core Role Access ===');
      console.log('Core users should have access to:');
      console.log('✅ Admin panel (/admin)');
      console.log('✅ Discord analytics');
      console.log('✅ User management features');
      console.log('✅ Campaign management');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixRoleAndApprovalIssues(); 