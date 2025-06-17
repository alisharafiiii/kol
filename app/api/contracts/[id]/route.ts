import { NextRequest, NextResponse } from 'next/server'
import { getContract } from '@/modules/onchain-contracts/core'

// Helper function to normalize Twitter handles
function normalizeTwitterHandle(handle: string): string {
  if (!handle) return 'unknown'
  // Remove @ symbol if present and convert to lowercase
  return handle.replace('@', '').toLowerCase()
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if contracts feature is enabled
    if (process.env.ENABLE_CONTRACTS !== 'true') {
      return NextResponse.json(
        { error: 'Contracts feature is disabled' },
        { status: 403 }
      )
    }

    const contractId = params.id.startsWith('contract:') ? params.id : `contract:${params.id}`

    // Get the contract
    const contract = await getContract(contractId)
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    // Parse additional data from terms field
    let description = contract.body.terms
    let additionalData: any = { parties: [] }
    
    try {
      // Check if terms contains JSON data
      if (contract.body.terms.startsWith('{')) {
        const parsed = JSON.parse(contract.body.terms)
        description = parsed.description || contract.body.terms
        additionalData = parsed
      }
    } catch (e) {
      // If not JSON, use terms as description
    }

    // Normalize the creator handle
    const normalizedCreator = normalizeTwitterHandle(contract.creatorTwitterHandle || 'unknown')

    console.log('Contract debug:', {
      id: contract.id,
      creator: contract.creatorTwitterHandle,
      normalizedCreator: normalizedCreator,
      walletAddress: contract.body.walletAddress,
      additionalData: additionalData
    })

    // Transform to frontend format
    const transformedContract = {
      id: contract.id,
      title: contract.title,
      description: description,
      creator: normalizedCreator,
      createdAt: contract.createdAt.toISOString(),
      status: contract.status,
      parties: [
        {
          address: additionalData.walletAddress || contract.body.walletAddress || '',
          name: normalizedCreator,
          role: 'creator' as const,
          signed: !!contract.adminSignature,
          signedAt: contract.adminSignature ? contract.updatedAt.toISOString() : undefined
        },
        ...(additionalData.parties || []).map((party: any) => ({
          address: party.address || '',
          name: normalizeTwitterHandle(party.name),
          role: party.role || 'signer',
          signed: false,
          signedAt: undefined
        }))
      ],
      files: additionalData.files || [],
      // Legacy support for single file
      fileUrl: additionalData.fileUrl || additionalData.files?.[0]?.url,
      fileName: additionalData.fileName || additionalData.files?.[0]?.name,
      // Add a warning if any parties have display names
      hasDisplayNameIssue: (additionalData.parties || []).some((party: any) => 
        party.name && party.name.includes(' ')
      )
    }

    // Debug logging
    console.log('Contract ID:', contract.id)
    console.log('Contract creator (original):', contract.creatorTwitterHandle)
    console.log('Contract creator (normalized):', normalizedCreator)
    console.log('Contract parties:', transformedContract.parties)

    return NextResponse.json(transformedContract)
  } catch (error) {
    console.error('Error fetching contract:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contract' },
      { status: 500 }
    )
  }
} 