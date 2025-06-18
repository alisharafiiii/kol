#!/usr/bin/env node

// Script to check raw profile data
require('dotenv').config({ path: '.env.local' })

async function checkRawProfile() {
  const url = process.env.UPSTASH_REDIS_REST_URL
  const token = process.env.UPSTASH_REDIS_REST_TOKEN
  
  const key = 'profile:admin_alice'
  
  try {
    const getResponse = await fetch(`${url}/get/${key}`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
    
    const getData = await getResponse.json()
    console.log('Raw response:', getData)
    
    if (getData.result) {
      console.log('\nRaw result:', getData.result)
      console.log('\nType:', typeof getData.result)
      
      // Try double parse (in case it's double stringified)
      try {
        const firstParse = JSON.parse(getData.result)
        console.log('\nFirst parse:', firstParse)
        console.log('Type after first parse:', typeof firstParse)
        
        if (typeof firstParse === 'string') {
          const secondParse = JSON.parse(firstParse)
          console.log('\nSecond parse:', secondParse)
        }
      } catch (e) {
        console.log('Parse error:', e.message)
      }
    }
    
  } catch (error) {
    console.error('Error:', error)
  }
}

checkRawProfile() 