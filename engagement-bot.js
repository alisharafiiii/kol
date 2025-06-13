const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js')
const { config } = require('dotenv')
const { Redis } = require('@upstash/redis')
const { GoogleGenerativeAI } = require('@google/generative-ai')

// Load environment variables
config({ path: '.env.local' })

// Initialize Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

// Initialize Gemini for sentiment analysis
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY)
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions
  ]
})

// Tweet URL regex
const TWEET_REGEX = /https?:\/\/(twitter\.com|x\.com)\/[\w]+\/status\/(\d+)/i

// Bot configuration
const BOT_CHANNEL_NAME = 'engagement-tracker'
const ADMIN_ROLE_NAME = 'admin'

// Helper function to extract tweet ID from URL
function extractTweetId(url) {
  const match = url.match(TWEET_REGEX)
  return match ? match[2] : null
}

// Helper function to extract Twitter handle from URL
function extractTwitterHandle(url) {
  const match = url.match(/https?:\/\/(twitter\.com|x\.com)\/([\w]+)\/status/)
  return match ? match[2] : null
}

// Create tweet embed
function createTweetEmbed(tweet, submitterName) {
  const embed = new EmbedBuilder()
    .setColor(0x1DA1F2) // Twitter blue
    .setTitle('📊 New Tweet Submitted')
    .setURL(tweet.url)
    .setDescription(`**Author:** @${tweet.authorHandle}\n**Category:** ${tweet.category || 'General'}\n**Submitted by:** ${submitterName}`)
    .setTimestamp(new Date(tweet.submittedAt))
    .setFooter({ text: `Tweet ID: ${tweet.tweetId}` })
  
  if (tweet.content) {
    embed.addFields({ name: 'Content', value: tweet.content.substring(0, 1024) })
  }
  
  return embed
}

// Handle slash commands
client.on('ready', async () => {
  console.log(`✅ Engagement bot logged in as ${client.user.tag}`)
  
  // Register slash commands
  const commands = [
    {
      name: 'connect',
      description: 'Connect your Twitter account'
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
    }
  ]
  
  try {
    await client.application.commands.set(commands)
    console.log('✅ Slash commands registered')
  } catch (error) {
    console.error('Error registering commands:', error)
  }
})

// Handle interactions
client.on('interactionCreate', async (interaction) => {
  // Handle slash commands
  if (interaction.isCommand()) {
    const { commandName } = interaction
    
    if (commandName === 'connect') {
      // Show modal for Twitter handle input
      const modal = new ModalBuilder()
        .setCustomId('connect-twitter')
        .setTitle('Connect Twitter Account')
      
      const handleInput = new TextInputBuilder()
        .setCustomId('twitter-handle')
        .setLabel('Your Twitter Handle')
        .setPlaceholder('@yourusername')
        .setStyle(TextInputStyle.Short)
        .setRequired(true)
      
      const row = new ActionRowBuilder().addComponents(handleInput)
      modal.addComponents(row)
      
      await interaction.showModal(modal)
    }
    
    else if (commandName === 'submit') {
      await interaction.deferReply({ ephemeral: true })
      
      const url = interaction.options.getString('url')
      const category = interaction.options.getString('category')
      
      // Validate URL
      const tweetId = extractTweetId(url)
      if (!tweetId) {
        await interaction.editReply('❌ Invalid tweet URL. Please provide a valid Twitter/X URL.')
        return
      }
      
      // Check if user is connected
      const connection = await redis.json.get(`engagement:connection:${interaction.user.id}`)
      if (!connection) {
        await interaction.editReply('❌ Please connect your Twitter account first using `/connect`')
        return
      }
      
      // Check for duplicate
      const isDuplicate = await redis.exists(`engagement:tweetid:${tweetId}`)
      if (isDuplicate) {
        await interaction.editReply('❌ This tweet has already been submitted.')
        return
      }
      
      // Extract author handle
      const authorHandle = extractTwitterHandle(url)
      
      // Check if submitter is author or admin
      const member = interaction.guild.members.cache.get(interaction.user.id)
      const isAdmin = member.roles.cache.some(role => role.name === ADMIN_ROLE_NAME)
      
      if (!isAdmin && connection.twitterHandle !== authorHandle) {
        await interaction.editReply('❌ You can only submit your own tweets. Admins can submit any tweet.')
        return
      }
      
      // Categorize tweet if no category provided
      let finalCategory = category
      if (!finalCategory) {
        try {
          // Fetch tweet content (you'd need Twitter API for real implementation)
          // For now, we'll use a placeholder
          finalCategory = 'General'
        } catch (error) {
          console.error('Error categorizing tweet:', error)
        }
      }
      
      // Submit tweet
      const { nanoid } = await import('nanoid')
      const tweet = {
        id: nanoid(),
        tweetId,
        submitterDiscordId: interaction.user.id,
        submittedAt: new Date(),
        category: finalCategory,
        url,
        authorHandle
      }
      
      await redis.json.set(`engagement:tweet:${tweet.id}`, '$', tweet)
      await redis.zadd('engagement:tweets:recent', Date.now(), tweet.id)
      await redis.set(`engagement:tweetid:${tweet.tweetId}`, tweet.id)
      
      // Send to channel
      const channel = interaction.guild.channels.cache.find(ch => ch.name === BOT_CHANNEL_NAME)
      if (channel) {
        const embed = createTweetEmbed(tweet, interaction.user.username)
        await channel.send({ embeds: [embed] })
      }
      
      await interaction.editReply('✅ Tweet submitted successfully!')
    }
    
    else if (commandName === 'stats') {
      await interaction.deferReply({ ephemeral: true })
      
      const connection = await redis.json.get(`engagement:connection:${interaction.user.id}`)
      if (!connection) {
        await interaction.editReply('❌ Please connect your Twitter account first using `/connect`')
        return
      }
      
      // Get recent engagements
      const logIds = await redis.zrevrange(`engagement:user:${interaction.user.id}:logs`, 0, 9)
      const logs = []
      for (const id of logIds) {
        const log = await redis.json.get(`engagement:log:${id}`)
        if (log) logs.push(log)
      }
      
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('📊 Your Engagement Stats')
        .setDescription(`**Twitter:** @${connection.twitterHandle}\n**Tier:** Level ${connection.tier}\n**Total Points:** ${connection.totalPoints}`)
        .setTimestamp()
      
      if (logs.length > 0) {
        const recentActivity = logs.map(log => 
          `${log.interactionType === 'like' ? '❤️' : log.interactionType === 'retweet' ? '🔁' : '💬'} +${log.points} points`
        ).join('\n')
        embed.addFields({ name: 'Recent Activity', value: recentActivity })
      }
      
      await interaction.editReply({ embeds: [embed] })
    }
    
    else if (commandName === 'leaderboard') {
      await interaction.deferReply()
      
      // Get leaderboard data
      const keys = await redis.keys('engagement:connection:*')
      const entries = []
      
      for (const key of keys.slice(0, 50)) {
        const connection = await redis.json.get(key)
        if (connection) {
          entries.push({
            discordId: connection.discordId,
            twitterHandle: connection.twitterHandle,
            totalPoints: connection.totalPoints
          })
        }
      }
      
      // Sort by points
      entries.sort((a, b) => b.totalPoints - a.totalPoints)
      
      const embed = new EmbedBuilder()
        .setColor(0xFFD700) // Gold
        .setTitle('🏆 Engagement Leaderboard')
        .setDescription('Top 10 Engagers')
        .setTimestamp()
      
      const top10 = entries.slice(0, 10).map((entry, index) => 
        `**${index + 1}.** @${entry.twitterHandle} - ${entry.totalPoints} points`
      ).join('\n')
      
      embed.addFields({ name: 'Rankings', value: top10 || 'No data yet' })
      
      await interaction.editReply({ embeds: [embed] })
    }
    
    else if (commandName === 'tier') {
      // Admin only
      const member = interaction.guild.members.cache.get(interaction.user.id)
      const isAdmin = member.roles.cache.some(role => role.name === ADMIN_ROLE_NAME)
      
      if (!isAdmin) {
        await interaction.reply({ content: '❌ This command is admin only.', ephemeral: true })
        return
      }
      
      const user = interaction.options.getUser('user')
      const tier = interaction.options.getInteger('tier')
      
      if (tier < 1 || tier > 3) {
        await interaction.reply({ content: '❌ Tier must be between 1 and 3.', ephemeral: true })
        return
      }
      
      const connection = await redis.json.get(`engagement:connection:${user.id}`)
      if (!connection) {
        await interaction.reply({ content: '❌ User has not connected their Twitter account.', ephemeral: true })
        return
      }
      
      await redis.json.set(`engagement:connection:${user.id}`, '$.tier', tier)
      await interaction.reply({ content: `✅ Updated ${user.username}'s tier to Level ${tier}`, ephemeral: true })
    }
  }
  
  // Handle modal submissions
  else if (interaction.isModalSubmit()) {
    if (interaction.customId === 'connect-twitter') {
      const handle = interaction.fields.getTextInputValue('twitter-handle')
      const cleanHandle = handle.toLowerCase().replace('@', '').trim()
      
      // Check if handle is already connected
      const existingDiscordId = await redis.get(`engagement:twitter:${cleanHandle}`)
      if (existingDiscordId && existingDiscordId !== interaction.user.id) {
        await interaction.reply({ 
          content: '❌ This Twitter account is already connected to another Discord user.', 
          ephemeral: true 
        })
        return
      }
      
      // Create connection
      const connection = {
        discordId: interaction.user.id,
        twitterHandle: cleanHandle,
        tier: 1,
        connectedAt: new Date(),
        totalPoints: 0
      }
      
      await redis.json.set(`engagement:connection:${interaction.user.id}`, '$', connection)
      await redis.set(`engagement:twitter:${cleanHandle}`, interaction.user.id)
      
      await interaction.reply({ 
        content: `✅ Successfully connected Twitter account @${cleanHandle}!`, 
        ephemeral: true 
      })
    }
  }
})

// Error handling
client.on('error', console.error)

// Login
client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => console.log('🚀 Engagement bot starting...'))
  .catch(console.error) 