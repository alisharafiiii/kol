# 🔒 Locked Section Monitoring System

## Overview
This repository implements a multi-layered protection system for critical code sections that should not be modified without proper review. These sections contain essential logic for preventing KOL duplication in campaigns.

## Protected Sections

### 1. Client-Side KOL Logic
- **File**: `components/KOLTable.tsx`
- **Lines**: 614-671
- **Markers**: `🔒 LOCKED SECTION` to `🔒 END LOCKED SECTION`
- **Purpose**: Prevents duplicate KOL entries when adding products

### 2. Server-Side KOL Logic
- **File**: `app/api/campaigns/[id]/kols/route.ts`
- **Lines**: 1-4, 168-170
- **Markers**: `✅ STABLE & VERIFIED — DO NOT MODIFY WITHOUT CODE REVIEW`
- **Purpose**: Server-side deduplication logic

### 3. Cleanup Script
- **File**: `scripts/clean-kol-duplicates.mjs`
- **Lines**: 3-5
- **Markers**: `🔒 LOCKED SCRIPT - DO NOT MODIFY WITHOUT CODE REVIEW`
- **Purpose**: Removes existing duplicate KOL entries

## Monitoring Layers

### 1. Local Pre-commit Hook
**Location**: `.githooks/pre-commit`

Automatically checks for modifications to locked sections before each commit:
- Prevents commits that modify locked sections
- Can be bypassed with `git commit --no-verify` (requires justification)
- Shows exact changes attempted in locked sections

### 2. GitHub Actions Workflow
**Location**: `.github/workflows/monitor-locked-sections.yml`

Runs on all pull requests that modify protected files:
- Fails CI if locked sections are modified
- Automatically comments on the PR with instructions
- Requires code review approval for any changes

### 3. Manual Monitoring Script
**Location**: `scripts/monitor-locked-sections.mjs`

Run manually to check integrity:
```bash
# Check integrity of all locked sections
node scripts/monitor-locked-sections.mjs

# Also show the locked code content
node scripts/monitor-locked-sections.mjs --show-content
```

## How to Use

### Setting Up (One-time)
```bash
# Make hooks executable
chmod +x .githooks/pre-commit

# Configure git to use custom hooks
git config core.hooksPath .githooks
```

### Daily Development
The monitoring is automatic:
1. **Local commits** are checked by the pre-commit hook
2. **Pull requests** are checked by GitHub Actions
3. **Manual checks** can be run anytime with the monitoring script

### If You Need to Modify a Locked Section

1. **Discuss first**: Talk to the team about why the change is needed
2. **Get approval**: Have a senior developer review the proposed changes
3. **Document**: Add comments explaining why the modification was necessary
4. **Test thoroughly**: Ensure KOL deduplication still works correctly
5. **Update markers**: If approved, update the lock markers and commit hash in monitoring script

To bypass the pre-commit hook (after approval):
```bash
git commit --no-verify -m "Approved modification to locked section: [reason]"
```

## Monitoring Commands

### Check who last modified a section:
```bash
# For KOLTable.tsx locked section
git blame -L614,671 components/KOLTable.tsx

# For server-side file
git blame app/api/campaigns/[id]/kols/route.ts | grep -A5 -B5 "STABLE & VERIFIED"
```

### View history of a locked section:
```bash
# Show commits that touched the locked section
git log -p -L614,671:components/KOLTable.tsx
```

### Check current status:
```bash
# Run the monitoring script
node scripts/monitor-locked-sections.mjs
```

## Why This Matters

The KOL deduplication logic is critical because:
1. **Prevents duplicate entries** when adding products to KOLs
2. **Maintains data integrity** in campaign management
3. **Saves costs** by avoiding duplicate budgets and products
4. **Ensures accurate analytics** by preventing inflated KOL counts

## Notification System

You will be notified of attempts to modify locked sections through:
1. **Git pre-commit hook** - Blocks local commits
2. **GitHub PR checks** - Fails CI and comments on PR
3. **Code review** - Team members will see the warnings

## Emergency Override

If you absolutely must modify a locked section in an emergency:
1. Use `git commit --no-verify`
2. Document the emergency in the commit message
3. Create a follow-up task to review the change
4. Update this documentation and monitoring scripts

---

Last updated: December 22, 2024
Monitoring added in commit: 1fabe7c 