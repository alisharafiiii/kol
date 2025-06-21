#!/usr/bin/env node

// Test the Discord link API endpoint directly
require('dotenv').config({ path: '.env.local' })

async function testAPI() {
  console.log('🧪 Testing Discord Link API\n')
  
  // First, let's check if you're authenticated
  console.log('1. Checking authentication status...')
  try {
    const sessionRes = await fetch('http://localhost:3000/api/auth/session')
    const session = await sessionRes.json()
    
    if (!session.user) {
      console.log('❌ Not authenticated. You need to sign in with Twitter first.')
      console.log('   Visit: http://localhost:3000/auth/signin')
      return
    }
    
    console.log('✅ Authenticated as:', session.user.name)
    console.log('   Session:', JSON.stringify(session, null, 2))
  } catch (error) {
    console.error('❌ Error checking session:', error.message)
    return
  }
  
  // Test the API endpoint
  console.log('\n2. Testing Discord link API...')
  const testSessionId = 'verify-alinabu-1750444898'
  
  try {
    const response = await fetch('http://localhost:3000/api/auth/discord-link', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        // We need to pass cookies for authentication
        'Cookie': 'next-auth.session-token=YOUR_SESSION_TOKEN_HERE'
      },
      body: JSON.stringify({
        sessionId: testSessionId
      })
    })
    
    const data = await response.json()
    
    console.log(`   Status: ${response.status}`)
    console.log('   Response:', JSON.stringify(data, null, 2))
    
    if (!response.ok) {
      console.log('\n❌ API Error Details:')
      console.log('   Error:', data.error)
      console.log('   Details:', data.details)
    }
  } catch (error) {
    console.error('❌ Request failed:', error)
  }
  
  console.log('\n3. Common issues:')
  console.log('   - Not authenticated: Sign in with Twitter first')
  console.log('   - Session expired: Create a new Discord session')
  console.log('   - Wrong NEXTAUTH_URL: Should be http://localhost:3000')
}

testAPI() 