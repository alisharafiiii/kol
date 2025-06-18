// Debug patch for engagement bot channel info processing
// This adds logging to help diagnose why channel fetch isn't working

const fs = require('fs');
const path = require('path');

// Read the engagement bot file
const botPath = path.join(__dirname, 'engagement-bot.js');
let botCode = fs.readFileSync(botPath, 'utf8');

// Find the channel info processing section and add debug logging
const searchPattern = `        // Try to fetch the channel
        try {
          const guild = client.guilds.cache.get(serverId)
          if (!guild) {
            console.log(\`Guild \${serverId} not found in cache\`)
            continue
          }`;

const replacement = `        // Try to fetch the channel
        try {
          console.log(\`[DEBUG] Processing request for channel \${channelId} in guild \${serverId}\`)
          console.log(\`[DEBUG] Available guilds: \${Array.from(client.guilds.cache.keys()).join(', ')}\`)
          
          const guild = client.guilds.cache.get(serverId)
          if (!guild) {
            console.log(\`Guild \${serverId} not found in cache\`)
            console.log(\`[DEBUG] Guild cache size: \${client.guilds.cache.size}\`)
            continue
          }`;

// Replace the code
if (botCode.includes(searchPattern)) {
  botCode = botCode.replace(searchPattern, replacement);
  
  // Save to a new file
  fs.writeFileSync(path.join(__dirname, 'engagement-bot-debug.js'), botCode);
  console.log('✅ Created engagement-bot-debug.js with debug logging');
  console.log('Run: node engagement-bot-debug.js to see detailed logs');
} else {
  console.log('❌ Could not find the pattern to patch');
} 