const { Client, GatewayIntentBits } = require('discord.js')
const { config } = require('dotenv')
const path = require('path')

// Load environment
config({ path: path.join(__dirname, '..', '.env.local') })

// Create client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages
  ]
})

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`)
  
  // Find all guilds
  console.log('\n📊 Checking all servers:')
  
  for (const guild of client.guilds.cache.values()) {
    console.log(`\n🏠 Server: ${guild.name}`)
    
    // Find engagement-tracker channel
    const channel = guild.channels.cache.find(ch => ch.name === 'engagement-tracker')
    
    if (channel) {
      console.log(`  ✅ Found #engagement-tracker (ID: ${channel.id})`)
      
      // Get bot member
      const botMember = guild.members.cache.get(client.user.id)
      if (!botMember) {
        console.log('  ❌ Bot member not found in cache')
        continue
      }
      
      // Check permissions
      const perms = channel.permissionsFor(botMember)
      
      console.log('  📋 Bot permissions:')
      console.log(`    • View Channel: ${perms.has('ViewChannel') ? '✅' : '❌'}`)
      console.log(`    • Send Messages: ${perms.has('SendMessages') ? '✅' : '❌'}`)
      console.log(`    • Embed Links: ${perms.has('EmbedLinks') ? '✅' : '❌'}`)
      console.log(`    • Attach Files: ${perms.has('AttachFiles') ? '✅' : '❌'}`)
      console.log(`    • Read Message History: ${perms.has('ReadMessageHistory') ? '✅' : '❌'}`)
      console.log(`    • Use External Emojis: ${perms.has('UseExternalEmojis') ? '✅' : '❌'}`)
      console.log(`    • Add Reactions: ${perms.has('AddReactions') ? '✅' : '❌'}`)
      
      // Check role position
      const botRole = botMember.roles.highest
      console.log(`  🎭 Bot's highest role: ${botRole.name} (position: ${botRole.position})`)
      
      // Try to send a test message
      try {
        console.log('  🧪 Testing message send...')
        await channel.send('🔧 Permission test - bot can send messages!')
        console.log('  ✅ Test message sent successfully!')
      } catch (error) {
        console.log('  ❌ Failed to send test message:', error.message)
      }
      
    } else {
      console.log('  ❌ No #engagement-tracker channel found')
    }
  }
  
  console.log('\n✅ Test complete!')
  process.exit(0)
})

client.on('error', console.error)

// Login
client.login(process.env.DISCORD_BOT_TOKEN)
  .catch(err => {
    console.error('❌ Failed to login:', err)
    process.exit(1)
  }) 