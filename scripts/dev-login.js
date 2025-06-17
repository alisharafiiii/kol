#!/usr/bin/env node

const handle = process.argv[2] || 'sharafi_eth';

console.log(`🔐 Logging in as @${handle}...`);

async function devLogin() {
  try {
    const response = await fetch('http://localhost:3000/api/auth/dev-login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ handle }),
    });

    const data = await response.json();

    if (response.ok) {
      console.log('✅ Login successful!');
      console.log(`👤 User: @${data.user.twitterHandle}`);
      console.log(`🎭 Role: ${data.user.role}`);
      console.log('\n🌐 You can now visit:');
      console.log('   http://localhost:3000/contracts-admin');
      console.log('   http://localhost:3000/admin');
      console.log('\n⚠️  Note: This only works in development mode');
    } else {
      console.error('❌ Login failed:', data.error);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.log('\n💡 Make sure your dev server is running on port 3000');
  }
}

// Show usage
if (handle === '--help' || handle === '-h') {
  console.log('Usage: node scripts/dev-login.js [handle]');
  console.log('\nAvailable handles:');
  console.log('  sharafi_eth (admin)');
  console.log('  nabulines (admin)');
  console.log('  alinabu (admin)');
  console.log('  testuser (regular user)');
  console.log('\nExample:');
  console.log('  node scripts/dev-login.js sharafi_eth');
} else {
  devLogin();
} 