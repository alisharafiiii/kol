// Test script for contract signing flow
import fetch from 'node-fetch'

const BASE_URL = 'http://localhost:3000'
const CONTRACT_ID = 'test123' // Will be normalized to contract:test123

async function testContractSigning() {
  console.log('Testing contract signing flow...\n')
  
  // Step 1: Fetch contract
  console.log('1. Fetching contract...')
  try {
    const getRes = await fetch(`${BASE_URL}/api/contracts/${CONTRACT_ID}`)
    const contract = await getRes.json()
    
    if (getRes.ok) {
      console.log('✅ Contract fetched successfully')
      console.log('   Status:', contract.status)
      console.log('   User Signature:', contract.userSignature ? 'Present' : 'Not signed')
    } else {
      console.log('❌ Failed to fetch contract:', contract.error)
    }
  } catch (error) {
    console.log('❌ Error fetching contract:', error.message)
  }
  
  // Step 2: Sign contract
  console.log('\n2. Signing contract...')
  try {
    const signRes = await fetch(`${BASE_URL}/api/contracts/${CONTRACT_ID}/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        signature: '0x' + 'a'.repeat(130), // Mock signature
        signerAddress: '0x742d35Cc6634C0532925a3b844Bc9e7595f6E123',
        twitterHandle: 'testuser',
        nonce: Date.now()
      })
    })
    
    const result = await signRes.json()
    
    if (signRes.ok) {
      console.log('✅ Contract signed successfully')
      console.log('   Message:', result.message)
      console.log('   Contract Status:', result.contract.status)
      console.log('   User Signature:', result.contract.userSignature ? 'Present' : 'Missing')
    } else {
      console.log('❌ Failed to sign contract:', result.error)
    }
  } catch (error) {
    console.log('❌ Error signing contract:', error.message)
  }
  
  // Step 3: Verify contract is updated
  console.log('\n3. Verifying contract update...')
  try {
    const verifyRes = await fetch(`${BASE_URL}/api/contracts/${CONTRACT_ID}`)
    const updatedContract = await verifyRes.json()
    
    if (verifyRes.ok) {
      console.log('✅ Contract verification complete')
      console.log('   Status:', updatedContract.status)
      console.log('   User Signature:', updatedContract.userSignature ? 'Present' : 'Not signed')
      console.log('   Signer Address:', updatedContract.signerAddress || 'Not set')
    } else {
      console.log('❌ Failed to verify contract:', updatedContract.error)
    }
  } catch (error) {
    console.log('❌ Error verifying contract:', error.message)
  }
}

// Run the test
testContractSigning().catch(console.error) 