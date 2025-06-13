const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle } = require('discord.js')
const { config } = require('dotenv')
const { Redis } = require('@upstash/redis')
const { GoogleGenerativeAI } = require('@google/generative-ai')
const path = require('path')

// Load environment variables from parent directory
const envPath = path.join(__dirname, '..', '.env.local')
console.log('🔍 Loading environment from:', envPath)
config({ path: envPath })

// Check required environment variables
const requiredVars = ['UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'DISCORD_BOT_TOKEN']
const optionalVars = ['GEMINI_API_KEY', 'GOOGLE_AI_API_KEY'] // Try both for compatibility
const missingVars = requiredVars.filter(v => !process.env[v])

// Check for Gemini/Google AI key
const hasAiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY

if (missingVars.length > 0) {
  console.error('❌ Missing required environment variables:', missingVars.join(', '))
  console.error('🔍 Please check your .env.local file contains:')
  missingVars.forEach(v => console.error(`   ${v}=your_value_here`))
  process.exit(1)
}

if (!hasAiKey) {
  console.warn('⚠️  No AI API key found (GEMINI_API_KEY or GOOGLE_AI_API_KEY)')
  console.warn('   Sentiment analysis will be disabled')
}

// Initialize Redis
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN
})

// Initialize Gemini for sentiment analysis (if available)
let genAI = null
let model = null

if (hasAiKey) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_AI_API_KEY
  genAI = new GoogleGenerativeAI(apiKey)
  model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
  console.log('✅ AI model initialized for sentiment analysis')
}

// Initialize Discord client
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers
  ]
})

// Tweet URL regex
const TWEET_REGEX = /https?:\/\/(twitter\.com|x\.com)\/[\w]+\/status\/(\d+)/i

// Bot configuration
const BOT_CHANNEL_NAME = 'engagement-tracker'
const ADMIN_ROLE_NAME = 'admin'
const KOL_ROLE_NAME = 'kol'

// Role hierarchy (higher number = higher priority)
const ROLE_HIERARCHY = {
  'admin': 4,
  'core': 3,
  'team': 2,
  'kol': 1,
  'user': 0
}

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

// Check if user is approved in the database
async function isUserApproved(twitterHandle) {
  try {
    const normalizedHandle = twitterHandle.toLowerCase().replace('@', '')
    
    // Check if user exists via username index
    const userIds = await redis.smembers(`idx:username:${normalizedHandle}`)
    if (!userIds || userIds.length === 0) {
      return { approved: false, userData: null }
    }
    
    // Get user data
    const userData = await redis.json.get(`user:${userIds[0]}`)
    if (!userData) {
      return { approved: false, userData: null }
    }
    
    // Check approval status
    const isApproved = userData.approvalStatus === 'approved'
    return { approved: isApproved, userData }
  } catch (error) {
    console.error('Error checking user approval:', error)
    return { approved: false, userData: null }
  }
}

// Get user's current role from database
async function getUserRole(twitterHandle) {
  try {
    const { approved, userData } = await isUserApproved(twitterHandle)
    if (!approved || !userData) return 'user'
    
    return userData.role || 'user'
  } catch (error) {
    console.error('Error getting user role:', error)
    return 'user'
  }
}

// Update user's role in database
async function updateUserRole(twitterHandle, newRole) {
  try {
    const normalizedHandle = twitterHandle.toLowerCase().replace('@', '')
    const userIds = await redis.smembers(`idx:username:${normalizedHandle}`)
    
    if (userIds && userIds.length > 0) {
      await redis.json.set(`user:${userIds[0]}`, '$.role', newRole)
      return true
    }
    return false
  } catch (error) {
    console.error('Error updating user role:', error)
    return false
  }
}

// Get tier-based scenarios
async function getTierScenarios(tier) {
  try {
    const scenarios = await redis.json.get(`engagement:scenarios:tier${tier}`)
    return scenarios || getDefaultScenarios(tier)
  } catch (error) {
    console.error('Error getting tier scenarios:', error)
    return getDefaultScenarios(tier)
  }
}

// Default scenarios by tier
function getDefaultScenarios(tier) {
  const scenarios = {
    1: {
      dailyTweetLimit: 3,
      categories: ['General', 'DeFi', 'NFT'],
      minFollowers: 100,
      bonusMultiplier: 1.0
    },
    2: {
      dailyTweetLimit: 5,
      categories: ['General', 'DeFi', 'NFT', 'Gaming', 'Tech'],
      minFollowers: 500,
      bonusMultiplier: 1.5
    },
    3: {
      dailyTweetLimit: 10,
      categories: ['General', 'DeFi', 'NFT', 'Gaming', 'Tech', 'Memes', 'News'],
      minFollowers: 1000,
      bonusMultiplier: 2.0
    }
  }
  
  return scenarios[tier] || scenarios[1]
}

// Create tweet embed
function createTweetEmbed(tweet, submitterName) {
  const embed = new EmbedBuilder()
    .setColor(0x1DA1F2) // Twitter blue
    .setTitle('🐦 New Tweet for Engagement!')
    .setURL(tweet.url)
    .setDescription(`**Click the title above to view and engage with this tweet!**`)
    .addFields(
      { name: '👤 Author', value: `[@${tweet.authorHandle}](https://twitter.com/${tweet.authorHandle})`, inline: true },
      { name: '🏷️ Category', value: tweet.category || 'General', inline: true },
      { name: '⭐ Tier', value: `Level ${tweet.tier}`, inline: true },
      { name: '📤 Submitted by', value: submitterName, inline: true },
      { name: '🎯 Bonus', value: `${tweet.bonusMultiplier}x points`, inline: true }
    )
    .setTimestamp(new Date(tweet.submittedAt))
    .setFooter({ text: `💡 Engage to earn points! • ID: ${tweet.tweetId}` })
  
  if (tweet.content) {
    embed.addFields({ name: '📝 Preview', value: tweet.content.substring(0, 280) + '...' })
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
      await interaction.deferReply({ flags: 64 }) // 64 is the flag for ephemeral
      
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
      
      // Check if user is still approved
      const { approved } = await isUserApproved(connection.twitterHandle)
      if (!approved) {
        await interaction.editReply('❌ Your Twitter account is no longer approved. Please contact an admin.')
        return
      }
      
      // Check tier scenarios
      const scenarios = await getTierScenarios(connection.tier)
      
      // Check daily limit
      const today = new Date().toISOString().split('T')[0]
      const dailySubmissions = await redis.get(`engagement:daily:${interaction.user.id}:${today}`) || 0
      
      if (dailySubmissions >= scenarios.dailyTweetLimit) {
        await interaction.editReply(`❌ You've reached your daily limit of ${scenarios.dailyTweetLimit} tweets for Tier ${connection.tier}.`)
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
      
      // Validate category
      let finalCategory = category
      if (category && !scenarios.categories.includes(category)) {
        await interaction.editReply(`❌ Invalid category. Available categories for Tier ${connection.tier}: ${scenarios.categories.join(', ')}`)
        return
      }
      
      if (!finalCategory) {
        finalCategory = 'General'
      }
      
      // Submit tweet
      try {
        const { nanoid } = await import('nanoid')
        const tweet = {
          id: nanoid(),
          tweetId,
          submitterDiscordId: interaction.user.id,
          submittedAt: new Date(),
          category: finalCategory,
          url,
          authorHandle,
          tier: connection.tier,
          bonusMultiplier: scenarios.bonusMultiplier
        }
        
        await redis.json.set(`engagement:tweet:${tweet.id}`, '$', tweet)
        // Use a different approach for recent tweets - store as a list
        await redis.lpush('engagement:tweets:recent', tweet.id)
        await redis.ltrim('engagement:tweets:recent', 0, 99) // Keep only 100 most recent
        await redis.set(`engagement:tweetid:${tweet.tweetId}`, tweet.id)
        
        // Increment daily counter
        await redis.incr(`engagement:daily:${interaction.user.id}:${today}`)
        await redis.expire(`engagement:daily:${interaction.user.id}:${today}`, 86400) // 24 hours
        
        // Send to channel
        const channel = interaction.guild.channels.cache.find(ch => ch.name === BOT_CHANNEL_NAME)
        if (channel) {
          try {
            const embed = createTweetEmbed(tweet, interaction.user.username)
            await channel.send({ embeds: [embed] })
          } catch (channelError) {
            console.error('Error posting to channel:', channelError)
            console.log('Make sure the bot has permission to send messages in #engagement-tracker')
          }
        } else {
          console.log(`Channel "${BOT_CHANNEL_NAME}" not found. Please create it for tweet announcements.`)
        }
        
        await interaction.editReply(`✅ Tweet submitted successfully! (${parseInt(dailySubmissions) + 1}/${scenarios.dailyTweetLimit} today)`)
      } catch (error) {
        console.error('Error submitting tweet:', error)
        await interaction.editReply('❌ An error occurred while submitting the tweet. Please try again.')
      }
    }
    
    else if (commandName === 'stats') {
      await interaction.deferReply({ flags: 64 }) // 64 is the flag for ephemeral
      
      const connection = await redis.json.get(`engagement:connection:${interaction.user.id}`)
      if (!connection) {
        await interaction.editReply('❌ Please connect your Twitter account first using `/connect`')
        return
      }
      
      // Get tier scenarios
      const scenarios = await getTierScenarios(connection.tier)
      
      // Get today's submissions
      const today = new Date().toISOString().split('T')[0]
      const dailySubmissions = await redis.get(`engagement:daily:${interaction.user.id}:${today}`) || 0
      
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
        .setDescription(`**Twitter:** @${connection.twitterHandle}\n**Tier:** Level ${connection.tier}\n**Total Points:** ${connection.totalPoints || 0}`)
        .addFields(
          { name: 'Daily Limit', value: `${dailySubmissions}/${scenarios.dailyTweetLimit}`, inline: true },
          { name: 'Bonus Multiplier', value: `${scenarios.bonusMultiplier}x`, inline: true },
          { name: 'Categories', value: scenarios.categories.join(', '), inline: false }
        )
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
            totalPoints: connection.totalPoints || 0,
            tier: connection.tier
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
        `**${index + 1}.** @${entry.twitterHandle} (T${entry.tier}) - ${entry.totalPoints} points`
      ).join('\n')
      
      embed.addFields({ name: 'Rankings', value: top10 || 'No data yet' })
      
      await interaction.editReply({ embeds: [embed] })
    }
    
    else if (commandName === 'tweets') {
      await interaction.deferReply()
      
      // Get recent tweets
      const tweetIds = await redis.lrange('engagement:tweets:recent', 0, 9) // Get last 10
      const tweets = []
      
      for (const id of tweetIds) {
        const tweet = await redis.json.get(`engagement:tweet:${id}`)
        if (tweet) tweets.push(tweet)
      }
      
      const embed = new EmbedBuilder()
        .setColor(0x1DA1F2) // Twitter blue
        .setTitle('🐦 Recent Tweets for Engagement')
        .setDescription('Click on any tweet to engage and earn points!')
        .setTimestamp()
      
      if (tweets.length === 0) {
        embed.addFields({ name: 'No tweets yet', value: 'Be the first to submit a tweet with `/submit`!' })
      } else {
        tweets.forEach((tweet, index) => {
          const submittedTime = new Date(tweet.submittedAt).toLocaleTimeString()
          embed.addFields({
            name: `${index + 1}. @${tweet.authorHandle} - ${tweet.category}`,
            value: `[View Tweet](${tweet.url})\n📅 ${submittedTime} • Tier ${tweet.tier}`
          })
        })
      }
      
      await interaction.editReply({ embeds: [embed] })
    }
    
    else if (commandName === 'tier') {
      // Admin only
      const member = interaction.guild.members.cache.get(interaction.user.id)
      const isAdmin = member.roles.cache.some(role => role.name === ADMIN_ROLE_NAME)
      
      if (!isAdmin) {
        await interaction.reply({ content: '❌ This command is admin only.', flags: 64 })
        return
      }
      
      const user = interaction.options.getUser('user')
      const tier = interaction.options.getInteger('tier')
      
      if (tier < 1 || tier > 3) {
        await interaction.reply({ content: '❌ Tier must be between 1 and 3.', flags: 64 })
        return
      }
      
      const connection = await redis.json.get(`engagement:connection:${user.id}`)
      if (!connection) {
        await interaction.reply({ content: '❌ User has not connected their Twitter account.', flags: 64 })
        return
      }
      
      await redis.json.set(`engagement:connection:${user.id}`, '$.tier', tier)
      await interaction.reply({ content: `✅ Updated ${user.username}'s tier to Level ${tier}`, flags: 64 })
    }
    
    else if (commandName === 'scenarios') {
      // Admin only
      const member = interaction.guild.members.cache.get(interaction.user.id)
      const isAdmin = member.roles.cache.some(role => role.name === ADMIN_ROLE_NAME)
      
      if (!isAdmin) {
        await interaction.reply({ content: '❌ This command is admin only.', flags: 64 })
        return
      }
      
      const tier = interaction.options.getInteger('tier')
      const dailyLimit = interaction.options.getInteger('daily_limit')
      const minFollowers = interaction.options.getInteger('min_followers')
      const bonusMultiplier = interaction.options.getNumber('bonus_multiplier')
      
      if (tier < 1 || tier > 3) {
        await interaction.reply({ content: '❌ Tier must be between 1 and 3.', flags: 64 })
        return
      }
      
      // Get current scenarios
      const currentScenarios = await getTierScenarios(tier)
      
      // Update with new values
      if (dailyLimit !== null) currentScenarios.dailyTweetLimit = dailyLimit
      if (minFollowers !== null) currentScenarios.minFollowers = minFollowers
      if (bonusMultiplier !== null) currentScenarios.bonusMultiplier = bonusMultiplier
      
      // Save scenarios
      await redis.json.set(`engagement:scenarios:tier${tier}`, '$', currentScenarios)
      
      await interaction.reply({ 
        content: `✅ Updated Tier ${tier} scenarios:\n` +
                 `Daily Limit: ${currentScenarios.dailyTweetLimit}\n` +
                 `Min Followers: ${currentScenarios.minFollowers}\n` +
                 `Bonus Multiplier: ${currentScenarios.bonusMultiplier}x`,
        flags: 64 
      })
    }
  }
  
  // Handle modal submissions
  else if (interaction.isModalSubmit()) {
    if (interaction.customId === 'connect-twitter') {
      const handle = interaction.fields.getTextInputValue('twitter-handle')
      const cleanHandle = handle.toLowerCase().replace('@', '').trim()
      
      // Check if user is approved
      const { approved, userData } = await isUserApproved(cleanHandle)
      if (!approved) {
        await interaction.reply({ 
          content: '❌ Your Twitter account is not approved. Please apply through the website first.', 
          flags: 64 
        })
        return
      }
      
      // Check if handle is already connected
      const existingDiscordId = await redis.get(`engagement:twitter:${cleanHandle}`)
      if (existingDiscordId && existingDiscordId !== interaction.user.id) {
        await interaction.reply({ 
          content: '❌ This Twitter account is already connected to another Discord user.', 
          flags: 64 
        })
        return
      }
      
      // Get current role from database
      const currentRole = userData.role || 'user'
      
      // Assign KOL role if user doesn't have a higher role
      let finalRole = currentRole
      if (ROLE_HIERARCHY[currentRole] < ROLE_HIERARCHY['kol']) {
        finalRole = 'kol'
        await updateUserRole(cleanHandle, 'kol')
        
        // Also assign Discord role if available
        try {
          const member = await interaction.guild.members.fetch(interaction.user.id)
          const kolRole = interaction.guild.roles.cache.find(role => role.name.toLowerCase() === KOL_ROLE_NAME)
          if (kolRole && !member.roles.cache.has(kolRole.id)) {
            await member.roles.add(kolRole)
          }
        } catch (error) {
          console.error('Error assigning Discord role:', error)
        }
      }
      
      // Create connection
      const connection = {
        discordId: interaction.user.id,
        twitterHandle: cleanHandle,
        tier: 1,
        connectedAt: new Date(),
        totalPoints: 0,
        role: finalRole
      }
      
      await redis.json.set(`engagement:connection:${interaction.user.id}`, '$', connection)
      await redis.set(`engagement:twitter:${cleanHandle}`, interaction.user.id)
      
      let message = `✅ Successfully connected Twitter account @${cleanHandle}!`
      if (finalRole === 'kol' && currentRole !== 'kol') {
        message += '\n🎉 You\'ve been assigned the KOL role!'
      }
      
      await interaction.reply({ 
        content: message, 
        flags: 64 
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