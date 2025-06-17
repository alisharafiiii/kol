import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createContract, getAllContracts } from '@/modules/onchain-contracts/core'

// Helper function to normalize Twitter handles
function normalizeTwitterHandle(handle: string): string {
  if (!handle) return 'unknown'
  // Remove @ symbol if present and convert to lowercase
  return handle.replace('@', '').toLowerCase()
}

export async function GET(request: NextRequest) {
  try {
    // Check if contracts feature is enabled
    if (process.env.ENABLE_CONTRACTS !== 'true') {
      return NextResponse.json(
        { error: 'Contracts feature is disabled' },
        { status: 403 }
      )
    }

    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get user's handle from session - use the actual Twitter handle, not display name
    const twitterHandle = (session as any)?.twitterHandle || (session?.user as any)?.twitterHandle
    if (!twitterHandle) {
      return NextResponse.json({ error: 'No Twitter handle found' }, { status: 401 })
    }
    
    const userHandle = normalizeTwitterHandle(twitterHandle)

    // Get all contracts
    const allContracts = await getAllContracts()
    
    // Transform and filter contracts
    const userContracts = allContracts
      .map(contract => {
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

        // Transform to frontend format
        return {
          id: contract.id,
          title: contract.title,
          description: description,
          creator: normalizedCreator,
          createdAt: contract.createdAt.toISOString(),
          status: contract.status,
          parties: [
            {
              address: contract.body.walletAddress || '',
              name: normalizedCreator,
              role: 'creator' as const,
              signed: !!contract.adminSignature
            },
            ...(additionalData.parties || []).map((party: any) => ({
              address: party.address || '',
              name: normalizeTwitterHandle(party.name),
              role: party.role || 'signer',
              signed: false
            }))
          ],
          files: additionalData.files || [],
          // Legacy support for single file
          fileUrl: additionalData.fileUrl || additionalData.files?.[0]?.url,
          fileName: additionalData.fileName || additionalData.files?.[0]?.name
        }
      })
      .filter(contract => {
        // Check if user is the creator
        if (contract.creator === userHandle) {
          return true
        }
        
        // Check if user is in the parties list
        // IMPORTANT: Filter out contracts where the user appears with a display name
        if (contract.parties) {
          const userIsParty = contract.parties.some(party => {
            // Only match if the party name is a valid handle (no spaces)
            const isValidHandle = party.name && !party.name.includes(' ')
            return isValidHandle && party.name === userHandle
          })
          
          if (userIsParty) {
            return true
          }
          
          // Also check if any party has a display name that might be this user
          // This prevents showing contracts where the user is listed by display name
          const hasDisplayNameMatch = contract.parties.some(party => {
            // If party name has spaces, it's likely a display name
            return party.name && party.name.includes(' ')
          })
          
          // Don't show contracts with display names as parties
          if (hasDisplayNameMatch) {
            console.log(`Filtering out contract ${contract.id} - has display names in parties`)
            return false
          }
        }
        
        return false
      })

    return NextResponse.json({ contracts: userContracts })
  } catch (error) {
    console.error('Error fetching contracts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contracts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check if contracts feature is enabled
    if (process.env.ENABLE_CONTRACTS !== 'true') {
      return NextResponse.json(
        { error: 'Contracts feature is disabled' },
        { status: 403 }
      )
    }

    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await request.json()

    // Validate required fields
    if (!data.title || !data.description) {
      return NextResponse.json(
        { error: 'Missing required fields: title and description' },
        { status: 400 }
      )
    }

    // Get Twitter handle from session
    const twitterHandle = (session as any)?.twitterHandle || (session?.user as any)?.twitterHandle
    if (!twitterHandle) {
      return NextResponse.json({ error: 'No Twitter handle found' }, { status: 401 })
    }

    // Use the creator handle passed from frontend (which includes the actual Twitter handle)
    // Fall back to session Twitter handle if not provided
    // Always normalize the handle
    const creatorHandle = normalizeTwitterHandle(data.creatorHandle || twitterHandle)

    // Normalize party handles as well
    const normalizedParties = (data.parties || []).map((party: any) => ({
      ...party,
      name: normalizeTwitterHandle(party.name)
    }))

    // Store all data as JSON in the terms field
    const termsData = {
      description: data.description,
      parties: normalizedParties,
      files: data.files || [],
      walletAddress: data.walletAddress
    }

    // Create contract data in the format expected by the core module
    const contractData = {
      title: data.title,
      role: 'creator',
      walletAddress: data.walletAddress || '0x0000000000000000000000000000000000000000',
      startDate: new Date().toISOString(),
      endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
      terms: JSON.stringify(termsData), // Store as JSON string
      compensation: '',
      deliverables: [],
      recipientTwitterHandle: normalizedParties[0]?.name || ''
    }

    // Create the contract with normalized handle
    const contract = await createContract(contractData, creatorHandle)
    
    // Transform the contract to match our frontend interface
    const transformedContract = {
      id: contract.id,
      title: contract.title,
      description: data.description,
      creator: creatorHandle,
      createdAt: contract.createdAt.toISOString(),
      status: contract.status,
      parties: [
        {
          address: data.walletAddress || '',
          name: creatorHandle,
          role: 'creator' as const,
          signed: false
        },
        ...normalizedParties.map((party: any) => ({
          address: party.address || '',
          name: party.name,
          role: party.role || 'signer',
          signed: false
        }))
      ],
      files: data.files || []
    }
    
    return NextResponse.json(transformedContract)
  } catch (error) {
    console.error('Error creating contract:', error)
    return NextResponse.json(
      { error: 'Failed to create contract' },
      { status: 500 }
    )
  }
} 