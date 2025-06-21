import { Redis } from '@upstash/redis';

// Check if we're on the server
const isServer = typeof window === 'undefined';

// Parse REDIS_URL if available (only on server)
let upstashUrl: string | undefined;
let upstashToken: string | undefined;

if (isServer && process.env.REDIS_URL) {
  try {
    // Parse redis://default:TOKEN@HOST:PORT format
    const url = new URL(process.env.REDIS_URL);
    const token = url.password; // The password part is the token
    const host = url.hostname;
    
    // Convert to Upstash REST API format
    upstashUrl = `https://${host}`;
    upstashToken = token;
  } catch (error) {
    console.error('[Server] Failed to parse REDIS_URL:', error);
  }
}

// Use parsed values or fall back to individual env vars (only on server)
const UPSTASH_REDIS_REST_URL = isServer ? (upstashUrl || process.env.UPSTASH_REDIS_REST_URL) : undefined;
const UPSTASH_REDIS_REST_TOKEN = isServer ? (upstashToken || process.env.UPSTASH_REDIS_REST_TOKEN) : undefined;

// Create a dummy Redis client for client-side that throws helpful errors
class DummyRedis {
  constructor() {
    console.warn('[Client] Redis operations are not available on the client side');
  }
  
  async json() {
    throw new Error('Redis operations must be performed on the server side');
  }
  
  async sadd() {
    throw new Error('Redis operations must be performed on the server side');
  }
  
  async smembers() {
    throw new Error('Redis operations must be performed on the server side');
  }
  
  async zadd() {
    throw new Error('Redis operations must be performed on the server side');
  }
  
  async keys() {
    throw new Error('Redis operations must be performed on the server side');
  }
}

// Create Redis client only on server, dummy client on browser
export const redis = isServer && UPSTASH_REDIS_REST_URL && UPSTASH_REDIS_REST_TOKEN
  ? new Redis({
      url: UPSTASH_REDIS_REST_URL,
      token: UPSTASH_REDIS_REST_TOKEN,
    })
  : new DummyRedis() as any;

// Log initialization status (only once)
if (isServer) {
  console.log('[Server] Redis client initialized:', !!UPSTASH_REDIS_REST_URL);
}

export interface InfluencerProfile {
  id: string
  name: string
  twitterHandle?: string
  profileImageUrl?: string
  followerCount?: number
  followingCount?: number
  bio?: string
  country?: string               // changed from location to country
  audienceTypes?: string[]            // e.g. ['NFT Collectors','Traders']
  primaryLanguage?: string
  chains?: string[]                   // active chains
  tier?: 'hero' | 'legend' | 'star' | 'rising' | 'micro'  // User tier (added for all users)
  postPricePerPost?: number
  monthlySupportBudget?: number
  bestCollabUrls?: string[]           // default 3, admin can add more
  shippingInfo?: {                    // for merch/DHL
    fullName: string
    addressLine1: string
    addressLine2?: string
    city: string
    postalCode: string
    country: string
  }
  socialAccounts?: {                  // handles + follower/subscriber counts
    twitter?:   { handle: string; followers: number }
    instagram?: { handle: string; followers: number }
    tiktok?:    { handle: string; followers: number }
    youtube?:   { handle: string; subscribers: number }
    telegram?:  { handle: string; followers: number }
  }
  walletAddresses?: {                 // linked wallets
    coinbase?: string
    phantom?:  string
  }
  campaigns?: Array<{                 // campaign details
    id: string
    name: string
    budget: string
    sendDevice: boolean
    sendMerch: boolean
    notes: string
    url: string
    createdAt: string
    createdBy: string
    updatedAt?: string
    updatedBy?: string
  }>
  farcasterId?: string                // future Farcaster login
  approvalStatus: 'pending' | 'approved' | 'rejected'
  adminNotes?: string
  campaignHistory?: string[]          // campaign IDs
  devicesSent?: string[]              // ledger flex, stax, etc.
  merchSent?: string[]                // merch items
  linksWorked?: string[]              // URLs of past collabs
  paymentStatus?: {                   // phase-2 fees
    entryFeePaid?:   boolean
    monthlyFeePaid?: boolean
  }
  roiRank?: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  role: 'viewer' | 'scout' | 'core' | 'admin' | 'user' | 'intern'
  contracts?: Array<{                 // contracts linked to this profile
    id: string
    role: 'creator' | 'recipient'
    linkedAt: string
  }>
  points?: number                     // Total points earned (optional for backward compatibility)
  createdAt: string                   // ISO timestamp
  updatedAt?: string
  updatedBy?: string                  // admin who made the last change
  approvedBy?: string                 // admin who approved the profile
  rejectedBy?: string                 // admin who rejected the profile
}

export async function saveProfile(profile: InfluencerProfile): Promise<void> {
  // save full profile
  await redis.json.set(`user:${profile.id}`, '$', JSON.parse(JSON.stringify(profile)))

  // index by location
  if (profile.country) {
    await redis.sadd(`idx:country:${profile.country}`, profile.id)
  }

  // index by follower count (sorted set)
  await redis.zadd(`idx:followers`, {
    score: profile.followerCount ?? 0,
    member: profile.id,
  })

  // index by each chain
  if (profile.chains) {
    await Promise.all(
      profile.chains.map((chain) =>
        redis.sadd(`idx:chain:${chain}`, profile.id)
      )
    )
  }

  // index by approval status
  await redis.sadd(`idx:status:${profile.approvalStatus}`, profile.id)
}

export async function getProfileById(id: string): Promise<InfluencerProfile | null> {
  const profile = await redis.json.get(`user:${id}`)
  return profile as InfluencerProfile | null
}

export async function searchProfiles(
  filters: Partial<{
    country: string
    minFollowers: number
    chains: string[]
    approvalStatus: 'pending' | 'approved' | 'rejected'
  }>
): Promise<InfluencerProfile[]> {
  // get all user keys
  const keys = await redis.keys('user:*')
  // load all profiles
  const all = await Promise.all(
    keys.map((key: string) => redis.json.get(key) as Promise<InfluencerProfile>)
  )
  // filter in JS
  return (all as InfluencerProfile[]).filter(p => {
    if (filters.country && p.country !== filters.country) return false
    if (filters.minFollowers != null && (p.followerCount ?? 0) < filters.minFollowers) return false
    if (
      filters.chains &&
      !filters.chains.every(chain => p.chains?.includes(chain))
    ) return false
    if (filters.approvalStatus && p.approvalStatus !== filters.approvalStatus)
      return false
    return true
  })
}

// Add new functions for admin panel
export async function getProfile(id: string): Promise<InfluencerProfile | null> {
  try {
    const profile = await redis.json.get(`user:${id}`)
    return profile as InfluencerProfile | null
  } catch (error) {
    console.error(`Error fetching profile ${id}:`, error)
    return null
  }
}

export async function getAllProfileKeys(): Promise<string[]> {
  try {
    const keys = await redis.keys('user:*')
    // Extract just the profile IDs from the keys
    return keys.map((key: string) => key.replace('user:', ''))
  } catch (error) {
    console.error('Error fetching profile keys:', error)
    return []
  }
}

/**
 * Check if a user profile exists with the same Twitter handle or wallet address
 * Returns existing profile or null if not found
 */
export async function findDuplicateProfile(profile: Partial<InfluencerProfile>): Promise<InfluencerProfile | null> {
  try {
    // Check by Twitter handle first
    if (profile.twitterHandle) {
      const handle = profile.twitterHandle.replace('@', '').toLowerCase();
      const userIds = await redis.smembers(`idx:username:${handle}`);
      
      if (userIds && userIds.length > 0) {
        const userData = await redis.json.get(`user:${userIds[0]}`);
        return userData as InfluencerProfile;
      }
    }
    
    // Check by display name to prevent duplicates based on name
    if (profile.name) {
      const displayName = profile.name.toLowerCase().replace(/\s+/g, '');
      const userIds = await redis.smembers(`idx:displayname:${displayName}`);
      
      if (userIds && userIds.length > 0) {
        // Verify this is actually a duplicate (same person)
        const userData = await redis.json.get(`user:${userIds[0]}`) as InfluencerProfile;
        // Only consider it a duplicate if the name matches and no twitter handle is stored yet
        // This prevents false positives but catches the "Bahram" case
        if (userData && !userData.twitterHandle && profile.name === userData.name) {
          return userData;
        }
      }
    }
    
    // Then check by wallet addresses
    if (profile.walletAddresses && Object.keys(profile.walletAddresses).length > 0) {
      for (const [_, address] of Object.entries(profile.walletAddresses)) {
        if (typeof address === 'string') {
          const userIds = await redis.smembers(`idx:wallet:${address.toLowerCase()}`);
          if (userIds && userIds.length > 0) {
            const userData = await redis.json.get(`user:${userIds[0]}`);
            return userData as InfluencerProfile;
          }
        }
      }
    }
    
    return null;
  } catch (error) {
    console.error('Error checking for duplicate profile:', error);
    return null;
  }
}

/**
 * Save a profile to Redis, handling duplicate detection
 * If a duplicate is found, it merges the profiles and updates
 */
export async function saveProfileWithDuplicateCheck(profile: InfluencerProfile): Promise<InfluencerProfile> {
  // Check for existing profile by Twitter handle FIRST
  const existingProfile = await findDuplicateProfile(profile);
  
  if (existingProfile) {
    console.log(`Found existing profile for ${profile.twitterHandle}, updating...`);
    // Merge profiles and update
    const mergedProfile = { ...existingProfile };
    
    // Update basic info if provided
    if (profile.name) mergedProfile.name = profile.name;
    if (profile.profileImageUrl) mergedProfile.profileImageUrl = profile.profileImageUrl;
    if (profile.bio) mergedProfile.bio = profile.bio;
    
    // Update follower count if provided
    if (profile.followerCount !== undefined) {
      mergedProfile.followerCount = profile.followerCount;
    }
    
    // Merge wallet addresses
    if (profile.walletAddresses) {
      mergedProfile.walletAddresses = {
        ...(mergedProfile.walletAddresses || {}),
        ...profile.walletAddresses
      };
    }
    
    // Merge social accounts
    if (profile.socialAccounts) {
      mergedProfile.socialAccounts = {
        ...(mergedProfile.socialAccounts || {}),
        ...profile.socialAccounts
      };
    }
    
    // Update timestamp
    mergedProfile.updatedAt = new Date().toISOString();
    
    // Save merged profile
    await redis.json.set(`user:${existingProfile.id}`, '$', JSON.parse(JSON.stringify(mergedProfile)));
    
    // Update indexes for any new data
    await updateProfileIndexes(mergedProfile);
    
    return mergedProfile;
  } else {
    console.log(`Creating new profile for ${profile.twitterHandle}`);
    // Ensure we have required fields for new profile
    if (!profile.id) {
      throw new Error('Profile ID is required for new profiles');
    }
    if (!profile.createdAt) {
      profile.createdAt = new Date().toISOString();
    }
    if (!profile.approvalStatus) {
      profile.approvalStatus = 'pending';
    }
    
    // Set default role for NEW users only
    if (!profile.role) {
      profile.role = 'user';
    }
    
    // No duplicate found, save as new profile
    await saveProfile(profile);
    
    // Index the new profile
    await updateProfileIndexes(profile);
    
    return profile;
  }
}

/**
 * Update profile indexes for new user data
 */
async function updateProfileIndexes(profile: InfluencerProfile): Promise<void> {
  // Index username/Twitter handle - use normalized version
  if (profile.twitterHandle) {
    const handle = profile.twitterHandle.replace('@', '').toLowerCase();
    await redis.sadd(`idx:username:${handle}`, profile.id);
    
    // Also index the display name to prevent that being used as a duplicate
    const displayName = profile.name?.toLowerCase().replace(/\s+/g, '');
    if (displayName && displayName !== handle) {
      await redis.sadd(`idx:displayname:${displayName}`, profile.id);
    }
  }
  
  // Index wallet addresses
  if (profile.walletAddresses) {
    for (const [_, address] of Object.entries(profile.walletAddresses)) {
      if (typeof address === 'string') {
        await redis.sadd(`idx:wallet:${address.toLowerCase()}`, profile.id);
      }
    }
  }
  
  // Index country
  if (profile.country && typeof profile.country === 'string') {
    await redis.sadd(`idx:country:${profile.country}`, profile.id);
  }
  
  // Index by approval status
  if (profile.approvalStatus) {
    await redis.sadd(`idx:status:${profile.approvalStatus}`, profile.id);
  }
  
  // Index by role
  if (profile.role) {
    await redis.sadd(`idx:role:${profile.role}`, profile.id);
  }
}
