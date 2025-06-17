import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getContract, updateContractSignature } from '@/modules/onchain-contracts/core'

export async function POST(
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

    // Check authentication
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { signature, walletAddress, message } = await request.json()
    const contractId = params.id.startsWith('contract:') ? params.id : `contract:${params.id}`
    
    // Get Twitter handle from session
    const twitterHandle = (session as any)?.twitterHandle || (session?.user as any)?.twitterHandle
    if (!twitterHandle) {
      return NextResponse.json({ error: 'No Twitter handle found' }, { status: 401 })
    }
    
    // Normalize the handle
    const userHandle = twitterHandle.toLowerCase().replace('@', '')

    // Get the contract
    const contract = await getContract(contractId)
    if (!contract) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    // Parse the terms to get party information
    let termsData: any = { parties: [] }
    try {
      if (contract.body.terms.startsWith('{')) {
        termsData = JSON.parse(contract.body.terms)
      }
    } catch (e) {
      // Ignore parse errors
    }

    // Check if user is the creator
    const isCreator = contract.creatorTwitterHandle?.toLowerCase().replace('@', '') === userHandle

    // Check if user is a party to this contract
    const userParty = termsData.parties?.find((party: any) => 
      party.name.toLowerCase().replace('@', '') === userHandle
    )

    // Debug logging
    console.log('Sign endpoint - User handle:', userHandle)
    console.log('Sign endpoint - Contract creator:', contract.creatorTwitterHandle)
    console.log('Sign endpoint - Is creator:', isCreator)
    console.log('Sign endpoint - Terms data parties:', termsData.parties)
    console.log('Sign endpoint - User party:', userParty)
    console.log('Sign endpoint - Wallet address provided:', walletAddress)
    
    // Additional debug: show all party names and their normalized versions
    if (termsData.parties) {
      console.log('Sign endpoint - All parties normalized:')
      termsData.parties.forEach((party: any, idx: number) => {
        console.log(`  Party ${idx}: "${party.name}" -> "${party.name.toLowerCase().replace('@', '')}" (match: ${party.name.toLowerCase().replace('@', '') === userHandle})`)
      })
    }

    if (!isCreator && !userParty) {
      return NextResponse.json(
        { error: 'You are not a party to this contract' },
        { status: 403 }
      )
    }

    // Verify wallet address matches
    if (userParty && userParty.address) {
      const expectedAddress = userParty.address.toLowerCase()
      const providedAddress = walletAddress?.toLowerCase()
      
      if (expectedAddress !== providedAddress) {
        return NextResponse.json(
          { error: `Wallet address mismatch. Expected: ${userParty.address}` },
          { status: 400 }
        )
      }
    }

    // TODO: In a real implementation, verify the signature here
    // For now, we just check that a signature was provided
    if (!signature) {
      return NextResponse.json(
        { error: 'Signature is required' },
        { status: 400 }
      )
    }

    // Update the contract with signature
    const updatedContract = await updateContractSignature(
      contractId,
      signature,
      userHandle,
      isCreator // Admin signature if creator
    )

    if (!updatedContract) {
      return NextResponse.json(
        { error: 'Failed to update contract' },
        { status: 500 }
      )
    }

    // Transform and return the updated contract
    const transformedContract = {
      id: updatedContract.id,
      title: updatedContract.title,
      description: termsData.description || updatedContract.body.terms,
      creator: updatedContract.creatorTwitterHandle || 'unknown',
      createdAt: updatedContract.createdAt.toISOString(),
      status: updatedContract.status,
      parties: [
        {
          address: termsData.walletAddress || updatedContract.body.walletAddress || '',
          name: updatedContract.creatorTwitterHandle || 'unknown',
          role: 'creator' as const,
          signed: !!updatedContract.adminSignature,
          signedAt: updatedContract.adminSignature ? new Date().toISOString() : undefined
        },
        ...(termsData.parties || []).map((party: any) => ({
          address: party.address || '',
          name: party.name,
          role: party.role || 'signer',
          signed: party.name.toLowerCase() === userHandle && !!updatedContract.userSignature,
          signedAt: party.name.toLowerCase() === userHandle && updatedContract.userSignature ? new Date().toISOString() : undefined
        }))
      ],
      files: termsData.files || [],
      fileUrl: termsData.fileUrl,
      fileName: termsData.fileName
    }

    return NextResponse.json(transformedContract)
  } catch (error) {
    console.error('Error signing contract:', error)
    return NextResponse.json(
      { error: 'Failed to sign contract' },
      { status: 500 }
    )
  }
} 