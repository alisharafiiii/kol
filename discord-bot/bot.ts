import { Client, GatewayIntentBits, Events, Message, TextChannel } from 'discord.js';
import { DiscordService } from '../lib/services/discord-service';

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

// Cache for tracked channels per server
const trackedChannelsCache = new Map<string, Set<string>>();

// Load tracked channels for all projects
async function loadTrackedChannels() {
  try {
    const projects = await DiscordService.getAllProjects();
    
    for (const project of projects) {
      if (project.isActive && project.trackedChannels.length > 0) {
        trackedChannelsCache.set(
          project.serverId, 
          new Set(project.trackedChannels)
        );
      }
    }
    
    console.log(`Loaded tracking config for ${projects.length} projects`);
  } catch (error) {
    console.error('Error loading tracked channels:', error);
  }
}

// Get project ID by server ID
async function getProjectIdByServerId(serverId: string): Promise<string | null> {
  const projects = await DiscordService.getAllProjects();
  const project = projects.find(p => p.serverId === serverId);
  return project?.id || null;
}

// Handle incoming messages
async function handleMessage(message: Message) {
  // Ignore bot messages
  if (message.author.bot) return;
  
  // Check if this channel is tracked
  const serverId = message.guild?.id;
  if (!serverId) return;
  
  const trackedChannels = trackedChannelsCache.get(serverId);
  if (!trackedChannels || !trackedChannels.has(message.channel.id)) return;
  
  // Get project ID
  const projectId = await getProjectIdByServerId(serverId);
  if (!projectId) return;
  
  try {
    // Save message to database
    await DiscordService.saveMessage({
      messageId: message.id,
      projectId,
      channelId: message.channel.id,
      channelName: (message.channel as TextChannel).name,
      userId: message.author.id,
      username: message.author.username,
      userAvatar: message.author.avatarURL() || undefined,
      content: message.content,
      timestamp: message.createdAt.toISOString(),
      hasAttachments: message.attachments.size > 0,
      replyToId: message.reference?.messageId
    });
    
    console.log(`[${serverId}] Message logged from #${(message.channel as TextChannel).name}`);
  } catch (error) {
    console.error('Error saving message:', error);
  }
}

// Bot ready event
client.once(Events.ClientReady, async (c) => {
  console.log(`Discord bot logged in as ${c.user.tag}`);
  
  // Load tracked channels
  await loadTrackedChannels();
  
  // Reload tracked channels every 5 minutes
  setInterval(loadTrackedChannels, 5 * 60 * 1000);
  
  // Update bot status
  c.user.setActivity('Analyzing Discord Activity', { type: 3 }); // Type 3 = Watching
});

// Message create event
client.on(Events.MessageCreate, handleMessage);

// Error handling
client.on('error', (error) => {
  console.error('Discord client error:', error);
});

// Export functions for external control
export async function startBot(token: string) {
  try {
    await client.login(token);
  } catch (error) {
    console.error('Failed to start Discord bot:', error);
    throw error;
  }
}

export async function stopBot() {
  await client.destroy();
  console.log('Discord bot stopped');
}

export async function reloadTrackedChannels() {
  await loadTrackedChannels();
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down Discord bot...');
  await stopBot();
  process.exit(0);
});

// Start bot if token is provided via environment
if (process.env.DISCORD_BOT_TOKEN) {
  startBot(process.env.DISCORD_BOT_TOKEN);
} 