const { Redis } = require('@upstash/redis');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env.local') });

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

async function resetDailyLimits() {
  console.log('🔄 Resetting daily submission limits...');
  
  try {
    // Get all daily limit keys
    const today = new Date().toISOString().split('T')[0];
    const keys = await redis.keys(`engagement:daily:*:${today}`);
    
    console.log(`Found ${keys.length} daily limit keys to reset`);
    
    // Delete all daily limit keys
    for (const key of keys) {
      await redis.del(key);
      console.log(`✅ Reset: ${key}`);
    }
    
    console.log('\n✅ All daily limits have been reset!');
    console.log('Users can now submit tweets again.');
    
  } catch (error) {
    console.error('❌ Error resetting limits:', error);
  }
}

// Also reset yesterday's limits for cleanup
async function cleanupOldLimits() {
  try {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split('T')[0];
    
    const oldKeys = await redis.keys(`engagement:daily:*:${yesterdayStr}`);
    
    if (oldKeys.length > 0) {
      console.log(`\n🧹 Cleaning up ${oldKeys.length} old limit keys...`);
      for (const key of oldKeys) {
        await redis.del(key);
      }
      console.log('✅ Old limits cleaned up');
    }
  } catch (error) {
    console.error('Error cleaning up old limits:', error);
  }
}

async function main() {
  await resetDailyLimits();
  await cleanupOldLimits();
  process.exit(0);
}

main(); 