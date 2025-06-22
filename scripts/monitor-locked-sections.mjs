#!/usr/bin/env node

// 🔒 LOCKED SECTION INTEGRITY MONITOR
// This script checks the integrity of locked sections across the codebase

import { readFileSync } from 'fs'
import { execSync } from 'child_process'

const PROTECTED_FILES = [
  {
    path: 'components/KOLTable.tsx',
    lockMarker: '🔒 LOCKED SECTION',
    endMarker: '🔒 END LOCKED SECTION',
    description: 'KOL deduplication logic (client-side)'
  },
  {
    path: 'app/api/campaigns/[id]/kols/route.ts',
    lockMarker: '✅ STABLE & VERIFIED',
    endMarker: null,
    description: 'KOL deduplication logic (server-side)'
  },
  {
    path: 'scripts/clean-kol-duplicates.mjs',
    lockMarker: '🔒 LOCKED SCRIPT',
    endMarker: null,
    description: 'KOL cleanup script'
  }
]

console.log('🔒 LOCKED SECTION INTEGRITY MONITOR')
console.log('==================================\n')

// Get the commit hash when locks were added
const LOCK_COMMIT = '1fabe7c' // The commit where we added the locks

let issuesFound = false

for (const file of PROTECTED_FILES) {
  console.log(`📋 Checking ${file.path}...`)
  
  try {
    // Check if file exists
    const content = readFileSync(file.path, 'utf8')
    const lines = content.split('\n')
    
    // Find locked sections
    let lockStart = -1
    let lockEnd = -1
    
    lines.forEach((line, index) => {
      if (line.includes(file.lockMarker) && lockStart === -1) {
        lockStart = index + 1 // Convert to 1-based
      }
      if (file.endMarker && line.includes(file.endMarker) && lockEnd === -1) {
        lockEnd = index + 1
      }
    })
    
    if (lockStart === -1) {
      console.log(`   ❌ MISSING LOCK MARKER: "${file.lockMarker}"`)
      issuesFound = true
      continue
    }
    
    if (file.endMarker && lockEnd === -1) {
      console.log(`   ❌ MISSING END MARKER: "${file.endMarker}"`)
      issuesFound = true
      continue
    }
    
    console.log(`   ✅ Lock markers found at line ${lockStart}${lockEnd > 0 ? `-${lockEnd}` : ''}`)
    console.log(`   📝 Purpose: ${file.description}`)
    
    // Check git history for modifications
    try {
      const gitLog = execSync(
        `git log --oneline --follow -L${lockStart},${lockEnd > 0 ? lockEnd : lockStart}:${file.path} ${LOCK_COMMIT}..HEAD 2>/dev/null`,
        { encoding: 'utf8' }
      ).trim()
      
      if (gitLog) {
        console.log(`   ⚠️  MODIFICATIONS DETECTED since lock was added:`)
        console.log(`   ${gitLog.split('\n').join('\n   ')}`)
        issuesFound = true
      } else {
        console.log(`   ✅ No modifications since lock was added`)
      }
    } catch (e) {
      // No commits found, which is good
      console.log(`   ✅ No modifications since lock was added`)
    }
    
    // Extract and display the locked content
    if (process.argv.includes('--show-content')) {
      console.log('\n   📄 Locked content:')
      const endLine = lockEnd > 0 ? lockEnd : Math.min(lockStart + 10, lines.length)
      for (let i = lockStart - 1; i < endLine && i < lines.length; i++) {
        console.log(`      ${String(i + 1).padStart(4)}: ${lines[i]}`)
      }
    }
    
  } catch (error) {
    console.log(`   ❌ ERROR: ${error.message}`)
    issuesFound = true
  }
  
  console.log('')
}

// Summary
console.log('==================================')
if (issuesFound) {
  console.log('❌ ISSUES FOUND - Review the locked sections above')
  process.exit(1)
} else {
  console.log('✅ All locked sections are intact')
}

// Show usage
console.log('\nUsage:')
console.log('  node scripts/monitor-locked-sections.mjs           # Check integrity')
console.log('  node scripts/monitor-locked-sections.mjs --show-content  # Also show locked code')

// Git blame info
console.log('\nTo see who last modified a locked section:')
console.log('  git blame -L614,671 components/KOLTable.tsx')
console.log('  git blame app/api/campaigns/[id]/kols/route.ts | grep -A5 -B5 "STABLE & VERIFIED"') 