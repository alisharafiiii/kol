import { Redis } from '@upstash/redis';

// Parse REDIS_URL if available
let upstashUrl;
let upstashToken;

if (process.env.REDIS_URL) {
  try {
    // Parse redis://default:TOKEN@HOST:PORT format
    const url = new URL(process.env.REDIS_URL);
    const token = url.password; // The password part is the token
    const host = url.hostname;
    
    // Convert to Upstash REST API format
    upstashUrl = `https://${host}`;
    upstashToken = token;
  } catch (error) {
    console.error('Failed to parse REDIS_URL:', error);
  }
}

// Use parsed values or fall back to individual env vars
const UPSTASH_REDIS_REST_URL = upstashUrl || process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_REDIS_REST_TOKEN = upstashToken || process.env.UPSTASH_REDIS_REST_TOKEN;

if (!UPSTASH_REDIS_REST_URL || !UPSTASH_REDIS_REST_TOKEN) {
  console.error('Redis configuration missing. Please set REDIS_URL or UPSTASH_REDIS_REST_URL/TOKEN');
  process.exit(1);
}

const redis = new Redis({
  url: UPSTASH_REDIS_REST_URL,
  token: UPSTASH_REDIS_REST_TOKEN,
});

function normalizeTwitterHandle(handle) {
  if (!handle) return 'unknown';
  // Remove @ symbol if present and convert to lowercase
  return handle.replace('@', '').toLowerCase();
}

async function fixContractHandles() {
  try {
    console.log('Starting contract handle normalization...');
    
    // Get all contract IDs
    const contractIds = await redis.smembers('contracts:all');
    console.log(`Found ${contractIds.length} contracts to process`);
    
    let updated = 0;
    
    for (const contractId of contractIds) {
      const contract = await redis.json.get(contractId);
      if (!contract) continue;
      
      let needsUpdate = false;
      
      // Normalize creator handle
      if (contract.creatorTwitterHandle) {
        const normalized = normalizeTwitterHandle(contract.creatorTwitterHandle);
        if (normalized !== contract.creatorTwitterHandle) {
          const oldHandle = contract.creatorTwitterHandle;
          contract.creatorTwitterHandle = normalized;
          needsUpdate = true;
          console.log(`Updated creator handle for ${contractId}: ${oldHandle} -> ${normalized}`);
        }
      }
      
      // Parse and update parties in terms
      if (contract.body && contract.body.terms) {
        try {
          if (contract.body.terms.startsWith('{')) {
            const termsData = JSON.parse(contract.body.terms);
            
            // Normalize party handles
            if (termsData.parties && Array.isArray(termsData.parties)) {
              let partiesUpdated = false;
              termsData.parties = termsData.parties.map(party => {
                const normalizedName = normalizeTwitterHandle(party.name);
                if (normalizedName !== party.name) {
                  partiesUpdated = true;
                  console.log(`  - Normalized party: ${party.name} -> ${normalizedName}`);
                }
                return {
                  ...party,
                  name: normalizedName
                };
              });
              
              if (partiesUpdated) {
                contract.body.terms = JSON.stringify(termsData);
                needsUpdate = true;
              }
            }
          }
        } catch (e) {
          console.error(`Error parsing terms for ${contractId}:`, e);
        }
      }
      
      // Update recipient handle
      if (contract.recipientTwitterHandle) {
        const normalized = normalizeTwitterHandle(contract.recipientTwitterHandle);
        if (normalized !== contract.recipientTwitterHandle) {
          const oldHandle = contract.recipientTwitterHandle;
          contract.recipientTwitterHandle = normalized;
          needsUpdate = true;
          console.log(`Updated recipient handle for ${contractId}: ${oldHandle} -> ${normalized}`);
        }
      }
      
      // Save updated contract
      if (needsUpdate) {
        await redis.json.set(contractId, '$', contract);
        updated++;
      }
    }
    
    console.log(`\nCompleted! Updated ${updated} out of ${contractIds.length} contracts.`);
    
  } catch (error) {
    console.error('Error fixing contract handles:', error);
  }
}

// Run the fix
fixContractHandles(); 