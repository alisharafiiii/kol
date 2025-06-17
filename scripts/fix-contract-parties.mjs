import { createClient } from 'redis'

// Map of known display names to Twitter handles
const nameToHandleMap = {
  'ali sharafi': 'sharafi_eth',
  'nabu.base.eth': 'sharafi_eth',
  // Add more mappings as needed
}

async function fixContractParties() {
  const redis = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  })

  try {
    await redis.connect()
    console.log('Connected to Redis')

    // Get all contracts
    const contractKeys = await redis.keys('contract:*')
    console.log(`Found ${contractKeys.length} contracts`)

    let fixedCount = 0

    for (const key of contractKeys) {
      const contract = await redis.hGetAll(key)
      
      if (!contract.body) continue
      
      try {
        const body = JSON.parse(contract.body)
        
        // Check if terms contains the party data
        if (body.terms) {
          let terms
          try {
            terms = JSON.parse(body.terms)
          } catch (e) {
            // terms might not be JSON
            continue
          }

          let modified = false

          // Fix parties in the terms
          if (terms.parties && Array.isArray(terms.parties)) {
            terms.parties = terms.parties.map(party => {
              const normalizedName = party.name?.toLowerCase().replace('@', '')
              
              // Check if this is a display name that needs to be converted
              for (const [displayName, handle] of Object.entries(nameToHandleMap)) {
                if (normalizedName === displayName.toLowerCase()) {
                  console.log(`Fixing party: "${party.name}" -> "${handle}"`)
                  party.name = handle
                  modified = true
                }
              }
              
              return party
            })
          }

          // Fix creator handle if needed
          const creatorHandle = contract.creatorTwitterHandle?.toLowerCase().replace('@', '')
          for (const [displayName, handle] of Object.entries(nameToHandleMap)) {
            if (creatorHandle === displayName.toLowerCase()) {
              console.log(`Fixing creator: "${contract.creatorTwitterHandle}" -> "${handle}"`)
              await redis.hSet(key, 'creatorTwitterHandle', handle)
              modified = true
            }
          }

          if (modified) {
            // Update the terms with fixed party names
            body.terms = JSON.stringify(terms)
            await redis.hSet(key, 'body', JSON.stringify(body))
            fixedCount++
            console.log(`Fixed contract: ${key}`)
          }
        }
      } catch (error) {
        console.error(`Error processing contract ${key}:`, error)
      }
    }

    console.log(`\nFixed ${fixedCount} contracts`)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await redis.quit()
  }
}

// Run the fix
fixContractParties() 