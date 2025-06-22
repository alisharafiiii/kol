import { NextRequest, NextResponse } from 'next/server'
import { identifyUser } from '@/lib/user-identity'

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    
    // Call identifyUser on the server side
    const result = await identifyUser(data)
    
    return NextResponse.json(result)
  } catch (error: any) {
    console.error('Error in user identification API:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to identify user' },
      { status: 500 }
    )
  }
} 