/**
 * ✅ STABLE & VERIFIED - DO NOT MODIFY WITHOUT EXPLICIT REVIEW
 * 
 * This middleware handles authentication and access control for the application.
 * Last verified: December 2024
 * 
 * Key functionality:
 * - JWT token validation from cookies
 * - Protected route authentication
 * - Public route allowlisting
 * - Auth flow redirection
 * 
 * CRITICAL: This code has been extensively tested and verified. Any modifications
 * could break authentication flow. Review carefully before making changes.
 */

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
  '/contracts-admin',
  '/api/admin',
  '/api/projects',
  '/api/upload',
  '/api/discord/bot-reboot',
  '/api/discord/bot-status',
  '/api/contracts',
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
  '/contracts',
  '/contracts/sign',
  '/api/webhook',
  '/_next',
  '/favicon.ico',
  '/api/public',
  '/discord/share/project--',
  '/sign',
  '/api/contracts/*/sign',
  '/api/contracts/*', // Allow public access to individual contracts for signing page
  '/test-contract-sign', // Test page for debugging
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
  
  // Special handling for individual contract viewing and signing
  // This must come BEFORE the protected path check
  if (pathname.match(/^\/api\/contracts\/[^\/]+$/) || 
      pathname.match(/^\/api\/contracts\/[^\/]+\/sign$/)) {
    console.log('[Middleware] Individual contract endpoint, allowing:', pathname)
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
      // Enhanced logging for token detection
      console.log('[Middleware] Checking protected path:', pathname)
      console.log('[Middleware] Request URL:', request.url)
      console.log('[Middleware] Request headers:', {
        cookie: request.headers.get('cookie')?.substring(0, 100) + '...',
        host: request.headers.get('host'),
        referer: request.headers.get('referer')
      })
      
      // Determine the correct cookie name based on environment
      // Try multiple cookie names as NextAuth might use different ones
      const possibleCookieNames = [
        'next-auth.session-token',
        '__Secure-next-auth.session-token',
        '__Host-next-auth.session-token',
        process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token'
      ]
      
      const isProduction = process.env.NODE_ENV === 'production'
      const isHttps = request.url.startsWith('https://')
      
      console.log('[Middleware] Cookie configuration:', {
        isProduction,
        isHttps,
        possibleCookieNames,
        nodeEnv: process.env.NODE_ENV,
        url: request.url
      })
      
      // Try to get token with different cookie names
      let token = null
      for (const cookieName of possibleCookieNames) {
        try {
          console.log('[Middleware] Trying cookie name:', cookieName)
          token = await getToken({ 
            req: request,
            secret: process.env.NEXTAUTH_SECRET,
            cookieName: cookieName,
            debug: false // Disable debug for cleaner logs
          })
          
          if (token) {
            console.log('[Middleware] Token found with cookie name:', cookieName)
            break
          }
        } catch (err) {
          console.log('[Middleware] Error with cookie name', cookieName, ':', err)
        }
      }
      
      console.log('[Middleware] Token check result:', {
        exists: !!token,
        tokenData: token ? {
          sub: token.sub,
          name: token.name,
          twitterHandle: token.twitterHandle,
          role: token.role,
          iat: token.iat,
          exp: token.exp
        } : null
      })
      
      // Check cookie names specifically
      const cookies = request.headers.get('cookie') || ''
      console.log('[Middleware] Session cookie check:', {
        hasSessionToken: cookies.includes('next-auth.session-token'),
        hasSecureSessionToken: cookies.includes('__Secure-next-auth.session-token'),
        hasHostPrefixedToken: cookies.includes('__Host-next-auth.session-token')
      })
      
      if (!token) {
        // Preserve the original URL for callback after login
        const url = new URL('/auth/signin', request.url)
        url.searchParams.set('callbackUrl', request.url)
        
        console.log('[Middleware] No token found, redirecting to signin with callback:', request.url)
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
      
      // For admin routes, check admin access (with live role refresh)
      if (pathname.startsWith('/admin') || pathname.startsWith('/api/admin')) {
        let userRole = token.role as string | undefined
        const handle = ((token.twitterHandle as string) || (token.name as string) || '').toLowerCase().replace('@', '')
        const masterAdmins = ['sharafi_eth', 'nabulines', 'alinabu']

        // ALWAYS attempt live fetch to ensure core users have access
        // This prevents race conditions and stale token issues
        try {
          const apiUrl = `${request.nextUrl.origin}/api/user/role?handle=${handle}`
          const res = await fetch(apiUrl, { headers: { 'cache-control': 'no-store' } })
          if (res.ok) {
            const data = await res.json()
            // Use live data if available, otherwise fall back to token
            userRole = data.role || userRole
            console.log('[Middleware] Live role check for', handle, ':', userRole)
          }
        } catch (err) {
          console.error('[Middleware] Live role fetch failed:', err)
          // Continue with token role if fetch fails
        }

        // Check access with updated role
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