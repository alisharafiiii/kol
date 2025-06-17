import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'
import { hasAdminAccess } from '@/lib/admin-config'

export async function GET(request: NextRequest) {
  try {
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

    // Return debug information
    return NextResponse.json({
      contracts: {
        enabled: process.env.ENABLE_CONTRACTS === 'true',
        ENABLE_CONTRACTS: process.env.ENABLE_CONTRACTS || 'not set',
        NEXT_PUBLIC_ENABLE_CONTRACTS: process.env.NEXT_PUBLIC_ENABLE_CONTRACTS || 'not set',
      },
      redis: {
        hasUrl: !!process.env.UPSTASH_REDIS_REST_URL,
        hasToken: !!process.env.UPSTASH_REDIS_REST_TOKEN,
      },
      session: {
        user: session.user.name,
        role: userRole,
        twitterHandle: (session as any)?.twitterHandle
      }
    })
  } catch (error) {
    console.error('Debug endpoint error:', error)
    return NextResponse.json(
      { error: 'Failed to get debug info' },
      { status: 500 }
    )
  }
} 