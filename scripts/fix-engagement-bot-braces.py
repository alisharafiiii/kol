#!/usr/bin/env python3
import re

# Read the file
with open('../discord-bots/engagement-bot.js', 'r') as f:
    content = f.read()

# Fix 1: Remove the extra closing brace before "// Handle modal submissions"
# Look for the pattern with the extra brace
pattern1 = r'(flags: 64 \n      \}\)\n    \}\n    )\}\n    \n    // Handle modal submissions'
replacement1 = r'\1\n    // Handle modal submissions'

content = re.sub(pattern1, replacement1, content)

# Fix 2: Add catch block after the modal handler ends
# Find the end of the modal handler (after the last })
# Look for the closing of the interactionCreate handler
pattern2 = r'(await interaction\.reply\(\{ \n        content: message, \n        flags: 64 \n      \}\)\n    \}\n  \}\n\}\))'
replacement2 = r'''\1
  } catch (error) {
    console.error('❌ Error handling interaction:', error)
    
    // Try to respond to the user
    try {
      if (interaction.deferred) {
        await interaction.editReply({ content: '❌ An error occurred processing your request. Please try again.' })
      } else if (!interaction.replied) {
        await interaction.reply({ content: '❌ An error occurred processing your request. Please try again.', flags: 64 })
      }
    } catch (replyError) {
      console.error('Could not send error message to user:', replyError)
    }
  }
})'''

content = re.sub(pattern2, replacement2, content)

# Fix 3: Remove duplicate "Enhanced error handling" comment if it exists
content = re.sub(r'// Enhanced error handling and connection monitoring\n\n// Enhanced error handling and connection monitoring', 
                 r'// Enhanced error handling and connection monitoring', content)

# Write the fixed content back
with open('../discord-bots/engagement-bot.js', 'w') as f:
    f.write(content)

print("✅ Fixed engagement bot syntax issues") 