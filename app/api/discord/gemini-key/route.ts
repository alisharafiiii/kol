import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { geminiService } from '@/lib/services/gemini-service'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session as any)?.role || (session.user as any)?.role
    if (!['admin', 'core'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const key = await geminiService.getApiKey()
    
    // Mask the key for security (show only last 4 characters)
    const maskedKey = key ? `${'*'.repeat(key.length - 4)}${key.slice(-4)}` : ''
    
    return NextResponse.json({ key: maskedKey })
  } catch (error) {
    console.error('Error fetching Gemini key:', error)
    return NextResponse.json({ error: 'Failed to fetch key' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userRole = (session as any)?.role || (session.user as any)?.role
    if (!['admin', 'core'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { key } = await request.json()
    
    if (!key) {
      return NextResponse.json({ error: 'API key is required' }, { status: 400 })
    }

    await geminiService.updateApiKey(key)
    
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating Gemini key:', error)
    return NextResponse.json({ error: 'Failed to update key' }, { status: 500 })
  }
} 