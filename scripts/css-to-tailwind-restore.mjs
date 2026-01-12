#!/usr/bin/env node

/**
 * Restore Vue Files from Backups
 * 
 * Restores original .vue files from .bak backups created by the css-to-tailwind converter.
 * 
 * Usage:
 *   node scripts/css-to-tailwind-restore.mjs <directory>
 *   node scripts/css-to-tailwind-restore.mjs <directory> --dry-run
 *   node scripts/css-to-tailwind-restore.mjs <directory> --delete-backups
 * 
 * Options:
 *   --dry-run         Preview which files would be restored without modifying
 *   --delete-backups  Delete backup files after restoring
 *   --no-recursive    Only process files in the specified directory (not subdirectories)
 *   --help            Show this help message
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ANSI color codes for terminal output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

/**
 * Print colored output
 */
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

/**
 * Print help message
 */
function printHelp() {
  console.log(`
${colors.bright}Restore Vue Files from Backups${colors.reset}

Restores original .vue files from .bak backups created by the css-to-tailwind converter.

${colors.bright}Usage:${colors.reset}
  node scripts/css-to-tailwind-restore.mjs <directory> [options]

${colors.bright}Options:${colors.reset}
  --dry-run         Preview which files would be restored without modifying
  --delete-backups  Delete backup files after restoring
  --no-recursive    Only process files in the specified directory (not subdirectories)
  --help            Show this help message

${colors.bright}Examples:${colors.reset}
  # Restore all .vue files from backups in a directory
  node scripts/css-to-tailwind-restore.mjs client/src/components

  # Preview which files would be restored
  node scripts/css-to-tailwind-restore.mjs client/src --dry-run

  # Restore and delete backup files
  node scripts/css-to-tailwind-restore.mjs client/src --delete-backups
`);
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const options = {
    directory: null,
    dryRun: false,
    deleteBackups: false,
    recursive: true,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--delete-backups') {
      options.deleteBackups = true;
    } else if (arg === '--no-recursive') {
      options.recursive = false;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (!arg.startsWith('-')) {
      options.directory = arg;
    }
  }

  return options;
}

/**
 * Find all .vue.bak files in a directory
 */
function findBackupFiles(directory, recursive = true) {
  const files = [];
  
  function scan(dir) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        // Skip node_modules and hidden directories
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) {
          continue;
        }
        if (recursive) {
          scan(fullPath);
        }
      } else if (entry.isFile() && entry.name.endsWith('.vue.bak')) {
        files.push(fullPath);
      }
    }
  }
  
  scan(directory);
  return files.sort();
}

/**
 * Restore a single file from its backup
 */
function restoreFile(backupPath, options) {
  // Get the original file path by removing .bak extension
  const originalPath = backupPath.slice(0, -4); // Remove '.bak'
  
  if (options.dryRun) {
    return { success: true, dryRun: true };
  }
  
  // Copy backup to original
  fs.copyFileSync(backupPath, originalPath);
  
  // Optionally delete backup
  if (options.deleteBackups) {
    fs.unlinkSync(backupPath);
  }
  
  return { success: true };
}

/**
 * Main entry point
 */
async function main() {
  const args = process.argv.slice(2);
  const options = parseArgs(args);
  
  if (options.help) {
    printHelp();
    process.exit(0);
  }
  
  if (!options.directory) {
    log('❌ Error: No directory specified', 'red');
    log('Run with --help for usage information', 'dim');
    process.exit(1);
  }
  
  // Resolve directory path
  const dirPath = path.resolve(process.cwd(), options.directory);
  
  // Check directory exists
  if (!fs.existsSync(dirPath)) {
    log(`❌ Error: Directory not found: ${dirPath}`, 'red');
    process.exit(1);
  }
  
  // Check it's a directory
  if (!fs.statSync(dirPath).isDirectory()) {
    log('❌ Error: Path is not a directory', 'red');
    process.exit(1);
  }
  
  // Find all .vue.bak files
  log(`\n🔍 Scanning for .vue.bak files in: ${dirPath}`, 'cyan');
  log(`   Recursive: ${options.recursive ? 'yes' : 'no'}`, 'dim');
  
  const backupFiles = findBackupFiles(dirPath, options.recursive);
  
  if (backupFiles.length === 0) {
    log('\n⚠️  No .vue.bak backup files found in directory', 'yellow');
    process.exit(0);
  }
  
  log(`\n📁 Found ${backupFiles.length} backup file(s)\n`, 'green');
  
  // Process results tracking
  const results = {
    total: backupFiles.length,
    restored: 0,
    failed: 0,
  };
  
  // Process each backup file
  for (let i = 0; i < backupFiles.length; i++) {
    const backupFile = backupFiles[i];
    const relativePath = path.relative(process.cwd(), backupFile);
    const originalRelativePath = relativePath.slice(0, -4); // Remove '.bak' for display
    const progress = `[${i + 1}/${backupFiles.length}]`;
    
    log(`${progress} Restoring: ${originalRelativePath}`, 'blue');
    
    try {
      const result = restoreFile(backupFile, options);
      
      if (result.success) {
        results.restored++;
        if (options.dryRun) {
          log(`        📋 Would restore from: ${relativePath}`, 'dim');
        } else {
          log(`        ✅ Restored${options.deleteBackups ? ' (backup deleted)' : ''}`, 'green');
        }
      }
    } catch (error) {
      results.failed++;
      log(`        ❌ Failed: ${error.message}`, 'red');
    }
  }
  
  // Print summary
  console.log('\n' + '═'.repeat(60));
  log('📊 Restore Summary', 'bright');
  console.log('═'.repeat(60));
  
  log(`   Total backups:   ${results.total}`, 'dim');
  log(`   ✅ Restored:     ${results.restored}`, 'green');
  log(`   ❌ Failed:       ${results.failed}`, results.failed > 0 ? 'red' : 'dim');
  
  if (options.dryRun) {
    log('\n   [DRY RUN] No files were modified', 'magenta');
  } else if (options.deleteBackups) {
    log('\n   🗑️  Backup files were deleted after restore', 'dim');
  }
  
  console.log('═'.repeat(60));
  
  log('\n✨ Restore complete!', 'green');
  process.exit(results.failed > 0 ? 1 : 0);
}

main();

