#!/usr/bin/env node
import dotenv from 'dotenv';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config({ path: '.env.local' });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

async function auditAccessControl() {
  console.log('🔍 Auditing ALL Access Control Points\n');
  
  const issues = [];
  const files = [];
  
  // Patterns to look for
  const patterns = [
    {
      name: 'Role checks without ProfileService',
      regex: /findUserByUsername\s*\([^)]*\)/g,
      issue: 'Uses old Redis system only'
    },
    {
      name: 'Admin-only checks missing core',
      regex: /role\s*===\s*['"]admin['"]\s*(?!.*\|\|.*core)/g,
      issue: 'Excludes core role'
    },
    {
      name: 'Hard-coded role checks',
      regex: /userRole\s*===\s*['"]admin['"]\s*&&\s*\(/g,
      issue: 'May exclude core role in conditions'
    }
  ];
  
  // Directories to scan
  const dirsToScan = ['app', 'components', 'lib'];
  
  async function scanFile(filePath) {
    if (!filePath.endsWith('.ts') && !filePath.endsWith('.tsx')) return;
    
    const content = await fs.readFile(filePath, 'utf8');
    const relativePath = path.relative(projectRoot, filePath);
    
    for (const pattern of patterns) {
      const matches = content.match(pattern.regex);
      if (matches) {
        // Get line numbers for each match
        const lines = content.split('\n');
        matches.forEach(match => {
          let lineNum = 0;
          for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes(match.trim())) {
              lineNum = i + 1;
              break;
            }
          }
          
          issues.push({
            file: relativePath,
            line: lineNum,
            pattern: pattern.name,
            issue: pattern.issue,
            code: match.trim()
          });
        });
      }
    }
    
    // Check for critical access control files
    if (content.includes('role') || content.includes('access') || content.includes('auth')) {
      files.push({
        path: relativePath,
        hasProfileService: content.includes('ProfileService'),
        hasFindUserByUsername: content.includes('findUserByUsername'),
        hasRoleCheck: content.includes('role ===') || content.includes('role !==')
      });
    }
  }
  
  async function scanDir(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
        await scanDir(fullPath);
      } else if (entry.isFile()) {
        await scanFile(fullPath);
      }
    }
  }
  
  // Scan all directories
  for (const dir of dirsToScan) {
    const fullDir = path.join(projectRoot, dir);
    try {
      await scanDir(fullDir);
    } catch (err) {
      console.log(`Skipping ${dir}: ${err.message}`);
    }
  }
  
  // Report findings
  console.log('=== Access Control Issues Found ===\n');
  
  if (issues.length === 0) {
    console.log('✅ No obvious access control issues found!');
  } else {
    // Group by file
    const byFile = {};
    issues.forEach(issue => {
      if (!byFile[issue.file]) byFile[issue.file] = [];
      byFile[issue.file].push(issue);
    });
    
    Object.entries(byFile).forEach(([file, fileIssues]) => {
      console.log(`📄 ${file}`);
      fileIssues.forEach(issue => {
        console.log(`   Line ${issue.line}: ${issue.issue}`);
        console.log(`   Code: ${issue.code}`);
        console.log('');
      });
    });
  }
  
  // Critical files analysis
  console.log('\n=== Critical Access Control Files ===\n');
  const criticalFiles = files.filter(f => 
    f.path.includes('api/user/role') ||
    f.path.includes('api/user/profile') ||
    f.path.includes('campaigns/page') ||
    f.path.includes('admin/page') ||
    f.path.includes('middleware')
  );
  
  criticalFiles.forEach(file => {
    console.log(`📄 ${file.path}`);
    console.log(`   Uses ProfileService: ${file.hasProfileService ? '✅' : '❌'}`);
    console.log(`   Uses findUserByUsername: ${file.hasFindUserByUsername ? '⚠️' : '✅'}`);
    console.log(`   Has role checks: ${file.hasRoleCheck ? 'Yes' : 'No'}`);
    console.log('');
  });
  
  console.log('\n=== Summary ===');
  console.log(`Total issues found: ${issues.length}`);
  console.log(`Files with access control: ${files.length}`);
  console.log(`Critical files analyzed: ${criticalFiles.length}`);
}

auditAccessControl(); 