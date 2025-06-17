import { NextAuthOptions } from "next-auth";
import Twitter from "next-auth/providers/twitter";
import { ProfileService } from "@/lib/services/profile-service";
import { nanoid } from 'nanoid';
import { isMasterAdmin, logAdminAccess } from '@/lib/admin-config';

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
        
        // Check if profile already exists in new system
        let existingProfile = await ProfileService.getProfileByHandle(twitterHandle);
        
        if (existingProfile) {
          log("Found existing profile, updating...");
          // Update existing profile with latest data
          existingProfile.profileImageUrl = profile?.data?.profile_image_url?.replace('_normal', '_400x400') || user.image?.replace('_normal', '_400x400') || existingProfile.profileImageUrl;
          if (!existingProfile.socialLinks) {
            existingProfile.socialLinks = {};
          }
          existingProfile.socialLinks.twitter = `https://twitter.com/${twitterHandle}`;
          existingProfile.lastLoginAt = new Date();
          
          await ProfileService.saveProfile(existingProfile);
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
      if (profile?.data?.username) {
        token.twitterHandle = profile.data.username; // Store without @ prefix
        log("Stored Twitter handle in token:", token.twitterHandle);
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
      
      // Fetch user role and approval status
      if (token.twitterHandle) {
        // Check for master admin
        const normalizedHandle = token.twitterHandle.toLowerCase().replace('@', '');
        if (isMasterAdmin(normalizedHandle)) {
          log(`JWT: Master admin ${normalizedHandle} detected - setting admin role`);
          logAdminAccess(normalizedHandle, 'auth_jwt_admin_role', {
            method: 'master_admin',
            context: 'nextauth_jwt'
          });
          token.role = 'admin';
          token.approvalStatus = 'approved';
        } else {
          // For other users, try to fetch from API
          try {
            // Use absolute URL for API calls
            const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
            const profileRes = await fetch(`${baseUrl}/api/user/profile?handle=${token.twitterHandle}`);
            
            if (profileRes.ok) {
              const profileData = await profileRes.json();
              if (profileData.user) {
                token.role = profileData.user.role || 'user';
                token.approvalStatus = profileData.user.approvalStatus || 'pending';
                
                log(`User ${token.twitterHandle} - Role: ${token.role}, Status: ${token.approvalStatus}`);
              }
            }
          } catch (error) {
            log("Error fetching user profile in JWT:", error);
            // Default to scout role for other users when API fails
            token.role = 'scout';
            token.approvalStatus = 'pending';
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
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
        domain: undefined // Let the browser handle domain
      },
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