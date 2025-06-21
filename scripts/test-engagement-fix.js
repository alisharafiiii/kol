#!/usr/bin/env node

// Script to test engagement bot fix
require('dotenv').config({ path: '.env.local' })

console.log('🧪 Testing Engagement Bot Fix\n')

// First, let's backup the original
const fs = require('fs')
const path = require('path')

const originalPath = path.join(__dirname, '..', 'discord-bots', 'engagement-bot.js')
const backupPath = path.join(__dirname, '..', 'discord-bots', 'engagement-bot-backup.js')
const fixedPath = path.join(__dirname, '..', 'discord-bots', 'engagement-bot-fixed.js')

console.log('1. Creating backup of original engagement bot...')
try {
  fs.copyFileSync(originalPath, backupPath)
  console.log('   ✅ Backup created: engagement-bot-backup.js')
} catch (error) {
  console.error('   ❌ Failed to create backup:', error.message)
  process.exit(1)
}

console.log('\n2. Checking if fixed version exists...')
if (!fs.existsSync(fixedPath)) {
  console.error('   ❌ Fixed version not found at:', fixedPath)
  console.log('   Please run the previous command to create engagement-bot-fixed.js')
  process.exit(1)
}
console.log('   ✅ Fixed version found')

console.log('\n3. Instructions for testing:')
console.log('   a) Stop the current engagement bot if running:')
console.log('      pkill -f engagement-bot.js')
console.log('')
console.log('   b) Run the fixed version to test:')
console.log('      cd discord-bots && node engagement-bot-fixed.js')
console.log('')
console.log('   c) In Discord, test the /connect command with a new Twitter handle')
console.log('')
console.log('   d) If it works correctly (creates profile for new users), apply the fix:')
console.log('      cp discord-bots/engagement-bot-fixed.js discord-bots/engagement-bot.js')
console.log('')
console.log('   e) If there are issues, restore from backup:')
console.log('      cp discord-bots/engagement-bot-backup.js discord-bots/engagement-bot.js')

console.log('\n📝 Key changes in the fixed version:')
console.log('   - /connect now creates profiles for new users (auto-approved)')
console.log('   - New users get "kol" role and "micro" tier by default')
console.log('   - Existing users still need to be approved')
console.log('   - No changes to analytics bot or other sections')

console.log('\n⚠️  IMPORTANT: The fixed bot will auto-approve new users for engagement tracking.')
console.log('   If you want stricter control, users can be set to "pending" later via admin panel.') 