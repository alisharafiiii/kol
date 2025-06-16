import { NextRequest, NextResponse } from 'next/server'
import { redis } from '@/lib/redis'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const contractId = params.id.includes('contract_') ? params.id : `contract_${params.id}`
    
    // Get contract from Redis
    const contractData = await redis.get(`contract:${contractId}`)
    
    if (!contractData) {
      return NextResponse.json({ error: 'Contract not found' }, { status: 404 })
    }

    const contract = JSON.parse(contractData)
    
    return NextResponse.json(contract)
  } catch (error) {
    console.error('Error fetching contract:', error)
    return NextResponse.json(
      { error: 'Failed to fetch contract' },
      { status: 500 }
    )
  }
} 