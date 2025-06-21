import { Client, GatewayIntentBits } from 'discord.js'
import { config } from 'dotenv'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { Redis } from '@upstash/redis'
import { GoogleGenerativeAI } from '@google/generative-ai'

// Get current directory (ES modules compatibility)
const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

// Load environment variables from parent directory
const envPath = join(__dirname, '..', '.env.local')
config({ path: envPath })
console.log('🔍 Loading environment from:', envPath)

// Initialize Redis connection using Upstash
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

console.log('✅ Connected to Upstash Redis')

// Initialize Gemini AI for sentiment analysis
let model = null
if (process.env.GEMINI_API_KEY) {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
  console.log('✅ AI model initialized for sentiment analysis')
} else {
  console.warn('⚠️  No GEMINI_API_KEY found - sentiment analysis disabled')
}

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ]
})

// Cache for tracked channels per project
const projectChannelsCache = new Map()

// Cache for sentiment settings per project
const sentimentSettingsCache = new Map()

// Load sentiment settings for a project
async function loadSentimentSettings(projectId) {
  try {
    const settingsKey = `discord:sentiment:${projectId}`
    const settings = await redis.json.get(settingsKey)
    
    if (settings) {
      sentimentSettingsCache.set(projectId, {
        bullishKeywords: (settings.bullishKeywords || '').split(',').map(k => k.trim().toLowerCase()).filter(k => k),
        bearishKeywords: (settings.bearishKeywords || '').split(',').map(k => k.trim().toLowerCase()).filter(k => k),
        bullishEmojis: (settings.bullishEmojis || '').split(',').map(e => e.trim()).filter(e => e),
        bearishEmojis: (settings.bearishEmojis || '').split(',').map(e => e.trim()).filter(e => e),
        ignoredChannels: settings.ignoredChannels || [],
        minimumMessageLength: settings.minimumMessageLength || 3
      })
      console.log(`📊 Loaded sentiment settings for project: ${projectId}`)
    }
  } catch (error) {
    console.error('Error loading sentiment settings:', error)
  }
}

// Check for sentiment settings reload requests
async function checkSentimentReloads() {
  for (const projectId of projectChannelsCache.keys()) {
    const reloadKey = `discord:sentiment:reload:${projectId}`
    const shouldReload = await redis.get(reloadKey)
    
    if (shouldReload) {
      console.log(`🔄 Reloading sentiment settings for project: ${projectId}`)
      await loadSentimentSettings(projectId)
      await redis.del(reloadKey)
    }
  }
}

// Load tracked channels for all projects
async function loadTrackedChannels() {
  try {
    console.log('📊 Loading tracked channels...')
    
    // Get all Discord projects - FIX: Use correct key pattern
    const projectKeys = await redis.keys('project:discord:*')
    
    for (const key of projectKeys) {
      const project = await redis.json.get(key)
      if (project && project.isActive && project.trackedChannels?.length > 0) {
        projectChannelsCache.set(project.id, {
          name: project.name,
          channels: new Set(project.trackedChannels),
          serverId: project.serverId
        })
        console.log(`📌 Tracking ${project.trackedChannels.length} channels for project: ${project.name}`)
        
        // Load sentiment settings for this project
        await loadSentimentSettings(project.id)
      }
    }
    
    console.log(`✅ Loaded ${projectChannelsCache.size} active projects`)
  } catch (error) {
    console.error('❌ Error loading tracked channels:', error)
  }
}

// Analyze sentiment using custom settings and Gemini
async function analyzeSentiment(content, projectId) {
  // Check minimum message length
  const settings = sentimentSettingsCache.get(projectId)
  if (settings && content.length < settings.minimumMessageLength) {
    return { score: 'neutral', confidence: 0.5 }
  }
  
  // First check custom keywords and emojis
  if (settings) {
    const lowerContent = content.toLowerCase()
    
    // Count bullish and bearish indicators
    let bullishCount = 0
    let bearishCount = 0
    
    // Check keywords
    for (const keyword of settings.bullishKeywords) {
      if (lowerContent.includes(keyword)) bullishCount++
    }
    for (const keyword of settings.bearishKeywords) {
      if (lowerContent.includes(keyword)) bearishCount++
    }
    
    // Check emojis
    for (const emoji of settings.bullishEmojis) {
      if (content.includes(emoji)) bullishCount++
    }
    for (const emoji of settings.bearishEmojis) {
      if (content.includes(emoji)) bearishCount++
    }
    
    // If we have clear indicators, use them
    if (bullishCount > bearishCount && bullishCount > 0) {
      return { score: 'positive', confidence: Math.min(0.9, 0.6 + (bullishCount * 0.1)) }
    } else if (bearishCount > bullishCount && bearishCount > 0) {
      return { score: 'negative', confidence: Math.min(0.9, 0.6 + (bearishCount * 0.1)) }
    }
  }
  
  // Fall back to AI analysis if no clear custom indicators
  if (!model || !content || content.length < 3) {
    return { score: 'neutral', confidence: 0.5 }
  }
  
  try {
    const prompt = `Analyze the sentiment of this Discord message and respond with ONLY ONE WORD - either "positive", "neutral", or "negative": "${content}"`
    
    const result = await model.generateContent(prompt)
    const response = await result.response
    const sentiment = response.text().toLowerCase().trim()
    
    // Validate response
    if (['positive', 'neutral', 'negative'].includes(sentiment)) {
      return { score: sentiment, confidence: 0.8 }
    }
    
    return { score: 'neutral', confidence: 0.5 }
  } catch (error) {
    console.error('Error analyzing sentiment:', error.message)
    return { score: 'neutral', confidence: 0.5 }
  }
}

// Save message to Redis using the same structure as DiscordService
async function saveMessage(message, projectId, projectData) {
  try {
    // Check if channel is ignored for sentiment analysis
    const settings = sentimentSettingsCache.get(projectId)
    if (settings && settings.ignoredChannels.includes(message.channel.id)) {
      console.log(`⏭️ Skipping ignored channel: #${message.channel.name}`)
      return
    }
    
    const messageId = `message:discord:${projectId}:${message.id}`
    
    // Analyze sentiment with project ID
    const sentiment = await analyzeSentiment(message.content, projectId)
    
    const messageData = {
      id: messageId,
      messageId: message.id,
      projectId: projectId,
      serverId: message.guild.id,
      serverName: message.guild.name,
      channelId: message.channel.id,
      channelName: message.channel.name,
      userId: message.author.id,
      username: message.author.username,
      userAvatar: message.author.avatarURL(),
      content: message.content,
      timestamp: message.createdAt.toISOString(),
      hasAttachments: message.attachments.size > 0,
      attachments: Array.from(message.attachments.values()).map(a => ({
        id: a.id,
        url: a.url,
        name: a.name,
        size: a.size,
        contentType: a.contentType
      })),
      replyToId: message.reference?.messageId || null,
      sentiment: sentiment
    }
    
    // Save message
    await redis.json.set(messageId, '$', messageData)
    
    // Add to indexes
    await redis.sadd(`discord:messages:project:${projectId}`, messageId)
    await redis.sadd(`discord:messages:channel:${message.channel.id}`, messageId)
    await redis.sadd(`discord:messages:user:${message.author.id}`, messageId)
    
    // Update user stats
    await updateUserStats(message.author.id, message.author.username, projectId, sentiment.score)
    
    // Update project stats
    await updateProjectStats(projectId)
    
    // Log based on sentiment
    const sentimentEmoji = {
      positive: '😊',
      neutral: '😐',
      negative: '😞'
    }[sentiment.score] || '😐'
    
    console.log(`${sentimentEmoji} [${projectData.name}] #${message.channel.name} @${message.author.username}: ${message.content.substring(0, 50)}${message.content.length > 50 ? '...' : ''}`)
    
    return messageData
  } catch (error) {
    console.error('Error saving message:', error)
    throw error
  }
}

// Update user statistics
async function updateUserStats(userId, username, projectId, sentiment) {
  try {
    const userKey = `discord:user:${userId}`
    let user = await redis.json.get(userKey)
    
    if (!user) {
      user = {
        id: userId,
        username: username,
        projects: [projectId],
        stats: {
          [projectId]: {
            messageCount: 0,
            firstSeen: new Date().toISOString(),
            lastSeen: new Date().toISOString(),
            sentimentBreakdown: {
              positive: 0,
              neutral: 0,
              negative: 0
            }
          }
        }
      }
    }
    
    // Update stats
    if (!user.stats[projectId]) {
      user.stats[projectId] = {
        messageCount: 0,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        sentimentBreakdown: {
          positive: 0,
          neutral: 0,
          negative: 0
        }
      }
    }
    
    user.stats[projectId].messageCount++
    user.stats[projectId].lastSeen = new Date().toISOString()
    user.stats[projectId].sentimentBreakdown[sentiment]++
    
    if (!user.projects.includes(projectId)) {
      user.projects.push(projectId)
    }
    
    await redis.json.set(userKey, '$', user)
    await redis.sadd(`discord:users:project:${projectId}`, userId)
  } catch (error) {
    console.error('Error updating user stats:', error)
  }
}

// Update project statistics
async function updateProjectStats(projectId) {
  try {
    const project = await redis.json.get(projectId)
    if (!project) return
    
    const messageIds = await redis.smembers(`discord:messages:project:${projectId}`)
    const userIds = await redis.smembers(`discord:users:project:${projectId}`)
    
    project.stats = {
      totalMessages: messageIds.length,
      totalUsers: userIds.length,
      lastActivity: new Date().toISOString()
    }
    
    await redis.json.set(projectId, '$', project)
  } catch (error) {
    console.error('Error updating project stats:', error)
  }
}

// Handle Discord ready event
client.on('ready', async () => {
  console.log(`✅ Analytics bot logged in as ${client.user.tag}`)
  console.log(`📊 Monitoring ${client.guilds.cache.size} servers`)
  
  // Load tracked channels
  await loadTrackedChannels()
  
  // Reload tracked channels every 5 minutes
  setInterval(loadTrackedChannels, 5 * 60 * 1000)
  
  // Check for sentiment settings reloads every 30 seconds
  setInterval(checkSentimentReloads, 30 * 1000)
})

// Handle new messages
client.on('messageCreate', async (message) => {
  // Ignore bot messages
  if (message.author.bot) return
  
  // Ignore DMs
  if (!message.guild) return
  
  // Check if this channel is being tracked by any project
  let trackedProject = null
  let projectData = null
  
  for (const [projectId, data] of projectChannelsCache) {
    if (data.channels.has(message.channel.id)) {
      trackedProject = projectId
      projectData = data
      break
    }
  }
  
  // If channel is not tracked, ignore
  if (!trackedProject) return
  
  try {
    // Save the message
    await saveMessage(message, trackedProject, projectData)
  } catch (error) {
    console.error('Error processing message:', error)
  }
})

// Handle errors
client.on('error', (error) => {
  console.error('Discord client error:', error)
})

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n🛑 Shutting down analytics bot...')
  
  try {
    client.destroy()
    // @upstash/redis doesn't need explicit connection closing
    console.log('✅ Analytics bot stopped gracefully')
    process.exit(0)
  } catch (error) {
    console.error('Error during shutdown:', error)
    process.exit(1)
  }
})

// Login to Discord
client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => console.log('🚀 Analytics bot starting...'))
  .catch((error) => {
    console.error('❌ Failed to start analytics bot:', error)
    process.exit(1)
  }) 