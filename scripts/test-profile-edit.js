// Test script for profile edit functionality
require('dotenv').config({ path: '.env.local' });

async function testProfileEdit() {
  console.log('=== Testing Profile Edit API ===\n');
  
  // You'll need to get a valid session token from your browser
  // In Chrome DevTools: Application > Cookies > next-auth.session-token
  const sessionToken = process.env.TEST_SESSION_TOKEN || 'YOUR_SESSION_TOKEN_HERE';
  
  if (sessionToken === 'YOUR_SESSION_TOKEN_HERE') {
    console.log('❌ Please set your session token!');
    console.log('\n1. Open your app in browser and log in');
    console.log('2. Open DevTools > Application > Cookies');
    console.log('3. Find "next-auth.session-token" and copy its value');
    console.log('4. Set TEST_SESSION_TOKEN in .env.local or update this script');
    return;
  }
  
  const testData = {
    handle: 'testuser', // Change this to a real user handle
    email: 'test@example.com',
    phone: '+1234567890',
    telegram: '@testuser',
    shippingAddress: {
      addressLine1: '123 Test Street',
      addressLine2: 'Apt 4B',
      city: 'Test City',
      postalCode: '12345',
      country: 'USA'
    }
  };
  
  try {
    const response = await fetch('http://localhost:3000/api/user/profile', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `next-auth.session-token=${sessionToken}`
      },
      body: JSON.stringify(testData)
    });
    
    const data = await response.text();
    
    console.log('Response status:', response.status);
    console.log('Response headers:', Object.fromEntries(response.headers.entries()));
    console.log('\nResponse body:');
    
    try {
      const jsonData = JSON.parse(data);
      console.log(JSON.stringify(jsonData, null, 2));
    } catch {
      console.log(data);
    }
    
    if (response.ok) {
      console.log('\n✅ Profile update successful!');
    } else {
      console.log('\n❌ Profile update failed');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

// Run the test
testProfileEdit(); 