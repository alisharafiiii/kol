import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { nanoid } from 'nanoid'
import { redis } from '@/lib/redis'
import { writeFile } from 'fs/promises'
import { join } from 'path'

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const contractDataStr = formData.get('contractData') as string
    const contractData = JSON.parse(contractDataStr)

    // Generate unique contract ID
    const contractId = `contract_${nanoid()}`
    
    // Handle file uploads
    const attachments: string[] = []
    const uploadDir = join(process.cwd(), 'public', 'uploads', contractId)
    
    // Create upload directory
    const { mkdir } = await import('fs/promises')
    await mkdir(uploadDir, { recursive: true })

    // Process each file
    const entries = Array.from(formData.entries())
    for (const [key, value] of entries) {
      if (key.startsWith('file-') && value instanceof File) {
        const file = value as File
        const bytes = await file.arrayBuffer()
        const buffer = Buffer.from(bytes)
        
        // Generate unique filename
        const filename = `${nanoid()}_${file.name}`
        const filepath = join(uploadDir, filename)
        
        await writeFile(filepath, buffer)
        attachments.push(`/uploads/${contractId}/${filename}`)
      }
    }

    // Create contract object
    const contract = {
      id: contractId,
      ...contractData,
      attachments,
      status: 'pending_signature',
      creatorSignature: {
        handle: contractData.creatorHandle,
        walletAddress: contractData.creatorWallet || null,
        signedAt: new Date().toISOString(),
        signature: contractData.creatorSignature || `creator_sig_${nanoid()}` // Use provided signature or generate mock
      },
      assigneeSignature: null,
      shareLink: `${process.env.NEXTAUTH_URL || 'http://localhost:3003'}/contracts/${contractId}/sign`
    }

    // Store in Redis
    await redis.set(`contract:${contractId}`, JSON.stringify(contract))
    
    // Also store a mapping for the assignee to find their contracts
    const assigneeKey = `contracts:${contractData.assignedPlatform}:${contractData.assignedTo.replace('@', '')}`
    const existingContracts = await redis.get(assigneeKey)
    const contractsList = existingContracts ? JSON.parse(existingContracts) : []
    contractsList.push(contractId)
    await redis.set(assigneeKey, JSON.stringify(contractsList))

    // Store creator's contracts
    const creatorKey = `contracts:created:${contractData.creatorHandle.replace('@', '')}`
    const creatorContracts = await redis.get(creatorKey)
    const creatorList = creatorContracts ? JSON.parse(creatorContracts) : []
    creatorList.push(contractId)
    await redis.set(creatorKey, JSON.stringify(creatorList))

    return NextResponse.json({
      contractId,
      shareLink: contract.shareLink,
      message: 'Contract created successfully'
    })
  } catch (error) {
    console.error('Error creating contract:', error)
    return NextResponse.json(
      { error: 'Failed to create contract' },
      { status: 500 }
    )
  }
} 