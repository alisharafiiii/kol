# Stable Code Registry

This document tracks all code sections that have been marked as STABLE & VERIFIED and should not be modified without explicit review.

## Purpose
To maintain stability in critical parts of the codebase by clearly marking sections that:
- Have been thoroughly tested and verified
- Handle critical functionality
- Have complex logic that was carefully debugged
- Are essential for proper system operation

## Registry Format
Each entry includes:
- **File Path**: Location of the stable code
- **Date Verified**: When the code was last verified
- **Description**: What the code does
- **Critical Features**: Key functionality that must be preserved

---

## Stable Code Sections

### 1. Login Modal Component
- **File**: `components/LoginModal.tsx`
- **Date Verified**: December 2024
- **Description**: Handles both main landing page login (triple-click) and authentication flows
- **Critical Features**:
  - Explicit trigger tracking to prevent auto-hiding for manual triggers
  - Wallet connection handling for Coinbase, MetaMask, and Phantom
  - Twitter authentication integration
  - Server-side user identification via API endpoint
  - Session polling mechanism for authentication
  - Profile fetching and role-based access

### 2. Middleware Authentication
- **File**: `middleware.ts`
- **Date Verified**: December 2024
- **Description**: Handles authentication and access control for the application
- **Critical Features**:
  - JWT token validation from cookies
  - Protected route authentication
  - Public route allowlisting
  - Auth flow redirection
  - Multi-cookie name detection for production compatibility
  - Live role refresh for admin routes

### 3. Auth Configuration
- **File**: `lib/auth-config.ts`
- **Date Verified**: December 2024
- **Description**: Core authentication configuration for NextAuth
- **Critical Features**:
  - JWT token generation with user role and status
  - Session data population from JWT
  - Twitter handle persistence across auth flow
  - Redis-based user data retrieval
  - Cookie configuration for secure sessions
  - Master admin detection

### 4. KOL POST Handler (Fixed)
- **File**: `app/api/campaigns/[id]/kols/route.ts`
- **Date Verified**: December 2024
- **Description**: Handles adding/updating KOLs in campaigns
- **Critical Features**:
  - Deduplication logic to prevent creating duplicate KOLs
  - Updates existing KOLs when device info or other fields change
  - Proper handling of product assignments
  - Admin bypass for permission checks

## Review Process
Before modifying any code marked as STABLE & VERIFIED:

1. **Understand the Context**: Read the stability comment and this registry entry
2. **Impact Analysis**: Assess how changes might affect the critical features
3. **Test Thoroughly**: Ensure all critical features still work after modifications
4. **Update Documentation**: Update both the inline comment and this registry
5. **Peer Review**: Have changes reviewed by another developer familiar with the system

## Version History
- **2024-12-XX**: Initial registry created with Login Modal, Middleware, Auth Config, and KOL Handler entries

## Authentication & Access Control

### 1. Middleware (`middleware.ts`)
- **Status**: ✅ STABLE & VERIFIED
- **Purpose**: Handles JWT token validation and protected route authentication
- **Key Features**:
  - JWT token extraction from cookies
  - Protected route checking
  - Public route allowlisting
  - Auth redirection logic
- **Dependencies**: next-auth/jwt

### 2. Auth Configuration (`lib/auth-config.ts`)
- **Status**: ✅ STABLE & VERIFIED
- **Purpose**: Core NextAuth configuration
- **Key Features**:
  - JWT callback for token generation
  - Session callback for data population
  - Twitter OAuth integration
  - Redis user data lookup
- **Critical**: JWT and session callbacks are carefully tuned

### 3. Auth Utilities (`lib/auth-utils.ts`)
- **Status**: ✅ STABLE & VERIFIED
- **Purpose**: Authentication helper functions for API routes
- **Key Functions**:
  - `checkAuth()` - Validates auth and role-based access
  - `requireAuth()` - Enforces auth with error responses
  - `getTwitterHandleFromSession()` - Handle extraction
  - `getUserRoleFromSession()` - Role extraction

## Tweet Sync Functionality

### 1. Sync API Endpoint (`app/api/campaigns/[id]/sync-tweets/route.ts`)
- **Status**: ✅ STABLE & VERIFIED
- **Purpose**: API endpoint for triggering tweet sync
- **Key Features**:
  - Role-based access control (admin/core/team)
  - Calls TwitterSyncService
  - Proper error handling and response formatting
- **Note**: Contains debug logging that can be removed

### 2. Twitter Sync Service (`lib/services/twitter-sync-service.ts`)
- **Status**: ✅ STABLE & VERIFIED
- **Purpose**: Core service for syncing tweet metrics
- **Key Method**: `syncCampaignTweets()`
- **Key Features**:
  - Dual format support (old campaign.kols and new CampaignKOLService)
  - Twitter API v2 integration
  - Rate limit handling
  - Batch tweet fetching
  - Metric aggregation and storage
- **Critical**: The dual-format support is essential for backward compatibility

## Modification Guidelines

1. **Before Making Changes**:
   - Review this registry
   - Understand the current functionality
   - Plan changes carefully
   - Test in development environment

2. **Testing Requirements**:
   - Test authentication flow end-to-end
   - Verify JWT token generation and session handling
   - Test tweet sync with various campaign formats
   - Verify rate limiting behavior
   - Check error handling paths

3. **Debug Logging**:
   - Debug console.log statements are marked and can be safely removed
   - They are currently helpful for monitoring but not required for functionality

## Recent Fixes and Updates

### KOL Duplication Prevention (December 2024)
**File**: `app/api/campaigns/[id]/kols/route.ts`
**Lines**: 170-225
**Fix**: Prevents duplicate KOL entries when adding products or updating existing KOLs
- Always updates existing KOL when handle matches (case-insensitive)
- Treats product assignment as just another field to update
- Removes redundant duplicate checking logic
- Critical section marked with: `✅ STABLE & VERIFIED — DO NOT MODIFY WITHOUT CODE REVIEW`

### Redis Key Type Error Handling (December 2024)
**File**: `lib/project.ts`
**Lines**: 183-220
**Fix**: Gracefully handles Redis WRONGTYPE errors in getAllProjects
- Silently falls back to string retrieval when JSON.get fails due to type mismatch
- Prevents error logs for expected type mismatches
- Ensures backward compatibility with different key storage formats
- Critical section marked with: `✅ STABLE & VERIFIED — DO NOT MODIFY WITHOUT CODE REVIEW`

### Client-Side KOL Duplication Fix (December 2024)
**File**: `components/KOLTable.tsx`
**Lines**: 537-585, 598-658
**Fix**: Prevents duplicate KOL entries when adding first product
- Updates existing KOL entry when adding first product (PUT)
- Only creates new entry (POST) when adding additional products
- Works in conjunction with server-side fix for complete solution
- Critical sections marked with:
  - `✅ FIXED: Update existing KOL with product instead of creating duplicate`
  - `🔒 LOCKED SECTION - DO NOT MODIFY WITHOUT CODE REVIEW`
- Added double-click prevention with loading state
- Enhanced console logging for debugging

**Cleanup Script**: `scripts/clean-kol-duplicates.mjs`
- Removes existing duplicate KOL entries
- Merges data intelligently
- Marked with: `🔒 LOCKED SCRIPT - DO NOT MODIFY WITHOUT CODE REVIEW`

## Discord Integration

### 1. Discord Link Page (`app/auth/discord-link/page.tsx`)
- **Status**: ✅ STABLE & VERIFIED
- **Purpose**: OAuth flow page for linking Discord to Twitter
- **Key Features**:
  - Handles Twitter OAuth redirect
  - Auto-links accounts after authentication
  - Shows success/error states
  - Session-based verification

### 2. Discord Link API (`app/api/auth/discord-link/route.ts`)
- **Status**: ✅ STABLE & VERIFIED
- **Purpose**: API endpoint for account linking
- **Key Features**:
  - Session validation
  - Profile creation/update
  - Engagement connection setup
  - Discord points bridge mapping
- **Recent Fix**: User ID format handling for points bridge

### 3. Discord Points Bridge (`lib/services/discord-points-bridge.ts`)
- **Status**: ✅ STABLE & VERIFIED
- **Purpose**: Bridge between Discord bot and points system
- **Key Features**:
  - Award points for Discord messages
  - User mapping management
  - Transaction logging
  - Leaderboard updates

## Contact
If you need to modify any stable code sections, please:
1. Review this document
2. Test thoroughly in development
3. Update this registry with any changes 