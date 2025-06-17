import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/app/api/auth/[...nextauth]/route'

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json({ error: 'No session' }, { status: 401 })
    }
    
    // Extract all possible handle locations
    const sessionData = {
      sessionUser: session.user,
      sessionTwitterHandle: (session as any)?.twitterHandle,
      userTwitterHandle: (session?.user as any)?.twitterHandle,
      userName: session?.user?.name,
      fullSession: JSON.parse(JSON.stringify(session))
    }
    
    return NextResponse.json(sessionData)
  } catch (error) {
    console.error('Debug session error:', error)
    return NextResponse.json({ error: 'Failed to get session' }, { status: 500 })
  }
} 