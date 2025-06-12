console.log('🧪 starting Enhanced Discord analytics bot...');

const { Client, GatewayIntentBits, Partials } = require('discord.js');
const { Redis } = require('@upstash/redis');
require('dotenv').config({ path: '.env.local' });

// Parse REDIS_URL if available
let upstashUrl;
let upstashToken;

if (process.env.REDIS_URL) {
  try {
    const url = new URL(process.env.REDIS_URL);
    const token = url.password;
    const host = url.hostname;
    
    upstashUrl = `https://${host}`;
    upstashToken = token;
    console.log('✅ Redis configuration loaded from environment');
  } catch (error) {
    console.error('Failed to parse REDIS_URL:', error);
  }
}

// Initialize Redis client
const redis = upstashUrl && upstashToken ? new Redis({
  url: upstashUrl,
  token: upstashToken
}) : null;

if (!redis) {
  console.error('❌ Redis not configured - analytics will not work');
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel]
});

// Cache for tracked channels per server
const trackedChannelsCache = new Map();
// Cache for Scout projects
const scoutProjectsCache = new Map();

// Load Scout project data
async function loadScoutProjects() {
  if (!redis) return;
  
  try {
    console.log('📋 Loading Scout project data...');
    
    const projectIds = await redis.smembers('discord:projects:all');
    
    for (const projectId of projectIds) {
      const project = await redis.json.get(projectId);
      if (project && project.scoutProjectId) {
        // Try to get Scout project data
        const scoutProjectKey = `project:${project.scoutProjectId}`;
        const scoutProject = await redis.json.get(scoutProjectKey).catch(() => null);
        
        if (scoutProject) {
          scoutProjectsCache.set(project.serverId, scoutProject);
          console.log(`   ✅ Loaded Scout project for server ${project.serverId}: ${scoutProject.twitterHandle}`);
        }
      }
    }
    
    console.log(`✅ Loaded ${scoutProjectsCache.size} Scout projects`);
  } catch (error) {
    console.error('❌ Error loading Scout projects:', error);
  }
}

// Update bot avatar based on Scout project
async function updateBotAvatar() {
  try {
    // Get the first Scout project with an image
    const scoutProject = Array.from(scoutProjectsCache.values()).find(p => p.profileImageUrl);
    
    if (scoutProject && scoutProject.profileImageUrl) {
      console.log(`🖼️  Setting bot avatar to ${scoutProject.twitterHandle}'s profile picture...`);
      await client.user.setAvatar(scoutProject.profileImageUrl);
      console.log('✅ Bot avatar updated successfully');
    }
  } catch (error) {
    console.error('❌ Error updating bot avatar:', error.message);
    // Rate limit or other errors - it's okay
  }
}

// Check for channel info requests from admin panel
async function checkChannelInfoRequests() {
  if (!redis) return;
  
  try {
    // Look for any channel info requests
    const requestKeys = await redis.keys('discord:channel-info-request:*');
    
    for (const requestKey of requestKeys) {
      const request = await redis.get(requestKey);
      if (!request) continue;
      
      const { channelId, serverId } = JSON.parse(request);
      
      // Try to find the channel in our client
      try {
        const guild = client.guilds.cache.get(serverId);
        if (guild) {
          const channel = guild.channels.cache.get(channelId);
          if (channel) {
            // Send response
            const responseKey = `discord:channel-info-response:${channelId}`;
            await redis.setex(responseKey, 60, JSON.stringify({
              id: channelId,
              name: channel.name,
              type: channel.type === 0 ? 'text' : 'other',
              parentName: channel.parent?.name || null
            }));
            
            console.log(`✅ Sent channel info for #${channel.name} (${channelId})`);
          }
        }
      } catch (error) {
        console.error(`Error fetching channel ${channelId}:`, error.message);
      }
      
      // Delete the request
      await redis.del(requestKey);
    }
  } catch (error) {
    // Silently fail to avoid spam
  }
}

// Load tracked channels for all projects
async function loadTrackedChannels() {
  if (!redis) {
    console.log('⚠️  Redis not configured, skipping channel loading');
    return;
  }
  
  try {
    console.log('📋 Loading tracked channels...');
    
    const projectIds = await redis.smembers('discord:projects:all');
    console.log(`   Found ${projectIds.length} Discord projects`);
    
    for (const projectId of projectIds) {
      const project = await redis.json.get(projectId);
      if (project && project.isActive && project.trackedChannels && project.trackedChannels.length > 0) {
        trackedChannelsCache.set(
          project.serverId, 
          {
            projectId: projectId,
            channels: new Set(project.trackedChannels),
            scoutProjectId: project.scoutProjectId
          }
        );
        console.log(`   ✅ Server ${project.serverId} (${project.name}): tracking ${project.trackedChannels.length} channels`);
        
        // Update channel metadata for each tracked channel
        for (const channelId of project.trackedChannels) {
          try {
            const guild = client.guilds.cache.get(project.serverId);
            if (guild) {
              const channel = guild.channels.cache.get(channelId);
              if (channel) {
                // Update channel metadata
                const channelKey = `channel:discord:${channelId}`;
                await redis.json.set(channelKey, '$', {
                  id: channelId,
                  name: channel.name,
                  projectId: projectId,
                  type: channel.type === 0 ? 'text' : 'other',
                  updatedAt: new Date().toISOString()
                });
                console.log(`      📁 Updated metadata for #${channel.name}`);
              }
            }
          } catch (error) {
            console.error(`      ❌ Error updating channel ${channelId} metadata:`, error.message);
          }
        }
      }
    }
    
    console.log(`✅ Loaded tracking config for ${trackedChannelsCache.size} active servers`);
  } catch (error) {
    console.error('❌ Error loading tracked channels:', error);
  }
}

client.on('ready', async () => {
  console.log(`🤖 logged in as ${client.user.tag}`);
  console.log(`   Servers: ${client.guilds.cache.size}`);
  console.log(`   Redis: ${redis ? '✅ Connected' : '❌ Not configured'}`);
  
  // Load Scout projects first
  await loadScoutProjects();
  
  // Try to update bot avatar
  await updateBotAvatar();
  
  // Load tracked channels on startup
  await loadTrackedChannels();
  
  // Reload tracked channels every 5 minutes
  if (redis) {
    setInterval(async () => {
      await loadScoutProjects();
      await loadTrackedChannels();
    }, 5 * 60 * 1000);
    
    // Check for channel info requests every 2 seconds
    setInterval(checkChannelInfoRequests, 2000);
  }
  
  client.user.setActivity('Analyzing Discord Activity', { type: 3 });
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Commands work regardless of tracking
  if (message.content === '!ping') {
    message.reply('pong! 🏓 Analytics bot is running!');
    return;
  }

  if (message.content === '!analytics-status') {
    if (!redis) {
      message.reply('❌ Redis is not configured. Analytics tracking is disabled.');
      return;
    }
    
    const serverData = trackedChannelsCache.get(message.guild.id);
    if (serverData) {
      const scoutProject = scoutProjectsCache.get(message.guild.id);
      let statusMessage = `✅ This server is being tracked!\n📊 Project ID: ${serverData.projectId}\n📝 Tracked channels: ${serverData.channels.size}`;
      
      if (scoutProject) {
        statusMessage += `\n🐦 Scout Project: ${scoutProject.twitterHandle}`;
      }
      
      message.reply(statusMessage);
    } else {
      message.reply('❌ This server is not set up for analytics tracking yet.\nAn admin needs to add it in the Discord admin panel.');
    }
    return;
  }
  
  if (message.content === '!refresh-channels') {
    if (!redis) {
      message.reply('❌ Redis is not configured.');
      return;
    }
    
    await loadTrackedChannels();
    message.reply('✅ Channel data refreshed!');
    return;
  }

  // Skip message logging if Redis is not configured
  if (!redis) return;

  // Check if this channel is tracked
  const serverId = message.guild?.id;
  if (!serverId) return;
  
  const serverData = trackedChannelsCache.get(serverId);
  
  if (!serverData || !serverData.channels.has(message.channel.id)) {
    return;
  }
  
  console.log(`📨 Logging message from ${message.author.username} in #${message.channel.name}`);
  
  try {
    // Save/update channel metadata
    const channelKey = `channel:discord:${message.channel.id}`;
    await redis.json.set(channelKey, '$', {
      id: message.channel.id,
      name: message.channel.name,
      projectId: serverData.projectId,
      type: 'text',
      updatedAt: new Date().toISOString()
    });
    
    // Save message via API endpoint (includes sentiment analysis)
    const messageData = {
      messageId: message.id,
      projectId: serverData.projectId,
      channelId: message.channel.id,
      channelName: message.channel.name,
      userId: message.author.id,
      username: message.author.username,
      userAvatar: message.author.avatarURL() || undefined,
      content: message.content,
      timestamp: message.createdAt.toISOString(),
      hasAttachments: message.attachments.size > 0,
      replyToId: message.reference?.messageId
    };
    
    // Call API endpoint
    const response = await fetch('http://localhost:3000/api/discord/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bot ${token}`
      },
      body: JSON.stringify(messageData)
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }
    
    const savedMessage = await response.json();
    
    console.log(`   ✅ Message saved with sentiment: ${savedMessage.sentiment?.score || 'unknown'}`);
    console.log(`   📁 Channel name stored: ${message.channel.name}`);
  } catch (error) {
    console.error('   ❌ Error saving message:', error.message);
  }
});

client.on('error', (error) => {
  console.error('❌ Discord client error:', error);
});

// Bot configuration
const token = process.env.DISCORD_BOT_TOKEN;
if (!token) {
  console.error('❌ DISCORD_BOT_TOKEN environment variable is required');
  process.exit(1);
}

console.log('🔑 Attempting to login...');

client.login(token).catch(error => {
  console.error('❌ Failed to login:', error.message);
}); 