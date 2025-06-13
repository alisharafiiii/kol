const { REST, Routes } = require('discord.js');
const readline = require('readline');
require('dotenv').config({ path: '.env.local' });

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

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

console.log('🔧 Guild Command Registration (Instant Updates)\n');
console.log('To get your Guild ID:');
console.log('1. Enable Developer Mode in Discord (Settings → Advanced → Developer Mode)');
console.log('2. Right-click your server name');
console.log('3. Click "Copy Server ID"\n');

rl.question('Enter your Discord Guild/Server ID: ', async (guildId) => {
  if (!guildId || guildId.length < 17) {
    console.error('❌ Invalid Guild ID');
    rl.close();
    return;
  }

  const rest = new REST({ version: '10' }).setToken(token);

  try {
    console.log(`\n🔄 Registering ${commands.length} commands to guild ${guildId}...`);
    
    const data = await rest.put(
      Routes.applicationGuildCommands(applicationId, guildId),
      { body: commands }
    );
    
    console.log(`✅ Successfully registered ${data.length} commands!`);
    console.log('\n📝 Commands are now available immediately in your server:');
    data.forEach(cmd => {
      console.log(`   /${cmd.name} - ${cmd.description}`);
    });
    
    console.log('\n✨ Try typing / in Discord now - commands should appear instantly!');
    
  } catch (error) {
    console.error('\n❌ Error registering commands:', error);
    console.log('\n💡 Common issues:');
    console.log('   - Make sure the bot is in your server');
    console.log('   - Verify the Guild ID is correct');
    console.log('   - Check that the bot has permissions');
  }
  
  rl.close();
}); 