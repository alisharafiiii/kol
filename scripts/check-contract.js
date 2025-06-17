const { Redis } = require('@upstash/redis');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function checkContract() {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  const contractId = 'contract:ppsg4ynGm-rj099I9WSgR';
  console.log(`Checking for contract: ${contractId}`);
  
  try {
    const contract = await redis.json.get(contractId);
    
    if (contract) {
      console.log('✅ Contract found!');
      console.log('Title:', contract.title);
      console.log('Status:', contract.status);
      console.log('Created:', contract.createdAt);
      console.log('Creator:', contract.creatorTwitterHandle || 'Not set');
      console.log('Recipient:', contract.recipientTwitterHandle || 'Not set');
    } else {
      console.log('❌ Contract not found');
      
      // Check if it exists in the contracts set
      const allContracts = await redis.smembers('contracts:all');
      console.log('\nAll contracts in system:', allContracts);
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

checkContract(); 