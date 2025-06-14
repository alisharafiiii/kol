const { REST, Routes } = require('discord.js');
require('dotenv').config({ path: '.env.local' });

const token = process.env.DISCORD_BOT_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;

// CHANGE THIS TO YOUR SERVER ID
const GUILD_ID = 'YOUR_GUILD_ID_HERE';

const commands = [
  {
    name: 'connect',
    description: 'Connect your Twitter account (must be approved)'
  },
  {
    name: 'submit',
    description: 'Submit a tweet for engagement tracking',
    options: [{
      name: 'url',
      type: 3,
      description: 'The tweet URL',
      required: true
    }, {
      name: 'category',
      type: 3,
      description: 'Tweet category (optional)',
      required: false
    }]
  },
  {
    name: 'stats',
    description: 'View your engagement stats'
  },
  {
    name: 'leaderboard',
    description: 'View the engagement leaderboard'
  },
  {
    name: 'recent',  // Changed from 'tweets' to 'recent'
    description: 'View recently submitted tweets'
  },
  {
    name: 'tier',
    description: 'Admin: Set user tier',
    options: [{
      name: 'user',
      type: 6,
      description: 'The user to update',
      required: true
    }, {
      name: 'tier',
      type: 4,
      description: 'Tier level (1-3)',
      required: true
    }]
  },
  {
    name: 'scenarios',
    description: 'Admin: Configure tier scenarios',
    options: [{
      name: 'tier',
      type: 4,
      description: 'Tier level (1-3)',
      required: true
    }, {
      name: 'daily_limit',
      type: 4,
      description: 'Daily tweet limit',
      required: false
    }, {
      name: 'min_followers',
      type: 4,
      description: 'Minimum followers required',
      required: false
    }, {
      name: 'bonus_multiplier',
      type: 10,
      description: 'Points bonus multiplier',
      required: false
    }]
  }
];

const rest = new REST({ version: '10' }).setToken(token);

console.log('🚀 INSTANT COMMAND REGISTRATION');
console.log('===============================\n');

console.log('📝 To get your Guild ID:');
console.log('1. Open Discord');
console.log('2. Go to Settings → Advanced → Enable Developer Mode');
console.log('3. Right-click your server name');
console.log('4. Click "Copy Server ID"\n');

console.log('Then edit this file and replace YOUR_GUILD_ID_HERE with your actual Guild ID.\n');

if (GUILD_ID === 'YOUR_GUILD_ID_HERE') {
  console.error('❌ Please edit this file and set your GUILD_ID first!');
  process.exit(1);
}

(async () => {
  try {
    console.log(`🔄 Registering ${commands.length} commands to guild ${GUILD_ID}...`);
    
    const data = await rest.put(
      Routes.applicationGuildCommands(applicationId, GUILD_ID),
      { body: commands }
    );
    
    console.log(`\n✅ Successfully registered ${data.length} commands!`);
    console.log('\n📝 Commands available INSTANTLY in your server:');
    data.forEach(cmd => {
      console.log(`   /${cmd.name} - ${cmd.description}`);
    });
    
    console.log('\n🎉 Try typing / in Discord RIGHT NOW - commands should appear immediately!');
    console.log('\n💡 Note: We changed /tweets to /recent to avoid conflicts.');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    if (error.code === 50001) {
      console.log('\n💡 Make sure the bot is in your server!');
    }
  }
})(); 