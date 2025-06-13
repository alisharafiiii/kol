const fs = require('fs');
const path = require('path');
const { config } = require('dotenv');

// Load .env.local
const envPath = path.join(__dirname, '.env.local');
console.log('🔍 Checking environment file:', envPath);

if (!fs.existsSync(envPath)) {
  console.error('❌ .env.local file not found!');
  process.exit(1);
}

// Load environment
config({ path: envPath });

console.log('\n📋 Environment Check for Engagement Bot:\n');

const requiredVars = {
  // Discord
  'DISCORD_BOT_TOKEN': 'Discord bot token (for engagement bot)',
  'DISCORD_APPLICATION_ID': 'Discord application ID',
  
  // Redis
  'UPSTASH_REDIS_REST_URL': 'Upstash Redis REST URL',
  'UPSTASH_REDIS_REST_TOKEN': 'Upstash Redis REST token',
};

const optionalVars = {
  // Google AI (optional - bot works without it)
  'GOOGLE_AI_API_KEY': 'Google AI API key for sentiment analysis',
  'GEMINI_API_KEY': 'Gemini API key (alternative to GOOGLE_AI_API_KEY)',
  
  // Twitter (optional for bot, required for batch processor)
  'TWITTER_API_KEY': 'Twitter API key (for batch processor)',
  'TWITTER_API_SECRET': 'Twitter API secret',
  'TWITTER_ACCESS_TOKEN': 'Twitter access token',
  'TWITTER_ACCESS_SECRET': 'Twitter access secret'
};

let missingCount = 0;
let warningCount = 0;

// Check required variables
Object.entries(requiredVars).forEach(([key, description]) => {
  const value = process.env[key];
  
  if (!value) {
    console.log(`❌ ${key}: MISSING (${description})`);
    missingCount++;
  } else {
    const maskedValue = value.substring(0, 6) + '...' + value.substring(value.length - 4);
    console.log(`✅ ${key}: ${maskedValue}`);
  }
});

// Check optional variables
console.log('\nOptional Variables:');
Object.entries(optionalVars).forEach(([key, description]) => {
  const value = process.env[key];
  
  if (!value) {
    console.log(`⚠️  ${key}: MISSING (${description})`);
    warningCount++;
  } else {
    const maskedValue = value.substring(0, 6) + '...' + value.substring(value.length - 4);
    console.log(`✅ ${key}: ${maskedValue}`);
  }
});

console.log('\n📊 Summary:');
const foundRequired = Object.keys(requiredVars).length - missingCount;
const foundOptional = Object.keys(optionalVars).length - warningCount;
console.log(`   ✅ Required: ${foundRequired}/${Object.keys(requiredVars).length} variables`);
console.log(`   ⚠️  Optional: ${foundOptional}/${Object.keys(optionalVars).length} variables`);
if (missingCount > 0) {
  console.log(`   ❌ Missing: ${missingCount} required variables`);
}

if (missingCount > 0) {
  console.log('\n💡 Next Steps:');
  console.log('   1. Add the missing variables to your .env.local file');
  console.log('   2. For the engagement bot, you need a SEPARATE Discord bot token');
  console.log('   3. Make sure Redis credentials match your web app\'s credentials');
  process.exit(1);
} else {
  console.log('\n✅ All required variables are present! You can run the engagement bot.');
} 