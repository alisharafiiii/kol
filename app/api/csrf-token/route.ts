import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth-options'
import { generateCSRFToken } from '@/lib/csrf'

export async function GET(request: NextRequest) {
  try {
    // Check if user is authenticated
    const session = await getServerSession(authOptions)
    
    if (!session) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      )
    }
    
    // Get user identifier from session
    const userId = (session as any)?.userId || 
                   (session.user as any)?.id ||
                   (session as any)?.twitterHandle ||
                   session.user?.email ||
                   'anonymous'
    
    // Generate CSRF token
    const token = await generateCSRFToken(userId)
    
    // Return token with proper headers
    const response = NextResponse.json({ token })
    
    // Set CSRF token in response header as well
    response.headers.set('X-CSRF-Token', token)
    
    // Add cache control headers to prevent caching
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    
    return response
  } catch (error) {
    console.error('Error generating CSRF token:', error)
    return NextResponse.json(
      { error: 'Failed to generate CSRF token' },
      { status: 500 }
    )
  }
} 