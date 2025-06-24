#!/usr/bin/env node

/**
 * Script to fix notification keys that have the wrong Redis type
 * Usage: npm run fix:notification-keys
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
console.log('FIX NOTIFICATION REDIS KEYS')
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

async function fixNotificationKeys() {
  try {
    const notificationKeys = [
      'notifications:queue',
      'notifications:sent', 
      'notifications:failed'
    ]
    
    console.log('\nChecking notification keys...\n')
    
    const problematicKeys = []
    
    for (const key of notificationKeys) {
      try {
        const type = await redis.type(key)
        const exists = type !== 'none'
        
        console.log(`Key: ${key}`)
        console.log(`  Exists: ${exists ? 'YES' : 'NO'}`)
        console.log(`  Type: ${type}`)
        console.log(`  Expected: list`)
        
        if (exists && type !== 'list') {
          console.log(`  ⚠️  WRONG TYPE DETECTED!`)
          problematicKeys.push({ key, actualType: type })
        } else if (exists) {
          console.log(`  ✅ Type is correct`)
        }
        
        console.log('')
      } catch (error) {
        console.error(`  Error checking ${key}:`, error.message)
        console.log('')
      }
    }
    
    if (problematicKeys.length === 0) {
      console.log('✅ All notification keys have the correct type!')
      rl.close()
      return
    }
    
    console.log(`\n❌ Found ${problematicKeys.length} keys with wrong type:`)
    problematicKeys.forEach(({ key, actualType }) => {
      console.log(`  - ${key}: ${actualType} (should be list)`)
    })
    
    const proceed = await question('\nDo you want to fix these keys? This will:\n1. Backup the current data\n2. Delete the wrong-typed key\n3. Create a new list key\n\nProceed? (y/N): ')
    
    if (proceed.toLowerCase() !== 'y') {
      console.log('\nOperation cancelled.')
      rl.close()
      return
    }
    
    console.log('\nFixing keys...\n')
    
    for (const { key, actualType } of problematicKeys) {
      console.log(`Fixing ${key}...`)
      
      try {
        // Try to backup the data based on type
        let backupData = null
        const backupKey = `${key}:backup:${Date.now()}`
        
        if (actualType === 'string') {
          const value = await redis.get(key)
          if (value) {
            backupData = value
            await redis.set(backupKey, value)
            console.log(`  ✅ Backed up string data to ${backupKey}`)
          }
        } else if (actualType === 'hash') {
          const allData = await redis.hgetall(key)
          if (allData && Object.keys(allData).length > 0) {
            backupData = allData
            await redis.set(backupKey, JSON.stringify(allData))
            console.log(`  ✅ Backed up hash data to ${backupKey}`)
          }
        } else if (actualType === 'set') {
          const members = await redis.smembers(key)
          if (members && members.length > 0) {
            backupData = members
            await redis.set(backupKey, JSON.stringify(members))
            console.log(`  ✅ Backed up set data to ${backupKey}`)
          }
        }
        
        // Delete the wrong-typed key
        await redis.del(key)
        console.log(`  ✅ Deleted wrong-typed key`)
        
        // Initialize as empty list
        // Note: We can't use lpush with empty array, so we'll leave it uninitialized
        // It will be created automatically when first item is pushed
        console.log(`  ✅ Key ${key} is now ready to be used as a list`)
        
        // Show backup info
        if (backupData) {
          console.log(`  ℹ️  Original data backed up to: ${backupKey}`)
          console.log(`  ℹ️  To retrieve: redis.get("${backupKey}")`)
        }
        
        console.log('')
      } catch (error) {
        console.error(`  ❌ Error fixing ${key}:`, error.message)
        console.log('')
      }
    }
    
    console.log('\n✅ Fix complete!')
    console.log('\nNote: The notification queues are now empty lists.')
    console.log('New notifications will be added to these lists automatically.')
    
  } catch (error) {
    console.error('\nError:', error.message)
  } finally {
    rl.close()
  }
}

fixNotificationKeys() 