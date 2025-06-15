/**
 * Centralized admin configuration
 * This file contains the list of master admin users who have elevated privileges
 * 
 * IMPORTANT: This should be migrated to a database-backed admin management system
 * for better security and auditability. Master admins should only be used for
 * emergency access and initial setup.
 */

// Master admin handles - these users always have admin access
// These should be used sparingly and only for emergency access
export const MASTER_ADMIN_HANDLES = [
  'sharafi_eth',
  'nabulines',
  'alinabu'
] as const

// Check if a handle is a master admin
export function isMasterAdmin(handle: string | null | undefined): boolean {
  if (!handle) return false
  // Normalize handle: remove @ symbol and convert to lowercase
  // Keep dots for ENS names
  const normalizedHandle = handle.toLowerCase().replace('@', '')
  return (MASTER_ADMIN_HANDLES as readonly string[]).includes(normalizedHandle)
}

// Get all master admin handles
export function getMasterAdmins(): readonly string[] {
  return MASTER_ADMIN_HANDLES
}

// Emergency admin wallet addresses (for wallet-based auth)
// These should be migrated to database storage
export const EMERGENCY_ADMIN_WALLETS = [
  // Add emergency admin wallet addresses here if needed
  // Format: '0x...' (lowercase)
] as const

// Check if a wallet is an emergency admin
export function isEmergencyAdminWallet(wallet: string | null | undefined): boolean {
  if (!wallet) return false
  const normalizedWallet = wallet.toLowerCase()
  return (EMERGENCY_ADMIN_WALLETS as readonly string[]).includes(normalizedWallet)
}

/**
 * Check if a user has admin access through any method
 * @param handle - Twitter handle
 * @param role - User role from database
 * @param wallet - Wallet address (optional)
 * @returns true if user has admin access
 */
export function hasAdminAccess(
  handle?: string | null,
  role?: string | null,
  wallet?: string | null
): boolean {
  // Check database role first (most common case)
  if (role === 'admin') return true
  
  // Check if master admin (emergency access)
  if (isMasterAdmin(handle)) return true
  
  // Check emergency wallet (legacy support)
  if (isEmergencyAdminWallet(wallet)) return true
  
  return false
}

/**
 * Log admin access for audit trail
 * @param handle - Twitter handle
 * @param action - Action being performed
 * @param details - Additional details
 */
export function logAdminAccess(
  handle: string,
  action: string,
  details?: Record<string, any>
): void {
  const timestamp = new Date().toISOString()
  const isMaster = isMasterAdmin(handle)
  
  console.log(`[ADMIN ACCESS] ${timestamp}`, {
    handle,
    action,
    isMasterAdmin: isMaster,
    ...details
  })
  
  // TODO: Implement proper audit logging to database
  // This should log to a persistent audit trail for security compliance
} 