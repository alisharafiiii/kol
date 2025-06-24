#!/usr/bin/env node

/**
 * Test the complete email notification flow
 * Usage: npm run test:email-flow
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { Redis } from '@upstash/redis'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env.local') })

console.log('='.repeat(80))
console.log('EMAIL NOTIFICATION FLOW TEST')
console.log('='.repeat(80))

// 1. Check environment variables
console.log('\n1. ENVIRONMENT CHECK:')
const envVars = {
  SMTP_HOST: process.env.SMTP_HOST,
  SMTP_PORT: process.env.SMTP_PORT,
  SMTP_USER: process.env.SMTP_USER,
  SMTP_PASS: process.env.SMTP_PASS,
  SMTP_FROM: process.env.SMTP_FROM
}

let allEnvSet = true
for (const [key, value] of Object.entries(envVars)) {
  console.log(`   ${key}: ${value ? '✅ SET' : '❌ NOT SET'}`)
  if (!value) allEnvSet = false
}

if (!allEnvSet) {
  console.error('\n❌ Some environment variables are missing!')
  console.error('   Please check your .env.local file')
}

// 2. Test SMTP connection
console.log('\n2. TESTING SMTP CONNECTION:')
if (envVars.SMTP_USER && envVars.SMTP_PASS) {
  try {
    // Dynamic import for nodemailer to work with ESM
    const nodemailer = await import('nodemailer')
    const transporter = nodemailer.default.createTransport({
      host: envVars.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(envVars.SMTP_PORT || '587'),
      secure: envVars.SMTP_PORT === '465',
      auth: {
        user: envVars.SMTP_USER,
        pass: envVars.SMTP_PASS
      }
    })
    
    console.log('   Verifying SMTP connection...')
    await transporter.verify()
    console.log('   ✅ SMTP connection verified successfully!')
    
    // Send test email
    console.log('\n3. SENDING TEST EMAIL:')
    const testEmail = {
      from: envVars.SMTP_FROM || `KOL Platform <${envVars.SMTP_USER}>`,
      to: 'ali.sharafi85@gmail.com', // Test recipient
      subject: 'Test Email from KOL Platform',
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2>Test Email</h2>
          <p>This is a test email from the KOL Platform notification system.</p>
          <p>If you received this email, the SMTP configuration is working correctly!</p>
          <p>Timestamp: ${new Date().toLocaleString()}</p>
        </div>
      `,
      text: 'Test email from KOL Platform. If you received this, SMTP is working!'
    }
    
    console.log('   Sending test email to:', testEmail.to)
    const info = await transporter.sendMail(testEmail)
    console.log('   ✅ Test email sent successfully!')
    console.log('   Message ID:', info.messageId)
    console.log('   Response:', info.response)
    
  } catch (error) {
    console.error('   ❌ SMTP connection/sending failed:', error.message)
    console.error('   Full error:', error)
  }
} else {
  console.log('   ⚠️  Skipping SMTP test - credentials not configured')
}

// 3. Check Redis connection and notification queues
console.log('\n4. CHECKING REDIS NOTIFICATION QUEUES:')

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  console.error('   ❌ Redis credentials not found')
} else {
  // Parse REDIS_URL if needed
  let url = UPSTASH_REDIS_REST_URL
  let token = UPSTASH_REDIS_REST_TOKEN
  
  if (UPSTASH_REDIS_REST_URL.startsWith('redis://')) {
    try {
      const parsedUrl = new URL(UPSTASH_REDIS_REST_URL)
      token = parsedUrl.password
      url = `https://${parsedUrl.hostname}`
    } catch (e) {
      console.error('Failed to parse REDIS_URL:', e.message)
    }
  }
  
  const redis = new Redis({ url, token })
  
  try {
    // Check queue status
    const [pending, sent, failed] = await Promise.all([
      redis.llen('notifications:queue'),
      redis.llen('notifications:sent'), 
      redis.llen('notifications:failed')
    ])
    
    console.log('   Queue status:')
    console.log(`   - Pending: ${pending}`)
    console.log(`   - Sent: ${sent}`)
    console.log(`   - Failed: ${failed}`)
    
    // Check for pending notifications
    if (pending > 0) {
      console.log('\n   Sample pending notification:')
      const sample = await redis.lrange('notifications:queue', 0, 0)
      if (sample && sample[0]) {
        const notification = typeof sample[0] === 'string' ? JSON.parse(sample[0]) : sample[0]
        console.log(`   - ID: ${notification.id}`)
        console.log(`   - Type: ${notification.type}`)
        console.log(`   - To: ${notification.recipientEmail}`)
        console.log(`   - Subject: ${notification.subject}`)
        console.log(`   - Status: ${notification.status}`)
        console.log(`   - Attempts: ${notification.attempts}`)
      }
    }
    
  } catch (error) {
    console.error('   ❌ Error checking Redis:', error.message)
  }
}

// 4. Test the complete flow
console.log('\n5. TESTING COMPLETE NOTIFICATION FLOW:')
console.log('   To test the complete flow:')
console.log('   1. Start the dev server: npm run dev')
console.log('   2. Log in as admin/core user')
console.log('   3. Add a note to a KOL profile in a campaign')
console.log('   4. Watch the server logs for 📧 messages')
console.log('   5. Check if email is received')
console.log('\n   You can also manually process pending notifications:')
console.log('   curl -X POST http://localhost:3000/api/notifications/process \\')
console.log('     -H "Cookie: <your-auth-cookie>"')
console.log('\n   Or check queue status:')
console.log('   curl http://localhost:3000/api/notifications/process \\')
console.log('     -H "Cookie: <your-auth-cookie>"')

console.log('\n' + '='.repeat(80))
console.log('TEST COMPLETE')
console.log('='.repeat(80))

process.exit(0) 