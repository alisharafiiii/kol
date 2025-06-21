# Points Management Implementation

## Overview
Implemented a dedicated Points Management system in the admin panel that allows admins to configure and manage points for various user actions, tiers, and scenarios.

## Features Added

### 1. Points Tab in Admin Panel
- Added a new "Points" tab in the admin navigation (`components/AdminPanel.tsx`)
- Clicking the tab navigates to `/admin/points`
- Tab follows the same styling as other admin tabs

### 2. Points Management Page (`app/admin/points/page.tsx`)
A comprehensive interface with three main sections:

#### Point Actions Tab
- Manage different actions that award points
- Fields: Name, Description, Category, Base Points
- Categories: engagement, social, content, referral
- Add/Remove actions dynamically

#### Tiers & Multipliers Tab
- Configure user tiers (Hero, Legend, Star, Rising, Micro)
- Set min/max points for each tier
- Configure tier multipliers
- Customize tier colors

#### Scenarios Tab
- Create specific point awards for tier-action combinations
- Override base points with custom values
- Apply specific multipliers

### 3. Backend API (`app/api/admin/points/config/route.ts`)
- **GET**: Fetch current points configuration
- **POST**: Save updated points configuration
- Admin authentication required
- Automatic backup creation with timestamps
- Default configuration provided

### 4. Points Service (`lib/services/points-service.ts`)
Centralized service for points management:

- **loadConfig()**: Load configuration from Redis
- **calculatePoints()**: Calculate points based on action and user tier
- **getTierByPoints()**: Determine user tier from total points
- **awardPoints()**: Award points to users with proper tracking
- **getUserPoints()**: Get user's points breakdown
- **getUserPointsHistory()**: Retrieve points history
- **getLeaderboard()**: Get daily/all-time leaderboards

## Data Structure

### Points Configuration
```json
{
  "actions": [
    {
      "id": "action_tweet_post",
      "name": "Tweet Post",
      "description": "Points for posting campaign tweets",
      "basePoints": 100,
      "category": "engagement"
    }
  ],
  "tiers": [
    {
      "id": "tier_hero",
      "name": "Hero",
      "minPoints": 10000,
      "maxPoints": 999999,
      "multiplier": 2.0,
      "color": "#FFB800"
    }
  ],
  "scenarios": [
    {
      "id": "scenario_hero_tweet",
      "tier": "tier_hero",
      "action": "action_tweet_post",
      "points": 200,
      "multiplier": 2.0
    }
  ]
}
```

### User Points Storage
- Total points: `user:{userId}.points`
- Breakdown: `user:{userId}.pointsBreakdown`
- History: `points:history:{userId}` (sorted set)
- Leaderboards: `points:leaderboard:alltime`, `points:leaderboard:{date}`

## Usage Example

```typescript
import { pointsService } from '@/lib/services/points-service'

// Award points for a tweet
const pointsAwarded = await pointsService.awardPoints(
  'user_sharafi', 
  'action_tweet_post',
  'campaigns',
  { campaignId: 'campaign123' }
)

// Get user's points
const userPoints = await pointsService.getUserPoints('user_sharafi')
console.log(userPoints)
// { discord: 50, contests: 100, scouts: 0, campaigns: 200, other: 0, total: 350 }

// Get leaderboard
const leaderboard = await pointsService.getLeaderboard('alltime', 10)
```

## Security
- Admin-only access enforced at API level
- Master admin bypass available
- All changes logged with admin handle
- Automatic backups with 30-day retention

## Integration Points
The Points Service can be integrated with:
- Discord bots for engagement points
- Contest submissions
- Scout referrals
- Campaign participation
- Any other user actions

## Future Enhancements
- Points decay over time
- Bonus multiplier events
- Team-based points
- Points redemption system
- Achievement badges based on points 