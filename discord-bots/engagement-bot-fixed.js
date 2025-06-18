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
    const safeTier = tier || 'micro' // Default to micro if tier is null/undefined
    const scenarios = await redis.json.get(`engagement:scenarios:${safeTier}`)
    return scenarios || getDefaultScenarios(safeTier)
  } catch (error) {
    console.error('Error getting tier scenarios:', error)
    return getDefaultScenarios(tier || 'micro')
  }
}

// Default scenarios by tier
function getDefaultScenarios(tier) {
  const scenarios = {
    'micro': {
      dailyTweetLimit: 5,
      categories: ['General', 'DeFi', 'NFT'],
      minFollowers: 100,
      bonusMultiplier: 1.0
    },
    'rising': {
      dailyTweetLimit: 10,
      categories: ['General', 'DeFi', 'NFT', 'Gaming', 'Tech'],
      minFollowers: 500,
      bonusMultiplier: 1.5
    },
    'star': {
      dailyTweetLimit: 20,
      categories: ['General', 'DeFi', 'NFT', 'Gaming', 'Tech', 'Memes', 'News'],
      minFollowers: 1000,
      bonusMultiplier: 2.0
    },
    'legend': {
      dailyTweetLimit: 30,
      categories: ['General', 'DeFi', 'NFT', 'Gaming', 'Tech', 'Memes', 'News', 'Special'],
      minFollowers: 5000,
      bonusMultiplier: 2.5
    },
    'hero': {
      dailyTweetLimit: 50,
      categories: ['General', 'DeFi', 'NFT', 'Gaming', 'Tech', 'Memes', 'News', 'Special', 'VIP'],
      minFollowers: 10000,
      bonusMultiplier: 3.0
    }
  }
  
  return scenarios[tier] || scenarios['micro']
}

// Create minimal tweet embed with preview
function createTweetEmbed(tweet, submitterName, includeButtons = true) {
  // Choose color based on tier
  const tierColors = {
    'micro': 0x6B7280,  // Gray
    'rising': 0x3BA55D, // Green
    'star': 0x5865F2,   // Blue
    'legend': 0xEA580C, // Orange
    'hero': 0x9333EA    // Purple
  }
  
  // Calculate potential points
  const likePoints = Math.floor(10 * tweet.bonusMultiplier)
  const retweetPoints = Math.floor(20 * tweet.bonusMultiplier)
  const replyPoints = Math.floor(30 * tweet.bonusMultiplier)
  
  const embed = new EmbedBuilder()
    .setColor(tierColors[tweet.tier] || 0x1DA1F2)
    .setAuthor({ 
      name: `@${tweet.authorHandle}`, 
      url: `https://twitter.com/${tweet.authorHandle}`,
      iconURL: 'https://abs.twimg.com/icons/apple-touch-icon-192x192.png'
    })
    .setDescription(
      `${tweet.content ? `"${tweet.content}"\n\n` : ''}` +
      `**💰 Earn ${tweet.bonusMultiplier}x points:**\n` +
      `❤️ Like: ${likePoints} pts | 🔁 RT: ${retweetPoints} pts | 💬 Reply: ${replyPoints} pts`
    )
    .addFields(
      { name: 'Tier', value: `⭐ ${tweet.tier}`, inline: true },
      { name: 'Category', value: `${tweet.category}`, inline: true },
      { name: 'Submitted', value: `<t:${Math.floor(new Date(tweet.submittedAt).getTime() / 1000)}:R>`, inline: true }
    )
    .setFooter({ text: `Submitted by ${submitterName}` })
  
  if (includeButtons) {
    // Create clickable button for the tweet
    const row = new ActionRowBuilder()
      .addComponents(
        new ButtonBuilder()
          .setLabel('View & Engage')
          .setStyle(ButtonStyle.Link)
          .setURL(tweet.url)
          .setEmoji('🐦')
      )
    
    return { embeds: [embed], components: [row] }
  }
  
  return { embeds: [embed] }
}

// Handle slash commands
client.on('ready', async () => {
  console.log(`✅ Engagement bot logged in as ${client.user.tag}`)
  
  // Start checking for channel info requests
  setInterval(async () => {
    try {
      // Look for any channel info requests
      const keys = await redis.keys('discord:channel-info-request:*')
      
      for (const key of keys) {
        const request = await redis.get(key)
        if (!request) continue
        
        let channelId, serverId
        try {
          const parsed = JSON.parse(request)
          channelId = parsed.channelId
          serverId = parsed.serverId
        } catch (parseError) {
          console.error(`Error parsing channel info request from ${key}:`, parseError)
          console.error('Raw request data:', request)
          await redis.del(key)
          continue
        }
        
        // Try to fetch the channel
        try {
          console.log(`[CHANNEL-FETCH] Looking for guild ${serverId}`);
          console.log(`[CHANNEL-FETCH] Available guilds: `, client.guilds.cache.map(g => ({ id: g.id, name: g.name })));
          
          const guild = client.guilds.cache.get(serverId)
          if (!guild) {
            console.log(`[CHANNEL-FETCH] Guild ${serverId} not found in cache`)
            console.log(`[CHANNEL-FETCH] Bot is in ${client.guilds.cache.size} guilds`)
            await redis.del(key)
            continue
          }
          
          console.log(`[CHANNEL-FETCH] Found guild: ${guild.name}`);
          const channel = guild.channels.cache.get(channelId)
          if (channel) {
            // Store the response
            const responseKey = `discord:channel-info-response:${channelId}`
            const responseData = {
              id: channelId,
              name: channel.name,
              type: channel.type === 0 ? 'text' : 'voice'
            };
            
            console.log(`[CHANNEL-FETCH] Found channel: #${channel.name} (${channelId})`);
            await redis.set(responseKey, JSON.stringify(responseData), {
              ex: 60 // expire in 60 seconds
            })
            console.log(`✅ Saved channel info response for #${channel.name}`)
          } else {
            console.log(`[CHANNEL-FETCH] Channel ${channelId} not found in guild ${serverId}`)
            console.log(`[CHANNEL-FETCH] Available channels in guild: `, guild.channels.cache.map(c => ({ id: c.id, name: c.name, type: c.type })).slice(0, 10))
          }
        } catch (error) {
          console.error(`[CHANNEL-FETCH] Error fetching channel ${channelId}:`, error)
        }
        
        // Delete the request
        await redis.del(key)
      }
    } catch (error) {
      console.error('Error processing channel info requests:', error)
    }
  }, 2000) // Check every 2 seconds
  
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
      name: 'recent',
      description: 'View recently submitted tweets'
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
        type: 3, // STRING
        description: 'Tier level (micro/rising/star/legend/hero)',
        required: true,
        choices: [
          { name: 'Micro', value: 'micro' },
          { name: 'Rising', value: 'rising' },
          { name: 'Star', value: 'star' },
          { name: 'Legend', value: 'legend' },
          { name: 'Hero', value: 'hero' }
        ]
      }]
    },
    {
      name: 'scenarios',
      description: 'Admin: Configure tier scenarios',
      options: [{
        name: 'tier',
        type: 3, // STRING
        description: 'Tier level (micro/rising/star/legend/hero)',
        required: true,
        choices: [
          { name: 'Micro', value: 'micro' },
          { name: 'Rising', value: 'rising' },
          { name: 'Star', value: 'star' },
          { name: 'Legend', value: 'legend' },
          { name: 'Hero', value: 'hero' }
        ]
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
        // Try to fetch tweet content from Twitter API
        let tweetContent = null
        try {
          const response = await fetch(`https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=text`, {
            headers: {
              'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
            }
          })
          
          if (response.ok) {
            const tweetData = await response.json()
            tweetContent = tweetData.data?.text || null
            console.log('📝 Fetched tweet content:', tweetContent ? 'Success' : 'No content')
          }
        } catch (error) {
          console.log('⚠️ Could not fetch tweet content:', error.message)
        }

        const tweet = {
          id: nanoid(),
          tweetId,
          submitterDiscordId: interaction.user.id,
          submittedAt: new Date(),
          category: finalCategory,
          url,
          authorHandle,
          content: tweetContent,
          tier: connection.tier,
          bonusMultiplier: scenarios.bonusMultiplier
        }
        
        await redis.json.set(`engagement:tweet:${tweet.id}`, '$', tweet)
        // Store in sorted set for admin panel compatibility
        await redis.zadd('engagement:tweets:recent', { score: Date.now(), member: tweet.id })
        await redis.set(`engagement:tweetid:${tweet.tweetId}`, tweet.id)
        
        // Increment daily counter
        await redis.incr(`engagement:daily:${interaction.user.id}:${today}`)
        await redis.expire(`engagement:daily:${interaction.user.id}:${today}`, 86400) // 24 hours
        
        // Send to channel
        const channel = interaction.guild.channels.cache.find(ch => ch.name === BOT_CHANNEL_NAME)
        if (channel) {
          // Debug: Check bot permissions in channel
          const botMember = interaction.guild.members.cache.get(client.user.id)
          const perms = channel.permissionsFor(botMember)
          console.log(`Bot permissions in #${BOT_CHANNEL_NAME}:`, {
            viewChannel: perms.has('ViewChannel'),
            sendMessages: perms.has('SendMessages'),
            embedLinks: perms.has('EmbedLinks'),
            readMessageHistory: perms.has('ReadMessageHistory'),
            useExternalEmojis: perms.has('UseExternalEmojis')
          })
          try {
            const messageContent = createTweetEmbed(tweet, interaction.user.username)
            await channel.send(messageContent)
            console.log(`✅ Posted tweet preview to #${BOT_CHANNEL_NAME}`)
          } catch (channelError) {
            console.error('Error posting to channel:', channelError)
            console.log('Make sure the bot has permission to send messages in #engagement-tracker')
            console.log('Required permissions: View Channel, Send Messages, Embed Links')
            
            // Try sending without buttons as fallback
            try {
              console.log('Attempting to send without buttons...')
              const simpleEmbed = createTweetEmbed(tweet, interaction.user.username, false)
              await channel.send(simpleEmbed)
              console.log('✅ Sent simplified preview without buttons')
            } catch (fallbackError) {
              console.error('Even simple embed failed:', fallbackError)
              console.log('Bot may lack basic permissions in the channel')
              
              // Last resort - send plain text
              try {
                const plainMessage = `**@${tweet.authorHandle}**\n` +
                  `${tweet.content ? `"${tweet.content}"\n\n` : ''}` +
                  `💰 Earn ${tweet.bonusMultiplier}x points | ⭐ Tier ${tweet.tier} | ${tweet.category}\n` +
                  `🔗 ${tweet.url}`
                await channel.send(plainMessage)
                console.log('✅ Sent plain text preview')
              } catch (textError) {
                console.error('Cannot send any message to channel:', textError)
              }
            }
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
      
      // Get recent engagements (skip for now since we don't have logs yet)
      const logs = []
      
      const embed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('📊 Your Engagement Stats')
        .setDescription(`**Twitter:** @${connection.twitterHandle}\n**Tier:** ${connection.tier ? connection.tier.toUpperCase() : 'MICRO'}\n**Total Points:** ${connection.totalPoints || 0}`)
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
      
      const top10 = entries.slice(0, 10).map((entry, index) => {
        const tierEmoji = {
          'micro': '⚪',
          'rising': '🟢',
          'star': '⭐',
          'legend': '🟠',
          'hero': '👑'
        }[entry.tier] || '⚪'
        return `**${index + 1}.** @${entry.twitterHandle} ${tierEmoji} ${entry.tier ? entry.tier.toUpperCase() : 'MICRO'} - ${entry.totalPoints} points`
      }).join('\n')
      
      embed.addFields({ name: 'Rankings', value: top10 || 'No data yet' })
      
      await interaction.editReply({ embeds: [embed] })
    }
    
    else if (commandName === 'recent') {
      await interaction.deferReply()
      
      try {
        // Get recent tweets from sorted set
        const tweetIds = await redis.zrange('engagement:tweets:recent', 0, 9, { rev: true }) // Get last 10
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
          let tweetList = ''
          tweets.forEach((tweet, index) => {
            tweetList += `**${index + 1}. @${tweet.authorHandle}**\n`
            if (tweet.content) {
              tweetList += `"${tweet.content.substring(0, 100)}${tweet.content.length > 100 ? '...' : ''}"\n`
            }
            tweetList += `💰 ${tweet.bonusMultiplier}x points | ⭐ Tier ${tweet.tier} | [View Tweet](${tweet.url})\n\n`
          })
          embed.addFields({ name: 'Recent Tweets', value: tweetList || 'No tweets yet' })
        }
        
        await interaction.editReply({ embeds: [embed] })
      } catch (error) {
        console.error('Error in /recent command:', error)
        await interaction.editReply('❌ An error occurred while fetching recent tweets.')
      }
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
      const tier = interaction.options.getString('tier')
      
      const validTiers = ['micro', 'rising', 'star', 'legend', 'hero']
      if (!validTiers.includes(tier)) {
        await interaction.reply({ content: '❌ Invalid tier. Must be one of: micro, rising, star, legend, hero', flags: 64 })
        return
      }
      
      const connection = await redis.json.get(`engagement:connection:${user.id}`)
      if (!connection) {
        await interaction.reply({ content: '❌ User has not connected their Twitter account.', flags: 64 })
        return
      }
      
      await redis.json.set(`engagement:connection:${user.id}`, '$.tier', tier)
      await interaction.reply({ content: `✅ Updated ${user.username}'s tier to ${tier.toUpperCase()}`, flags: 64 })
    }
    
    else if (commandName === 'scenarios') {
      // Admin only
      const member = interaction.guild.members.cache.get(interaction.user.id)
      const isAdmin = member.roles.cache.some(role => role.name === ADMIN_ROLE_NAME)
      
      if (!isAdmin) {
        await interaction.reply({ content: '❌ This command is admin only.', flags: 64 })
        return
      }
      
      const tier = interaction.options.getString('tier')
      const dailyLimit = interaction.options.getInteger('daily_limit')
      const minFollowers = interaction.options.getInteger('min_followers')
      const bonusMultiplier = interaction.options.getNumber('bonus_multiplier')
      
      const validTiers = ['micro', 'rising', 'star', 'legend', 'hero']
      if (!validTiers.includes(tier)) {
        await interaction.reply({ content: '❌ Invalid tier. Must be one of: micro, rising, star, legend, hero', flags: 64 })
        return
      }
      
      // Get current scenarios
      const currentScenarios = await getTierScenarios(tier)
      
      // Update with new values
      if (dailyLimit !== null) currentScenarios.dailyTweetLimit = dailyLimit
      if (minFollowers !== null) currentScenarios.minFollowers = minFollowers
      if (bonusMultiplier !== null) currentScenarios.bonusMultiplier = bonusMultiplier
      
      // Save scenarios
      await redis.json.set(`engagement:scenarios:${tier}`, '$', currentScenarios)
      
      await interaction.reply({ 
        content: `✅ Updated ${tier.toUpperCase()} tier scenarios:\n` +
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
          
          if (kolRole) {
            // Check if bot has permission to manage roles
            const botMember = interaction.guild.members.cache.get(client.user.id)
            if (!botMember.permissions.has('ManageRoles')) {
              console.warn('⚠️  Bot lacks "Manage Roles" permission - cannot assign KOL role')
              console.log('   Please grant the bot "Manage Roles" permission in Discord')
            } 
            // Check if bot's highest role is above the KOL role
            else if (botMember.roles.highest.position <= kolRole.position) {
              console.warn('⚠️  Bot\'s role is not high enough to assign the KOL role')
              console.log('   Please move the bot\'s role above the KOL role in Discord settings')
            }
            // Try to assign the role
            else if (!member.roles.cache.has(kolRole.id)) {
              await member.roles.add(kolRole)
              console.log(`✅ Assigned KOL role to ${member.user.tag}`)
            }
          } else {
            console.warn(`⚠️  No role found with name "${KOL_ROLE_NAME}" (case-insensitive)`)
            console.log('   Please create a role named "kol" in your Discord server')
          }
        } catch (error) {
          console.error('❌ Error assigning Discord role:', error.message)
          if (error.code === 50013) {
            console.log('   This is a permissions issue. Please check:')
            console.log('   1. Bot has "Manage Roles" permission')
            console.log('   2. Bot\'s role is above the KOL role in the hierarchy')
          }
        }
      }
      
      // Create connection - get tier from user profile
      const userTier = userData.tier || 'micro'  // Default to micro if no tier
      const connection = {
        discordId: interaction.user.id,
        twitterHandle: cleanHandle,
        tier: userTier,
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

// Handle regular messages (for ping/pong)
client.on('messageCreate', async (message) => {
  // Ignore messages from bots
  if (message.author.bot) return
  
  // Simple ping/pong response
  if (message.content.toLowerCase() === 'ping' || message.content.toLowerCase() === '!ping') {
    try {
      await message.reply('pong! 🏓')
      console.log(`Replied to ping from ${message.author.tag}`)
    } catch (error) {
      console.error('Error replying to ping:', error)
    }
  }
})

// Login
client.login(process.env.DISCORD_BOT_TOKEN)
  .then(() => console.log('🚀 Engagement bot starting...'))
  .catch(console.error) 