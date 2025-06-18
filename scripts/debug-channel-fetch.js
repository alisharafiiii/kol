const fetch = require('node-fetch');
const { Redis } = require('@upstash/redis');
require('dotenv').config({ path: '../.env.local' });

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
});

async function debugChannelFetch() {
  const channelId = '1382583759907459123';
  const projectId = 'project:discord:pype0pAxNMSU9k0LDSkF4';
  
  console.log('🔍 Debugging channel fetch for:', channelId);
  console.log('================================================\n');
  
  try {
    // 1. Get project info
    const project = await redis.json.get(projectId);
    console.log('1. Project server ID:', project.serverId);
    
    // 2. Create a channel info request
    const requestKey = `discord:channel-info-request:${channelId}`;
    const requestData = {
      channelId,
      projectId,
      serverId: project.serverId,
      timestamp: new Date().toISOString()
    };
    
    console.log('\n2. Creating channel info request...');
    console.log('   Request key:', requestKey);
    console.log('   Request data:', JSON.stringify(requestData, null, 2));
    
    await redis.set(requestKey, JSON.stringify(requestData), {
      ex: 30 // expire in 30 seconds
    });
    console.log('   ✅ Request created');
    
    // 3. Wait for bot to process
    console.log('\n3. Waiting for bot to process (3 seconds)...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // 4. Check if request still exists
    const requestStillExists = await redis.get(requestKey);
    console.log('\n4. Request still exists?', requestStillExists ? 'Yes' : 'No (processed by bot)');
    
    // 5. Check for response
    const responseKey = `discord:channel-info-response:${channelId}`;
    const response = await redis.get(responseKey);
    console.log('\n5. Response key:', responseKey);
    console.log('   Response exists?', response ? 'Yes' : 'No');
    
    if (response) {
      console.log('   Response data:', response);
      try {
        const parsed = JSON.parse(response);
        console.log('   Parsed response:', JSON.stringify(parsed, null, 2));
      } catch (e) {
        console.log('   Error parsing response:', e.message);
      }
    }
    
    // 6. Check channel metadata
    const metadataKey = `channel:discord:${channelId}`;
    const metadata = await redis.json.get(metadataKey);
    console.log('\n6. Channel metadata:', metadata ? JSON.stringify(metadata, null, 2) : 'None');
    
    // 7. Try the API endpoint
    console.log('\n7. Testing API endpoint...');
    
    // First get a session
    const loginRes = await fetch('http://localhost:3001/api/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: 'sharafi_eth' })
    });
    
    const cookies = loginRes.headers.get('set-cookie');
    
    const res = await fetch(`http://localhost:3001/api/discord/projects/${projectId}/fetch-channel`, {
      method: 'POST',
      headers: { 
        'Cookie': cookies,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ channelId })
    });
    
    console.log('   API Status:', res.status);
    const apiData = await res.json();
    console.log('   API Response:', JSON.stringify(apiData, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

debugChannelFetch(); 