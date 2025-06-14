const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ]
});

client.once('ready', async () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
  
  try {
    // Get the guild
    const guild = client.guilds.cache.get(process.env.DISCORD_GUILD_ID);
    if (!guild) {
      console.error('❌ Guild not found!');
      process.exit(1);
    }
    
    console.log(`\n📍 Server: ${guild.name}`);
    
    // Find the engagement-tracker channel
    const channel = guild.channels.cache.find(ch => ch.name === 'engagement-tracker');
    if (!channel) {
      console.error('❌ Channel #engagement-tracker not found!');
      process.exit(1);
    }
    
    console.log(`\n📍 Channel: #${channel.name} (ID: ${channel.id})`);
    
    // Check bot permissions in the channel
    const botMember = guild.members.cache.get(client.user.id);
    const permissions = channel.permissionsFor(botMember);
    
    console.log('\n🔍 Bot Permissions in #engagement-tracker:');
    console.log('─'.repeat(50));
    
    const requiredPerms = [
      'ViewChannel',
      'SendMessages',
      'EmbedLinks',
      'AttachFiles',
      'ReadMessageHistory',
      'AddReactions',
      'UseExternalEmojis'
    ];
    
    requiredPerms.forEach(perm => {
      const hasPerm = permissions.has(PermissionsBitField.Flags[perm]);
      console.log(`${hasPerm ? '✅' : '❌'} ${perm}`);
    });
    
    console.log('─'.repeat(50));
    
    // Check if bot can send messages
    if (permissions.has(PermissionsBitField.Flags.SendMessages)) {
      console.log('\n✅ Bot CAN send messages to this channel');
    } else {
      console.log('\n❌ Bot CANNOT send messages to this channel');
      console.log('\n🔧 To fix: Follow the instructions in DISCORD_BOT_FIX.md');
    }
    
    // List bot's roles
    console.log('\n🎭 Bot Roles:');
    botMember.roles.cache.forEach(role => {
      if (role.name !== '@everyone') {
        console.log(`  - ${role.name} (Position: ${role.position})`);
      }
    });
    
  } catch (error) {
    console.error('Error checking permissions:', error);
  }
  
  client.destroy();
  process.exit(0);
});

client.login(process.env.DISCORD_BOT_TOKEN); 