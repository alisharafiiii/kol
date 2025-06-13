const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, resolve);
  });
}

async function main() {
  console.log('🔧 Discord Engagement Bot Environment Setup\n');
  
  // Check if .env.vercel exists and has Redis credentials
  const envVercelPath = path.join(__dirname, '.env.vercel');
  const envLocalPath = path.join(__dirname, '.env.local');
  
  let redisUrl = '';
  let redisToken = '';
  
  if (fs.existsSync(envVercelPath)) {
    const envVercel = fs.readFileSync(envVercelPath, 'utf8');
    const urlMatch = envVercel.match(/UPSTASH_REDIS_REST_URL=(.+)/);
    const tokenMatch = envVercel.match(/UPSTASH_REDIS_REST_TOKEN=(.+)/);
    
    if (urlMatch) redisUrl = urlMatch[1];
    if (tokenMatch) redisToken = tokenMatch[1];
    
    if (redisUrl && redisToken) {
      console.log('✅ Found Redis credentials in .env.vercel');
    }
  }
  
  // Read current .env.local
  let envContent = '';
  if (fs.existsSync(envLocalPath)) {
    envContent = fs.readFileSync(envLocalPath, 'utf8');
  }
  
  // Check what's missing
  const hasRedisUrl = envContent.includes('UPSTASH_REDIS_REST_URL=');
  const hasRedisToken = envContent.includes('UPSTASH_REDIS_REST_TOKEN=');
  const hasDiscordAppId = envContent.includes('DISCORD_APPLICATION_ID=');
  
  console.log('\n📋 Current Status:');
  console.log(`   Redis URL: ${hasRedisUrl ? '✅ Present' : '❌ Missing'}`);
  console.log(`   Redis Token: ${hasRedisToken ? '✅ Present' : '❌ Missing'}`);
  console.log(`   Discord App ID: ${hasDiscordAppId ? '✅ Present' : '❌ Missing'}`);
  
  const updates = [];
  
  // Add Redis credentials if missing and available
  if (!hasRedisUrl && redisUrl) {
    updates.push(`UPSTASH_REDIS_REST_URL=${redisUrl}`);
  }
  
  if (!hasRedisToken && redisToken) {
    updates.push(`UPSTASH_REDIS_REST_TOKEN=${redisToken}`);
  }
  
  // Ask for Discord App ID if missing
  if (!hasDiscordAppId) {
    console.log('\n📱 Discord Application ID is required for slash commands.');
    console.log('   You can find this in Discord Developer Portal:');
    console.log('   https://discord.com/developers/applications');
    console.log('   Select your bot application → General Information → Application ID\n');
    
    const appId = await question('Enter your Discord Application ID: ');
    if (appId) {
      updates.push(`DISCORD_APPLICATION_ID=${appId}`);
    }
  }
  
  if (updates.length > 0) {
    // Append to .env.local
    const newContent = envContent + (envContent.endsWith('\n') ? '' : '\n') + 
                      '\n# Engagement Bot Configuration\n' + 
                      updates.join('\n') + '\n';
    
    fs.writeFileSync(envLocalPath, newContent);
    console.log(`\n✅ Added ${updates.length} environment variable(s) to .env.local`);
    
    console.log('\n💡 Next steps:');
    console.log('   1. cd discord-bots');
    console.log('   2. node engagement-bot.js');
    console.log('\n📝 Note: The Gemini API key is optional. Without it, sentiment analysis will be disabled.');
  } else {
    console.log('\n✅ All required variables are already present!');
  }
  
  rl.close();
}

main().catch(console.error); 