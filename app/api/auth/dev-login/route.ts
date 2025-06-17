import { NextRequest, NextResponse } from 'next/server'
import { encode } from 'next-auth/jwt'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  // Only allow in development
  if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Not available in production' }, { status: 403 })
  }

  try {
    const { handle } = await request.json()
    
    // Whitelist of test accounts
    const testAccounts = ['sharafi_eth', 'nabulines', 'alinabu', 'testuser']
    
    if (!testAccounts.includes(handle)) {
      return NextResponse.json({ error: 'Invalid test account' }, { status: 400 })
    }
    
    // Create a mock session token
    const token = await encode({
      token: {
        sub: `user_${handle}`,
        name: handle,
        twitterHandle: handle,
        role: ['sharafi_eth', 'nabulines', 'alinabu'].includes(handle) ? 'admin' : 'user',
        approvalStatus: 'approved',
        followerCount: 10000,
        iat: Date.now() / 1000,
        exp: Date.now() / 1000 + 30 * 24 * 60 * 60, // 30 days
      },
      secret: process.env.NEXTAUTH_SECRET!,
    })
    
    // Set the session cookie
    const cookieStore = cookies()
    cookieStore.set('next-auth.session-token', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // false for localhost
      path: '/',
      maxAge: 30 * 24 * 60 * 60, // 30 days
    })
    
    return NextResponse.json({ 
      success: true,
      message: `Logged in as ${handle}`,
      user: {
        name: handle,
        twitterHandle: handle,
        role: ['sharafi_eth', 'nabulines', 'alinabu'].includes(handle) ? 'admin' : 'user'
      }
    })
  } catch (error) {
    console.error('Dev login error:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }
} 