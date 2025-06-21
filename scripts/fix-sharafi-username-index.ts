import { redis } from '../lib/redis';

async function fixSharafiUsernameIndex() {
  try {
    console.log('🔧 Fixing username index for sharafi_eth...\n');
    
    // First, check what's currently in the index
    const currentIds = await redis.smembers('idx:username:sharafi_eth');
    console.log('Current username index:', currentIds);
    
    // Clear the index
    await redis.del('idx:username:sharafi_eth');
    
    // The findUserByUsername function expects the ID without 'user:' prefix
    // It then adds 'user:' when fetching: redis.json.get(`user:${userIds[0]}`)
    // So we need to add 'user_sharafi_eth' to the index
    await redis.sadd('idx:username:sharafi_eth', 'user_sharafi_eth');
    
    // Verify the fix
    const newIds = await redis.smembers('idx:username:sharafi_eth');
    console.log('\nNew username index:', newIds);
    
    // Test that it works
    const userData = await redis.json.get('user:user_sharafi_eth');
    console.log('\nUser data found:', JSON.stringify(userData, null, 2));
    
    console.log('\n✅ Username index fixed! sharafi_eth should now be able to access admin panel.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixSharafiUsernameIndex(); 