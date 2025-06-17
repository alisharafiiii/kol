import { redis } from '@/lib/redis'
import { nanoid } from 'nanoid'

export interface ContractData {
  title: string
  role: string
  walletAddress: string
  startDate: string
  endDate: string
  terms: string
  compensation?: string
  deliverables?: string[]
  recipientTwitterHandle?: string
}

export interface SignatureData {
  signature: string
  signerAddress: string
  timestamp: number
}

export interface OcContract {
  id: string
  title: string
  body: ContractData
  signerAddress?: string
  adminSignature?: string
  userSignature?: string
  relayUsed: boolean
  txHash?: string
  status: 'draft' | 'pending' | 'signed' | 'published'
  createdAt: Date
  updatedAt: Date
  creatorTwitterHandle?: string
  recipientTwitterHandle?: string
}

// EIP-712 Domain
const DOMAIN = {
  name: 'KOL Contracts',
  version: '1',
  chainId: 1, // Will be dynamic based on env
}

// EIP-712 Types
const TYPES = {
  Contract: [
    { name: 'title', type: 'string' },
    { name: 'role', type: 'string' },
    { name: 'walletAddress', type: 'address' },
    { name: 'startDate', type: 'string' },
    { name: 'endDate', type: 'string' },
    { name: 'terms', type: 'string' },
    { name: 'nonce', type: 'uint256' },
  ],
}

/**
 * Create a new contract draft
 */
export async function createContract(
  data: ContractData,
  creatorTwitterHandle?: string
): Promise<OcContract> {
  if (process.env.ENABLE_CONTRACTS !== 'true') {
    throw new Error('Contracts feature is disabled')
  }

  try {
    const id = `contract:${nanoid()}`
    const now = new Date()
    
    const contract: OcContract = {
      id,
      title: data.title,
      body: data,
      status: 'draft',
      relayUsed: false,
      createdAt: now,
      updatedAt: now,
      creatorTwitterHandle,
      recipientTwitterHandle: data.recipientTwitterHandle
    }

    await redis.json.set(id, '$', contract as any)
    await redis.sadd('contracts:all', id)

    return contract
  } catch (error) {
    console.error('Error creating contract:', error)
    throw error
  }
}

/**
 * Get contract by ID
 */
export async function getContract(id: string): Promise<OcContract | null> {
  if (process.env.ENABLE_CONTRACTS !== 'true') {
    throw new Error('Contracts feature is disabled')
  }

  try {
    const contract = await redis.json.get(id) as any
    if (!contract) return null
    
    // Convert date strings back to Date objects
    return {
      ...contract,
      createdAt: new Date(contract.createdAt),
      updatedAt: new Date(contract.updatedAt),
    }
  } catch (error) {
    console.error('Error fetching contract:', error)
    return null
  }
}

/**
 * Get all contracts
 */
export async function getAllContracts(): Promise<OcContract[]> {
  if (process.env.ENABLE_CONTRACTS !== 'true') {
    throw new Error('Contracts feature is disabled')
  }

  try {
    const contractIds = await redis.smembers('contracts:all')
    const contracts: OcContract[] = []

    for (const id of contractIds) {
      const contract = await getContract(id)
      if (contract) contracts.push(contract)
    }

    return contracts.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  } catch (error) {
    console.error('Error fetching contracts:', error)
    return []
  }
}

/**
 * Generate EIP-712 typed data for signing
 */
export function getTypedData(contractData: ContractData, nonce: number) {
  return {
    domain: DOMAIN,
    types: TYPES,
    primaryType: 'Contract',
    message: {
      ...contractData,
      walletAddress: contractData.walletAddress.toLowerCase(),
      nonce,
    },
  }
}

/**
 * Verify a signature and recover the signer address
 * Note: This is a placeholder - actual implementation requires ethers.js or similar
 */
export async function verifySignature(
  contractData: ContractData,
  signature: string,
  nonce: number
): Promise<string> {
  // Placeholder implementation
  console.log('Verifying signature:', { contractData, signature, nonce })
  
  // In production, this would use ethers.js to verify the signature
  // For now, return a mock address
  return '0x' + '0'.repeat(40)
}

/**
 * Update contract with signature
 */
export async function updateContractSignature(
  id: string,
  signature: string,
  signerAddress: string,
  isAdmin: boolean
): Promise<OcContract | null> {
  if (process.env.ENABLE_CONTRACTS !== 'true') {
    throw new Error('Contracts feature is disabled')
  }

  try {
    const contract = await getContract(id)
    if (!contract) {
      throw new Error('Contract not found')
    }

    // Update signature fields
    if (isAdmin) {
      contract.adminSignature = signature
    } else {
      contract.userSignature = signature
      contract.signerAddress = signerAddress
    }

    // Update status if both signatures are present
    if (contract.adminSignature && contract.userSignature) {
      contract.status = 'signed'
    } else {
      contract.status = 'pending'
    }

    contract.updatedAt = new Date()

    await redis.json.set(id, '$', contract as any)
    return contract
  } catch (error) {
    console.error('Error updating contract signature:', error)
    throw error
  }
}

/**
 * Publish contract to chain (placeholder)
 */
export async function publishToChain(contractId: string): Promise<OcContract> {
  if (process.env.ENABLE_CONTRACTS !== 'true') {
    throw new Error('Contracts feature is disabled')
  }

  const contract = await getContract(contractId)
  if (!contract) {
    throw new Error('Contract not found')
  }

  if (contract.status !== 'signed') {
    throw new Error('Contract must be signed by both parties')
  }

  // Check if relay is enabled
  if (process.env.USE_RELAY === 'true') {
    return useRelay(contract)
  }

  // Direct chain publishing will be implemented with wagmi
  throw new Error('Direct chain publishing not implemented yet')
}

/**
 * Use relay for gasless transactions (placeholder)
 */
export async function useRelay(contract: OcContract): Promise<OcContract> {
  if (!process.env.RELAY_ENDPOINT || !process.env.RELAY_TOKEN_SECRET) {
    throw new Error('Relay configuration missing')
  }

  // Placeholder for relay logic
  console.log('Using relay for contract:', contract.id)
  
  // Update contract to mark relay was used
  contract.relayUsed = true
  contract.status = 'published'
  contract.txHash = '0x' + 'placeholder'.repeat(6) // Mock tx hash
  contract.updatedAt = new Date()
  
  await redis.json.set(contract.id, '$', contract as any)
  
  return contract
}

/**
 * Store contract on IPFS (placeholder)
 */
export async function storeOnIPFS(contractData: any): Promise<string> {
  // Placeholder for IPFS storage
  console.log('Storing on IPFS:', contractData)
  return 'ipfs://placeholder-cid'
} 