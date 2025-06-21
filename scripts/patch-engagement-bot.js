#!/usr/bin/env node

// Script to patch engagement bot with conservative fix
const fs = require('fs')
const path = require('path')

const botPath = path.join(__dirname, '..', 'discord-bots', 'engagement-bot.js')
const backupPath = path.join(__dirname, '..', 'discord-bots', 'engagement-bot-original.js')

console.log('🔧 Patching Engagement Bot\n')

// Read the original file
let content
try {
  content = fs.readFileSync(botPath, 'utf8')
  console.log('✅ Read original engagement bot')
} catch (error) {
  console.error('❌ Failed to read engagement bot:', error.message)
  process.exit(1)
}

// Create backup
try {
  fs.writeFileSync(backupPath, content)
  console.log('✅ Created backup: engagement-bot-original.js')
} catch (error) {
  console.error('❌ Failed to create backup:', error.message)
  process.exit(1)
}

// Apply patches
console.log('\n📝 Applying patches...')

// 1. Add nanoid import after other requires
if (!content.includes("require('nanoid')")) {
  const requireIndex = content.indexOf("const path = require('path')")
  if (requireIndex !== -1) {
    const insertPoint = content.indexOf('\n', requireIndex) + 1
    content = content.slice(0, insertPoint) + "const { nanoid } = require('nanoid')\n" + content.slice(insertPoint)
    console.log('   ✅ Added nanoid import')
  }
}

// 2. Add createUserProfile function after extractTwitterHandle
const createUserProfileFunc = `
// Create a new user profile (pending approval)
async function createUserProfile(twitterHandle, discordId) {
  try {
    const normalizedHandle = twitterHandle.toLowerCase().replace('@', '')
    const userId = \`user:\${nanoid()}\`
    
    const newUser = {
      id: userId,
      twitterHandle: \`@\${normalizedHandle}\`,
      name: normalizedHandle, // Use handle as name initially
      approvalStatus: 'pending', // Set to pending, requiring admin approval
      role: 'user', // Default to user role
      tier: 'micro', // Default tier
      discordId: discordId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      socialAccounts: {
        twitter: {
          handle: normalizedHandle,
          connected: true
        }
      }
    }
    
    // Save to Redis
    await redis.json.set(userId, '$', newUser)
    
    // Create username index
    await redis.sadd(\`idx:username:\${normalizedHandle}\`, userId)
    
    // Add to pending users set (not approved)
    await redis.sadd('users:pending', userId)
    
    console.log(\`✅ Created new user profile (pending) for @\${normalizedHandle}\`)
    return newUser
  } catch (error) {
    console.error('Error creating user profile:', error)
    throw error
  }
}
`

if (!content.includes('createUserProfile')) {
  const insertAfter = content.indexOf('function extractTwitterHandle')
  if (insertAfter !== -1) {
    const insertPoint = content.indexOf('\n}', insertAfter) + 2
    content = content.slice(0, insertPoint) + '\n' + createUserProfileFunc + content.slice(insertPoint)
    console.log('   ✅ Added createUserProfile function')
  }
}

// 3. Modify isUserApproved to return exists flag
const oldIsUserApproved = `return { approved: false, userData: null }`
const newIsUserApproved = `return { approved: false, userData: null, exists: false }`

content = content.replace(/return { approved: false, userData: null }/g, newIsUserApproved)

const oldIsUserApprovedSuccess = `return { approved: isApproved, userData }`
const newIsUserApprovedSuccess = `return { approved: isApproved, userData, exists: true }`

content = content.replace(oldIsUserApprovedSuccess, newIsUserApprovedSuccess)
console.log('   ✅ Updated isUserApproved return values')

// 4. Update the connect modal handler
const oldConnectHandler = `      const { approved, userData } = await isUserApproved(cleanHandle)
      if (!approved) {
        await interaction.reply({ 
          content: '❌ Your Twitter account is not approved. Please apply through the website first.', 
          flags: 64 
        })
        return
      }`

const newConnectHandler = `      const { approved, userData, exists } = await isUserApproved(cleanHandle)
      
      // If user doesn't exist, create a new profile (pending approval)
      if (!exists) {
        try {
          const newUser = await createUserProfile(cleanHandle, interaction.user.id)
          console.log(\`✅ Created new profile (pending) for @\${cleanHandle}\`)
          
          await interaction.reply({ 
            content: \`📝 Your Twitter account @\${cleanHandle} has been registered!\\n\\n\` +
                     \`⏳ **Your account is pending approval.** An admin will review and approve your account soon.\\n\` +
                     \`📢 You'll be notified once approved and can then use the engagement features.\`, 
            flags: 64 
          })
          return
        } catch (error) {
          console.error('Error creating new user profile:', error)
          await interaction.reply({ 
            content: '❌ An error occurred while creating your profile. Please try again or contact an admin.', 
            flags: 64 
          })
          return
        }
      }
      
      // If user exists but is not approved
      if (!approved) {
        await interaction.reply({ 
          content: '❌ Your Twitter account is pending approval. Please wait for an admin to approve your account.', 
          flags: 64 
        })
        return
      }`

content = content.replace(oldConnectHandler, newConnectHandler)
console.log('   ✅ Updated connect modal handler')

// Write the patched file
try {
  fs.writeFileSync(botPath, content)
  console.log('\n✅ Successfully patched engagement bot!')
} catch (error) {
  console.error('\n❌ Failed to write patched file:', error.message)
  console.log('   Restoring from backup...')
  fs.copyFileSync(backupPath, botPath)
  process.exit(1)
}

console.log('\n📋 Summary of changes:')
console.log('   - Added createUserProfile function')
console.log('   - Modified isUserApproved to return exists flag')
console.log('   - Updated /connect to create pending profiles for new users')
console.log('   - New users see a message about pending approval')
console.log('   - Existing behavior preserved for approved users')

console.log('\n💡 Next steps:')
console.log('   1. Restart the engagement bot:')
console.log('      pkill -f engagement-bot.js')
console.log('      cd discord-bots && node engagement-bot.js')
console.log('   2. Test with a new Twitter handle')
console.log('   3. Check admin panel to approve new users')

console.log('\n⚙️  To restore original:')
console.log('   cp discord-bots/engagement-bot-original.js discord-bots/engagement-bot.js') 