import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { createContract, getAllContracts } from '@/modules/onchain-contracts/core'
import { hasAdminAccess } from '@/lib/admin-config'

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
    if (!session?.user?.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin access
    const userRole = (session as any)?.role || (session as any)?.user?.role
    if (!hasAdminAccess(session.user.name, userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const contracts = await getAllContracts()
    return NextResponse.json(contracts)
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
    if (!session?.user?.name) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin access
    const userRole = (session as any)?.role || (session as any)?.user?.role
    if (!hasAdminAccess(session.user.name, userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const data = await request.json()

    // Validate required fields
    if (!data.title || !data.role || !data.walletAddress || !data.startDate || !data.endDate || !data.terms) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const contract = await createContract(data)
    
    return NextResponse.json({
      ...contract,
      signingUrl: `/sign/${contract.id}`
    })
  } catch (error) {
    console.error('Error creating contract:', error)
    return NextResponse.json(
      { error: 'Failed to create contract' },
      { status: 500 }
    )
  }
} 