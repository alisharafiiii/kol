import Redis from 'ioredis'

async function fixContractPartyHandles() {
  const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379')

  try {
    console.log('Connected to Redis')

    // Get all contracts
    const contractKeys = await redis.keys('contract:*')
    console.log(`Found ${contractKeys.length} contracts`)

    let fixedCount = 0
    let removedCount = 0

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
          let shouldRemove = false

          // Fix creator handle if it's a display name
          const creatorHandle = contract.creatorTwitterHandle
          if (creatorHandle && creatorHandle.includes(' ')) {
            console.log(`Creator "${creatorHandle}" appears to be a display name, not a handle`)
            
            // Try to find the actual handle by searching for users with this name
            const userKeys = await redis.keys('user:*')
            let foundHandle = null
            
            for (const userKey of userKeys) {
              const userData = await redis.hGetAll(userKey)
              if (userData.name?.toLowerCase() === creatorHandle.toLowerCase()) {
                // Found a user with this display name
                const twitterHandle = userData.twitterHandle?.replace('@', '') || 
                                    userKey.replace('user:', '').replace('twitter_', '')
                if (twitterHandle && !twitterHandle.includes(' ')) {
                  foundHandle = twitterHandle
                  console.log(`Found handle for creator "${creatorHandle}": ${foundHandle}`)
                  break
                }
              }
            }
            
            if (foundHandle) {
              await redis.hSet(key, 'creatorTwitterHandle', foundHandle)
              modified = true
            } else {
              console.log(`Could not find handle for creator "${creatorHandle}" - marking for removal`)
              shouldRemove = true
            }
          }

          // Fix parties in the terms
          if (terms.parties && Array.isArray(terms.parties)) {
            const fixedParties = []
            
            for (const party of terms.parties) {
              const partyName = party.name
              
              // Check if this looks like a display name (contains spaces)
              if (partyName && partyName.includes(' ')) {
                console.log(`Party "${partyName}" appears to be a display name, not a handle`)
                
                // Try to find the actual handle
                const userKeys = await redis.keys('user:*')
                let foundHandle = null
                
                for (const userKey of userKeys) {
                  const userData = await redis.hGetAll(userKey)
                  if (userData.name?.toLowerCase() === partyName.toLowerCase()) {
                    // Found a user with this display name
                    const twitterHandle = userData.twitterHandle?.replace('@', '') || 
                                        userKey.replace('user:', '').replace('twitter_', '')
                    if (twitterHandle && !twitterHandle.includes(' ')) {
                      foundHandle = twitterHandle
                      console.log(`Found handle for party "${partyName}": ${foundHandle}`)
                      break
                    }
                  }
                }
                
                if (foundHandle) {
                  party.name = foundHandle
                  fixedParties.push(party)
                  modified = true
                } else {
                  console.log(`Could not find handle for party "${partyName}" - removing from contract`)
                  modified = true
                  // Don't add this party to fixedParties
                }
              } else {
                // Keep parties that already have handles
                fixedParties.push(party)
              }
            }
            
            terms.parties = fixedParties
            
            // If no valid parties left, mark for removal
            if (fixedParties.length === 0 && contract.creatorTwitterHandle?.includes(' ')) {
              shouldRemove = true
            }
          }

          if (shouldRemove) {
            // Remove contracts that have invalid creator and no valid parties
            await redis.del(key)
            removedCount++
            console.log(`Removed invalid contract: ${key}`)
          } else if (modified) {
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

    console.log(`\nSummary:`)
    console.log(`- Fixed ${fixedCount} contracts`)
    console.log(`- Removed ${removedCount} invalid contracts`)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    await redis.quit()
  }
}

// Run the fix
fixContractPartyHandles() 