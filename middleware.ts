import { NextRequest, NextResponse } from 'next/server'

export function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname
  
  // Add specific handling for Discord share routes
  if (path.startsWith('/discord/share/')) {
    const userAgent = request.headers.get('user-agent') || ''
    const isMobile = /iPhone|iPad|iPod|Android/i.test(userAgent)
    
    if (isMobile) {
      console.log('Middleware: Mobile access to Discord share detected')
      
      // Add cache control headers to prevent aggressive caching on mobile
      const response = NextResponse.next()
      response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
      response.headers.set('Pragma', 'no-cache')
      response.headers.set('Expires', '0')
      
      return response
    }
  }
  
  // Only apply middleware to /admin and /collab routes
  if (!path.startsWith('/admin') && !path.startsWith('/collab')) {
    return NextResponse.next()
  }
  
  console.log('Middleware: Path accessed:', path)
  
  // WALLET CHECKS DISABLED - Authentication is handled by Twitter sessions in each route
  // Just pass through all requests
  return NextResponse.next()
}

// Configure paths that the middleware should run on
export const config = {
  matcher: ['/admin/:path*', '/collab/:path*', '/admin', '/collab', '/discord/share/:path*']
} 