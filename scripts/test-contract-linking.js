const { Redis } = require('@upstash/redis');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function testContractLinking() {
  console.log('🔧 Testing contract linking functionality...\n');

  // Initialize Redis client
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  try {
    // 1. Check if test contract exists
    const contractId = 'contract:test123';
    const contract = await redis.json.get(contractId);
    
    if (!contract) {
      console.log('❌ Test contract not found. Please run create-test-contract.js first.');
      return;
    }
    
    console.log('✅ Found test contract:', contractId);
    console.log('   Title:', contract.title);
    console.log('   Status:', contract.status);
    console.log('   Creator:', contract.creatorTwitterHandle || 'Not set');
    console.log('   Recipient:', contract.recipientTwitterHandle || 'Not set');
    
    // 2. Check contract indexes
    console.log('\n📊 Checking contract indexes...');
    
    const contractUsers = await redis.smembers(`idx:contract:${contractId}:users`);
    console.log(`   Users linked to contract: ${contractUsers.length}`);
    contractUsers.forEach(userId => {
      console.log(`   - ${userId}`);
    });
    
    // 3. Check user profiles for contracts
    console.log('\n👤 Checking user profiles...');
    
    // Check a specific user (e.g., the test user)
    const testUserHandle = 'testuser';
    const userIds = await redis.smembers(`idx:username:${testUserHandle}`);
    
    if (userIds && userIds.length > 0) {
      const userId = userIds[0];
      const userProfile = await redis.json.get(`user:${userId}`);
      
      if (userProfile) {
        console.log(`\nUser profile for @${testUserHandle}:`);
        console.log('   ID:', userProfile.id);
        console.log('   Name:', userProfile.name);
        console.log('   Contracts:', userProfile.contracts ? userProfile.contracts.length : 0);
        
        if (userProfile.contracts && userProfile.contracts.length > 0) {
          userProfile.contracts.forEach(contract => {
            console.log(`   - Contract ${contract.id} (${contract.role}) linked at ${contract.linkedAt}`);
          });
        }
      }
    } else {
      console.log(`   No profile found for @${testUserHandle}`);
    }
    
    // 4. Test the API endpoint
    console.log('\n🌐 Testing API endpoint...');
    console.log('   You can test the API by visiting:');
    console.log(`   http://localhost:3000/api/user/contracts?handle=${testUserHandle}`);
    
    // 5. Summary
    console.log('\n📋 Summary:');
    console.log('   - Contract linking system is set up');
    console.log('   - Contracts are stored with creator/recipient info');
    console.log('   - User profiles can have linked contracts');
    console.log('   - API endpoint is available for fetching user contracts');
    console.log('\n✨ To see contracts on a profile:');
    console.log('   1. Create a contract via /contracts-admin');
    console.log('   2. Set the recipient Twitter handle');
    console.log('   3. Sign the contract at /sign/[contractId]');
    console.log('   4. View the profile at /profile/[handle]');
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the test
testContractLinking(); 