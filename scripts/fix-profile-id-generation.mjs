#!/usr/bin/env node
import { readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import { glob } from 'glob';

// Pattern to find profile creation with nanoid
const NANOID_PATTERNS = [
  /userId\s*=\s*`user:\$\{nanoid\(\)\}`/g,
  /id:\s*`user:\$\{nanoid\(\)\}`/g,
  /profile\.id\s*=\s*`user:\$\{nanoid\(\)\}`/g
];

// Pattern to find where we should be using consistent IDs
const HANDLE_AVAILABLE_PATTERN = /(?:normalizedHandle|twitterHandle|handle)/;

async function findAndFixFiles() {
  console.log('🔍 Searching for inconsistent profile ID generation...\n');
  
  // Find all relevant files
  const patterns = [
    'app/api/**/*.ts',
    'app/api/**/*.js',
    'discord-bots/*.js',
    'lib/**/*.ts',
    'modules/**/*.ts'
  ];
  
  const filesToFix = [];
  
  for (const pattern of patterns) {
    const files = await glob(pattern);
    
    for (const file of files) {
      const content = await readFile(file, 'utf-8');
      
      // Check if file contains problematic patterns
      let hasIssue = false;
      for (const pattern of NANOID_PATTERNS) {
        if (pattern.test(content)) {
          hasIssue = true;
          break;
        }
      }
      
      if (hasIssue && HANDLE_AVAILABLE_PATTERN.test(content)) {
        filesToFix.push(file);
      }
    }
  }
  
  console.log(`Found ${filesToFix.length} files with inconsistent ID generation:\n`);
  
  // Generate fix report
  for (const file of filesToFix) {
    console.log(`📄 ${file}`);
    const content = await readFile(file, 'utf-8');
    
    // Find specific issues
    const lines = content.split('\n');
    lines.forEach((line, index) => {
      for (const pattern of NANOID_PATTERNS) {
        if (pattern.test(line)) {
          console.log(`   Line ${index + 1}: ${line.trim()}`);
          console.log(`   ❌ Should use: \`user_\${normalizedHandle}\` instead\n`);
        }
      }
    });
  }
  
  return filesToFix;
}

async function generatePatchFile(files) {
  console.log('\n📝 Generating patch file...\n');
  
  const patches = [];
  
  for (const file of files) {
    const content = await readFile(file, 'utf-8');
    let fixed = content;
    
    // Apply fixes
    fixed = fixed.replace(/userId\s*=\s*`user:\$\{nanoid\(\)\}`/g, 'userId = `user_${normalizedHandle}`');
    fixed = fixed.replace(/id:\s*`user:\$\{nanoid\(\)\}`,/g, 'id: `user_${normalizedHandle}`,');
    fixed = fixed.replace(/profile\.id\s*=\s*`user:\$\{nanoid\(\)\}`/g, 'profile.id = `user_${normalizedHandle}`');
    
    if (fixed !== content) {
      patches.push({
        file,
        original: content,
        fixed
      });
    }
  }
  
  // Save patch file
  await writeFile('profile-id-fixes.json', JSON.stringify(patches, null, 2));
  console.log(`✅ Created patch file with ${patches.length} fixes\n`);
  
  return patches;
}

// Main execution
console.log('🔧 Profile ID Generation Fix Tool\n');
console.log('This tool identifies and fixes inconsistent profile ID generation.\n');

const filesToFix = await findAndFixFiles();

if (filesToFix.length > 0) {
  console.log('\n💡 Recommendation:');
  console.log('1. All profile creation should use: `user_${handle}` format');
  console.log('2. Remove nanoid() usage for profile IDs');
  console.log('3. Implement centralized profile creation in ProfileService');
  console.log('4. Add validation to prevent random ID generation\n');
  
  const patches = await generatePatchFile(filesToFix);
  
  console.log('📋 Summary:');
  console.log(`   Files with issues: ${filesToFix.length}`);
  console.log(`   Patches generated: ${patches.length}`);
  console.log('\n⚠️  Review patches carefully before applying!');
} 