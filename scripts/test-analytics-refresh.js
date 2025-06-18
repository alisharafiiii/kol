#!/usr/bin/env node

const fetch = require('node-fetch');

const projectId = 'project--discord--OVPuPOX3_zHBnLUscRbdM'; // Ledger
const baseUrl = 'http://localhost:3006/api/discord/projects';

async function checkAnalytics(timeframe = 'daily') {
  try {
    const response = await fetch(`${baseUrl}/${projectId}/analytics?timeframe=${timeframe}&public=true`);
    const data = await response.json();
    
    if (data.analytics) {
      const { totalMessages, uniqueUsers } = data.analytics.metrics;
      const lastActivity = data.analytics.metrics.dailyTrend?.slice(-1)[0];
      
      console.log(`[${new Date().toLocaleTimeString()}] ${timeframe.toUpperCase()} Analytics:`);
      console.log(`  Total Messages: ${totalMessages}`);
      console.log(`  Unique Users: ${uniqueUsers}`);
      if (lastActivity) {
        console.log(`  Today's Messages: ${lastActivity.messages}`);
      }
      console.log('---');
    } else {
      console.error('Error:', data);
    }
  } catch (error) {
    console.error('Failed to fetch analytics:', error.message);
  }
}

console.log('Analytics Refresh Test - Checking every 10 seconds');
console.log('Cache TTL is 30 seconds, so you should see updates after cache expires');
console.log('Send messages in Ledger Discord to test\n');

// Initial check
checkAnalytics();

// Check every 10 seconds
setInterval(() => checkAnalytics(), 10000);

// Exit after 2 minutes
setTimeout(() => {
  console.log('\nTest complete!');
  process.exit(0);
}, 120000); 