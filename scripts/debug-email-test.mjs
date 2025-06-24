#!/usr/bin/env node

/**
 * Debug script for testing email notifications
 * Usage: npm run debug:email-test
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { Redis } from '@upstash/redis'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env.local') })

console.log('='.repeat(80))
console.log('EMAIL NOTIFICATION DEBUG TEST')
console.log('='.repeat(80))

// Check SMTP configuration
console.log('\n1. SMTP CONFIGURATION:')
console.log('   SMTP_HOST:', process.env.SMTP_HOST || 'NOT SET')
console.log('   SMTP_PORT:', process.env.SMTP_PORT || 'NOT SET')
console.log('   SMTP_USER:', process.env.SMTP_USER || 'NOT SET')
console.log('   SMTP_PASS:', process.env.SMTP_PASS ? '***SET***' : 'NOT SET')
console.log('   SMTP_FROM:', process.env.SMTP_FROM || 'NOT SET')

// Check if email is configured
const isEmailConfigured = !!(
  process.env.SMTP_HOST && 
  process.env.SMTP_PORT && 
  process.env.SMTP_USER && 
  process.env.SMTP_PASS
)

console.log('\n   Email configured:', isEmailConfigured ? '✅ YES' : '❌ NO')

if (!isEmailConfigured) {
  console.log('\n   ⚠️  Email notifications will be simulated in console logs')
  console.log('   To enable actual email sending, set SMTP_* environment variables')
}

// Connect to Redis to check notification queue
console.log('\n2. CHECKING NOTIFICATION QUEUE:')

const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  console.error('   ❌ Redis credentials not found')
  process.exit(1)
}

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
    process.exit(1)
  }
}

const redis = new Redis({ url, token })

try {
  // Check notification queues
  const [pending, sent, failed] = await Promise.all([
    redis.llen('notifications:queue'),
    redis.llen('notifications:sent'),
    redis.llen('notifications:failed')
  ])
  
  console.log('   Pending notifications:', pending)
  console.log('   Sent notifications:', sent)
  console.log('   Failed notifications:', failed)
  
  // Show recent notifications
  if (sent > 0) {
    console.log('\n3. RECENT SENT NOTIFICATIONS:')
    const recent = await redis.lrange('notifications:sent', 0, 2)
    
    for (const item of recent) {
      try {
        // Handle both string and object responses from Redis
        const notification = typeof item === 'string' ? JSON.parse(item) : item
        console.log('\n   Notification ID:', notification.id)
        console.log('   Type:', notification.type)
        console.log('   To:', notification.recipientEmail)
        console.log('   Subject:', notification.subject)
        console.log('   Sent at:', notification.sentAt || notification.createdAt)
      } catch (e) {
        console.error('   Error parsing notification:', e.message)
      }
    }
  }
  
  // Check for admin/core users with emails
  console.log('\n4. CHECKING ADMIN/CORE USERS WITH EMAILS:')
  
  // Get profiles with admin/core roles
  const adminIds = await redis.smembers('idx:profile:role:admin')
  const coreIds = await redis.smembers('idx:profile:role:core')
  
  console.log('   Admin profiles found:', adminIds.length)
  console.log('   Core profiles found:', coreIds.length)
  
  // Sample check for emails
  let emailCount = 0
  const allIds = [...adminIds, ...coreIds].slice(0, 5) // Check first 5
  
  for (const id of allIds) {
    const profile = await redis.json.get(`profile:${id}`)
    if (profile && profile.email) {
      emailCount++
      console.log(`   ✅ ${profile.twitterHandle || profile.name}: Has email`)
    }
  }
  
  if (emailCount === 0 && allIds.length > 0) {
    console.log('   ⚠️  No admin/core users have email addresses configured')
    console.log('   Email notifications will not be sent without email addresses')
  }
  
} catch (error) {
  console.error('Error checking Redis:', error.message)
}

console.log('\n' + '='.repeat(80))
console.log('TEST COMPLETE')
console.log('='.repeat(80))

console.log('\nTO TEST NOTE NOTIFICATIONS:')
console.log('1. Log in as admin/core user')
console.log('2. Go to any campaign with KOLs')
console.log('3. Click on a KOL profile')
console.log('4. Add a note')
console.log('5. Check server logs for "📧" emoji messages')
console.log('6. If emails are configured, check inbox')
console.log('7. If not configured, check console logs for simulated emails')

process.exit(0) 