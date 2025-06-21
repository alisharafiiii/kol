#!/usr/bin/env node
import dotenv from 'dotenv';
import { Redis } from '@upstash/redis';

// Load .env.local for actual environment variables
dotenv.config({ path: '.env.local' });

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

// Calculate profile completeness score
function calculateProfileScore(profile) {
  let score = 0;
  
  // Base scores for approval status
  if (profile.approvalStatus === 'approved') score += 1000;
  else if (profile.approvalStatus === 'pending') score += 500;
  
  // Role importance
  if (profile.role === 'admin') score += 500;
  else if (profile.role === 'core') score += 400;
  else if (profile.role === 'team') score += 300;
  else if (profile.role === 'kol') score += 200;
  else if (profile.role === 'scout') score += 100;
  
  // Data completeness
  if (profile.profileImageUrl) score += 50;
  if (profile.bio) score += 30;
  if (profile.followerCount > 0) score += profile.followerCount / 1000;
  if (profile.email) score += 40;
  if (profile.walletAddresses && Object.keys(profile.walletAddresses).length > 0) score += 50;
  if (profile.campaigns && profile.campaigns.length > 0) score += profile.campaigns.length * 20;
  if (profile.points > 0) score += profile.points / 10;
  
  // Tier value
  const tierValues = { whale: 100, shark: 80, dolphin: 60, fish: 40, micro: 20 };
  score += tierValues[profile.tier] || tierValues[profile.currentTier] || 0;
  
  // Activity indicators
  if (profile.lastActivityAt) {
    const daysSinceActivity = (Date.now() - new Date(profile.lastActivityAt).getTime()) / (1000 * 60 * 60 * 24);
    score += Math.max(0, 100 - daysSinceActivity);
  }
  
  return score;
}

// Merge two profiles, preserving all data
function mergeProfiles(primary, secondary) {
  const merged = { ...primary };
  
  // Merge basic fields (prefer non-empty values)
  if (!merged.name && secondary.name) merged.name = secondary.name;
  if (!merged.profileImageUrl && secondary.profileImageUrl) merged.profileImageUrl = secondary.profileImageUrl;
  if (!merged.bio && secondary.bio) merged.bio = secondary.bio;
  if (!merged.email && secondary.email) merged.email = secondary.email;
  if (!merged.phone && secondary.phone) merged.phone = secondary.phone;
  if (!merged.country && secondary.country) merged.country = secondary.country;
  if (!merged.city && secondary.city) merged.city = secondary.city;
  
  // Merge numeric fields (take maximum)
  merged.followerCount = Math.max(merged.followerCount || 0, secondary.followerCount || 0);
  merged.points = Math.max(merged.points || 0, secondary.points || 0);
  
  // Merge arrays (combine unique values)
  if (secondary.campaigns && secondary.campaigns.length > 0) {
    merged.campaigns = merged.campaigns || [];
    secondary.campaigns.forEach(campaign => {
      if (!merged.campaigns.some(c => c.id === campaign.id)) {
        merged.campaigns.push(campaign);
      }
    });
  }
  
  if (secondary.tags && secondary.tags.length > 0) {
    merged.tags = [...new Set([...(merged.tags || []), ...secondary.tags])];
  }
  
  if (secondary.chains && secondary.chains.length > 0) {
    merged.chains = [...new Set([...(merged.chains || []), ...secondary.chains])];
  }
  
  // Merge objects (deep merge)
  if (secondary.walletAddresses) {
    merged.walletAddresses = {
      ...(merged.walletAddresses || {}),
      ...secondary.walletAddresses
    };
  }
  
  if (secondary.socialLinks) {
    merged.socialLinks = {
      ...(merged.socialLinks || {}),
      ...secondary.socialLinks
    };
  }
  
  if (secondary.socialAccounts) {
    merged.socialAccounts = {
      ...(merged.socialAccounts || {}),
      ...secondary.socialAccounts
    };
  }
  
  // Merge notes (combine all)
  if (secondary.notes && secondary.notes.length > 0) {
    merged.notes = merged.notes || [];
    secondary.notes.forEach(note => {
      // Check if note already exists (by content and timestamp)
      const exists = merged.notes.some(n => 
        n.content === note.content && 
        n.createdAt === note.createdAt
      );
      if (!exists) {
        merged.notes.push(note);
      }
    });
  }
  
  // Keep earliest creation date
  if (secondary.createdAt && new Date(secondary.createdAt) < new Date(merged.createdAt)) {
    merged.createdAt = secondary.createdAt;
  }
  
  // Update modification date
  merged.updatedAt = new Date().toISOString();
  
  return merged;
}

async function analyzeDuplicates() {
  console.log('🔍 Analyzing Duplicate Profiles for Safe Merging\n');
  
  try {
    // Get all profile keys (both old and new format)
    const userKeys = await redis.keys('user:*');
    const profileKeys = await redis.keys('profile:*');
    const allKeys = [...userKeys, ...profileKeys];
    
    console.log(`Found ${allKeys.length} total profile keys\n`);
    
    // Build handle map
    const profilesByHandle = new Map();
    const errors = [];
    
    for (const key of allKeys) {
      try {
        const profile = await redis.json.get(key);
        if (profile && profile.twitterHandle) {
          const handle = profile.twitterHandle.toLowerCase().replace('@', '').trim();
          
          if (!profilesByHandle.has(handle)) {
            profilesByHandle.set(handle, []);
          }
          
          profilesByHandle.get(handle).push({
            key,
            profile,
            score: calculateProfileScore(profile)
          });
        }
      } catch (err) {
        errors.push({ key, error: err.message });
      }
    }
    
    console.log(`Analyzed ${profilesByHandle.size} unique handles\n`);
    
    // Process duplicates
    const mergeOperations = [];
    
    for (const [handle, profiles] of profilesByHandle) {
      if (profiles.length > 1) {
        // Sort by score
        profiles.sort((a, b) => b.score - a.score);
        
        console.log(`\n📊 Handle: @${handle}`);
        console.log(`   Found ${profiles.length} profiles:`);
        
        profiles.forEach((p, idx) => {
          console.log(`   ${idx + 1}. ${p.key} (score: ${p.score})`);
          console.log(`      Status: ${p.profile.approvalStatus}, Role: ${p.profile.role}`);
        });
        
        // Plan merge operation
        const primary = profiles[0];
        const toMerge = profiles.slice(1);
        
        let mergedProfile = primary.profile;
        for (const secondary of toMerge) {
          mergedProfile = mergeProfiles(mergedProfile, secondary.profile);
        }
        
        // Ensure correct ID format
        const correctId = `user_${handle}`;
        mergedProfile.id = correctId;
        
        mergeOperations.push({
          handle,
          primaryKey: primary.key,
          keysToDelete: toMerge.map(p => p.key),
          mergedProfile,
          correctKey: `profile:${correctId}`
        });
        
        console.log(`   ✅ Will merge into: profile:${correctId}`);
      }
    }
    
    console.log(`\n📋 Summary:`);
    console.log(`   Total merge operations: ${mergeOperations.length}`);
    console.log(`   Profiles to be consolidated: ${mergeOperations.reduce((sum, op) => sum + op.keysToDelete.length, 0)}`);
    
    // Save merge plan
    await redis.set('merge-plan', JSON.stringify(mergeOperations), { ex: 3600 });
    console.log('\n💾 Merge plan saved to Redis (expires in 1 hour)');
    console.log('   Run with --execute flag to perform the merge');
    
    return mergeOperations;
    
  } catch (error) {
    console.error('Error:', error);
  }
}

async function executeMerge() {
  try {
    const planData = await redis.get('merge-plan');
    if (!planData) {
      console.log('❌ No merge plan found. Run without --execute first.');
      return;
    }
    
    // Handle both string and object responses from Redis
    const mergeOperations = typeof planData === 'string' ? JSON.parse(planData) : planData;
    console.log(`\n🚀 Executing ${mergeOperations.length} merge operations...\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (const operation of mergeOperations) {
      try {
        console.log(`Processing @${operation.handle}...`);
        
        // Save merged profile with correct key
        await redis.json.set(operation.correctKey, '$', operation.mergedProfile);
        
        // Update indexes
        await redis.sadd(`idx:profile:handle:${operation.handle}`, operation.mergedProfile.id);
        
        // Delete old profiles
        for (const keyToDelete of operation.keysToDelete) {
          await redis.del(keyToDelete);
        }
        
        // If primary key is different from correct key, delete it too
        if (operation.primaryKey !== operation.correctKey) {
          await redis.del(operation.primaryKey);
        }
        
        successCount++;
        console.log(`   ✅ Successfully merged`);
        
      } catch (err) {
        errorCount++;
        console.error(`   ❌ Error: ${err.message}`);
      }
    }
    
    console.log(`\n✅ Merge Complete:`);
    console.log(`   Successful: ${successCount}`);
    console.log(`   Errors: ${errorCount}`);
    
    // Clean up merge plan
    await redis.del('merge-plan');
    
  } catch (error) {
    console.error('Error executing merge:', error);
  }
}

// Main
const shouldExecute = process.argv.includes('--execute');

if (shouldExecute) {
  executeMerge();
} else {
  analyzeDuplicates();
} 