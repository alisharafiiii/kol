const fs = require('fs');
const path = require('path');

// Read the engagement bot file
const filePath = path.join(__dirname, '..', 'discord-bots', 'engagement-bot.js');
let content = fs.readFileSync(filePath, 'utf8');

// Split into lines for easier manipulation
const lines = content.split('\n');

// Find and fix the duplicate closing brace issue
let fixedLines = [];
let skipNextBrace = false;

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const trimmed = line.trim();
  
  // Look for the pattern where we have the scenarios command end
  if (i > 0 && lines[i-1].includes('flags: 64') && 
      lines[i].trim() === '})' && 
      i+1 < lines.length && lines[i+1].trim() === '}' &&
      i+2 < lines.length && lines[i+2].trim() === '}' &&
      i+3 < lines.length && lines[i+3].trim() === '' &&
      i+4 < lines.length && lines[i+4].includes('// Handle modal submissions')) {
    
    // We found the problematic section
    fixedLines.push(line); // Keep the first })
    fixedLines.push(lines[i+1]); // Keep the second }
    // Skip the third } (the extra one)
    i++; // Skip ahead
    continue;
  }
  
  fixedLines.push(line);
}

// Now we need to add the catch block after the modal handler ends
// Find where to insert it
let insertIndex = -1;
for (let i = fixedLines.length - 1; i >= 0; i--) {
  if (fixedLines[i].includes('await interaction.reply({') && 
      i+1 < fixedLines.length && fixedLines[i+1].includes('content: message,') &&
      i+2 < fixedLines.length && fixedLines[i+2].includes('flags: 64')) {
    // Found the last reply in modal handler
    // Look for the closing braces
    for (let j = i + 3; j < Math.min(i + 10, fixedLines.length); j++) {
      if (fixedLines[j].trim() === '}' && 
          j+1 < fixedLines.length && fixedLines[j+1].trim() === '}' &&
          j+2 < fixedLines.length && fixedLines[j+2].trim() === '})') {
        insertIndex = j + 3;
        break;
      }
    }
    break;
  }
}

if (insertIndex > 0) {
  // Insert the catch block
  const catchBlock = [
    '  } catch (error) {',
    '    console.error(\'❌ Error handling interaction:\', error)',
    '    ',
    '    // Try to respond to the user',
    '    try {',
    '      if (interaction.deferred) {',
    '        await interaction.editReply({ content: \'❌ An error occurred processing your request. Please try again.\' })',
    '      } else if (!interaction.replied) {',
    '        await interaction.reply({ content: \'❌ An error occurred processing your request. Please try again.\', flags: 64 })',
    '      }',
    '    } catch (replyError) {',
    '      console.error(\'Could not send error message to user:\', replyError)',
    '    }',
    '  }'
  ];
  
  fixedLines.splice(insertIndex, 0, ...catchBlock);
}

// Join back and write
const fixedContent = fixedLines.join('\n');
fs.writeFileSync(filePath, fixedContent, 'utf8');

console.log('✅ Fixed engagement bot syntax');
console.log('✨ The /connect command should now respond without timeout'); 