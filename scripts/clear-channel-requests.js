const Redis = require('ioredis');

async function clearChannelRequests() {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
  
  try {
    console.log('Looking for channel info requests...');
    
    // Find all channel info request keys
    const keys = await redis.keys('discord:channel-info-request:*');
    console.log(`Found ${keys.length} channel info requests`);
    
    // Check and delete each one
    for (const key of keys) {
      try {
        const value = await redis.get(key);
        console.log(`Key: ${key}`);
        console.log(`Value:`, value);
        
        // Try to parse it
        try {
          const parsed = JSON.parse(value);
          console.log('Parsed successfully:', parsed);
        } catch (e) {
          console.log('Failed to parse - deleting this request');
          await redis.del(key);
        }
      } catch (error) {
        console.error(`Error processing ${key}:`, error);
      }
    }
    
    console.log('Done!');
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await redis.quit();
  }
}

clearChannelRequests(); 