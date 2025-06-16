import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { redis } from '@/lib/redis'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { signature, signerHandle } = body
    
    const contractId = params.id.includes('contract_') ? params.id : `contract_${params.id}`
    
    // Get contract from Redis
    const contractData = await redis.get(`contract:${contractId}`)
    
    if (!contractData) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    const contract = JSON.parse(contractData)
    
    // Verify the signer is the assignee
    const normalizedSigner = signerHandle.replace('@', '').toLowerCase()
    const normalizedAssignee = contract.assignedTo.replace('@', '').toLowerCase()
    
    if (normalizedSigner !== normalizedAssignee) {
      return NextResponse.json(
        { error: 'You are not authorized to sign this contract' },
        { status: 403 }
      )
    }
    
    // Check if already signed
    if (contract.assigneeSignature) {
      return NextResponse.json(
        { error: 'Contract has already been signed by assignee' },
        { status: 400 }
      )
    }
    
    // Update contract with signature
    contract.assigneeSignature = {
      handle: signerHandle,
      signedAt: new Date().toISOString(),
      signature
    }
    contract.status = 'completed'
    
    // Save updated contract
    await redis.set(`contract:${contractId}`, JSON.stringify(contract))
    
    return NextResponse.json({
      success: true,
      contract,
      message: 'Contract signed successfully'
    })
  } catch (error) {
    console.error('Error signing contract:', error)
    return NextResponse.json(
      { error: 'Failed to sign contract' },
      { status: 500 }
    )
  }
} 