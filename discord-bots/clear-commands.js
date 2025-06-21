const { REST, Routes } = require('discord.js')
const { config } = require('dotenv')
const path = require('path')

// Load environment
config({ path: path.join(__dirname, '..', '.env.local') })

const token = process.env.DISCORD_ENGAGEMENT_BOT_TOKEN || process.env.DISCORD_BOT_TOKEN
const clientId = '1385726036909752340' // Correct bot ID from test
const guildId = '980159046176870450' // NABU LINES guild ID

if (!token) {
  console.error('❌ No bot token found!')
  process.exit(1)
}

const rest = new REST({ version: '10' }).setToken(token)

async function clearAndRegisterCommands() {
  try {
    console.log('🧹 Clearing existing commands...')
    
    // Get all guilds the bot is in
    const guilds = await rest.get(Routes.userGuilds())
    
    // Clear global commands
    await rest.put(Routes.applicationCommands(clientId), { body: [] })
    console.log('✅ Cleared global commands')
    
    // Define commands
    const commands = [
      {
        name: 'connect',
        description: 'Connect your Twitter account (must be approved)'
      },
      {
        name: 'test',
        description: 'Test if the bot is working'
      }
    ]
    
    // Register to specific guild (faster update)
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    )
    
    console.log(`✅ Registered ${commands.length} commands to guild`)
    console.log('⏱️  Commands should be available immediately in Discord')
    console.log('💡 Try refreshing Discord (Ctrl+R or Cmd+R) and typing / again')
    
  } catch (error) {
    console.error('Error:', error)
  }
}

clearAndRegisterCommands() 