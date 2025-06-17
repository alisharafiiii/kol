import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { getUserContracts } from '@/modules/onchain-contracts/core/profile-contracts'
import { getContract } from '@/modules/onchain-contracts/core'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const { searchParams } = new URL(request.url)
    const handle = searchParams.get('handle')
    
    // If no handle provided, use the session user's handle
    const twitterHandle = handle || (session as any)?.twitterHandle || session?.user?.name
    
    if (!twitterHandle) {
      return NextResponse.json({ error: 'No Twitter handle provided' }, { status: 400 })
    }
    
    // Get contract IDs for the user
    const contractIds = await getUserContracts(twitterHandle)
    
    // Fetch full contract details
    const contracts = []
    for (const contractId of contractIds) {
      const contract = await getContract(contractId)
      if (contract) {
        contracts.push(contract)
      }
    }
    
    // Sort by creation date (newest first)
    contracts.sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
    
    return NextResponse.json({
      handle: twitterHandle,
      contracts: contracts,
      count: contracts.length
    })
  } catch (error) {
    console.error('Error fetching user contracts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contracts' },
      { status: 500 }
    )
  }
} 