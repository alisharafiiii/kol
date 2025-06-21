const { Client, GatewayIntentBits } = require('discord.js')
const { config } = require('dotenv')
const path = require('path')

// Load environment
const envPath = path.join(__dirname, '..', '.env.local')
config({ path: envPath })

// Create client
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
})

// When ready
client.on('ready', async () => {
  console.log(`✅ Test bot logged in as ${client.user.tag}`)
  
  // Register a simple ping command
  const commands = [{
    name: 'test',
    description: 'Simple test command'
  }]
  
  try {
    await client.application.commands.set(commands)
    console.log('✅ Commands registered')
  } catch (error) {
    console.error('❌ Failed to register commands:', error)
  }
})

// Handle interactions
client.on('interactionCreate', async (interaction) => {
  console.log(`📥 Received interaction: ${interaction.type} - ${interaction.commandName}`)
  
  if (!interaction.isCommand()) return
  
  if (interaction.commandName === 'test') {
    try {
      await interaction.reply('✅ Bot is working!')
      console.log('✅ Replied successfully')
    } catch (error) {
      console.error('❌ Failed to reply:', error)
    }
  }
})

// Error handler
client.on('error', console.error)

// Login
const token = process.env.DISCORD_ENGAGEMENT_BOT_TOKEN
if (!token) {
  console.error('❌ No DISCORD_ENGAGEMENT_BOT_TOKEN found!')
  process.exit(1)
}

client.login(token)
  .then(() => console.log('🚀 Starting test bot...'))
  .catch(console.error) 