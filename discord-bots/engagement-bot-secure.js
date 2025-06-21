// Secure version of engagement bot that verifies Twitter ownership
// This is a patch to add to the existing engagement bot

// In the connect command handler, replace the modal approach with this:
if (commandName === 'connect') {
  await interaction.deferReply({ flags: 64 })
  
  try {
    // Get user's Discord connections
    const userId = interaction.user.id
    
    // Note: Discord bots cannot access user connections directly for privacy reasons
    // We need to use a different approach
    
    // Option 1: Generate a unique verification code
    const verificationCode = `KOL-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`
    const verificationKey = `discord:verify:${userId}`
    
    // Store verification request
    await redis.set(verificationKey, JSON.stringify({
      discordId: userId,
      discordUsername: interaction.user.username,
      code: verificationCode,
      timestamp: Date.now()
    }), { ex: 600 }) // Expires in 10 minutes
    
    // Create verification URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const verificationUrl = `${baseUrl}/auth/discord-verify?code=${verificationCode}&discord=${userId}`
    
    await interaction.editReply({
      content: `🔐 **Secure Twitter Connection**\n\n` +
               `To securely connect your Twitter account, please:\n\n` +
               `1. Click this link: ${verificationUrl}\n` +
               `2. Sign in with your Twitter account\n` +
               `3. Your accounts will be automatically linked\n\n` +
               `⏱️ This link expires in 10 minutes.\n` +
               `🔒 This ensures only you can connect your Twitter account.`,
      flags: 64
    })
  } catch (error) {
    console.error('Error in connect command:', error)
    await interaction.editReply('❌ An error occurred. Please try again.')
  }
}

// Alternative approach using a verification tweet
if (commandName === 'connect-tweet') {
  // Show modal for Twitter handle input
  const modal = new ModalBuilder()
    .setCustomId('connect-twitter-verify')
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

// Modal handler for tweet verification
if (interaction.customId === 'connect-twitter-verify') {
  const handle = interaction.fields.getTextInputValue('twitter-handle')
  const cleanHandle = handle.toLowerCase().replace('@', '').trim()
  
  // Generate unique verification code
  const verifyCode = `KOL-VERIFY-${interaction.user.id}-${Date.now().toString(36)}`
  
  // Store pending verification
  await redis.set(`verify:discord:${interaction.user.id}`, JSON.stringify({
    twitterHandle: cleanHandle,
    verifyCode: verifyCode,
    timestamp: Date.now()
  }), { ex: 3600 }) // 1 hour expiry
  
  await interaction.reply({
    content: `📝 **Verification Required**\n\n` +
             `To prove you own @${cleanHandle}, please:\n\n` +
             `1. Tweet this exact code from your account:\n` +
             `\`\`\`${verifyCode}\`\`\`\n\n` +
             `2. Use the command \`/verify-tweet [tweet-url]\` with the link to your tweet\n\n` +
             `⏱️ You have 1 hour to complete verification.\n` +
             `🔐 The tweet can be deleted after verification.`,
    flags: 64
  })
}

// Add verify-tweet command
{
  name: 'verify-tweet',
  description: 'Verify your Twitter account with a tweet',
  options: [{
    name: 'url',
    type: 3, // STRING
    description: 'URL of your verification tweet',
    required: true
  }]
}

// Handler for verify-tweet
if (commandName === 'verify-tweet') {
  await interaction.deferReply({ flags: 64 })
  
  const tweetUrl = interaction.options.getString('url')
  const tweetIdMatch = tweetUrl.match(/status\/(\d+)/)
  
  if (!tweetIdMatch) {
    await interaction.editReply('❌ Invalid tweet URL')
    return
  }
  
  const tweetId = tweetIdMatch[1]
  
  // Get pending verification
  const verifyData = await redis.get(`verify:discord:${interaction.user.id}`)
  if (!verifyData) {
    await interaction.editReply('❌ No pending verification found. Use `/connect` first.')
    return
  }
  
  const { twitterHandle, verifyCode } = JSON.parse(verifyData)
  
  // Fetch tweet content (requires Twitter API v2)
  if (process.env.TWITTER_BEARER_TOKEN) {
    try {
      const response = await fetch(`https://api.twitter.com/2/tweets/${tweetId}?tweet.fields=author_id,text`, {
        headers: {
          'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
        }
      })
      
      if (!response.ok) {
        await interaction.editReply('❌ Could not fetch tweet. Please make sure it\'s public.')
        return
      }
      
      const tweetData = await response.json()
      const tweetText = tweetData.data?.text || ''
      
      // Verify the code is in the tweet
      if (!tweetText.includes(verifyCode)) {
        await interaction.editReply('❌ Verification code not found in tweet.')
        return
      }
      
      // Get tweet author to verify handle
      const authorId = tweetData.data?.author_id
      const userResponse = await fetch(`https://api.twitter.com/2/users/${authorId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.TWITTER_BEARER_TOKEN}`
        }
      })
      
      if (userResponse.ok) {
        const userData = await userResponse.json()
        const tweetAuthor = userData.data?.username?.toLowerCase()
        
        if (tweetAuthor !== twitterHandle) {
          await interaction.editReply('❌ Tweet is from a different account than the one you\'re trying to verify.')
          return
        }
      }
      
      // Verification successful - now create or connect the profile
      // ... (rest of the connection logic)
      
      // Clean up
      await redis.del(`verify:discord:${interaction.user.id}`)
      
      await interaction.editReply('✅ Twitter account verified and connected successfully!')
      
    } catch (error) {
      console.error('Error verifying tweet:', error)
      await interaction.editReply('❌ Error verifying tweet. Please try again.')
    }
  } else {
    // Fallback if no Twitter API access
    await interaction.editReply(
      '⚠️ Automatic verification unavailable. Please contact an admin with:\n' +
      `- Your tweet URL: ${tweetUrl}\n` +
      `- Your verification code: ${verifyCode}`
    )
  }
} 