import { Session } from 'next-auth';

/**
 * Extract user role from session object
 * Handles inconsistent session structure where role can be in multiple locations
 */
export function getUserRole(session: any): string | undefined {
  if (!session) return undefined;
  
  // Check all possible locations for role
  const role = session.role || 
                session.user?.role || 
                (session as any).user?.role ||
                (session as any)?.role;
                
  return role;
}

/**
 * Extract Twitter handle from session object
 * Handles various session structures
 */
export function getTwitterHandle(session: any): string | undefined {
  if (!session) return undefined;
  
  const handle = session.twitterHandle || 
                 session.user?.twitterHandle ||
                 session.user?.name ||
                 (session as any).user?.username ||
                 (session as any)?.twitterHandle;
                 
  return handle?.toLowerCase().replace('@', '');
}

/**
 * Check if user has core access (admin or core role)
 */
export function hasCoreAccess(session: any): boolean {
  const role = getUserRole(session);
  const handle = getTwitterHandle(session);
  
  // Master admins always have access
  const masterAdmins = ['sharafi_eth', 'nabulines', 'alinabu'];
  if (handle && masterAdmins.includes(handle)) {
    return true;
  }
  
  // Check role-based access
  return role === 'admin' || role === 'core';
}

/**
 * Check if user has admin access
 */
export function hasAdminAccess(session: any): boolean {
  const role = getUserRole(session);
  const handle = getTwitterHandle(session);
  
  // Master admins always have access
  const masterAdmins = ['sharafi_eth', 'nabulines', 'alinabu'];
  if (handle && masterAdmins.includes(handle)) {
    return true;
  }
  
  return role === 'admin';
} 