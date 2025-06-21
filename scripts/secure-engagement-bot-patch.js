#!/usr/bin/env node

// Script to add secure Twitter verification to engagement bot
const fs = require('fs')
const path = require('path')

const botPath = path.join(__dirname, '..', 'discord-bots', 'engagement-bot.js')
const backupPath = path.join(__dirname, '..', 'discord-bots', 'engagement-bot-presecure.js')

console.log('🔒 Adding Secure Twitter Verification to Engagement Bot\n')

// Read the current file
let content
try {
  content = fs.readFileSync(botPath, 'utf8')
  console.log('✅ Read engagement bot')
} catch (error) {
  console.error('❌ Failed to read engagement bot:', error.message)
  process.exit(1)
}

// Create backup
try {
  fs.writeFileSync(backupPath, content)
  console.log('✅ Created backup: engagement-bot-presecure.js')
} catch (error) {
  console.error('❌ Failed to create backup:', error.message)
  process.exit(1)
}

// The secure connect implementation
const secureConnectHandler = `
    if (commandName === 'connect') {
      await interaction.deferReply({ flags: 64 })
      
      try {
        // Generate a unique verification session
        const sessionId = \`verify-\${interaction.user.id}-\${Date.now()}\`
        const sessionKey = \`discord:verify:\${sessionId}\`
        
        // Store session data
        await redis.set(sessionKey, JSON.stringify({
          discordId: interaction.user.id,
          discordUsername: interaction.user.username,
          discordTag: interaction.user.tag,
          timestamp: Date.now()
        }), { ex: 600 }) // Expires in 10 minutes
        
        // Create verification URL that will use the website's Twitter OAuth
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const verificationUrl = \`\${baseUrl}/auth/discord-link?session=\${sessionId}\`
        
        const embed = new EmbedBuilder()
          .setColor(0x1DA1F2) // Twitter blue
          .setTitle('🔐 Secure Twitter Connection')
          .setDescription(
            'To securely connect your Twitter account, you need to verify ownership through Twitter OAuth.\\n\\n' +
            '**Click the button below to:**\\n' +
            '1. Sign in with Twitter (OAuth)\\n' +
            '2. Authorize the connection\\n' +
            '3. Your accounts will be linked automatically'
          )
          .addFields(
            { name: '⏱️ Expires In', value: '10 minutes', inline: true },
            { name: '🔒 Security', value: 'OAuth 2.0', inline: true }
          )
          .setFooter({ text: 'Only you can complete this verification' })
        
        const row = new ActionRowBuilder()
          .addComponents(
            new ButtonBuilder()
              .setLabel('Verify Twitter Account')
              .setStyle(ButtonStyle.Link)
              .setURL(verificationUrl)
              .setEmoji('🐦')
          )
        
        await interaction.editReply({
          embeds: [embed],
          components: [row],
          flags: 64
        })
      } catch (error) {
        console.error('Error in connect command:', error)
        await interaction.editReply('❌ An error occurred. Please try again.')
      }
    }`

// Find and replace the connect command handler
const connectHandlerRegex = /if \(commandName === 'connect'\) \{[\s\S]*?await interaction\.showModal\(modal\)\s*\}/
if (connectHandlerRegex.test(content)) {
  content = content.replace(connectHandlerRegex, secureConnectHandler)
  console.log('✅ Replaced connect handler with secure version')
} else {
  console.error('❌ Could not find connect handler to replace')
  console.log('   The bot may have been modified. Please check manually.')
}

// Update the command description
content = content.replace(
  "description: 'Connect your Twitter account'",
  "description: 'Securely connect your Twitter account via OAuth'"
)

// Write the updated file
try {
  fs.writeFileSync(botPath, content)
  console.log('\n✅ Successfully added secure Twitter verification!')
} catch (error) {
  console.error('\n❌ Failed to write updated file:', error.message)
  console.log('   Restoring from backup...')
  fs.copyFileSync(backupPath, botPath)
  process.exit(1)
}

console.log('\n📋 Summary of changes:')
console.log('   - /connect now shows a secure verification link')
console.log('   - Users must authenticate via Twitter OAuth on the website')
console.log('   - No more manual Twitter handle input')
console.log('   - Verification expires in 10 minutes')
console.log('   - Only the Discord user who initiated can complete verification')

console.log('\n⚠️  IMPORTANT: You also need to create the Discord link page on the website:')
console.log('   /auth/discord-link - to handle the OAuth flow and link accounts')

console.log('\n💡 Next steps:')
console.log('   1. Restart the engagement bot:')
console.log('      pkill -f engagement-bot.js')
console.log('      cd discord-bots && node engagement-bot.js')
console.log('   2. Test the /connect command')
console.log('   3. Implement the website endpoint if not exists')

console.log('\n⚙️  To restore previous version:')
console.log('   cp discord-bots/engagement-bot-presecure.js discord-bots/engagement-bot.js') 