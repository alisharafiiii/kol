const { REST, Routes } = require('discord.js');
require('dotenv').config({ path: '.env.local' });

const token = process.env.DISCORD_BOT_TOKEN;
const applicationId = process.env.DISCORD_APPLICATION_ID;

if (!token || !applicationId) {
  console.error('❌ Missing DISCORD_BOT_TOKEN or DISCORD_APPLICATION_ID in .env.local');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(token);

async function clearCommands() {
  try {
    console.log('🔄 Clearing all global application commands...');
    
    // Clear global commands
    await rest.put(Routes.applicationCommands(applicationId), { body: [] });
    console.log('✅ Successfully cleared all global commands');
    
    // If you want to clear guild-specific commands, uncomment and add your guild ID:
    // const guildId = 'YOUR_GUILD_ID';
    // await rest.put(Routes.applicationGuildCommands(applicationId, guildId), { body: [] });
    // console.log('✅ Successfully cleared guild commands');
    
  } catch (error) {
    console.error('❌ Error clearing commands:', error);
  }
}

clearCommands(); 