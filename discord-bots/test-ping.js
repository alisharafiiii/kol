const { Client, GatewayIntentBits } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

client.once('ready', () => {
  console.log(`✅ Test bot logged in as ${client.user.tag}`);
  console.log(`📍 Connected to ${client.guilds.cache.size} servers`);
  
  // List all servers
  client.guilds.cache.forEach(guild => {
    console.log(`\nServer: ${guild.name} (ID: ${guild.id})`);
    console.log(`Members: ${guild.memberCount}`);
    
    // Check bot's permissions
    const botMember = guild.members.cache.get(client.user.id);
    console.log('Bot permissions:', botMember.permissions.toArray());
    
    // List channels bot can see
    const channels = guild.channels.cache
      .filter(ch => ch.type === 0) // Text channels only
      .filter(ch => ch.permissionsFor(botMember).has('ViewChannel'));
    
    console.log(`\nChannels bot can see (${channels.size}):`);
    channels.forEach(ch => {
      const canSend = ch.permissionsFor(botMember).has('SendMessages');
      console.log(`  - #${ch.name} ${canSend ? '✅ Can send' : '❌ Cannot send'}`);
    });
  });
  
  console.log('\n🔍 Listening for "ping" messages...');
});

client.on('messageCreate', async (message) => {
  // Log all messages the bot sees
  console.log(`[${new Date().toISOString()}] ${message.author.tag} in #${message.channel.name}: ${message.content}`);
  
  // Ignore bot messages
  if (message.author.bot) return;
  
  // Respond to ping
  if (message.content.toLowerCase() === 'ping') {
    console.log('📌 Detected ping! Attempting to reply...');
    try {
      await message.reply('pong! 🏓');
      console.log('✅ Successfully replied with pong!');
    } catch (error) {
      console.error('❌ Failed to reply:', error.message);
    }
  }
});

client.on('error', console.error);

client.login(process.env.DISCORD_BOT_TOKEN); 