#!/usr/bin/env node

const { config } = require('dotenv')

// Load environment variables
config({ path: '.env.local' })

const botToken = process.env.DISCORD_BOT_TOKEN

console.log('🔐 Testing Discord Bot Authentication\n')
console.log('Bot token from env:', botToken ? `${botToken.substring(0, 30)}...` : 'NOT SET')
console.log('Token length:', botToken ? botToken.length : 0)

// Test API call
const testMessage = {
  messageId: 'test123',
  projectId: 'project:discord:GEpk5t8yZkQzaWYDHDZHS',
  channelId: 'test-channel',
  channelName: 'test-channel',
  userId: 'test-user',
  username: 'testuser',
  content: 'This is a test message',
  timestamp: new Date().toISOString(),
  hasAttachments: false
}

console.log('\n📨 Testing API call to /api/discord/messages')
console.log('Authorization header:', `Bot ${botToken}`)

fetch('http://localhost:3000/api/discord/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bot ${botToken}`
  },
  body: JSON.stringify(testMessage)
})
.then(res => {
  console.log('\nResponse status:', res.status, res.statusText)
  return res.json()
})
.then(data => {
  console.log('Response data:', data)
})
.catch(err => {
  console.error('Error:', err.message)
}) 