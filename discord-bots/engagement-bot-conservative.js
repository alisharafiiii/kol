const { nanoid } = require('nanoid')

// Create a new user profile (pending approval)
async function createUserProfile(twitterHandle, discordId) {
  try {
    const normalizedHandle = twitterHandle.toLowerCase().replace('@', '')
    const userId = `user_${normalizedHandle}`
    
    const newUser = {
      id: userId,
      twitterHandle: `@${normalizedHandle}`,
      name: normalizedHandle, // Use handle as name initially
      approvalStatus: 'pending', // Set to pending, requiring admin approval
      role: 'user', // Default to user role
      tier: 'micro', // Default tier
      discordId: discordId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      socialAccounts: {
        twitter: {
          handle: normalizedHandle,
          connected: true
        }
      }
    }
    
    // Save to Redis
    await redis.json.set(userId, '$', newUser)
    
    // Create username index
    await redis.sadd(`idx:username:${normalizedHandle}`, userId)
    
    // Add to pending users set (not approved)
    await redis.sadd('users:pending', userId)
    
    console.log(`✅ Created new user profile (pending) for @${normalizedHandle}`)
    return newUser
  } catch (error) {
    console.error('Error creating user profile:', error)
    throw error
  }
}

// Modify the isUserApproved function to return exists flag:
async function isUserApproved(twitterHandle) {
  try {
    const normalizedHandle = twitterHandle.toLowerCase().replace('@', '')
    
    // Check if user exists via username index
    const userIds = await redis.smembers(`idx:username:${normalizedHandle}`)
    if (!userIds || userIds.length === 0) {
      return { approved: false, userData: null, exists: false }
    }
    
    // Get user data
    const userData = await redis.json.get(`user:${userIds[0]}`)
    if (!userData) {
      return { approved: false, userData: null, exists: false }
    }
    
    // Check approval status
    const isApproved = userData.approvalStatus === 'approved'
    return { approved: isApproved, userData, exists: true }
  } catch (error) {
    console.error('Error checking user approval:', error)
    return { approved: false, userData: null, exists: false }
  }
}

// In the modal submission handler for 'connect-twitter', replace the existing logic with:
if (interaction.customId === 'connect-twitter') {
  const handle = interaction.fields.getTextInputValue('twitter-handle')
  const cleanHandle = handle.toLowerCase().replace('@', '').trim()
  
  // Check if user exists
  const { approved, userData, exists } = await isUserApproved(cleanHandle)
  
  // If user doesn't exist, create a new profile (pending approval)
  if (!exists) {
    try {
      const newUser = await createUserProfile(cleanHandle, interaction.user.id)
      console.log(`✅ Created new profile (pending) for @${cleanHandle}`)
      
      await interaction.reply({ 
        content: `📝 Your Twitter account @${cleanHandle} has been registered!\n\n` +
                 `⏳ **Your account is pending approval.** An admin will review and approve your account soon.\n` +
                 `📢 You'll be notified once approved and can then use the engagement features.`, 
        flags: 64 
      })
      return
    } catch (error) {
      console.error('Error creating new user profile:', error)
      await interaction.reply({ 
        content: '❌ An error occurred while creating your profile. Please try again or contact an admin.', 
        flags: 64 
      })
      return
    }
  }
  
  // If user exists but is not approved
  if (!approved) {
    await interaction.reply({ 
      content: '❌ Your Twitter account is pending approval. Please wait for an admin to approve your account.', 
      flags: 64 
    })
    return
  }
  
  // Rest of the existing logic for approved users...
} 