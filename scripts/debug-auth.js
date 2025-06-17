const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

console.log('🔍 NextAuth Debug Information\n');
console.log('=' .repeat(50));

// Check required environment variables
const requiredVars = {
  'NEXTAUTH_URL': process.env.NEXTAUTH_URL,
  'NEXTAUTH_SECRET': process.env.NEXTAUTH_SECRET,
  'TWITTER_CLIENT_ID': process.env.TWITTER_CLIENT_ID,
  'TWITTER_CLIENT_SECRET': process.env.TWITTER_CLIENT_SECRET,
};

console.log('1. Environment Variables:');
console.log('-'.repeat(30));
for (const [key, value] of Object.entries(requiredVars)) {
  if (value) {
    if (key.includes('SECRET') || key.includes('TOKEN')) {
      console.log(`✅ ${key}: ${value.substring(0, 10)}...${value.substring(value.length - 5)}`);
    } else {
      console.log(`✅ ${key}: ${value}`);
    }
  } else {
    console.log(`❌ ${key}: NOT SET`);
  }
}

// Check NEXTAUTH_URL format
console.log('\n2. NEXTAUTH_URL Validation:');
console.log('-'.repeat(30));
if (process.env.NEXTAUTH_URL) {
  try {
    const url = new URL(process.env.NEXTAUTH_URL);
    console.log(`✅ Valid URL: ${url.href}`);
    console.log(`   Protocol: ${url.protocol}`);
    console.log(`   Host: ${url.host}`);
    console.log(`   Port: ${url.port || 'default'}`);
    
    if (url.protocol !== 'http:' && url.hostname === 'localhost') {
      console.log('⚠️  WARNING: Using HTTPS with localhost can cause issues');
    }
  } catch (e) {
    console.log(`❌ Invalid URL format: ${e.message}`);
  }
} else {
  console.log('❌ NEXTAUTH_URL is not set');
}

// Check Twitter OAuth callback URLs
console.log('\n3. Expected Twitter OAuth Callback URLs:');
console.log('-'.repeat(30));
const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
console.log(`📍 Add these to your Twitter App settings:`);
console.log(`   ${baseUrl}/api/auth/callback/twitter`);

// Check for common issues
console.log('\n4. Common Issues Check:');
console.log('-'.repeat(30));

// Check if running on correct port
if (baseUrl.includes('localhost:3000') && process.env.PORT && process.env.PORT !== '3000') {
  console.log(`⚠️  WARNING: NEXTAUTH_URL uses port 3000 but PORT env is ${process.env.PORT}`);
} else {
  console.log('✅ Port configuration looks correct');
}

// Check for trailing slash
if (baseUrl.endsWith('/')) {
  console.log('⚠️  WARNING: NEXTAUTH_URL has trailing slash - remove it');
} else {
  console.log('✅ No trailing slash in NEXTAUTH_URL');
}

// Additional checks
console.log('\n5. Additional Information:');
console.log('-'.repeat(30));
console.log(`Node Environment: ${process.env.NODE_ENV || 'development'}`);
console.log(`Current Directory: ${process.cwd()}`);

// Recommendations
console.log('\n6. Troubleshooting Steps:');
console.log('-'.repeat(30));
console.log('1. Clear browser cookies and cache');
console.log('2. Try incognito/private browsing mode');
console.log('3. Check browser console for errors');
console.log('4. Verify Twitter App OAuth 2.0 settings:');
console.log('   - Type of App: Web App');
console.log('   - Callback URL must match exactly');
console.log('   - App permissions: Read');
console.log('5. For local development, use:');
console.log('   NEXTAUTH_URL=http://localhost:3000');
console.log('   (not https, not 127.0.0.1)');

console.log('\n' + '='.repeat(50));
console.log('✨ Debug complete\n'); 