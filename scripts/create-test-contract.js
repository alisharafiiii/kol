const { redis } = require('../lib/redis');

async function createTestContract() {
  const testContract = {
    id: 'contract:test123',
    title: 'Test KOL Agreement',
    body: {
      title: 'Test KOL Agreement',
      role: 'Key Opinion Leader',
      walletAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f6E123',
      startDate: '2024-01-01',
      endDate: '2024-12-31',
      terms: 'This is a test contract for demonstration purposes.\n\nThe KOL agrees to:\n- Create content about the project\n- Engage with the community\n- Maintain professional standards',
      compensation: '$5000 USD per month',
      deliverables: ['5 tweets per week', '2 long-form posts per month', '1 community AMA per quarter']
    },
    status: 'draft',
    relayUsed: false,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  try {
    // Store the contract
    await redis.json.set(testContract.id, '$', testContract);
    await redis.sadd('contracts:all', testContract.id);
    
    console.log('✅ Test contract created successfully!');
    console.log('');
    console.log('Contract ID:', testContract.id);
    console.log('Signing URL: http://localhost:3003/sign/contract:test123');
    console.log('');
    console.log('You can now test the wallet connection at the signing URL above.');
  } catch (error) {
    console.error('Error creating test contract:', error);
  } finally {
    await redis.quit();
  }
}

createTestContract(); 