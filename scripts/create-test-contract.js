const { Redis } = require('@upstash/redis');
const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

async function createTestContract() {
  console.log('🔧 Creating test contract...\n');

  // Check if contracts feature is enabled
  if (process.env.ENABLE_CONTRACTS !== 'true') {
    console.error('❌ Contracts feature is disabled. Set ENABLE_CONTRACTS=true in your .env.local');
    process.exit(1);
  }

  // Initialize Redis client
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });

  try {
    // Create test contract data
    const contractId = 'contract:test123';
    const now = new Date();
    
    const contract = {
      id: contractId,
      title: 'Test KOL Agreement',
      body: {
        title: 'Test KOL Agreement',
        role: 'Key Opinion Leader',
        walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f6E123',
        startDate: '2024-01-01',
        endDate: '2024-12-31',
        terms: 'This is a test contract for development.\n\nThe KOL agrees to:\n- Create content about the project\n- Engage with the community\n- Maintain professional standards\n\nThis is a binding agreement between both parties.',
        compensation: '$5000 USD per month',
        deliverables: [
          '5 tweets per week',
          '2 long-form posts per month',
          '1 community AMA per quarter'
        ]
      },
      status: 'draft',
      relayUsed: false,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    // Save to Redis
    console.log('📝 Contract data:', JSON.stringify(contract, null, 2));
    console.log('\n💾 Saving to Redis...');
    
    await redis.json.set(contractId, '$', contract);
    await redis.sadd('contracts:all', contractId);
    
    console.log('✅ Contract created successfully!');
    console.log(`\n🔗 Signing URL: http://localhost:3000/sign/test123`);
    console.log(`🔗 Direct URL: http://localhost:3000/sign/${contractId}`);
    
    // Verify it was saved
    console.log('\n🔍 Verifying contract was saved...');
    const savedContract = await redis.json.get(contractId);
    if (savedContract) {
      console.log('✅ Contract verified in Redis');
    } else {
      console.log('❌ Contract not found in Redis');
    }
    
  } catch (error) {
    console.error('❌ Error creating contract:', error);
    process.exit(1);
  }
}

// Run the script
createTestContract(); 