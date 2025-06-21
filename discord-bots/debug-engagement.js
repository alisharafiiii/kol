const { Client, GatewayIntentBits, REST, Routes } = require('discord.js')
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
  console.log(`✅ Bot logged in as ${client.user.tag}`)
  console.log(`📊 Bot is in ${client.guilds.cache.size} servers:`)
  
  // List all servers
  client.guilds.cache.forEach(guild => {
    console.log(`   - ${guild.name} (${guild.id})`)
  })
  
  // Get bot application ID
  const clientId = client.user.id
  
  // Define commands
  const commands = [
    {
      name: 'ping',
      description: 'Test if bot is working'
    },
    {
      name: 'connect',
      description: 'Connect your Twitter account'
    }
  ]
  
  // Register commands globally
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_ENGAGEMENT_BOT_TOKEN)
  
  try {
    console.log('🔄 Refreshing application (/) commands...')
    
    // Register globally (might take up to an hour to show)
    await rest.put(
      Routes.applicationCommands(clientId),
      { body: commands }
    )
    
    console.log('✅ Successfully registered global commands')
    
    // Also register to each guild for instant update
    for (const guild of client.guilds.cache.values()) {
      try {
        await rest.put(
          Routes.applicationGuildCommands(clientId, guild.id),
          { body: commands }
        )
        console.log(`✅ Registered commands to guild: ${guild.name}`)
      } catch (error) {
        console.error(`❌ Failed to register to ${guild.name}:`, error.message)
      }
    }
  } catch (error) {
    console.error('❌ Failed to register commands:', error)
  }
})

// Handle interactions
client.on('interactionCreate', async (interaction) => {
  console.log(`📥 Interaction received: ${interaction.commandName} from ${interaction.user.tag}`)
  
  if (!interaction.isCommand()) return
  
  try {
    if (interaction.commandName === 'ping') {
      await interaction.reply('🏓 Pong! Bot is working!')
      console.log('✅ Replied to ping')
    } else if (interaction.commandName === 'connect') {
      await interaction.reply({
        content: '✅ Connect command received! (This is a test response)',
        ephemeral: true
      })
      console.log('✅ Replied to connect')
    }
  } catch (error) {
    console.error('❌ Error handling interaction:', error)
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

console.log('🔑 Using token:', token.substring(0, 25) + '...')

client.login(token)
  .then(() => console.log('🚀 Starting debug bot...'))
  .catch(error => {
    console.error('❌ Failed to login:', error)
    if (error.code === 'TokenInvalid') {
      console.error('   The bot token is invalid. Please check DISCORD_ENGAGEMENT_BOT_TOKEN')
    }
  }) 