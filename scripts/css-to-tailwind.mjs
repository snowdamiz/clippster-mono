#!/usr/bin/env node

/**
 * CSS to Tailwind Converter for Vue SFC Files
 * 
 * Converts standard CSS in Vue single-file components to Tailwind CSS v4
 * utility classes, applying them directly to template elements.
 * 
 * Usage:
 *   node scripts/css-to-tailwind.mjs <vue-file>
 *   node scripts/css-to-tailwind.mjs <vue-file> --dry-run
 *   node scripts/css-to-tailwind.mjs <vue-file> --no-backup
 * 
 * Options:
 *   --dry-run    Preview changes without modifying files
 *   --no-backup  Skip creating .bak backup file
 *   --verbose    Show detailed conversion information
 *   --help       Show this help message
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { parseVueSfc, extractCssRules, extractDynamicClasses } from './css-to-tailwind/parser.mjs';
import { convertRules, generateUnconvertedCss } from './css-to-tailwind/converter.mjs';
import { transformVueSfc, generateSummary } from './css-to-tailwind/transformer.mjs';

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
${colors.bright}CSS to Tailwind Converter for Vue SFC${colors.reset}

Converts standard CSS in Vue single-file components to Tailwind CSS v4
utility classes, applying them directly to template elements.

${colors.bright}Usage:${colors.reset}
  node scripts/css-to-tailwind.mjs <vue-file> [options]

${colors.bright}Options:${colors.reset}
  --dry-run     Preview changes without modifying files
  --no-backup   Skip creating .bak backup file
  --verbose     Show detailed conversion information
  --help        Show this help message

${colors.bright}Examples:${colors.reset}
  # Convert a file (creates backup by default)
  node scripts/css-to-tailwind.mjs client/src/pages/MyComponent.vue

  # Preview changes without modifying
  node scripts/css-to-tailwind.mjs client/src/pages/MyComponent.vue --dry-run

  # Convert without creating backup
  node scripts/css-to-tailwind.mjs client/src/pages/MyComponent.vue --no-backup
`);
}

/**
 * Parse command line arguments
 */
function parseArgs(args) {
  const options = {
    file: null,
    dryRun: false,
    noBackup: false,
    verbose: false,
    help: false,
  };

  for (const arg of args) {
    if (arg === '--dry-run') {
      options.dryRun = true;
    } else if (arg === '--no-backup') {
      options.noBackup = true;
    } else if (arg === '--verbose') {
      options.verbose = true;
    } else if (arg === '--help' || arg === '-h') {
      options.help = true;
    } else if (!arg.startsWith('-')) {
      options.file = arg;
    }
  }

  return options;
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
 * Main conversion function
 */
async function convertFile(filePath, options) {
  log(`\n📄 Processing: ${filePath}`, 'cyan');

  // Read the file
  const source = fs.readFileSync(filePath, 'utf-8');
  
  // Parse the Vue SFC
  log('  Parsing Vue SFC...', 'dim');
  const parseResult = parseVueSfc(source, path.basename(filePath));
  
  if (!parseResult.styles || parseResult.styles.length === 0) {
    log('  ⚠️  No <style> blocks found in file', 'yellow');
    return { success: false, reason: 'No styles to convert' };
  }
  
  // Only process scoped styles - leave non-scoped (global) styles untouched
  const scopedStyles = parseResult.styles.filter(s => s.scoped);
  const nonScopedStyles = parseResult.styles.filter(s => !s.scoped);
  
  if (scopedStyles.length === 0) {
    log('  ⚠️  No scoped <style> blocks found (only processing scoped styles)', 'yellow');
    return { success: false, reason: 'No scoped styles to convert' };
  }
  
  if (nonScopedStyles.length > 0) {
    log(`  ℹ️  Skipping ${nonScopedStyles.length} non-scoped style block(s) (global styles preserved)`, 'dim');
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
    log('  ⚠️  No CSS rules found in scoped style blocks', 'yellow');
    return { success: false, reason: 'No CSS rules to convert' };
  }
  
  log(`  Found ${allRules.length} CSS rules in scoped styles`, 'dim');
  
  // Extract classes used in :class bindings - these need CSS preserved
  const dynamicClasses = parseResult.template 
    ? extractDynamicClasses(parseResult.template.content)
    : new Set();
  
  if (dynamicClasses.size > 0 && options.verbose) {
    log(`  ℹ️  Found ${dynamicClasses.size} class(es) in :class bindings (CSS preserved)`, 'dim');
  }
  
  // Convert CSS rules to Tailwind classes
  log('  Converting CSS to Tailwind...', 'dim');
  const { classMap, unconvertedRules, classesInUnconvertedRules } = convertRules(allRules);
  
  // Add dynamic classes to the set of classes needing CSS preservation
  for (const className of dynamicClasses) {
    classesInUnconvertedRules.add(className);
  }
  
  if (classMap.size === 0) {
    log('  ⚠️  No CSS classes could be converted', 'yellow');
    return { success: false, reason: 'No convertible CSS classes' };
  }
  
  // Generate remaining CSS for unconverted rules (includes dynamic class CSS)
  const remainingCss = generateUnconvertedCss(classMap, unconvertedRules, dynamicClasses);
  
  // Transform the Vue SFC (only scoped styles will be modified)
  log('  Transforming template...', 'dim');
  const { content, stats } = transformVueSfc(source, parseResult, classMap, remainingCss, scopedStyles.length, classesInUnconvertedRules);
  
  // Print summary
  if (options.verbose) {
    console.log('\n' + generateSummary(stats));
  }
  
  // Print conversion details
  log(`\n  ✅ Converted ${classMap.size} CSS class(es) to Tailwind`, 'green');
  
  if (options.verbose) {
    for (const [className, entry] of classMap) {
      const allClasses = [...entry.baseClasses, ...entry.variantClasses];
      log(`    .${className} → ${allClasses.join(' ')}`, 'dim');
    }
  }
  
  if (unconvertedRules.length > 0) {
    log(`  ⚠️  ${unconvertedRules.length} rule(s) could not be converted (kept in <style>)`, 'yellow');
    if (options.verbose) {
      for (const rule of unconvertedRules) {
        log(`    - ${rule.selector || rule.name || 'unknown'}`, 'dim');
      }
    }
  }
  
  // Check for partially converted classes
  let partialCount = 0;
  for (const [, entry] of classMap) {
    if (entry.unconverted.length > 0) {
      partialCount++;
    }
  }
  if (partialCount > 0) {
    log(`  ⚠️  ${partialCount} class(es) partially converted (some properties kept in <style>)`, 'yellow');
  }
  
  // Dry run - just show what would change
  if (options.dryRun) {
    log('\n  [DRY RUN] Would write:', 'magenta');
    console.log('─'.repeat(60));
    console.log(content);
    console.log('─'.repeat(60));
    return { success: true, dryRun: true };
  }
  
  // Create backup
  if (!options.noBackup) {
    const backupPath = createBackup(filePath);
    log(`  📦 Backup created: ${backupPath}`, 'dim');
  }
  
  // Write the transformed file
  fs.writeFileSync(filePath, content, 'utf-8');
  log(`  💾 File updated: ${filePath}`, 'green');
  
  return {
    success: true,
    classesConverted: classMap.size,
    rulesUnconverted: unconvertedRules.length,
    stats,
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
  
  if (!options.file) {
    log('❌ Error: No file specified', 'red');
    log('Run with --help for usage information', 'dim');
    process.exit(1);
  }
  
  // Resolve file path
  const filePath = path.resolve(process.cwd(), options.file);
  
  // Check file exists
  if (!fs.existsSync(filePath)) {
    log(`❌ Error: File not found: ${filePath}`, 'red');
    process.exit(1);
  }
  
  // Check it's a .vue file
  if (!filePath.endsWith('.vue')) {
    log('❌ Error: File must be a .vue file', 'red');
    process.exit(1);
  }
  
  try {
    const result = await convertFile(filePath, options);
    
    if (result.success) {
      log('\n✨ Conversion complete!', 'green');
      process.exit(0);
    } else {
      log(`\n⚠️  Conversion skipped: ${result.reason}`, 'yellow');
      process.exit(0);
    }
  } catch (error) {
    log(`\n❌ Error: ${error.message}`, 'red');
    if (options.verbose) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

main();

