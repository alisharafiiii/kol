import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '../[...nextauth]/route'
import { headers } from 'next/headers'

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions)
    const headersList = headers()
    
    // Get all relevant headers
    const debugInfo = {
      timestamp: new Date().toISOString(),
      session: session || null,
      headers: {
        cookie: headersList.get('cookie'),
        referer: headersList.get('referer'),
        'user-agent': headersList.get('user-agent'),
        host: headersList.get('host'),
      },
      url: {
        href: req.url,
        searchParams: Object.fromEntries(req.nextUrl.searchParams),
        pathname: req.nextUrl.pathname,
      },
      env: {
        NEXTAUTH_URL: process.env.NEXTAUTH_URL,
        NODE_ENV: process.env.NODE_ENV,
      }
    }
    
    return NextResponse.json(debugInfo, { 
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      }
    })
  } catch (error) {
    console.error('Auth debug error:', error)
    return NextResponse.json({ 
      error: 'Failed to get debug info',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
} 