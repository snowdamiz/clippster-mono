#!/usr/bin/env node

/**
 * Rust/Tauri Dead Code Analysis Script
 * 
 * Analyzes the Rust codebase for:
 * - Dead code (unused functions, structs, enums, etc.)
 * - Unused dependencies
 * - Module structure visualization
 * 
 * Usage:
 *   node scripts/analyze-rust.mjs [--fix] [--verbose]
 * 
 * Options:
 *   --fix      Automatically apply clippy suggestions where safe
 *   --verbose  Show all warnings, not just dead code
 * 
 * Requirements:
 *   - Rust toolchain installed
 *   - Optional: cargo-udeps (cargo install cargo-udeps)
 *   - Optional: cargo-modules (cargo install cargo-modules)
 */

import { spawnSync, spawn } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const TAURI_DIR = join(ROOT_DIR, 'client', 'src-tauri');
const OUTPUT_DIR = join(ROOT_DIR, 'analysis-output');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  fix: args.includes('--fix'),
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
 * Check if cargo is available
 */
function checkCargo() {
  try {
    const result = spawnSync('cargo', ['--version'], { encoding: 'utf-8', shell: true });
    if (result.status === 0) {
      log(`Found: ${result.stdout.trim()}`, 'green');
      return true;
    }
  } catch {
    // ignore
  }
  log('Cargo not found. Please install Rust: https://rustup.rs/', 'red');
  return false;
}

/**
 * Run cargo clippy with dead_code and other useful lints
 * Uses streaming output so progress is visible during compilation
 */
async function runClippy() {
  logSubsection('Running cargo clippy');
  
  const warnings = {
    deadCode: [],
    unusedImports: [],
    unusedVariables: [],
    unusedMut: [],
    other: [],
  };

  // Build clippy arguments
  const clippyArgs = ['clippy', '--all-targets', '--message-format=short'];
  
  if (options.fix) {
    clippyArgs.push('--fix', '--allow-dirty', '--allow-staged');
  }
  
  clippyArgs.push('--', '-W', 'dead_code', '-W', 'unused_imports', '-W', 'unused_variables', '-W', 'unused_mut');

  log(`Running: cargo ${clippyArgs.join(' ')}`, 'cyan');
  log('(This may take a few minutes for initial compilation...)', 'yellow');
  
  // Use spawn for streaming output
  const output = await new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    
    const proc = spawn('cargo', clippyArgs, {
      cwd: TAURI_DIR,
      shell: true,
      stdio: ['inherit', 'pipe', 'pipe'],
    });

    proc.stdout.on('data', (data) => {
      const text = data.toString();
      stdout += text;
      // Show compilation progress
      if (text.includes('Compiling') || text.includes('Checking')) {
        process.stdout.write(colors.cyan + '.' + colors.reset);
      }
    });

    proc.stderr.on('data', (data) => {
      const text = data.toString();
      stderr += text;
      // Show compilation progress and warnings in real-time
      if (text.includes('Compiling') || text.includes('Checking')) {
        process.stdout.write(colors.cyan + '.' + colors.reset);
      } else if (text.includes('warning:') || text.includes('error:')) {
        // Show warnings/errors immediately
        console.log('\n' + text.trim());
      }
    });

    proc.on('close', (code) => {
      console.log(''); // New line after progress dots
      resolve(stdout + stderr);
    });

    proc.on('error', (err) => {
      reject(err);
    });

    // Timeout after 10 minutes
    setTimeout(() => {
      proc.kill();
      reject(new Error('Clippy timed out after 10 minutes'));
    }, 600000);
  });

  const lines = output.split('\n');

  // Parse warnings
  for (const line of lines) {
    if (line.includes('warning:')) {
      if (line.includes('never used') || line.includes('never read') || line.includes('dead_code')) {
        warnings.deadCode.push(line);
      } else if (line.includes('unused import')) {
        warnings.unusedImports.push(line);
      } else if (line.includes('unused variable')) {
        warnings.unusedVariables.push(line);
      } else if (line.includes('unused_mut') || line.includes('not need to be mutable')) {
        warnings.unusedMut.push(line);
      } else if (options.verbose) {
        warnings.other.push(line);
      }
    }
  }

  // Display summary
  console.log(''); // spacing
  if (warnings.deadCode.length > 0) {
    log(`Dead Code (${warnings.deadCode.length}):`, 'yellow');
    warnings.deadCode.forEach(w => console.log(`  ${w}`));
  } else {
    log('No dead code found!', 'green');
  }

  if (warnings.unusedImports.length > 0) {
    log(`\nUnused Imports (${warnings.unusedImports.length}):`, 'yellow');
    warnings.unusedImports.forEach(w => console.log(`  ${w}`));
  }

  if (warnings.unusedVariables.length > 0) {
    log(`\nUnused Variables (${warnings.unusedVariables.length}):`, 'yellow');
    warnings.unusedVariables.forEach(w => console.log(`  ${w}`));
  }

  if (warnings.unusedMut.length > 0) {
    log(`\nUnnecessary Mutable (${warnings.unusedMut.length}):`, 'yellow');
    warnings.unusedMut.forEach(w => console.log(`  ${w}`));
  }

  if (options.verbose && warnings.other.length > 0) {
    log(`\nOther Warnings (${warnings.other.length}):`, 'yellow');
    warnings.other.forEach(w => console.log(`  ${w}`));
  }

  return warnings;
}

/**
 * Run cargo-udeps to find unused dependencies
 */
function runUdeps() {
  logSubsection('Checking for unused dependencies');

  // Check if cargo-udeps is installed
  const checkResult = spawnSync('cargo', ['udeps', '--version'], {
    encoding: 'utf-8',
    shell: true,
  });

  if (checkResult.status !== 0) {
    log('cargo-udeps not installed.', 'yellow');
    log('Install with: cargo install cargo-udeps', 'cyan');
    log('Note: Requires nightly Rust (+nightly)', 'cyan');
    return null;
  }

  log('Running cargo +nightly udeps...', 'cyan');
  
  const result = spawnSync('cargo', ['+nightly', 'udeps', '--all-targets'], {
    cwd: TAURI_DIR,
    encoding: 'utf-8',
    shell: true,
    timeout: 300000,
  });

  const output = (result.stdout || '') + (result.stderr || '');
  
  const unusedDeps = [];
  const lines = output.split('\n');
  
  for (const line of lines) {
    if (line.includes('unused') || line.includes('crate')) {
      unusedDeps.push(line.trim());
    }
  }

  if (unusedDeps.length > 0) {
    log(`\nUnused Dependencies:`, 'yellow');
    unusedDeps.forEach(d => console.log(`  ${d}`));
  } else {
    log('No unused dependencies found!', 'green');
  }

  return unusedDeps;
}

/**
 * Run cargo-modules to visualize module structure
 */
function runModules() {
  logSubsection('Generating module structure');

  // Check if cargo-modules is installed
  const checkResult = spawnSync('cargo', ['modules', '--version'], {
    encoding: 'utf-8',
    shell: true,
  });

  if (checkResult.status !== 0) {
    log('cargo-modules not installed.', 'yellow');
    log('Install with: cargo install cargo-modules', 'cyan');
    return null;
  }

  log('Running cargo modules...', 'cyan');
  
  // Generate tree view
  const treeResult = spawnSync('cargo', ['modules', 'generate', 'tree', '--lib'], {
    cwd: TAURI_DIR,
    encoding: 'utf-8',
    shell: true,
    timeout: 60000,
  });

  if (treeResult.stdout) {
    const treePath = join(OUTPUT_DIR, 'rust-module-tree.txt');
    writeFileSync(treePath, treeResult.stdout);
    log(`Module tree saved to: ${treePath}`, 'green');
    
    // Show preview
    const lines = treeResult.stdout.split('\n').slice(0, 30);
    console.log('\nModule Tree Preview:');
    lines.forEach(l => console.log(`  ${l}`));
    if (treeResult.stdout.split('\n').length > 30) {
      console.log('  ...');
    }
  }

  // Generate graph in DOT format
  const graphResult = spawnSync('cargo', ['modules', 'generate', 'graph', '--lib'], {
    cwd: TAURI_DIR,
    encoding: 'utf-8',
    shell: true,
    timeout: 60000,
  });

  if (graphResult.stdout) {
    const graphPath = join(OUTPUT_DIR, 'rust-module-graph.dot');
    writeFileSync(graphPath, graphResult.stdout);
    log(`Module graph (DOT) saved to: ${graphPath}`, 'green');
    log('Convert to SVG: dot -Tsvg rust-module-graph.dot -o rust-module-graph.svg', 'cyan');
  }

  return true;
}

/**
 * Check for #[allow(dead_code)] annotations that might be hiding issues
 */
function findAllowDeadCode() {
  logSubsection('Checking for #[allow(dead_code)] annotations');

  const result = spawnSync('rg', ['--count', '#\\[allow\\(dead_code\\)\\]', '--type', 'rust'], {
    cwd: TAURI_DIR,
    encoding: 'utf-8',
    shell: true,
  });

  if (result.stdout) {
    const files = result.stdout.trim().split('\n').filter(l => l);
    if (files.length > 0) {
      log(`\nFiles with #[allow(dead_code)] (${files.length}):`, 'yellow');
      files.forEach(f => console.log(`  ${f}`));
      log('\nThese annotations may be hiding unused code.', 'cyan');
    }
  } else {
    log('No #[allow(dead_code)] annotations found.', 'green');
  }
}

/**
 * Main execution
 */
async function main() {
  log('\n🦀 Rust/Tauri Dead Code Analysis', 'bright');
  console.log('Analyzing: ' + TAURI_DIR + '\n');

  if (!checkCargo()) {
    process.exit(1);
  }

  logSection('Clippy Analysis');
  const clippyResults = await runClippy();

  logSection('Dependency Analysis');
  runUdeps();

  logSection('Module Structure');
  runModules();

  logSection('Code Annotations');
  findAllowDeadCode();

  // Summary
  logSection('Summary');
  
  const totalIssues = 
    clippyResults.deadCode.length +
    clippyResults.unusedImports.length +
    clippyResults.unusedVariables.length +
    clippyResults.unusedMut.length;

  if (totalIssues > 0) {
    log(`Found ${totalIssues} potential issues:`, 'yellow');
    console.log(`  - Dead code: ${clippyResults.deadCode.length}`);
    console.log(`  - Unused imports: ${clippyResults.unusedImports.length}`);
    console.log(`  - Unused variables: ${clippyResults.unusedVariables.length}`);
    console.log(`  - Unnecessary mut: ${clippyResults.unusedMut.length}`);
  } else {
    log('No dead code issues found!', 'green');
  }

  log(`\nOutput files are in: ${OUTPUT_DIR}`, 'cyan');
  
  if (!options.fix) {
    log('\nTip: Run with --fix to automatically fix some issues', 'cyan');
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
