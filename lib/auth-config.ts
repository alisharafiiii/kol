/**
 * ✅ STABLE & VERIFIED - DO NOT MODIFY WITHOUT EXPLICIT REVIEW
 * 
 * Core authentication configuration for NextAuth.
 * Last verified: December 2024
 * 
 * Key functionality:
 * - JWT token generation with user role and status
 * - Session data population from JWT
 * - Twitter handle persistence across auth flow
 * - Redis-based user data retrieval
 * 
 * CRITICAL: This configuration is essential for authentication flow.
 * The jwt() and session() callbacks have been carefully tuned to maintain
 * user state correctly. Do not modify without thorough testing.
 */

import { NextAuthOptions } from "next-auth";
import Twitter from "next-auth/providers/twitter";
import { ProfileService } from "@/lib/services/profile-service";
import { nanoid } from 'nanoid';
import { isMasterAdmin, logAdminAccess } from '@/lib/admin-config';
import { redis } from '@/lib/redis';

// Enable for debugging
const DEBUG = false;

// Basic log function
const log = (message: string, data?: any) => {
  if (DEBUG) {
    console.log(`\n[NEXTAUTH DEBUG] ${message}`);
    if (data) console.log(JSON.stringify(data, null, 2));
  }
};

// Configuration options
export const authOptions: NextAuthOptions = {
  debug: process.env.NODE_ENV === "development",
  providers: [
    Twitter({
      clientId: process.env.TWITTER_CLIENT_ID || "",
      clientSecret: process.env.TWITTER_CLIENT_SECRET || "",
      version: "2.0",
    }),
  ],
  callbacks: {
    async redirect({ url, baseUrl }) {
      log("=== REDIRECT CALLBACK ===");
      log("URL:", url);
      log("Base URL:", baseUrl);
      
      // If we have a callbackUrl in the URL, extract and use it
      try {
        const urlObj = new URL(url, baseUrl);
        const callbackUrl = urlObj.searchParams.get('callbackUrl');
        
        if (callbackUrl) {
          log("REDIRECT DECISION: Found callbackUrl in params:", callbackUrl);
          // Decode the URL properly
          const decodedCallbackUrl = decodeURIComponent(callbackUrl);
          
          // For production, ensure we're redirecting to the correct domain
          if (decodedCallbackUrl.includes('nabulines.com') || decodedCallbackUrl.includes('localhost')) {
            log("REDIRECT DECISION: Using decoded callbackUrl:", decodedCallbackUrl);
            return decodedCallbackUrl;
          }
          
          // If it's a relative URL, prepend the base URL
          if (decodedCallbackUrl.startsWith('/')) {
            const fullUrl = baseUrl + decodedCallbackUrl;
            log("REDIRECT DECISION: Using relative callbackUrl:", fullUrl);
            return fullUrl;
          }
        }
      } catch (e) {
        log("REDIRECT ERROR: Failed to parse URL:", e);
      }
      
      // Check if the URL is the sign-in page with a callbackUrl
      if (url.includes('/auth/signin') && url.includes('callbackUrl=')) {
        log("REDIRECT DECISION: Detected sign-in page with callback, extracting callback URL");
        try {
          const urlObj = new URL(url);
          const callbackUrl = urlObj.searchParams.get('callbackUrl');
          if (callbackUrl) {
            const decodedUrl = decodeURIComponent(callbackUrl);
            log("REDIRECT DECISION: Extracted callback URL:", decodedUrl);
            return decodedUrl;
          }
        } catch (e) {
          log("REDIRECT ERROR: Failed to extract callback URL:", e);
        }
      }
      
      // Allow absolute URLs on the same origin
      if (url.startsWith(baseUrl)) {
        log("REDIRECT DECISION: Absolute URL on same origin - ALLOWING:", url);
        return url;
      }
      
      // Allow relative URLs
      if (url.startsWith("/")) {
        const fullUrl = baseUrl + url;
        log("REDIRECT DECISION: Relative URL - ALLOWING:", fullUrl);
        return fullUrl;
      }
      
      // Default to base URL
      log("REDIRECT DECISION: Defaulting to base URL:", baseUrl);
      return baseUrl;
    },
    async signIn({ user, account, profile }: any) {
      log("=== SIGN IN CALLBACK TRIGGERED ===");
      log("Timestamp:", new Date().toISOString());
      log("Provider:", account?.provider);
      log("User data:", user);
      log("Account data:", account);
      log("Profile data:", profile);
      
      if (account?.provider !== "twitter") {
        log("Non-Twitter provider, allowing sign in");
        return true;
      }
      
      try {
        // IMPORTANT: Use the correct Twitter handle from profile data (without @ prefix)
        const twitterHandle = profile?.data?.username || profile?.username || user?.name || '';
        log("Extracted Twitter handle:", twitterHandle);
        
        // Store Twitter handle for later use in JWT
        user.twitterHandle = twitterHandle;
        
        // Generate a unique ID based on Twitter username to prevent duplicates
        const profileId = twitterHandle ? `user_${twitterHandle.toLowerCase()}` : `user_${nanoid()}`;
        
        // Get follower count from Twitter API
        let followerCount = 0;
        
        // Try to get follower data using Twitter API v2
        const bearerToken = process.env.TWITTER_BEARER_TOKEN || account.access_token;
        
        if (bearerToken && profile?.data?.id) {
          try {
            const response = await fetch(
              `https://api.twitter.com/2/users/${profile.data.id}?user.fields=public_metrics,profile_image_url`,
              {
                headers: {
                  Authorization: `Bearer ${bearerToken}`,
                },
              }
            );
            
            if (response.ok) {
              const userData = await response.json();
              log("Twitter API response:", userData);
              
              if (userData.data?.public_metrics?.followers_count) {
                followerCount = userData.data.public_metrics.followers_count;
              }
            } else {
              const errorText = await response.text();
              log("Twitter API error response:", {
                status: response.status,
                statusText: response.statusText,
                body: errorText
              });
            }
          } catch (error) {
            log("Error fetching Twitter follower count:", error);
          }
        }
        
        // 1️⃣  Try new unified ProfileService
        let existingProfile = await ProfileService.getProfileByHandle(twitterHandle);
        
        // 2️⃣  Fallback – check legacy Redis storage so we don't recreate an already-approved user
        if (!existingProfile) {
          try {
            const normalizedHandle = twitterHandle.replace('@', '').toLowerCase();
            const legacyIds = await redis.smembers(`idx:username:${normalizedHandle}`);
            if (legacyIds && legacyIds.length > 0) {
              const legacyUserId = legacyIds[0];
              const legacyUser: any = await redis.json.get(`user:${legacyUserId}`);
              if (legacyUser) {
                console.log('[Auth] Found legacy user, migrating → ProfileService:', legacyUserId);
                existingProfile = {
                  id: `user_${normalizedHandle}`,
                  twitterHandle: normalizedHandle,
                  name: legacyUser.name || normalizedHandle,
                  profileImageUrl: legacyUser.profileImageUrl || legacyUser.pfp || null,
                  role: legacyUser.role || 'user',
                  approvalStatus: legacyUser.approvalStatus || 'pending',
                  isKOL: legacyUser.isKOL || false,
                  tier: legacyUser.tier || 'micro',
                  currentTier: legacyUser.currentTier,
                  socialLinks: legacyUser.socialLinks || {
                    twitter: `https://twitter.com/${normalizedHandle}`,
                  },
                  chains: legacyUser.chains || ["Ethereum", "Base"],
                  tags: legacyUser.tags || [],
                  campaigns: legacyUser.campaigns || [],
                  notes: legacyUser.notes || [],
                  points: legacyUser.points || 0,
                  createdAt: legacyUser.createdAt ? new Date(legacyUser.createdAt) : new Date(),
                  updatedAt: new Date(),
                  lastLoginAt: new Date(),
                } as any;

                // Persist migrated profile (indexes will be created inside)
                await ProfileService.saveProfile(existingProfile!);

                if (existingProfile) {
                  console.log('[Auth] Migration complete – user preserved with role:', existingProfile.role, 'status:', existingProfile.approvalStatus);
                }
              }
            }
          } catch (migErr) {
            console.error('[Auth] Error while attempting legacy profile migration:', migErr);
          }
        }
        
        if (existingProfile) {
          log("Found existing profile, updating...");
          log(`Current profile - Role: ${existingProfile.role}, Approval: ${existingProfile.approvalStatus}`);
          
          // CRITICAL: Only update Twitter-related data that may have changed
          // Create updated profile to avoid modifying admin fields
          const updatedProfile = {
            ...existingProfile,
            // Only update Twitter-related fields
            profileImageUrl: profile?.data?.profile_image_url?.replace('_normal', '_400x400') || user.image?.replace('_normal', '_400x400') || existingProfile.profileImageUrl,
            name: profile?.data?.name || existingProfile.name || twitterHandle,
            lastLoginAt: new Date(),
            socialLinks: {
              ...existingProfile.socialLinks,
              twitter: `https://twitter.com/${twitterHandle}`,
            },
          };
          
          // Update follower count if available
          if (followerCount > 0) {
            (updatedProfile as any).followerCount = followerCount;
          }
          
          // EXPLICITLY PRESERVE admin-controlled fields
          updatedProfile.role = existingProfile.role;
          updatedProfile.approvalStatus = existingProfile.approvalStatus;
          updatedProfile.isKOL = existingProfile.isKOL;
          updatedProfile.tier = existingProfile.tier;
          updatedProfile.currentTier = existingProfile.currentTier;
          
          log(`Saving with preserved fields - Role: ${updatedProfile.role}, Approval: ${updatedProfile.approvalStatus}`);
          
          await ProfileService.saveProfile(updatedProfile);
          log(`Profile updated - preserved role: ${existingProfile.role} and approval: ${existingProfile.approvalStatus}`);
        } else {
          log("Creating new profile...");
          // Create new profile in the new system
          const newProfile = {
            id: profileId,
            twitterHandle: twitterHandle,
            name: profile?.data?.name || user.name || twitterHandle,
            profileImageUrl: profile?.data?.profile_image_url?.replace('_normal', '_400x400') || user.image?.replace('_normal', '_400x400'),
            role: 'user' as const, // Default role for new users
            approvalStatus: 'pending' as const,
            isKOL: false,
            tier: 'micro' as const, // Default tier
            socialLinks: {
              twitter: `https://twitter.com/${twitterHandle}`,
            },
            chains: ["Ethereum", "Base"], // Default chains
            tags: [],
            campaigns: [],
            notes: [],
            points: 0, // Initialize points
            createdAt: new Date(),
            updatedAt: new Date(),
            lastLoginAt: new Date(),
          };
          
          await ProfileService.saveProfile(newProfile);
          log("Profile saved successfully");
        }
        
        log("Sign in successful");
        return true;
      } catch (error) {
        log("ERROR in Twitter auth callback:", error);
        return true; // Still allow sign in even if there's an error saving profile
      }
    },
    async session({ session, token, user }: any) {
      log("=== SESSION CALLBACK ===");
      log("Session before modification:", session);
      log("Token:", token);
      
      // Add user info to session
      if (session.user) {
        session.user.id = token.sub;
        // Add Twitter handle if available
        if (token.twitterHandle) {
          session.user.twitterHandle = token.twitterHandle;
        }
        // Add follower count if available
        if (token.followerCount) {
          session.user.followerCount = token.followerCount;
        }
        // Add role if available
        if (token.role) {
          session.user.role = token.role;
        }
        // Add approval status if available
        if (token.approvalStatus) {
          session.user.approvalStatus = token.approvalStatus;
        }
      }
      
      // Also add Twitter handle at top level for easier access
      if (token.twitterHandle) {
        session.twitterHandle = token.twitterHandle;
      }
      
      // Add role at top level too
      if (token.role) {
        session.role = token.role;
      }
      
      log("Session after modification:", session);
      
      // DEBUG: Log critical session info
      if (!session.twitterHandle) {
        console.error("[AUTH] WARNING: No twitterHandle in session!");
        console.error("[AUTH] Token data:", token);
      }
      
      return session;
    },
    async jwt({ token, user, account, profile, trigger, session }: any) {
      log("=== JWT CALLBACK ===");
      log("Token:", token);
      log("User:", user);
      log("Account:", account);
      log("Profile:", profile);
      log("Trigger:", trigger);
      
      // Preserve the callback URL if it's a new sign in
      if (trigger === "signIn" && account) {
        // The callback URL should be preserved in the token
        if (token.callbackUrl) {
          log("Preserving callback URL:", token.callbackUrl);
        }
      }
      
      // Add Twitter handle to token if available (without @ prefix)
      // Try multiple locations where the handle might be
      const possibleHandle = profile?.data?.username || 
                            profile?.username || 
                            user?.twitterHandle || 
                            token.twitterHandle;
                            
      if (possibleHandle) {
        token.twitterHandle = possibleHandle; // Store without @ prefix
        log("Stored Twitter handle in token:", token.twitterHandle);
      } else if (trigger === 'signIn') {
        log("WARNING: No Twitter handle found in profile or user data!");
        log("Profile data structure:", profile);
        log("User data structure:", user);
      }
      
      // Store follower count if it's a new sign in
      if (account && profile) {
        // Try to get follower count during JWT creation as well
        const bearerToken = process.env.TWITTER_BEARER_TOKEN;
        if (bearerToken && profile?.data?.id) {
          try {
            const response = await fetch(
              `https://api.twitter.com/2/users/${profile.data.id}?user.fields=public_metrics`,
              {
                headers: {
                  Authorization: `Bearer ${bearerToken}`,
                },
              }
            );
            
            if (response.ok) {
              const userData = await response.json();
              if (userData.data?.public_metrics?.followers_count) {
                token.followerCount = userData.data.public_metrics.followers_count;
                log("Stored follower count:", token.followerCount);
              }
            }
          } catch (error) {
            log("Error fetching follower count in JWT:", error);
          }
        }
      }
      
      // SIMPLIFIED: Only fetch fresh data on specific triggers to reduce conflicts
      if (token.twitterHandle) {
        const normalizedHandle = token.twitterHandle.toLowerCase().replace('@', '');
        
        // Priority 1: Check session invalidation
        try {
          const invalidationKey = `auth:invalidate:${normalizedHandle}`;
          const invalidationTime = await redis.get(invalidationKey);
          
          if (invalidationTime) {
            const tokenIssuedAt = token.iat * 1000;
            const invalidatedAt = Number(invalidationTime);
            
            if (tokenIssuedAt < invalidatedAt) {
              log(`JWT: Session invalidated for ${normalizedHandle}`);
              return null; // Force re-authentication
            }
          }
        } catch (error) {
          log(`JWT: Error checking session invalidation: ${error}`);
        }
        
        // Priority 2: Master admin check
        if (isMasterAdmin(normalizedHandle)) {
          log(`JWT: Master admin ${normalizedHandle} detected`);
          token.role = 'admin';
          token.approvalStatus = 'approved';
          return token;
        }
        
        // Priority 3: Only fetch fresh data on sign-in or update triggers
        const shouldRefresh = trigger === 'signIn' || trigger === 'update' || !token.role;
        
        if (shouldRefresh) {
          try {
            // Use ProfileService as single source of truth
            const profileKey = `profile:user_${normalizedHandle}`;
            const profileData = await redis.json.get(profileKey);
            
            if (profileData) {
              log(`JWT: Refreshing data for ${normalizedHandle} - Role: ${profileData.role}, Status: ${profileData.approvalStatus}`);
              token.role = profileData.role;
              token.approvalStatus = profileData.approvalStatus;
            } else if (trigger === 'signIn') {
              // New user defaults
              token.role = 'user';
              token.approvalStatus = 'pending';
              log(`JWT: New user ${normalizedHandle} - Setting defaults`);
            }
          } catch (error) {
            log(`JWT: Error fetching profile data: ${error}`);
            // Keep existing token data on error
          }
        }
      }
      
      log("Final token:", token);
      return token;
    },
  },
  pages: {
    signIn: "/auth/signin", // Use our custom sign-in page that handles callbacks properly
    error: "/auth/error",
    signOut: "/",
  },
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  cookies: {
    sessionToken: {
      name: (() => {
        const url = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const isHttps = url.startsWith("https://");
        // Use secure-prefixed cookie name in production
        if (isHttps && process.env.NODE_ENV === 'production') {
          return '__Secure-next-auth.session-token';
        }
        return 'next-auth.session-token';
      })(),
      options: (() => {
        const url = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const isHttps = url.startsWith("https://");
        
        console.log('[Auth Config] Cookie settings:', {
          url,
          isHttps,
          nodeEnv: process.env.NODE_ENV,
          cookieName: isHttps && process.env.NODE_ENV === 'production' ? '__Secure-next-auth.session-token' : 'next-auth.session-token'
        });
        
        return {
          httpOnly: true,
          sameSite: isHttps ? "lax" : "lax", // Use lax for better compatibility
          secure: isHttps,
          path: "/",
          domain: undefined, // Let browser handle domain
        } as const;
      })(),
    },
    callbackUrl: {
      name: (() => {
        const url = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const isHttps = url.startsWith("https://");
        if (isHttps && process.env.NODE_ENV === 'production') {
          return '__Secure-next-auth.callback-url';
        }
        return 'next-auth.callback-url';
      })(),
      options: (() => {
        const url = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const isHttps = url.startsWith("https://");
        return {
          httpOnly: true,
          sameSite: isHttps ? "lax" : "lax",
          secure: isHttps,
          path: "/",
        } as const;
      })(),
    },
    csrfToken: {
      name: (() => {
        const url = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const isHttps = url.startsWith("https://");
        if (isHttps && process.env.NODE_ENV === 'production') {
          return '__Host-next-auth.csrf-token';
        }
        return 'next-auth.csrf-token';
      })(),
      options: (() => {
        const url = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const isHttps = url.startsWith("https://");
        return {
          httpOnly: true,
          sameSite: isHttps ? "lax" : "lax",
          secure: isHttps,
          path: "/",
        } as const;
      })(),
    },
  },
  events: {
    async signIn(message: any) {
      log("=== SIGN IN EVENT ===", message);
    },
    async signOut(message: any) {
      log("=== SIGN OUT EVENT ===", message);
    },
    async createUser(message: any) {
      log("=== CREATE USER EVENT ===", message);
    },
    async updateUser(message: any) {
      log("=== UPDATE USER EVENT ===", message);
    },
    async linkAccount(message: any) {
      log("=== LINK ACCOUNT EVENT ===", message);
    },
    async session(message: any) {
      log("=== SESSION EVENT ===", message);
    },
  },
};

// Log configuration on load
log('NextAuth configuration loaded', {
  url: process.env.NEXTAUTH_URL,
  clientId: process.env.TWITTER_CLIENT_ID ? "Configured" : "Missing",
  clientSecret: process.env.TWITTER_CLIENT_SECRET ? "Configured" : "Missing",
  secret: process.env.NEXTAUTH_SECRET ? "Configured" : "Missing"
}); 