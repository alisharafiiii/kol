import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

// CSRF token configuration
const CSRF_SECRET = new TextEncoder().encode(
  process.env.CSRF_SECRET || process.env.NEXTAUTH_SECRET || 'fallback-csrf-secret-change-me'
)
const CSRF_TOKEN_NAME = 'csrf-token'
const CSRF_HEADER_NAME = 'x-csrf-token'
const TOKEN_EXPIRY = '1h' // 1 hour expiry

/**
 * Generate a new CSRF token
 * @param userId - User identifier to bind the token to
 * @returns JWT CSRF token
 */
export async function generateCSRFToken(userId: string): Promise<string> {
  const token = await new SignJWT({ 
    userId,
    type: 'csrf',
    // Add a random value to ensure uniqueness
    nonce: Math.random().toString(36).substring(2)
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(CSRF_SECRET)
  
  return token
}

/**
 * Verify a CSRF token
 * @param token - CSRF token to verify
 * @param userId - Expected user ID
 * @returns true if valid, false otherwise
 */
export async function verifyCSRFToken(token: string, userId: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, CSRF_SECRET)
    
    // Check if token is for the correct user and is a CSRF token
    return payload.userId === userId && payload.type === 'csrf'
  } catch (error) {
    console.error('CSRF token verification failed:', error)
    return false
  }
}

/**
 * Get CSRF token from request (header or body)
 * @param request - NextRequest object
 * @returns CSRF token or null
 */
export function getCSRFTokenFromRequest(request: NextRequest): string | null {
  // Check header first (preferred method)
  const headerToken = request.headers.get(CSRF_HEADER_NAME)
  if (headerToken) return headerToken
  
  // Check body for form submissions
  const contentType = request.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    // For JSON requests, we'll need to parse the body
    // This is handled in the middleware
    return null
  }
  
  return null
}

/**
 * Middleware to check CSRF protection
 * @param request - NextRequest object
 * @param options - Options for CSRF check
 * @returns Response if CSRF check fails, null if passes
 */
export async function checkCSRFProtection(
  request: NextRequest,
  options: {
    userId: string
    exempt?: boolean
  }
): Promise<Response | null> {
  // Skip CSRF check if explicitly exempted
  if (options.exempt) return null
  
  // Skip CSRF check for safe methods
  const method = request.method.toUpperCase()
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return null
  
  // Get CSRF token from request
  const csrfToken = getCSRFTokenFromRequest(request)
  
  if (!csrfToken) {
    return new Response(
      JSON.stringify({ error: 'CSRF token missing' }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
  
  // Verify the token
  const isValid = await verifyCSRFToken(csrfToken, options.userId)
  
  if (!isValid) {
    return new Response(
      JSON.stringify({ error: 'Invalid CSRF token' }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
  
  return null
}

/**
 * Set CSRF token in response headers
 * @param response - Response object
 * @param token - CSRF token
 * @returns Modified response with CSRF token header
 */
export function setCSRFTokenHeader(response: Response, token: string): Response {
  const headers = new Headers(response.headers)
  headers.set('X-CSRF-Token', token)
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  })
}

/**
 * Hook to use in API routes that need CSRF protection
 * @param request - NextRequest object
 * @param userId - User ID from session
 * @returns Object with CSRF check result
 */
export async function useCSRFProtection(
  request: NextRequest,
  userId: string | null
): Promise<{
  protected: boolean
  error?: string
  newToken?: string
}> {
  // If no user ID, no CSRF protection needed
  if (!userId) {
    return { protected: false, error: 'No authenticated user' }
  }
  
  // Check if this is a state-changing request
  const method = request.method.toUpperCase()
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) {
    // Generate new token for future requests
    const newToken = await generateCSRFToken(userId)
    return { protected: true, newToken }
  }
  
  // For state-changing requests, verify CSRF token
  const csrfToken = getCSRFTokenFromRequest(request)
  
  if (!csrfToken) {
    return { protected: false, error: 'CSRF token missing' }
  }
  
  const isValid = await verifyCSRFToken(csrfToken, userId)
  
  if (!isValid) {
    return { protected: false, error: 'Invalid CSRF token' }
  }
  
  // Generate new token for next request
  const newToken = await generateCSRFToken(userId)
  return { protected: true, newToken }
} 