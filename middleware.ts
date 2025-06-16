import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Paths that require authentication
const protectedPaths = [
  '/admin',
  '/profile/edit',
  '/scout',
  '/campaigns/create',
  '/campaigns/*/edit',
  '/campaigns/*/brief/edit',
  '/api/admin',
  '/api/campaigns',
  '/api/projects',
  '/api/upload',
  '/api/discord/bot-reboot',
  '/api/discord/bot-status',
]

// Paths that should be accessible without authentication
const publicPaths = [
  '/auth',
  '/api/auth',
  '/',
  '/about',
  '/terms',
  '/campaigns',
  '/contests',
  '/api/webhook',
  '/_next',
  '/favicon.ico',
  '/api/public',
  '/discord/share/project--',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Log all requests in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[Middleware] Request:', pathname)
  }
  
  // CRITICAL: Allow all auth-related paths to proceed without checks
  if (pathname.startsWith('/api/auth') || pathname.startsWith('/auth')) {
    console.log('[Middleware] Auth path detected, allowing:', pathname)
    return NextResponse.next()
  }
  
  // Log OAuth callback handling
  if (pathname.includes('callback')) {
    console.log('[Middleware] Callback detected:', pathname)
    console.log('[Middleware] Callback URL params:', request.nextUrl.searchParams.toString())
    return NextResponse.next()
  }
  
  // Skip middleware for static files and public paths
  const isPublicPath = publicPaths.some(path => 
    pathname === path || pathname.startsWith(path + '/')
  )
  
  // Special handling for Discord share links
  if (pathname.startsWith('/discord/share/project--')) {
    console.log('[Middleware] Public Discord share link detected:', pathname)
    return NextResponse.next()
  }
  
  if (isPublicPath) {
    return NextResponse.next()
  }
  
  // Check if path requires authentication
  const isProtectedPath = protectedPaths.some(path => {
    if (path.includes('*')) {
      const regex = new RegExp('^' + path.replace('*', '[^/]+') + '$')
      return regex.test(pathname)
    }
    return pathname === path || pathname.startsWith(path + '/')
  })
  
  if (isProtectedPath) {
    try {
      const token = await getToken({ 
        req: request,
        secret: process.env.NEXTAUTH_SECRET 
      })
      
      console.log('[Middleware] Protected path:', pathname)
      console.log('[Middleware] Token exists:', !!token)
      
      if (!token) {
        // Preserve the original URL for callback after login
        const url = new URL('/auth/signin', request.url)
        url.searchParams.set('callbackUrl', request.url)
        
        console.log('[Middleware] Redirecting to signin with callback:', request.url)
        return NextResponse.redirect(url)
      }
      
      // For Discord share pages, check role access
      if (pathname.startsWith('/discord/share')) {
        const userRole = token.role as string
        const allowedRoles = ['admin', 'core', 'viewer', 'scout']
        
        // Check for master admin handles
        const handle = ((token.twitterHandle as string) || (token.name as string) || '').toLowerCase().replace('@', '')
        const masterAdmins = ['sharafi_eth', 'nabulines', 'alinabu']
        
        console.log('[Middleware] Discord share access check - handle:', handle)
        console.log('[Middleware] Discord share access check - role:', userRole)
        console.log('[Middleware] Discord share access check - token.twitterHandle:', token.twitterHandle)
        console.log('[Middleware] Discord share access check - token.name:', token.name)
        
        if (!allowedRoles.includes(userRole) && !masterAdmins.includes(handle)) {
          console.log('[Middleware] Discord share access denied:', { handle, role: userRole })
          return NextResponse.redirect(new URL('/access-denied', request.url))
        }
      }
      
      // For admin routes, check admin access
      if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
        const userRole = token.role as string
        const handle = ((token.twitterHandle as string) || (token.name as string) || '').toLowerCase().replace('@', '')
        const masterAdmins = ['sharafi_eth', 'nabulines', 'alinabu']
        
        if (userRole !== 'admin' && userRole !== 'core' && !masterAdmins.includes(handle)) {
          console.log('[Middleware] Admin access denied:', { handle, role: userRole })
          return NextResponse.redirect(new URL('/access-denied', request.url))
        }
      }
    } catch (error) {
      console.error('[Middleware] Error checking authentication:', error)
      
      // On error, redirect to sign in
      const url = new URL('/auth/signin', request.url)
      url.searchParams.set('callbackUrl', request.url)
      return NextResponse.redirect(url)
    }
  }
  
  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public/).*)',
  ],
} 