#!/usr/bin/env node

/**
 * Utility script to check all notification-related Redis keys and their types
 * Usage: npm run check:notification-keys
 */

import dotenv from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { Redis } from '@upstash/redis'

const __dirname = dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: join(__dirname, '..', '.env.local') })

console.log('='.repeat(80))
console.log('NOTIFICATION REDIS KEYS CHECK')
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

async function checkNotificationKeys() {
  try {
    console.log('\n1. CHECKING PREDEFINED NOTIFICATION KEYS:')
    const predefinedKeys = [
      'notifications:queue',
      'notifications:sent',
      'notifications:failed'
    ]
    
    for (const key of predefinedKeys) {
      try {
        const type = await redis.type(key)
        const exists = type !== 'none'
        
        console.log(`\n   Key: ${key}`)
        console.log(`   Exists: ${exists ? '✅ YES' : '❌ NO'}`)
        console.log(`   Type: ${type}`)
        
        if (exists && type === 'list') {
          try {
            const length = await redis.llen(key)
            console.log(`   Length: ${length} items`)
            
            // Show sample item if exists
            if (length > 0) {
              const sample = await redis.lrange(key, 0, 0)
              if (sample && sample[0]) {
                try {
                  const parsed = typeof sample[0] === 'string' ? JSON.parse(sample[0]) : sample[0]
                  console.log(`   Sample ID: ${parsed.id || 'N/A'}`)
                  console.log(`   Sample Type: ${parsed.type || 'N/A'}`)
                } catch (e) {
                  console.log(`   Sample: Unable to parse (${e.message})`)
                }
              }
            }
          } catch (e) {
            console.log(`   Error reading list: ${e.message}`)
          }
        } else if (exists && type !== 'list') {
          console.log(`   ⚠️  WARNING: Expected type 'list' but found '${type}'`)
          
          // Try to show what's in there
          if (type === 'string') {
            try {
              const value = await redis.get(key)
              console.log(`   String value preview: ${JSON.stringify(value).substring(0, 100)}...`)
            } catch (e) {
              console.log(`   Could not read string value: ${e.message}`)
            }
          } else if (type === 'hash') {
            try {
              const keys = await redis.hkeys(key)
              console.log(`   Hash keys: ${keys.slice(0, 5).join(', ')}${keys.length > 5 ? '...' : ''}`)
            } catch (e) {
              console.log(`   Could not read hash keys: ${e.message}`)
            }
          } else if (type === 'set') {
            try {
              const members = await redis.smembers(key)
              console.log(`   Set size: ${members.length} members`)
            } catch (e) {
              console.log(`   Could not read set members: ${e.message}`)
            }
          }
        }
      } catch (error) {
        console.log(`   Key: ${key}`)
        console.log(`   Error: ${error.message}`)
      }
    }
    
    console.log('\n2. SEARCHING FOR OTHER NOTIFICATION-RELATED KEYS:')
    console.log('   (Looking for keys containing "notif"...)')
    
    // Search for any keys containing "notif"
    const patterns = ['*notif*', '*notification*', '*email*queue*']
    const foundKeys = new Set()
    
    for (const pattern of patterns) {
      try {
        const keys = await redis.keys(pattern)
        keys.forEach(key => foundKeys.add(key))
      } catch (e) {
        console.log(`   Error searching with pattern "${pattern}": ${e.message}`)
      }
    }
    
    // Remove predefined keys from found keys
    predefinedKeys.forEach(key => foundKeys.delete(key))
    
    if (foundKeys.size > 0) {
      console.log(`\n   Found ${foundKeys.size} additional keys:`)
      
      for (const key of foundKeys) {
        try {
          const type = await redis.type(key)
          console.log(`\n   Key: ${key}`)
          console.log(`   Type: ${type}`)
          
          // Show size/length based on type
          if (type === 'list') {
            const length = await redis.llen(key)
            console.log(`   Length: ${length} items`)
          } else if (type === 'set') {
            const card = await redis.scard(key)
            console.log(`   Size: ${card} members`)
          } else if (type === 'hash') {
            const keys = await redis.hkeys(key)
            console.log(`   Fields: ${keys.length}`)
          }
        } catch (e) {
          console.log(`   Error checking key: ${e.message}`)
        }
      }
    } else {
      console.log('   No additional notification-related keys found.')
    }
    
    console.log('\n3. RECOMMENDATIONS:')
    console.log('   - If you see WRONGTYPE errors, check the keys above marked with ⚠️')
    console.log('   - Keys should be of type "list" for notification queues')
    console.log('   - To fix: Either delete the wrong-typed key or migrate its data')
    console.log('   - To delete a key: redis.del("key-name")')
    
  } catch (error) {
    console.error('\nError checking notification keys:', error.message)
  }
}

checkNotificationKeys().then(() => {
  console.log('\n' + '='.repeat(80))
  console.log('CHECK COMPLETE')
  console.log('='.repeat(80))
  process.exit(0)
}) 