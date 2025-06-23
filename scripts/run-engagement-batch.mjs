#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Engagement Batch Processor Runner');
console.log('📝 Optimized to reduce API calls and avoid rate limits\n');

console.log('📋 How it works:');
console.log('  - Regular runs: Update tweet metrics only (likes, RTs, replies)');
console.log('  - Hourly runs: Full engagement processing (who liked/retweeted)');
console.log('  - Force detailed: Add --force-detailed flag\n');

async function runBatchProcessor() {
  const args = process.argv.slice(2);
  const forceDetailed = args.includes('--force-detailed');
  try {
    // Change to project root
    process.chdir(path.join(__dirname, '..'));
    
    if (forceDetailed) {
      console.log('🔍 Running with --force-detailed flag\n');
    }
    console.log('🔄 Running batch processor...\n');
    
    // Run the batch processor
    const command = forceDetailed ? 
      'node discord-bots/engagement-batch-processor.js --force-detailed' : 
      'node discord-bots/engagement-batch-processor.js';
    const { stdout, stderr } = await execAsync(command);
    
    if (stdout) {
      console.log('📝 Output:');
      console.log(stdout);
    }
    
    if (stderr) {
      console.error('⚠️  Errors:');
      console.error(stderr);
    }
    
    console.log('\n✅ Batch processing complete!');
    console.log('💡 Check the Batch tab at https://www.nabulines.com/admin/engagement');
    
  } catch (error) {
    console.error('\n❌ Error running batch processor:');
    console.error(error.message);
  }
}

// Run the processor
runBatchProcessor().catch(console.error); 