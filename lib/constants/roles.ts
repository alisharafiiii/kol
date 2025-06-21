// Centralized role definitions to ensure consistency across the application

export const ROLES = {
  ADMIN: 'admin',
  CORE: 'core',
  TEAM: 'team',
  VIEWER: 'viewer',
  SCOUT: 'scout',
  KOL: 'kol',
  USER: 'user'
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// Role hierarchies and permissions
export const ADMIN_ROLES: Role[] = [ROLES.ADMIN, ROLES.CORE];
export const TEAM_ROLES: Role[] = [ROLES.ADMIN, ROLES.CORE, ROLES.TEAM];
export const VIEWER_ROLES: Role[] = [ROLES.ADMIN, ROLES.CORE, ROLES.TEAM, ROLES.VIEWER];
export const SCOUT_ROLES: Role[] = [ROLES.ADMIN, ROLES.CORE, ROLES.TEAM, ROLES.SCOUT];
export const DISCORD_ACCESS_ROLES: Role[] = [ROLES.ADMIN, ROLES.CORE, ROLES.VIEWER, ROLES.SCOUT];

// Helper functions for role checking
export function hasAdminRole(role: string | null | undefined): boolean {
  return role !== null && role !== undefined && ADMIN_ROLES.includes(role as Role);
}

export function hasTeamRole(role: string | null | undefined): boolean {
  return role !== null && role !== undefined && TEAM_ROLES.includes(role as Role);
}

export function hasViewerRole(role: string | null | undefined): boolean {
  return role !== null && role !== undefined && VIEWER_ROLES.includes(role as Role);
}

export function hasScoutRole(role: string | null | undefined): boolean {
  return role !== null && role !== undefined && SCOUT_ROLES.includes(role as Role);
}

export function hasDiscordAccess(role: string | null | undefined): boolean {
  return role !== null && role !== undefined && DISCORD_ACCESS_ROLES.includes(role as Role);
} 