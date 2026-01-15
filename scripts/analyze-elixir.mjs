#!/usr/bin/env node

/**
 * Elixir Server Dead Code Analysis Script
 * 
 * Analyzes the Elixir codebase for:
 * - Unreachable functions (never called)
 * - Deprecated function calls
 * - Cross-reference analysis
 * - Code quality issues (via credo)
 * 
 * Usage:
 *   node scripts/analyze-elixir.mjs [--graph] [--verbose]
 * 
 * Options:
 *   --graph    Generate cross-reference graph in DOT format
 *   --verbose  Show all credo issues, not just unused-related
 * 
 * Requirements:
 *   - Elixir/OTP installed
 *   - Optional: Credo added to mix.exs
 */

import { spawnSync } from 'child_process';
import { writeFileSync, existsSync, mkdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const SERVER_DIR = join(ROOT_DIR, 'server');
const OUTPUT_DIR = join(ROOT_DIR, 'analysis-output');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  graph: args.includes('--graph'),
  verbose: args.includes('--verbose'),
};

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Color helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  magenta: '\x1b[35m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'bright');
  console.log('='.repeat(60) + '\n');
}

function logSubsection(title) {
  console.log('\n' + '-'.repeat(40));
  log(title, 'cyan');
  console.log('-'.repeat(40));
}

/**
 * Check if mix is available
 */
function checkMix() {
  try {
    const result = spawnSync('mix', ['--version'], { encoding: 'utf-8', shell: true });
    if (result.status === 0) {
      log(`Found Elixir: ${result.stdout.trim().split('\n')[0]}`, 'green');
      return true;
    }
  } catch {
    // ignore
  }
  log('Elixir/Mix not found. Please install Elixir: https://elixir-lang.org/install.html', 'red');
  return false;
}

/**
 * Compile the project first
 */
function compileProject() {
  logSubsection('Compiling project');
  
  const result = spawnSync('mix', ['compile', '--warnings-as-errors'], {
    cwd: SERVER_DIR,
    encoding: 'utf-8',
    shell: true,
    timeout: 120000,
  });

  const output = (result.stdout || '') + (result.stderr || '');
  
  // Check for compile-time warnings
  const warnings = output.split('\n').filter(l => l.includes('warning:'));
  
  if (warnings.length > 0) {
    log(`\nCompilation Warnings (${warnings.length}):`, 'yellow');
    warnings.slice(0, 20).forEach(w => console.log(`  ${w}`));
    if (warnings.length > 20) {
      console.log(`  ... and ${warnings.length - 20} more`);
    }
  } else {
    log('Compilation successful with no warnings!', 'green');
  }

  return warnings;
}

/**
 * Run mix xref unreachable to find unused functions
 */
function runXrefUnreachable() {
  logSubsection('Finding unreachable functions (mix xref unreachable)');
  
  const result = spawnSync('mix', ['xref', 'unreachable'], {
    cwd: SERVER_DIR,
    encoding: 'utf-8',
    shell: true,
    timeout: 60000,
  });

  const output = (result.stdout || '') + (result.stderr || '');
  
  // Filter out compilation messages
  const lines = output.split('\n')
    .filter(l => l.trim() && !l.includes('Compiling') && !l.includes('Generated'))
    .map(l => l.trim());

  if (lines.length === 0 || output.includes('no unreachable')) {
    log('No unreachable functions found!', 'green');
    return [];
  }

  log(`\nUnreachable Functions (${lines.length}):`, 'yellow');
  lines.forEach(l => console.log(`  ${l}`));
  
  return lines;
}

/**
 * Run mix xref deprecated to find deprecated function calls
 */
function runXrefDeprecated() {
  logSubsection('Finding deprecated function calls (mix xref deprecated)');
  
  const result = spawnSync('mix', ['xref', 'deprecated'], {
    cwd: SERVER_DIR,
    encoding: 'utf-8',
    shell: true,
    timeout: 60000,
  });

  const output = (result.stdout || '') + (result.stderr || '');
  
  const lines = output.split('\n')
    .filter(l => l.trim() && !l.includes('Compiling') && !l.includes('Generated'))
    .map(l => l.trim());

  if (lines.length === 0 || output.includes('no deprecated')) {
    log('No deprecated function calls found!', 'green');
    return [];
  }

  log(`\nDeprecated Function Calls (${lines.length}):`, 'yellow');
  lines.forEach(l => console.log(`  ${l}`));
  
  return lines;
}

/**
 * Run mix xref callers to find where specific modules are used
 */
function runXrefCallers(moduleName) {
  const result = spawnSync('mix', ['xref', 'callers', moduleName], {
    cwd: SERVER_DIR,
    encoding: 'utf-8',
    shell: true,
    timeout: 30000,
  });

  return (result.stdout || '').split('\n').filter(l => l.trim());
}

/**
 * Generate cross-reference graph
 */
function runXrefGraph() {
  logSubsection('Generating cross-reference graph');
  
  const dotPath = join(OUTPUT_DIR, 'elixir-xref-graph.dot');
  
  const result = spawnSync('mix', ['xref', 'graph', '--format', 'dot'], {
    cwd: SERVER_DIR,
    encoding: 'utf-8',
    shell: true,
    timeout: 60000,
  });

  if (result.stdout) {
    writeFileSync(dotPath, result.stdout);
    log(`Graph saved to: ${dotPath}`, 'green');
    log('Convert to SVG: dot -Tsvg elixir-xref-graph.dot -o elixir-xref-graph.svg', 'cyan');
    
    // Also try to get stats
    const stats = result.stdout.match(/\d+ vertices, \d+ edges/);
    if (stats) {
      log(`Graph: ${stats[0]}`, 'cyan');
    }
  }

  // Generate a simpler stats view
  const statsResult = spawnSync('mix', ['xref', 'graph', '--format', 'stats'], {
    cwd: SERVER_DIR,
    encoding: 'utf-8',
    shell: true,
    timeout: 60000,
  });

  if (statsResult.stdout) {
    log('\nModule Statistics:', 'cyan');
    console.log(statsResult.stdout);
    
    const statsPath = join(OUTPUT_DIR, 'elixir-xref-stats.txt');
    writeFileSync(statsPath, statsResult.stdout);
  }
}

/**
 * Run credo for code quality analysis
 */
function runCredo() {
  logSubsection('Running code quality analysis (mix credo)');

  // Check if credo is installed
  const checkResult = spawnSync('mix', ['credo', '--version'], {
    cwd: SERVER_DIR,
    encoding: 'utf-8',
    shell: true,
  });

  if (checkResult.status !== 0 || checkResult.stderr?.includes('could not be found')) {
    log('Credo not installed.', 'yellow');
    log('Add to mix.exs: {:credo, "~> 1.7", only: [:dev, :test], runtime: false}', 'cyan');
    log('Then run: mix deps.get', 'cyan');
    return null;
  }

  // Run credo
  const result = spawnSync('mix', ['credo', 'list', '--all'], {
    cwd: SERVER_DIR,
    encoding: 'utf-8',
    shell: true,
    timeout: 60000,
  });

  const output = (result.stdout || '') + (result.stderr || '');
  const lines = output.split('\n');

  const issues = {
    unused: [],
    consistency: [],
    readability: [],
    refactoring: [],
    warnings: [],
    design: [],
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('Checking') || trimmed.startsWith('Analysis')) continue;

    // Categorize by credo category markers
    if (trimmed.includes('[F]') || trimmed.includes('unused') || trimmed.includes('Unused')) {
      issues.unused.push(trimmed);
    } else if (trimmed.includes('[C]')) {
      issues.consistency.push(trimmed);
    } else if (trimmed.includes('[R]') && trimmed.toLowerCase().includes('readability')) {
      issues.readability.push(trimmed);
    } else if (trimmed.includes('[R]')) {
      issues.refactoring.push(trimmed);
    } else if (trimmed.includes('[W]')) {
      issues.warnings.push(trimmed);
    } else if (trimmed.includes('[D]')) {
      issues.design.push(trimmed);
    } else if (options.verbose && trimmed.includes('.ex')) {
      // Catch any other issues with file references
      issues.warnings.push(trimmed);
    }
  }

  // Display unused code issues (always)
  if (issues.unused.length > 0) {
    log(`\nUnused Code Issues (${issues.unused.length}):`, 'yellow');
    issues.unused.forEach(i => console.log(`  ${i}`));
  }

  // Display warnings (always)
  if (issues.warnings.length > 0) {
    log(`\nWarnings (${issues.warnings.length}):`, 'yellow');
    issues.warnings.forEach(i => console.log(`  ${i}`));
  }

  // Display other categories if verbose
  if (options.verbose) {
    if (issues.consistency.length > 0) {
      log(`\nConsistency Issues (${issues.consistency.length}):`, 'cyan');
      issues.consistency.slice(0, 10).forEach(i => console.log(`  ${i}`));
      if (issues.consistency.length > 10) console.log(`  ... and ${issues.consistency.length - 10} more`);
    }

    if (issues.readability.length > 0) {
      log(`\nReadability Issues (${issues.readability.length}):`, 'cyan');
      issues.readability.slice(0, 10).forEach(i => console.log(`  ${i}`));
      if (issues.readability.length > 10) console.log(`  ... and ${issues.readability.length - 10} more`);
    }

    if (issues.refactoring.length > 0) {
      log(`\nRefactoring Suggestions (${issues.refactoring.length}):`, 'cyan');
      issues.refactoring.slice(0, 10).forEach(i => console.log(`  ${i}`));
      if (issues.refactoring.length > 10) console.log(`  ... and ${issues.refactoring.length - 10} more`);
    }

    if (issues.design.length > 0) {
      log(`\nDesign Issues (${issues.design.length}):`, 'cyan');
      issues.design.slice(0, 10).forEach(i => console.log(`  ${i}`));
      if (issues.design.length > 10) console.log(`  ... and ${issues.design.length - 10} more`);
    }
  }

  if (issues.unused.length === 0 && issues.warnings.length === 0) {
    log('No unused code issues found by credo!', 'green');
  }

  return issues;
}

/**
 * Find modules that aren't referenced by any other modules
 */
function findOrphanModules() {
  logSubsection('Finding potentially orphan modules');

  // Get all modules
  const result = spawnSync('mix', ['xref', 'graph', '--sink', 'lib'], {
    cwd: SERVER_DIR,
    encoding: 'utf-8',
    shell: true,
    timeout: 60000,
  });

  // This is a basic check - modules with no incoming edges might be entry points or orphans
  const output = (result.stdout || '');
  
  if (output) {
    log('Sink modules (entry points or potentially unused):', 'cyan');
    const lines = output.split('\n').filter(l => l.trim()).slice(0, 20);
    lines.forEach(l => console.log(`  ${l}`));
    
    log('\nNote: Sink modules may be entry points (controllers, workers) or genuinely unused.', 'yellow');
    log('Verify manually before removing.', 'yellow');
  }
}

/**
 * Main execution
 */
async function main() {
  log('\n💧 Elixir Server Dead Code Analysis', 'bright');
  console.log('Analyzing: ' + SERVER_DIR + '\n');

  if (!checkMix()) {
    process.exit(1);
  }

  logSection('Compilation');
  const compileWarnings = compileProject();

  logSection('Cross-Reference Analysis');
  const unreachable = runXrefUnreachable();
  const deprecated = runXrefDeprecated();

  if (options.graph) {
    runXrefGraph();
  }

  logSection('Code Quality');
  const credoIssues = runCredo();

  logSection('Module Analysis');
  findOrphanModules();

  // Summary
  logSection('Summary');
  
  const totalIssues = 
    compileWarnings.length +
    unreachable.length +
    deprecated.length +
    (credoIssues?.unused?.length || 0) +
    (credoIssues?.warnings?.length || 0);

  if (totalIssues > 0) {
    log(`Found ${totalIssues} potential issues:`, 'yellow');
    console.log(`  - Compile warnings: ${compileWarnings.length}`);
    console.log(`  - Unreachable functions: ${unreachable.length}`);
    console.log(`  - Deprecated calls: ${deprecated.length}`);
    if (credoIssues) {
      console.log(`  - Credo unused: ${credoIssues.unused?.length || 0}`);
      console.log(`  - Credo warnings: ${credoIssues.warnings?.length || 0}`);
    }
  } else {
    log('No dead code issues found!', 'green');
  }

  log(`\nOutput files are in: ${OUTPUT_DIR}`, 'cyan');
  
  console.log('\n' + '-'.repeat(40));
  log('Useful Commands:', 'bright');
  console.log(`
  # Find callers of a specific module
  mix xref callers MyApp.SomeModule

  # Generate full dependency graph
  mix xref graph --format dot > deps.dot
  dot -Tsvg deps.dot -o deps.svg

  # Find circular dependencies
  mix xref graph --format cycles

  # Show compile-time dependencies
  mix xref graph --label compile
  `);
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
