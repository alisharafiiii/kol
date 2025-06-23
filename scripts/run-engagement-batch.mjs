#!/usr/bin/env node

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🚀 Engagement Batch Processor Runner\n');

async function runBatchProcessor() {
  try {
    // Change to project root
    process.chdir(path.join(__dirname, '..'));
    
    console.log('🔄 Running batch processor...\n');
    
    // Run the batch processor
    const { stdout, stderr } = await execAsync('node discord-bots/engagement-batch-processor.js');
    
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