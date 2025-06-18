const fetch = require('node-fetch');

async function testChannelFetch() {
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
    
    // Now try to fetch channel info
    const channelId = '1382583759907459123';
    console.log(`\n📡 Fetching info for channel ${channelId}...`);
    
    const res = await fetch(`http://localhost:3001/api/discord/projects/project:discord:pype0pAxNMSU9k0LDSkF4/fetch-channel`, {
      method: 'POST',
      headers: { 
        'Cookie': cookies,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ channelId })
    });
    
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('\nChannel info received:');
    console.log(JSON.stringify(data, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testChannelFetch(); 