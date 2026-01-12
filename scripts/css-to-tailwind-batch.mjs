#!/usr/bin/env node

/**
 * Batch CSS to Tailwind Converter for Vue SFC Files
 * 
 * Runs the css-to-tailwind converter on all .vue files in a directory.
 * 
 * Usage:
 *   node scripts/css-to-tailwind-batch.mjs <directory>
 *   node scripts/css-to-tailwind-batch.mjs <directory> --dry-run
 *   node scripts/css-to-tailwind-batch.mjs <directory> --no-backup
 *   node scripts/css-to-tailwind-batch.mjs <directory> --no-recursive
 * 
 * Options:
 *   --dry-run       Preview changes without modifying files
 *   --no-backup     Skip creating .bak backup files
 *   --no-recursive  Only process files in the specified directory (not subdirectories)
 *   --verbose       Show detailed conversion information for each file
 *   --continue      Continue processing even if a file fails
 *   --help          Show this help message
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { parseVueSfc, extractCssRules, extractDynamicClasses } from './css-to-tailwind/parser.mjs';
import { convertRules, generateUnconvertedCss } from './css-to-tailwind/converter.mjs';
import { transformVueSfc } from './css-to-tailwind/transformer.mjs';

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
${colors.bright}Batch CSS to Tailwind Converter for Vue SFC${colors.reset}

Runs the css-to-tailwind converter on all .vue files in a directory.

${colors.bright}Usage:${colors.reset}
  node scripts/css-to-tailwind-batch.mjs <directory> [options]

${colors.bright}Options:${colors.reset}
  --dry-run       Preview changes without modifying files
  --no-backup     Skip creating .bak backup files
  --no-recursive  Only process files in the specified directory (not subdirectories)
  --verbose       Show detailed conversion information for each file
  --continue      Continue processing even if a file fails
  --help          Show this help message

${colors.bright}Examples:${colors.reset}
  # Convert all .vue files in a directory recursively
  node scripts/css-to-tailwind-batch.mjs client/src/components

  # Preview changes without modifying files
  node scripts/css-to-tailwind-batch.mjs client/src/pages --dry-run

  # Convert only files in the immediate directory
  node scripts/css-to-tailwind-batch.mjs client/src/pages --no-recursive

  # Convert all files, continuing even if some fail
  node scripts/css-to-tailwind-batch.mjs client/src --continue
`);
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const options = {
    directory: null,
    dryRun: false,
    noBackup: false,
    recursive: true,
    verbose: false,
    continueOnError: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--no-backup') {
      options.noBackup = true;
    } else if (arg === '--no-recursive') {
      options.recursive = false;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--continue') {
      options.continueOnError = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (!arg.startsWith('-')) {
      options.directory = arg;
    }
  }

  return options;
}

/**
 * Find all .vue files in a directory
 */
function findVueFiles(directory, recursive = true) {
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
      } else if (entry.isFile() && entry.name.endsWith('.vue')) {
        // Skip backup files
        if (!entry.name.endsWith('.vue.bak')) {
          files.push(fullPath);
        }
      }
    }
  }
  
  scan(directory);
  return files.sort();
}

/**
 * Create a backup of the original file
 */
function createBackup(filePath) {
  const backupPath = `${filePath}.bak`;
  fs.copyFileSync(filePath, backupPath);
  return backupPath;
}

/**
 * Convert a single file (adapted from css-to-tailwind.mjs)
 */
function convertFile(filePath, options) {
  const relativePath = path.relative(process.cwd(), filePath);
  
  // Read the file
  const source = fs.readFileSync(filePath, 'utf-8');
  
  // Parse the Vue SFC
  const parseResult = parseVueSfc(source, path.basename(filePath));
  
  if (!parseResult.styles || parseResult.styles.length === 0) {
    return { success: false, skipped: true, reason: 'No styles to convert' };
  }
  
  // Only process scoped styles - leave non-scoped (global) styles untouched
  const scopedStyles = parseResult.styles.filter(s => s.scoped);
  
  if (scopedStyles.length === 0) {
    return { success: false, skipped: true, reason: 'No scoped styles to convert' };
  }
  
  // Process only scoped style blocks
  let allRules = [];
  for (const style of scopedStyles) {
    if (style.content) {
      const rules = extractCssRules(style.content);
      allRules.push(...rules);
    }
  }
  
  if (allRules.length === 0) {
    return { success: false, skipped: true, reason: 'No CSS rules to convert' };
  }
  
  // Extract classes used in :class bindings - these need CSS preserved
  const dynamicClasses = parseResult.template 
    ? extractDynamicClasses(parseResult.template.content)
    : new Set();
  
  // Convert CSS rules to Tailwind classes
  const { classMap, unconvertedRules, classesInUnconvertedRules } = convertRules(allRules);
  
  // Add dynamic classes to the set of classes needing CSS preservation
  for (const className of dynamicClasses) {
    classesInUnconvertedRules.add(className);
  }
  
  if (classMap.size === 0) {
    return { success: false, skipped: true, reason: 'No convertible CSS classes' };
  }
  
  // Generate remaining CSS for unconverted rules (includes dynamic class CSS)
  const remainingCss = generateUnconvertedCss(classMap, unconvertedRules, dynamicClasses);
  
  // Transform the Vue SFC (only scoped styles will be modified)
  const { content, stats } = transformVueSfc(source, parseResult, classMap, remainingCss, scopedStyles.length, classesInUnconvertedRules);
  
  // Dry run - don't modify
  if (options.dryRun) {
    return {
      success: true,
      skipped: false,
      dryRun: true,
      classesConverted: classMap.size,
      rulesUnconverted: unconvertedRules.length,
    };
  }
  
  // Create backup
  if (!options.noBackup) {
    createBackup(filePath);
  }
  
  // Write the transformed file
  fs.writeFileSync(filePath, content, 'utf-8');
  
  return {
    success: true,
    skipped: false,
    classesConverted: classMap.size,
    rulesUnconverted: unconvertedRules.length,
  };
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
  
  // Find all .vue files
  log(`\n🔍 Scanning for .vue files in: ${dirPath}`, 'cyan');
  log(`   Recursive: ${options.recursive ? 'yes' : 'no'}`, 'dim');
  
  const files = findVueFiles(dirPath, options.recursive);
  
  if (files.length === 0) {
    log('\n⚠️  No .vue files found in directory', 'yellow');
    process.exit(0);
  }
  
  log(`\n📁 Found ${files.length} .vue file(s)\n`, 'green');
  
  // Process results tracking
  const results = {
    total: files.length,
    successful: 0,
    skipped: 0,
    failed: 0,
    files: [],
  };
  
  // Process each file
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const relativePath = path.relative(process.cwd(), file);
    const progress = `[${i + 1}/${files.length}]`;
    
    if (options.verbose) {
      log(`${progress} Processing: ${relativePath}`, 'blue');
    }
    
    try {
      const result = convertFile(file, options);
      
      if (result.skipped) {
        results.skipped++;
        results.files.push({ path: relativePath, status: 'skipped', reason: result.reason });
        if (options.verbose) {
          log(`        ⏭️  Skipped: ${result.reason}`, 'dim');
        }
      } else if (result.success) {
        results.successful++;
        results.files.push({ 
          path: relativePath, 
          status: 'success',
          classesConverted: result.classesConverted,
        });
        if (options.verbose) {
          log(`        ✅ Converted ${result.classesConverted} class(es)`, 'green');
        }
      }
    } catch (error) {
      results.failed++;
      results.files.push({ path: relativePath, status: 'failed', error: error.message });
      
      if (options.verbose) {
        log(`${progress} Processing: ${relativePath}`, 'blue');
      }
      log(`        ❌ Failed: ${error.message}`, 'red');
      
      if (!options.continueOnError) {
        log('\n⛔ Stopping due to error. Use --continue to process remaining files.', 'red');
        break;
      }
    }
  }
  
  // Print summary
  console.log('\n' + '═'.repeat(60));
  log('📊 Batch Conversion Summary', 'bright');
  console.log('═'.repeat(60));
  
  log(`   Total files:     ${results.total}`, 'dim');
  log(`   ✅ Converted:    ${results.successful}`, 'green');
  log(`   ⏭️  Skipped:      ${results.skipped}`, 'dim');
  log(`   ❌ Failed:       ${results.failed}`, results.failed > 0 ? 'red' : 'dim');
  
  if (options.dryRun) {
    log('\n   [DRY RUN] No files were modified', 'magenta');
  }
  
  console.log('═'.repeat(60));
  
  // Exit with appropriate code
  if (results.failed > 0 && !options.continueOnError) {
    process.exit(1);
  }
  
  log('\n✨ Batch conversion complete!', 'green');
  process.exit(0);
}

main();
