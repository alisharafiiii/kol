const { Redis } = require('@upstash/redis');
require('dotenv').config({ path: '../.env.local' });

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

async function manualChannelFetch() {
  const channelId = '1382583759907459123';
  const projectId = 'project:discord:pype0pAxNMSU9k0LDSkF4';
  const serverId = '980159046176870450';
  
  console.log('🔧 Manual channel fetch test\n');
  
  // Clear any old data
  const requestKey = `discord:channel-info-request:${channelId}`;
  const responseKey = `discord:channel-info-response:${channelId}`;
  
  await redis.del(requestKey);
  await redis.del(responseKey);
  console.log('✅ Cleared old data');
  
  // Create request
  const requestData = {
    channelId,
    projectId,
    serverId,
    timestamp: new Date().toISOString()
  };
  
  console.log('\n📤 Creating request:');
  console.log(JSON.stringify(requestData, null, 2));
  
  // Store the request
  await redis.set(requestKey, JSON.stringify(requestData), {
    ex: 30
  });
  
  console.log('\n⏳ Waiting for bot to process...');
  
  // Monitor for response
  let attempts = 0;
  const maxAttempts = 10;
  
  while (attempts < maxAttempts) {
    attempts++;
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Check if request still exists
    const requestExists = await redis.get(requestKey);
    console.log(`\nAttempt ${attempts}:`);
    console.log(`  Request exists: ${requestExists ? 'Yes' : 'No (processed)'}`);
    
    // Check for response
    const response = await redis.get(responseKey);
    if (response) {
      console.log(`  ✅ Got response!`);
      console.log(`  Response:`, response);
      
      try {
        const parsed = JSON.parse(response);
        console.log(`  Parsed:`, JSON.stringify(parsed, null, 2));
        break;
      } catch (e) {
        console.log(`  ❌ Error parsing response:`, e.message);
        break;
      }
    } else {
      console.log(`  No response yet...`);
    }
    
    if (!requestExists && !response) {
      console.log(`  ⚠️  Request was processed but no response created`);
      break;
    }
  }
  
  if (attempts === maxAttempts) {
    console.log('\n❌ Timeout - no response received');
  }
}

manualChannelFetch().catch(console.error); 