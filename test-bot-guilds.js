const { Client, GatewayIntentBits } = require('discord.js')
require('dotenv').config({ path: '../.env.local' })

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
})

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`)
  console.log('\n📋 Guilds (Servers) the bot is in:')
  console.log('================================\n')
  
  client.guilds.cache.forEach(guild => {
    console.log(`Server: ${guild.name}`)
    console.log(`  ID: ${guild.id}`)
    console.log(`  Members: ${guild.memberCount}`)
    console.log(`  Channels: ${guild.channels.cache.size}`)
    
    // Check for specific channel
    const targetChannelId = '1382583759907459123'
    const channel = guild.channels.cache.get(targetChannelId)
    if (channel) {
      console.log(`  ✅ Found channel: #${channel.name} (${targetChannelId})`)
    }
    
    console.log('')
  })
  
  // Check specific server
  const nabulinesServerId = '980159046176870450'
  const nabulinesGuild = client.guilds.cache.get(nabulinesServerId)
  
  console.log('\n🔍 NABULINES Server Check:')
  console.log('========================')
  if (nabulinesGuild) {
    console.log('✅ Bot is in NABULINES server')
    console.log(`Server name: ${nabulinesGuild.name}`)
    
    // List all channels
    console.log('\nChannels in NABULINES:')
    nabulinesGuild.channels.cache.forEach(channel => {
      console.log(`  - #${channel.name} (${channel.id}) [${channel.type === 0 ? 'text' : 'other'}]`)
    })
  } else {
    console.log('❌ Bot is NOT in NABULINES server (ID: 980159046176870450)')
  }
  
  // Exit after checking
  client.destroy()
  process.exit(0)
})

client.login(process.env.DISCORD_BOT_TOKEN) 