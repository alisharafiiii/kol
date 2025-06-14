const { REST, Routes } = require('discord.js');
require('dotenv').config({ path: '.env.local' });

const token = process.env.DISCORD_BOT_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;

if (!token || !applicationId) {
  console.error('❌ Missing DISCORD_BOT_TOKEN or DISCORD_APPLICATION_ID');
  process.exit(1);
}

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
      type: 3, // STRING
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
    name: 'tweets',
    description: 'View recent submitted tweets'
  },
  {
    name: 'tier',
    description: 'Admin: Set user tier',
    options: [{
      name: 'user',
      type: 6, // USER
      description: 'The user to update',
      required: true
    }, {
      name: 'tier',
      type: 4, // INTEGER
      description: 'Tier level (1-3)',
      required: true
    }]
  },
  {
    name: 'scenarios',
    description: 'Admin: Configure tier scenarios',
    options: [{
      name: 'tier',
      type: 4, // INTEGER
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
      type: 10, // DOUBLE
      description: 'Points bonus multiplier',
      required: false
    }]
  }
];

const rest = new REST({ version: '10' }).setToken(token);

async function refreshCommands() {
  try {
    console.log(`🔄 Refreshing ${commands.length} slash commands...`);
    console.log(`📱 Application ID: ${applicationId}`);
    
    // Register commands globally
    const data = await rest.put(
      Routes.applicationCommands(applicationId),
      { body: commands }
    );
    
    console.log(`✅ Successfully registered ${data.length} commands globally`);
    console.log('\n📝 Registered commands:');
    data.forEach(cmd => {
      console.log(`   /${cmd.name} - ${cmd.description}`);
    });
    
    console.log('\n💡 Tips:');
    console.log('   - Global commands may take up to 1 hour to appear');
    console.log('   - Try typing / in Discord and waiting a moment');
    console.log('   - Make sure the bot has "Use Slash Commands" permission');
    console.log('   - You may need to restart Discord');
    
  } catch (error) {
    console.error('❌ Error refreshing commands:', error);
  }
}

refreshCommands(); 