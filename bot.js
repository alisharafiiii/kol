console.log('🧪 starting bot.js...');

const { Client, GatewayIntentBits, Partials } = require('discord.js');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

client.on('ready', () => {
  console.log(`🤖 logged in as ${client.user.tag}`);
  console.log(`   Servers: ${client.guilds.cache.size}`);
  
  // Set bot status
  client.user.setActivity('Analyzing Discord Activity', { type: 3 }); // Type 3 = Watching
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Test command still works
  if (message.content === '!ping') {
    message.reply('pong! 🏓 Analytics bot is running!');
    return;
  }

  // Admin commands
  if (message.content === '!analytics-status') {
    message.reply('❌ Redis is not configured yet. Analytics tracking will be available soon!');
    return;
  }
  
  // Later we'll add Redis logging here
  console.log(`📨 Message from ${message.author.username}: ${message.content}`);
});

// Error handling
client.on('error', (error) => {
  console.error('❌ Discord client error:', error);
});

// Use environment variable for token, fallback to the one you provided
const token = process.env.DISCORD_BOT_TOKEN || 'MTM4MTg2Nzc0Mjk1MjU1NDYxNg.G03q5T.P3PEmlg_rfm8G-cqUibwR8KknYofULEYFX0c60';

console.log('🔑 Attempting to login with token:', token.substring(0, 20) + '...');

client.login(token).catch(error => {
  console.error('❌ Failed to login:', error.message);
});
