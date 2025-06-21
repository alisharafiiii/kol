# Rebuild Profile Campaigns Documentation

## ⚠️ IMPORTANT NOTE
The original `rebuild-profile-campaigns-upstash.mjs` script has been removed due to a bug that created duplicate profiles with incorrect IDs. The profile campaigns have been properly rebuilt and the issue has been resolved.

## Problem
User profiles are not showing campaign cards and engagement metrics because:
1. When profiles are migrated from the old format, campaigns array is set to empty
2. Campaign participations exist in the campaigns but aren't linked to profiles
3. KOL metrics are not calculated for profiles

## Solution
The `rebuild-profile-campaigns-upstash.mjs` script scans all campaigns and rebuilds profile campaign participations.

## What the Script Does
1. **Scans all campaigns** from the `campaigns:all` set
2. **For each campaign**:
   - Gets campaign details
   - Extracts all KOLs from the campaign's `kols` array
   - For each KOL:
     - Finds or creates their profile
     - Creates/updates campaign participation
     - Calculates engagement metrics
     - **Transfers profile images** from `pfp` field (including base64 data URIs)
3. **Updates profiles** with:
   - Campaign participations
   - KOL metrics (earnings, views, engagement)
   - Profile images (from campaign KOL data)
   - Proper flags (`isKOL`, tier, etc.)

## How to Run

```bash
node scripts/rebuild-profile-campaigns-upstash.mjs
```

Make sure you have the required environment variables set in your `.env.local` file:
- `REDIS_URL`: Your Redis connection string

## What Gets Fixed
After running the script, user profiles will show:
- **Campaign Cards**: List of campaigns they participated in
- **Engagement Metrics**:
  - Total campaigns
  - Total earnings
  - Total views
  - Total engagement
  - Average engagement rate
  - Tier history
- **KOL Status**: Properly marked as KOL with tier

## Verification
After running the script, check a KOL profile:
1. Go to `/profile/[handle]` for any KOL
2. You should see:
   - KOL Statistics section with metrics
   - Campaigns tab with campaign cards
   - Proper tier badge

## Example Output
```
Starting to rebuild profile campaign participations...

Found 4 campaigns

Processing campaign: campaign:Te-1hZJ5AfwCwAEayvwLI
  - Campaign name: Solana Flex
  - Found 17 KOLs in campaign
    - Processing KOL: @hunter_nft
    - Added participation for @hunter_nft

Summary:
- Campaigns processed: 4
- Total KOLs processed: 35
- Total profiles updated: 29
- Total campaign participations: 35
```

## Notes
- Safe to run multiple times (idempotent)
- Creates profiles for KOLs that don't have one
- Updates existing profiles without losing data
- Calculates metrics based on actual campaign data
- Works with Upstash Redis (REST API) 