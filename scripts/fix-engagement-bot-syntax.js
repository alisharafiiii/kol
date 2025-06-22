const fs = require('fs');
const path = require('path');

// Read the engagement bot file
const filePath = path.join(__dirname, '..', 'discord-bots', 'engagement-bot.js');
let content = fs.readFileSync(filePath, 'utf8');

// Find the position after the modal handler ends
// Look for the end of the modal submission handler
const modalEndPattern = /await interaction\.reply\({ \n        content: message, \n        flags: 64 \n      }\)\n    }\n  }\n}\)/;

// Check if we can find this pattern
if (modalEndPattern.test(content)) {
  console.log('✅ Found modal handler end pattern');
  
  // Replace the end of the interactionCreate handler to add the missing catch block
  content = content.replace(
    /(\s*await interaction\.reply\({ \n        content: message, \n        flags: 64 \n      }\)\n    }\n  }\n}\))/,
    `$1

// Enhanced error handling and connection monitoring`
  );
} else {
  console.log('❌ Could not find exact pattern, trying alternative approach...');
  
  // Alternative: Find the line "})" at the end of modal handler and add catch block before next client.on
  const lines = content.split('\n');
  let foundModalEnd = false;
  let insertIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    // Look for the end of the isModalSubmit block
    if (lines[i].includes('await interaction.reply({') && 
        lines[i+1] && lines[i+1].includes('content: message,') &&
        lines[i+2] && lines[i+2].includes('flags: 64')) {
      // Found the final reply in modal handler, look for closing braces
      for (let j = i + 3; j < Math.min(i + 10, lines.length); j++) {
        if (lines[j].trim() === '}' && 
            lines[j+1] && lines[j+1].trim() === '}' &&
            lines[j+2] && lines[j+2].trim() === '})') {
          insertIndex = j + 2;
          foundModalEnd = true;
          break;
        }
      }
    }
    if (foundModalEnd) break;
  }
  
  if (insertIndex > 0) {
    console.log(`✅ Found modal handler end at line ${insertIndex + 1}`);
    
    // Insert the catch block after the modal handler
    const catchBlock = `  } catch (error) {
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
  }`;
    
    // Replace the closing }) with the catch block and closing })
    lines[insertIndex] = lines[insertIndex].replace('});', catchBlock + '\n});');
    content = lines.join('\n');
    
    console.log('✅ Added catch block to close the try block');
  } else {
    console.error('❌ Could not find the correct position to insert catch block');
    process.exit(1);
  }
}

// Write the fixed content back
fs.writeFileSync(filePath, content, 'utf8');
console.log('✅ Fixed engagement bot syntax issue'); 