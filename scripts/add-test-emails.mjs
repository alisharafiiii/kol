#!/usr/bin/env node

/**
 * Script to add test email addresses to admin/core users
 * Usage: npm run add:test-emails
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { Redis } from '@upstash/redis'
import readline from 'readline'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env.local') })

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
})

const question = (prompt) => new Promise((resolve) => rl.question(prompt, resolve))

console.log('='.repeat(80))
console.log('ADD TEST EMAIL ADDRESSES TO ADMIN/CORE USERS')
console.log('='.repeat(80))

// Connect to Redis
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.REDIS_URL
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  console.error('❌ Redis credentials not found')
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

async function updateProfile(profile, email) {
  profile.email = email
  profile.updatedAt = new Date()
  
  await redis.json.set(
    `profile:${profile.id}`,
    '$',
    JSON.parse(JSON.stringify(profile))
  )
  
  console.log(`✅ Updated ${profile.twitterHandle} with email: ${email}`)
}

async function main() {
  try {
    // Get all admin and core profiles
    const adminIds = await redis.smembers('idx:profile:role:admin')
    const coreIds = await redis.smembers('idx:profile:role:core')
    
    console.log(`\nFound ${adminIds.length} admin profiles`)
    console.log(`Found ${coreIds.length} core profiles`)
    
    const allIds = [...new Set([...adminIds, ...coreIds])]
    console.log(`Total unique admin/core profiles: ${allIds.length}`)
    
    if (allIds.length === 0) {
      console.log('\n❌ No admin or core profiles found')
      rl.close()
      return
    }
    
    // Show current status
    console.log('\nCurrent email status:')
    const profiles = []
    
    for (const id of allIds) {
      const profile = await redis.json.get(`profile:${id}`)
      if (profile) {
        profiles.push(profile)
        console.log(`- ${profile.twitterHandle} (${profile.role}): ${profile.email || 'NO EMAIL'}`)
      }
    }
    
    const withoutEmail = profiles.filter(p => !p.email)
    console.log(`\n${withoutEmail.length} profiles need email addresses`)
    
    if (withoutEmail.length === 0) {
      console.log('✅ All admin/core users already have email addresses!')
      rl.close()
      return
    }
    
    // Options
    console.log('\nOptions:')
    console.log('1. Add test emails to ALL admin/core users without emails')
    console.log('2. Add specific email to specific user')
    console.log('3. Exit')
    
    const choice = await question('\nYour choice (1-3): ')
    
    if (choice === '1') {
      const domain = await question('\nEnter email domain (e.g., gmail.com): ')
      
      console.log('\nAdding test emails...')
      for (const profile of withoutEmail) {
        const testEmail = `${profile.twitterHandle.toLowerCase()}@${domain}`
        await updateProfile(profile, testEmail)
      }
      
      console.log(`\n✅ Added test emails to ${withoutEmail.length} profiles`)
      
    } else if (choice === '2') {
      console.log('\nProfiles without email:')
      withoutEmail.forEach((p, i) => {
        console.log(`${i + 1}. ${p.twitterHandle} (${p.role})`)
      })
      
      const index = await question('\nSelect profile number: ')
      const profileIndex = parseInt(index) - 1
      
      if (profileIndex >= 0 && profileIndex < withoutEmail.length) {
        const profile = withoutEmail[profileIndex]
        const email = await question(`\nEnter email for ${profile.twitterHandle}: `)
        
        await updateProfile(profile, email)
        console.log('\n✅ Email added successfully!')
      } else {
        console.log('❌ Invalid selection')
      }
    }
    
    // Show final status
    console.log('\n' + '='.repeat(80))
    console.log('FINAL EMAIL STATUS:')
    console.log('='.repeat(80))
    
    for (const id of allIds) {
      const profile = await redis.json.get(`profile:${id}`)
      if (profile) {
        console.log(`- ${profile.twitterHandle} (${profile.role}): ${profile.email || 'NO EMAIL'}`)
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message)
  } finally {
    rl.close()
  }
}

main() 