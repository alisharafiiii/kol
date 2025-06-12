const { spawn } = require('child_process');

console.log('🚀 Discord Bot Manager Started');

function startBot() {
  console.log(`[${new Date().toISOString()}] Starting Discord bot...`);
  
  const bot = spawn('node', ['bot.js'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false
  });

  bot.stdout.on('data', (data) => {
    process.stdout.write(`[BOT] ${data}`);
  });

  bot.stderr.on('data', (data) => {
    process.stderr.write(`[BOT ERROR] ${data}`);
  });

  bot.on('close', (code) => {
    console.log(`[${new Date().toISOString()}] Bot process exited with code ${code}`);
    console.log('Restarting in 5 seconds...');
    setTimeout(startBot, 5000);
  });

  bot.on('error', (err) => {
    console.error('Failed to start bot process:', err);
    setTimeout(startBot, 5000);
  });
}

// Handle shutdown gracefully
process.on('SIGINT', () => {
  console.log('\n🛑 Shutting down bot manager...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Shutting down bot manager...');
  process.exit(0);
});

// Start the bot
startBot(); 