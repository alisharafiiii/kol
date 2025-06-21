const { redis } = require('../.next/server/chunks/8948.js').redis || require('../lib/redis');

async function checkSharafiRole() {
  try {
    console.log('🔍 Checking sharafi_eth role in Redis...\n');
    
    // First, let's check what's actually in the username index
    const userIds = await redis.smembers('idx:username:sharafi_eth');
    console.log('Username index for sharafi_eth:', userIds);
    
    // Check each ID
    if (userIds && userIds.length > 0) {
      for (const id of userIds) {
        // The issue is that findUserByUsername expects user:ID format
        // but the index might just have the ID
        const userKey = id.startsWith('user:') ? id : `user:${id}`;
        const userData = await redis.json.get(userKey);
        console.log(`\nChecking ${userKey}:`, JSON.stringify(userData, null, 2));
      }
    }
    
    // Also check the direct user_sharafi_eth key
    const directUser = await redis.json.get('user:user_sharafi_eth');
    console.log('\nDirect user:user_sharafi_eth lookup:', JSON.stringify(directUser, null, 2));
    
    // Check without user: prefix
    const withoutPrefix = await redis.json.get('user_sharafi_eth');
    console.log('\nDirect user_sharafi_eth lookup:', JSON.stringify(withoutPrefix, null, 2));
    
    // Now let's fix the index to have the correct format
    console.log('\n🔧 Fixing the username index...');
    
    // Clear the old index
    await redis.del('idx:username:sharafi_eth');
    
    // Add the correct user ID to the index (without user: prefix)
    await redis.sadd('idx:username:sharafi_eth', 'user_sharafi_eth');
    
    console.log('✅ Index fixed! The username index now points to user_sharafi_eth');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSharafiRole(); 