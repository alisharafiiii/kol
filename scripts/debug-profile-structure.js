#!/usr/bin/env node

// Script to debug profile structure
require('dotenv').config({ path: '.env.local' })

async function debugProfiles() {
  console.log('🔍 Debugging profile structure...\n')
  
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  
  if (!url || !token) {
    console.error('❌ Missing UPSTASH_REDIS_REST_URL or UPSTASH_REDIS_REST_TOKEN')
    return
  }
  
  try {
    // Get all keys
    const keysResponse = await fetch(`${url}/keys/*`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    
    const keysData = await keysResponse.json()
    const allKeys = keysData.result || []
    
    console.log(`Total keys in database: ${allKeys.length}\n`)
    
    // Group keys by pattern
    const keyPatterns = {}
    allKeys.forEach(key => {
      const pattern = key.split(':')[0]
      keyPatterns[pattern] = (keyPatterns[pattern] || 0) + 1
    })
    
    console.log('Key patterns:')
    Object.entries(keyPatterns).forEach(([pattern, count]) => {
      console.log(`- ${pattern}:* → ${count} keys`)
    })
    
    // Look for profile-related keys
    const profileKeys = allKeys.filter(key => 
      key.includes('profile') || 
      key.includes('user') || 
      key.includes('kol') ||
      key.includes('team')
    )
    
    console.log(`\n📋 Found ${profileKeys.length} profile-related keys`)
    
    // Check first few profile-related entries
    console.log('\nSample entries:')
    for (let i = 0; i < Math.min(5, profileKeys.length); i++) {
      const key = profileKeys[i]
      const getResponse = await fetch(`${url}/get/${key}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      
      const getData = await getResponse.json()
      if (getData.result) {
        console.log(`\n🔑 ${key}:`)
        try {
          const data = JSON.parse(getData.result)
          console.log('  Type:', typeof data)
          console.log('  Fields:', Object.keys(data).join(', '))
          if (data.role) console.log('  Role:', data.role)
          if (data.name) console.log('  Name:', data.name)
          if (data.twitterHandle) console.log('  Handle:', data.twitterHandle)
          if (data.handle) console.log('  Handle (alt):', data.handle)
        } catch (e) {
          console.log('  Raw value:', getData.result.substring(0, 100) + '...')
        }
      }
    }
    
    // Also check for unified profiles
    console.log('\n🔍 Checking for unified profiles...')
    const unifiedKeys = allKeys.filter(key => key.includes('unified'))
    console.log(`Found ${unifiedKeys.length} unified profile keys`)
    
    if (unifiedKeys.length > 0) {
      const sampleKey = unifiedKeys[0]
      const getResponse = await fetch(`${url}/get/${sampleKey}`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      
      const getData = await getResponse.json()
      if (getData.result) {
        try {
          const data = JSON.parse(getData.result)
          console.log('\nSample unified profile structure:')
          console.log('Fields:', Object.keys(data).join(', '))
        } catch (e) {
          console.log('Failed to parse unified profile')
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error)
  }
}

debugProfiles() 