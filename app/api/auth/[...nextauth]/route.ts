import NextAuth, { NextAuthOptions } from "next-auth";
import Twitter from "next-auth/providers/twitter";
import { saveProfileWithDuplicateCheck } from "@/lib/redis";
import { nanoid } from 'nanoid';

// Enable for debugging
const DEBUG = true;

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
    async signIn({ user, account, profile }: any) {
      log("=== SIGN IN CALLBACK TRIGGERED ===");
      log("Provider:", account?.provider);
      log("User data:", user);
      log("Account data:", account);
      log("Profile data:", profile);
      
      if (account.provider !== "twitter") {
        log("Non-Twitter provider, allowing sign in");
        return true;
      }
      
      try {
        // Get follower count from Twitter API
        let followerCount = 0;
        
        // Try to get follower data using Twitter API v2
        // Use Bearer token from environment variable for better access
        const bearerToken = process.env.TWITTER_BEARER_TOKEN || account.access_token;
        
        if (bearerToken) {
          try {
            // Fetch user data including public metrics
            const userId = profile?.data?.id;
            log("Fetching Twitter user data for ID:", userId);
            
            const response = await fetch(
              `https://api.twitter.com/2/users/${userId}?user.fields=public_metrics,profile_image_url`,
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
        
        // IMPORTANT: Use the correct Twitter handle from profile data (without @ prefix)
        const twitterHandle = profile?.data?.username || undefined;
        
        // Generate a unique ID based on Twitter username to prevent duplicates
        const profileId = twitterHandle ? `user_${profile.data.username.toLowerCase()}` : `user_${nanoid()}`;
        
        // Prepare user data from Twitter profile
        // DON'T set role or approvalStatus - let saveProfileWithDuplicateCheck handle existing users
        const userData = {
          id: profileId, // Use consistent ID based on Twitter username
          twitterHandle: twitterHandle,
          name: profile?.data?.name || user.name,
          profileImageUrl: profile?.data?.profile_image_url?.replace('_normal', '_400x400') || user.image?.replace('_normal', '_400x400'),
          createdAt: new Date().toISOString(),
          followerCount: followerCount, // Store follower count at top level
          socialAccounts: {
            twitter: {
              handle: profile?.data?.username,
              followers: followerCount,
            }
          },
          // Store selected chains if available in session
          chains: Array.isArray(user.chains) ? user.chains : ["Ethereum", "Base"]
        };
        
        log("Saving user profile:", userData);
        
        // Save or update user profile
        await saveProfileWithDuplicateCheck(userData as any);
        
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
    async jwt({ token, user, account, profile }: any) {
      log("=== JWT CALLBACK ===");
      log("Token:", token);
      log("User:", user);
      log("Account:", account);
      log("Profile:", profile);
      
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
        // HARDCODED CHECK FOR SHARAFI_ETH
        const normalizedHandle = token.twitterHandle.toLowerCase().replace('@', '');
        if (normalizedHandle === 'sharafi_eth' || normalizedHandle === 'alinabu') {
          log(`JWT: Master admin ${normalizedHandle} detected - setting admin role`);
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
    signIn: "/api/auth/signin", // Use default NextAuth sign-in page
    error: "/auth/error",
    signOut: "/",
  },
  secret: process.env.NEXTAUTH_SECRET,
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

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST }; 