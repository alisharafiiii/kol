#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '..', 'discord-bots', 'engagement-bot.js');

// Read the file
let content = fs.readFileSync(filePath, 'utf8');

// Fix the Redis expiry syntax
// Change { ex: 600 } to { EX: 600 }
content = content.replace(/\{ ex: (\d+) \}/g, '{ EX: $1 }');

// Also fix any setex calls to use EX option
content = content.replace(/\.setex\(/g, '.set(');

// Write back
fs.writeFileSync(filePath, content, 'utf8');

console.log('✅ Fixed Redis syntax in engagement-bot.js');
console.log('   Changed { ex: 600 } to { EX: 600 }'); 