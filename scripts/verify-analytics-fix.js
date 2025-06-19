#!/usr/bin/env node

// Verify analytics fix
const fetch = require('node-fetch');

async function verifyAnalytics() {
  console.log('🔍 Verifying Discord Analytics Fix\n');
  
  const projectId = 'project--discord--OVPuPOX3_zHBnLUscRbdM'; // Ledger
  const baseUrl = 'http://localhost:3000/api/discord/projects';
  
  console.log('Expected values based on database analysis:');
  console.log('Daily: 201 messages, 45 unique users');
  console.log('Weekly: 215 messages, 46 unique users');
  console.log('Monthly: 215 messages, 46 unique users\n');
  
  console.log('Fetching actual analytics from API...\n');
  
  try {
    // Test public endpoint (no auth required)
    const response = await fetch(`${baseUrl}/${projectId}/analytics?timeframe=daily&public=true`);
    
    if (!response.ok) {
      console.log(`❌ API returned error: ${response.status} ${response.statusText}`);
      const errorText = await response.text();
      console.log('Error details:', errorText);
      return;
    }
    
    const data = await response.json();
    
    if (data.analytics && data.analytics.metrics) {
      const { metrics } = data.analytics;
      
      console.log('✅ API Response - DAILY timeframe:');
      console.log(`   Total Messages: ${metrics.totalMessages}`);
      console.log(`   Unique Users: ${metrics.uniqueUsers}`);
      console.log(`   Date Range: ${data.analytics.startDate} to ${data.analytics.endDate}`);
      
      // Check if values match expected
      if (metrics.totalMessages >= 190 && metrics.totalMessages <= 210) {
        console.log('\n✅ Message count looks correct! (within expected range)');
      } else {
        console.log('\n⚠️ Message count seems off. Expected around 201, got', metrics.totalMessages);
      }
      
      if (metrics.uniqueUsers >= 40 && metrics.uniqueUsers <= 50) {
        console.log('✅ User count looks correct! (within expected range)');
      } else {
        console.log('⚠️ User count seems off. Expected around 45, got', metrics.uniqueUsers);
      }
      
    } else {
      console.log('❌ No analytics data in response');
      console.log('Response:', JSON.stringify(data, null, 2));
    }
  } catch (error) {
    console.log('❌ Error fetching analytics:', error.message);
  }
}

verifyAnalytics(); 