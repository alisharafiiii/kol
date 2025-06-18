const fetch = require('node-fetch');

async function testChannelsAPI() {
  try {
    // First get a session
    console.log('🔐 Logging in...');
    const loginRes = await fetch('http://localhost:3001/api/auth/dev-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ handle: 'sharafi_eth' })
    });
    
    const cookies = loginRes.headers.get('set-cookie');
    console.log('Got cookies:', cookies ? 'Yes' : 'No');
    
    // Now fetch channels
    console.log('\n📡 Fetching channels...');
    const res = await fetch('http://localhost:3001/api/discord/projects/project:discord:pype0pAxNMSU9k0LDSkF4/channels', {
      headers: { 'Cookie': cookies }
    });
    
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('\nChannels data:');
    console.log(JSON.stringify(data, null, 2));
    
    // Check if channel names are present
    if (Array.isArray(data)) {
      console.log('\n✅ Channel summary:');
      data.forEach(ch => {
        console.log(`  - ${ch.name} (ID: ${ch.id})`);
      });
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testChannelsAPI(); 