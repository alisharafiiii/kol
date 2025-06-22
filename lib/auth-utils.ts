/**
 * ✅ STABLE & VERIFIED - DO NOT MODIFY WITHOUT EXPLICIT REVIEW
 * 
 * Authentication utility functions for API routes.
 * Last verified: December 2024
 * 
 * Key functionality:
 * - checkAuth() - Validates authentication and role-based access
 * - requireAuth() - Enforces authentication with error responses
 * - getTwitterHandleFromSession() - Extracts Twitter handle from various session formats
 * - getUserRoleFromSession() - Retrieves user role from session
 * 
 * CRITICAL: These utilities are used throughout the API routes for access control.
 * Changes could break API authentication. Test thoroughly before modifying.
 */

import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { checkUserRoleFromSession } from './user-identity';
import { Session } from 'next-auth';

/**
 * Check if the current request has valid authentication and required role
 * @param req - The NextRequest object
 * @param requiredRoles - Array of roles that provide access (default: ['admin'])
 * @returns Object with user info, role, and hasAccess
 */
export async function checkAuth(req: Request, requiredRoles: string[] = ['admin']) {
  try {
    // Get the session from NextAuth
    const session: any = await getServerSession(authOptions as any);
    
    if (!session?.twitterHandle) {
      console.log('No authenticated Twitter session found');
      return {
        authenticated: false,
        user: null,
        role: null,
        hasAccess: false,
        error: 'No authenticated session'
      };
    }
    
    // Check the user's role based on their Twitter handle
    const roleCheck = await checkUserRoleFromSession(session, requiredRoles);
    
    return {
      authenticated: true,
      user: {
        twitterHandle: session.twitterHandle,
        name: session.user?.name,
        image: session.user?.image
      },
      role: roleCheck.role,
      hasAccess: roleCheck.hasAccess,
      error: roleCheck.hasAccess ? null : 'Insufficient permissions'
    };
  } catch (error) {
    console.error('Error checking authentication:', error);
    return {
      authenticated: false,
      user: null,
      role: null,
      hasAccess: false,
      error: 'Authentication check failed'
    };
  }
}

/**
 * Helper to ensure request has required role
 * Throws an error response if access is denied
 */
export async function requireAuth(req: Request, requiredRoles: string[] = ['admin']) {
  const authCheck = await checkAuth(req, requiredRoles);
  
  if (!authCheck.authenticated) {
    return new Response(
      JSON.stringify({ 
        error: 'Authentication required',
        message: 'Please log in with Twitter to access this resource'
      }),
      { 
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  if (!authCheck.hasAccess) {
    return new Response(
      JSON.stringify({ 
        error: 'Access denied',
        message: `This action requires one of the following roles: ${requiredRoles.join(', ')}`,
        currentRole: authCheck.role
      }),
      { 
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
  
  return null; // Access granted
}

/**
 * Extract Twitter handle from session in a consistent way
 * Checks multiple possible locations where the handle might be stored
 */
export function getTwitterHandleFromSession(session: any): string | null {
  if (!session) return null;
  
  // Try all possible locations where the handle might be
  const handle = session?.twitterHandle || 
                 session?.user?.twitterHandle ||
                 session?.user?.name ||
                 (session as any)?.twitterHandle ||
                 (session as any)?.user?.username ||
                 (session?.user as any)?.handle;
                 
  // Log for debugging
  if (!handle) {
    console.error('[Auth Utils] No Twitter handle found in session:', {
      sessionKeys: Object.keys(session || {}),
      userKeys: Object.keys(session?.user || {}),
      twitterHandle: session?.twitterHandle,
      userName: session?.user?.name,
      fullSession: session
    });
  }
  
  return handle || null;
}

/**
 * Get user role from session
 */
export function getUserRoleFromSession(session: any): string | null {
  if (!session) return null;
  
  return session?.role || 
         session?.user?.role || 
         (session as any)?.role ||
         (session as any)?.user?.role ||
         null;
}

/**
 * Get approval status from session
 */
export function getApprovalStatusFromSession(session: any): string | null {
  if (!session) return null;
  
  return session?.approvalStatus || 
         session?.user?.approvalStatus || 
         (session as any)?.approvalStatus ||
         (session as any)?.user?.approvalStatus ||
         null;
} 