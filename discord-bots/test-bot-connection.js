const { Client, GatewayIntentBits } = require('discord.js')
const { config } = require('dotenv')
const path = require('path')

// Load environment
config({ path: path.join(__dirname, '..', '.env.local') })

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
})

client.once('ready', () => {
  console.log(`✅ Bot logged in as: ${client.user.tag}`)
  console.log(`📍 Bot ID: ${client.user.id}`)
  console.log(`🏠 Guilds:`)
  client.guilds.cache.forEach(guild => {
    console.log(`   - ${guild.name} (ID: ${guild.id})`)
    console.log(`     Members: ${guild.memberCount}`)
    console.log(`     Channels: ${guild.channels.cache.size}`)
  })
  
  // Check if bot can see any text channels
  let textChannels = 0
  client.guilds.cache.forEach(guild => {
    guild.channels.cache.forEach(channel => {
      if (channel.type === 0) { // Text channel
        textChannels++
      }
    })
  })
  console.log(`\n📝 Total text channels bot can see: ${textChannels}`)
  
  setTimeout(() => {
    console.log('\n✅ Test complete! Bot is connected properly.')
    process.exit(0)
  }, 2000)
})

client.on('error', console.error)

const token = process.env.DISCORD_ENGAGEMENT_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN
if (!token) {
  console.error('❌ No bot token found!')
  process.exit(1)
}

console.log('🔍 Testing bot connection...')
console.log(`📍 Using token: ${token.substring(0, 10)}...`)

client.login(token).catch(err => {
  console.error('❌ Failed to login:', err.message)
  process.exit(1)
}) 