#!/usr/bin/env node

/**
 * Codebase Analysis Script
 * 
 * Analyzes the codebase for:
 * - Unused files and exports (knip)
 * - Orphan files and circular dependencies (madge)
 * - Dead code in Rust (cargo clippy)
 * - Dead code in Elixir (mix xref)
 * 
 * Usage:
 *   node scripts/analyze-codebase.mjs [--vue] [--rust] [--elixir] [--all] [--json] [--html]
 * 
 * Options:
 *   --vue      Analyze Vue/TypeScript client (default if no options)
 *   --rust     Analyze Rust/Tauri backend
 *   --elixir   Analyze Elixir server
 *   --all      Analyze all parts of the codebase
 *   --json     Output results as JSON
 *   --html     Generate HTML report
 *   --graph    Generate dependency graph SVG (Vue only)
 */

import { execSync, spawnSync, spawn } from 'child_process';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = join(__dirname, '..');
const CLIENT_DIR = join(ROOT_DIR, 'client');
const TAURI_DIR = join(ROOT_DIR, 'client', 'src-tauri');
const SERVER_DIR = join(ROOT_DIR, 'server');
const OUTPUT_DIR = join(ROOT_DIR, 'analysis-output');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
  vue: args.includes('--vue') || args.includes('--all') || (!args.includes('--rust') && !args.includes('--elixir')),
  rust: args.includes('--rust') || args.includes('--all'),
  elixir: args.includes('--elixir') || args.includes('--all'),
  json: args.includes('--json'),
  html: args.includes('--html'),
  graph: args.includes('--graph'),
};

// Ensure output directory exists
if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Color helpers for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
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
 * Analyze Vue/TypeScript client using knip and madge
 */
async function analyzeVueClient() {
  logSection('Vue/TypeScript Client Analysis');
  
  const results = {
    knip: { unusedFiles: [], unusedExports: [], unusedDependencies: [], errors: [] },
    madge: { orphans: [], circular: [], errors: [] },
  };

  // Run knip
  logSubsection('Running knip (unused files, exports, dependencies)');
  try {
    const knipResult = spawnSync('npx', ['knip', '--reporter', 'json'], {
      cwd: CLIENT_DIR,
      encoding: 'utf-8',
      shell: true,
      timeout: 120000,
    });

    if (knipResult.stdout) {
      try {
        const knipData = JSON.parse(knipResult.stdout);
        results.knip.unusedFiles = knipData.files || [];
        results.knip.unusedExports = knipData.exports || [];
        results.knip.unusedDependencies = knipData.dependencies || [];
      } catch (parseError) {
        // Knip outputs text when there are no issues
        if (knipResult.stdout.includes('no issues found')) {
          log('No unused code found by knip!', 'green');
        } else {
          results.knip.errors.push(`Parse error: ${parseError.message}`);
        }
      }
    }

    if (knipResult.stderr && !knipResult.stderr.includes('no issues found')) {
      results.knip.errors.push(knipResult.stderr);
    }

    // Display knip results
    if (results.knip.unusedFiles.length > 0) {
      log(`\nUnused Files (${results.knip.unusedFiles.length}):`, 'yellow');
      results.knip.unusedFiles.forEach(file => console.log(`  - ${file}`));
    }

    if (results.knip.unusedExports.length > 0) {
      log(`\nUnused Exports (${results.knip.unusedExports.length}):`, 'yellow');
      results.knip.unusedExports.slice(0, 20).forEach(exp => {
        console.log(`  - ${exp.name} in ${exp.file || exp.path}`);
      });
      if (results.knip.unusedExports.length > 20) {
        console.log(`  ... and ${results.knip.unusedExports.length - 20} more`);
      }
    }

    if (results.knip.unusedDependencies.length > 0) {
      log(`\nUnused Dependencies (${results.knip.unusedDependencies.length}):`, 'yellow');
      results.knip.unusedDependencies.forEach(dep => console.log(`  - ${dep}`));
    }

  } catch (error) {
    results.knip.errors.push(error.message);
    log(`Error running knip: ${error.message}`, 'red');
  }

  // Run madge for orphans (only .ts files - madge can't parse Vue SFCs properly)
  logSubsection('Running madge (orphan files)');
  try {
    const madgeOrphansResult = spawnSync('npx', ['madge', '--orphans', '--extensions', 'ts', '--exclude', '\\.vue$', 'src/'], {
      cwd: CLIENT_DIR,
      encoding: 'utf-8',
      shell: true,
      timeout: 60000,
    });

    if (madgeOrphansResult.stdout) {
      const orphans = madgeOrphansResult.stdout
        .split('\n')
        .map(line => line.trim())
        .filter(line => line && !line.startsWith('Processed') && !line.startsWith('Skipped'));
      
      results.madge.orphans = orphans;
      
      if (orphans.length > 0) {
        log(`\nOrphan Files (${orphans.length}):`, 'yellow');
        orphans.forEach(file => console.log(`  - ${file}`));
      } else {
        log('No orphan files found!', 'green');
      }
    }

    if (madgeOrphansResult.stderr) {
      // Filter out warnings about skipped files
      const errors = madgeOrphansResult.stderr
        .split('\n')
        .filter(line => !line.includes('Skipping') && line.trim());
      if (errors.length > 0) {
        results.madge.errors.push(...errors);
      }
    }
  } catch (error) {
    results.madge.errors.push(error.message);
    log(`Error running madge orphans: ${error.message}`, 'red');
  }

  // Run madge for circular dependencies (only .ts files - madge can't parse Vue SFCs properly)
  logSubsection('Running madge (circular dependencies)');
  try {
    const madgeCircularResult = spawnSync('npx', ['madge', '--circular', '--extensions', 'ts', '--exclude', '\\.vue$', 'src/'], {
      cwd: CLIENT_DIR,
      encoding: 'utf-8',
      shell: true,
      timeout: 60000,
    });

    if (madgeCircularResult.stdout) {
      const lines = madgeCircularResult.stdout.split('\n').filter(line => line.trim());
      const circularStart = lines.findIndex(line => line.includes('Circular'));
      
      if (circularStart !== -1 || lines.some(line => line.includes('->'))) {
        results.madge.circular = lines.filter(line => line.includes('->') || line.includes('.ts') || line.includes('.vue'));
        
        if (results.madge.circular.length > 0) {
          log(`\nCircular Dependencies (${results.madge.circular.length}):`, 'yellow');
          results.madge.circular.forEach(dep => console.log(`  ${dep}`));
        }
      } else {
        log('No circular dependencies found!', 'green');
      }
    }
  } catch (error) {
    results.madge.errors.push(error.message);
    log(`Error running madge circular: ${error.message}`, 'red');
  }

  // Generate dependency graph if requested (only .ts files - madge can't parse Vue SFCs properly)
  if (options.graph) {
    logSubsection('Generating dependency graph');
    try {
      const graphPath = join(OUTPUT_DIR, 'ts-dependency-graph.svg');
      spawnSync('npx', ['madge', '--image', graphPath, '--extensions', 'ts', '--exclude', '\\.vue$', 'src/'], {
        cwd: CLIENT_DIR,
        encoding: 'utf-8',
        shell: true,
        timeout: 120000,
      });
      log(`Dependency graph saved to: ${graphPath}`, 'green');
      log('Note: Graph only includes .ts files (madge cannot parse Vue SFCs)', 'yellow');
    } catch (error) {
      log(`Error generating graph: ${error.message}`, 'red');
    }
  }

  return results;
}

/**
 * Analyze Rust/Tauri backend using cargo clippy
 */
async function analyzeRustBackend() {
  logSection('Rust/Tauri Backend Analysis');
  
  const results = {
    deadCode: [],
    unusedDependencies: [],
    errors: [],
  };

  // Check if cargo is available
  try {
    execSync('cargo --version', { encoding: 'utf-8' });
  } catch {
    log('Cargo not found. Please install Rust to analyze the Tauri backend.', 'yellow');
    results.errors.push('Cargo not installed');
    return results;
  }

  // Run cargo clippy with dead_code warnings
  logSubsection('Running cargo clippy (dead code detection)');
  log('(This may take a few minutes for initial compilation...)', 'yellow');
  
  try {
    // Use spawn for streaming output so user sees progress
    const output = await new Promise((resolve, reject) => {
      let stdout = '';
      let stderr = '';
      
      const proc = spawn('cargo', ['clippy', '--message-format=short', '--', '-W', 'dead_code'], {
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
        // Show compilation progress
        if (text.includes('Compiling') || text.includes('Checking')) {
          process.stdout.write(colors.cyan + '.' + colors.reset);
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

    // Parse dead code warnings
    const deadCodePattern = /warning: (.*?) is never (used|read|constructed)/gi;
    const matches = output.matchAll(deadCodePattern);

    for (const match of matches) {
      results.deadCode.push(match[0]);
    }

    // Also look for unused import warnings
    const unusedPattern = /warning: unused (import|variable|function|struct|enum)/gi;
    const unusedMatches = output.matchAll(unusedPattern);

    for (const match of unusedMatches) {
      results.deadCode.push(match[0]);
    }

    if (results.deadCode.length > 0) {
      log(`\nDead Code Warnings (${results.deadCode.length}):`, 'yellow');
      results.deadCode.slice(0, 30).forEach(warning => console.log(`  ${warning}`));
      if (results.deadCode.length > 30) {
        console.log(`  ... and ${results.deadCode.length - 30} more`);
      }
    } else {
      log('No dead code warnings from clippy!', 'green');
    }

    // Show full output for review
    if (output.includes('warning:')) {
      log('\nFull clippy output available. Run with --json for details.', 'cyan');
    }

  } catch (error) {
    results.errors.push(error.message);
    log(`Error running cargo clippy: ${error.message}`, 'red');
  }

  // Try to run cargo-udeps if installed
  logSubsection('Checking for unused dependencies (cargo-udeps)');
  try {
    const udepsCheck = spawnSync('cargo', ['udeps', '--version'], {
      encoding: 'utf-8',
      shell: true,
    });

    if (udepsCheck.status === 0) {
      log('Running cargo udeps (this requires nightly Rust)...', 'cyan');
      const udepsResult = spawnSync('cargo', ['+nightly', 'udeps', '--all-targets'], {
        cwd: TAURI_DIR,
        encoding: 'utf-8',
        shell: true,
        timeout: 300000,
      });

      const output = udepsResult.stdout + udepsResult.stderr;
      if (output.includes('unused')) {
        results.unusedDependencies = output.split('\n').filter(line => line.includes('unused'));
        log(`\nUnused Dependencies:`, 'yellow');
        results.unusedDependencies.forEach(dep => console.log(`  ${dep}`));
      } else {
        log('No unused dependencies found!', 'green');
      }
    } else {
      log('cargo-udeps not installed. Install with: cargo install cargo-udeps', 'yellow');
      log('Note: cargo-udeps requires nightly Rust', 'yellow');
    }
  } catch {
    log('cargo-udeps not available. Skipping unused dependency check.', 'yellow');
  }

  return results;
}

/**
 * Analyze Elixir server using mix xref and credo
 */
async function analyzeElixirServer() {
  logSection('Elixir Server Analysis');
  
  const results = {
    unreachable: [],
    deprecated: [],
    credo: [],
    errors: [],
  };

  // Check if mix is available
  try {
    execSync('mix --version', { encoding: 'utf-8' });
  } catch {
    log('Mix not found. Please install Elixir to analyze the server.', 'yellow');
    results.errors.push('Mix not installed');
    return results;
  }

  // Run mix xref for unreachable code
  logSubsection('Running mix xref (cross-reference analysis)');
  try {
    // First, compile the project
    log('Compiling project...', 'cyan');
    spawnSync('mix', ['compile'], {
      cwd: SERVER_DIR,
      encoding: 'utf-8',
      shell: true,
      timeout: 120000,
    });

    // Run xref unreachable
    const xrefResult = spawnSync('mix', ['xref', 'unreachable'], {
      cwd: SERVER_DIR,
      encoding: 'utf-8',
      shell: true,
      timeout: 60000,
    });

    const output = xrefResult.stdout + xrefResult.stderr;
    
    if (output.includes('no unreachable')) {
      log('No unreachable code found!', 'green');
    } else {
      const lines = output.split('\n').filter(line => line.trim() && !line.includes('Compiling'));
      results.unreachable = lines;
      
      if (lines.length > 0) {
        log(`\nUnreachable Code:`, 'yellow');
        lines.forEach(line => console.log(`  ${line}`));
      }
    }

    // Run xref deprecated
    const deprecatedResult = spawnSync('mix', ['xref', 'deprecated'], {
      cwd: SERVER_DIR,
      encoding: 'utf-8',
      shell: true,
      timeout: 60000,
    });

    const deprecatedOutput = deprecatedResult.stdout + deprecatedResult.stderr;
    
    if (!deprecatedOutput.includes('no deprecated')) {
      const deprecatedLines = deprecatedOutput.split('\n').filter(line => line.trim() && !line.includes('Compiling'));
      results.deprecated = deprecatedLines;
      
      if (deprecatedLines.length > 0) {
        log(`\nDeprecated Function Calls:`, 'yellow');
        deprecatedLines.forEach(line => console.log(`  ${line}`));
      }
    }

  } catch (error) {
    results.errors.push(error.message);
    log(`Error running mix xref: ${error.message}`, 'red');
  }

  // Run mix credo if available
  logSubsection('Running mix credo (code quality)');
  try {
    const credoCheck = spawnSync('mix', ['credo', '--version'], {
      cwd: SERVER_DIR,
      encoding: 'utf-8',
      shell: true,
    });

    if (credoCheck.status === 0) {
      const credoResult = spawnSync('mix', ['credo', 'list', '--all', '--format', 'oneline'], {
        cwd: SERVER_DIR,
        encoding: 'utf-8',
        shell: true,
        timeout: 60000,
      });

      const output = credoResult.stdout;
      
      // Filter for unused-related issues
      const unusedIssues = output.split('\n').filter(line => 
        line.toLowerCase().includes('unused') || 
        line.toLowerCase().includes('dead')
      );

      if (unusedIssues.length > 0) {
        results.credo = unusedIssues;
        log(`\nCredo Unused/Dead Code Issues:`, 'yellow');
        unusedIssues.forEach(issue => console.log(`  ${issue}`));
      } else {
        log('No unused code issues from credo!', 'green');
      }
    } else {
      log('Credo not installed. Add {:credo, "~> 1.7", only: [:dev, :test]} to mix.exs', 'yellow');
    }
  } catch {
    log('Credo not available. Skipping code quality check.', 'yellow');
  }

  // Generate xref graph
  logSubsection('Generating cross-reference graph');
  try {
    const graphPath = join(OUTPUT_DIR, 'elixir-xref-graph.dot');
    spawnSync('mix', ['xref', 'graph', '--format', 'dot', '--output', graphPath], {
      cwd: SERVER_DIR,
      encoding: 'utf-8',
      shell: true,
      timeout: 60000,
    });
    
    if (existsSync(graphPath)) {
      log(`Cross-reference graph saved to: ${graphPath}`, 'green');
      log('Convert to SVG with: dot -Tsvg elixir-xref-graph.dot -o elixir-xref-graph.svg', 'cyan');
    }
  } catch (error) {
    log(`Error generating xref graph: ${error.message}`, 'yellow');
  }

  return results;
}

/**
 * Generate HTML report
 */
function generateHtmlReport(allResults) {
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Codebase Analysis Report</title>
  <style>
    * { box-sizing: border-box; }
    body { 
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      line-height: 1.6;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    h1 { color: #333; border-bottom: 2px solid #007acc; padding-bottom: 10px; }
    h2 { color: #007acc; margin-top: 30px; }
    h3 { color: #666; }
    .section {
      background: white;
      border-radius: 8px;
      padding: 20px;
      margin: 20px 0;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .warning { color: #b45309; }
    .success { color: #059669; }
    .error { color: #dc2626; }
    .count { 
      display: inline-block;
      background: #e5e7eb;
      color: #374151;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 14px;
      margin-left: 8px;
    }
    .count.warning { background: #fef3c7; color: #92400e; }
    .count.success { background: #d1fae5; color: #065f46; }
    ul { padding-left: 20px; }
    li { margin: 5px 0; font-family: monospace; font-size: 14px; }
    .timestamp { color: #888; font-size: 14px; }
    .summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 15px;
      margin: 20px 0;
    }
    .summary-card {
      background: white;
      padding: 15px;
      border-radius: 8px;
      text-align: center;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .summary-card .number {
      font-size: 32px;
      font-weight: bold;
      color: #007acc;
    }
    .summary-card.warning .number { color: #b45309; }
    .summary-card.success .number { color: #059669; }
    pre {
      background: #1e1e1e;
      color: #d4d4d4;
      padding: 15px;
      border-radius: 6px;
      overflow-x: auto;
      font-size: 13px;
    }
  </style>
</head>
<body>
  <h1>Codebase Analysis Report</h1>
  <p class="timestamp">Generated: ${new Date().toLocaleString()}</p>

  ${allResults.vue ? `
  <div class="section">
    <h2>Vue/TypeScript Client</h2>
    
    <div class="summary">
      <div class="summary-card ${allResults.vue.knip.unusedFiles.length > 0 ? 'warning' : 'success'}">
        <div class="number">${allResults.vue.knip.unusedFiles.length}</div>
        <div>Unused Files</div>
      </div>
      <div class="summary-card ${allResults.vue.knip.unusedExports.length > 0 ? 'warning' : 'success'}">
        <div class="number">${allResults.vue.knip.unusedExports.length}</div>
        <div>Unused Exports</div>
      </div>
      <div class="summary-card ${allResults.vue.madge.orphans.length > 0 ? 'warning' : 'success'}">
        <div class="number">${allResults.vue.madge.orphans.length}</div>
        <div>Orphan Files</div>
      </div>
      <div class="summary-card ${allResults.vue.madge.circular.length > 0 ? 'warning' : 'success'}">
        <div class="number">${allResults.vue.madge.circular.length}</div>
        <div>Circular Dependencies</div>
      </div>
    </div>

    ${allResults.vue.knip.unusedFiles.length > 0 ? `
    <h3>Unused Files <span class="count warning">${allResults.vue.knip.unusedFiles.length}</span></h3>
    <ul>
      ${allResults.vue.knip.unusedFiles.map(f => `<li>${f}</li>`).join('\n      ')}
    </ul>
    ` : '<p class="success">No unused files found!</p>'}

    ${allResults.vue.knip.unusedExports.length > 0 ? `
    <h3>Unused Exports <span class="count warning">${allResults.vue.knip.unusedExports.length}</span></h3>
    <ul>
      ${allResults.vue.knip.unusedExports.slice(0, 50).map(e => `<li>${e.name || e} - ${e.file || e.path || ''}</li>`).join('\n      ')}
      ${allResults.vue.knip.unusedExports.length > 50 ? `<li>... and ${allResults.vue.knip.unusedExports.length - 50} more</li>` : ''}
    </ul>
    ` : ''}

    ${allResults.vue.madge.orphans.length > 0 ? `
    <h3>Orphan Files <span class="count warning">${allResults.vue.madge.orphans.length}</span></h3>
    <ul>
      ${allResults.vue.madge.orphans.map(f => `<li>${f}</li>`).join('\n      ')}
    </ul>
    ` : ''}

    ${allResults.vue.madge.circular.length > 0 ? `
    <h3>Circular Dependencies <span class="count warning">${allResults.vue.madge.circular.length}</span></h3>
    <pre>${allResults.vue.madge.circular.join('\n')}</pre>
    ` : ''}
  </div>
  ` : ''}

  ${allResults.rust ? `
  <div class="section">
    <h2>Rust/Tauri Backend</h2>
    
    <div class="summary">
      <div class="summary-card ${allResults.rust.deadCode.length > 0 ? 'warning' : 'success'}">
        <div class="number">${allResults.rust.deadCode.length}</div>
        <div>Dead Code Warnings</div>
      </div>
      <div class="summary-card ${allResults.rust.unusedDependencies.length > 0 ? 'warning' : 'success'}">
        <div class="number">${allResults.rust.unusedDependencies.length}</div>
        <div>Unused Dependencies</div>
      </div>
    </div>

    ${allResults.rust.deadCode.length > 0 ? `
    <h3>Dead Code Warnings</h3>
    <pre>${allResults.rust.deadCode.slice(0, 50).join('\n')}${allResults.rust.deadCode.length > 50 ? `\n... and ${allResults.rust.deadCode.length - 50} more` : ''}</pre>
    ` : '<p class="success">No dead code warnings!</p>'}

    ${allResults.rust.errors.length > 0 ? `
    <h3 class="error">Errors</h3>
    <pre>${allResults.rust.errors.join('\n')}</pre>
    ` : ''}
  </div>
  ` : ''}

  ${allResults.elixir ? `
  <div class="section">
    <h2>Elixir Server</h2>
    
    <div class="summary">
      <div class="summary-card ${allResults.elixir.unreachable.length > 0 ? 'warning' : 'success'}">
        <div class="number">${allResults.elixir.unreachable.length}</div>
        <div>Unreachable Functions</div>
      </div>
      <div class="summary-card ${allResults.elixir.deprecated.length > 0 ? 'warning' : 'success'}">
        <div class="number">${allResults.elixir.deprecated.length}</div>
        <div>Deprecated Calls</div>
      </div>
    </div>

    ${allResults.elixir.unreachable.length > 0 ? `
    <h3>Unreachable Code</h3>
    <pre>${allResults.elixir.unreachable.join('\n')}</pre>
    ` : '<p class="success">No unreachable code found!</p>'}

    ${allResults.elixir.deprecated.length > 0 ? `
    <h3>Deprecated Function Calls</h3>
    <pre>${allResults.elixir.deprecated.join('\n')}</pre>
    ` : ''}

    ${allResults.elixir.credo.length > 0 ? `
    <h3>Credo Issues</h3>
    <pre>${allResults.elixir.credo.join('\n')}</pre>
    ` : ''}

    ${allResults.elixir.errors.length > 0 ? `
    <h3 class="error">Errors</h3>
    <pre>${allResults.elixir.errors.join('\n')}</pre>
    ` : ''}
  </div>
  ` : ''}

  <div class="section">
    <h2>How to Use This Report</h2>
    <ol>
      <li><strong>Review unused files</strong> - These files are not imported anywhere and may be safe to delete</li>
      <li><strong>Check unused exports</strong> - Functions/components that are exported but never imported</li>
      <li><strong>Fix circular dependencies</strong> - These can cause issues and should be refactored</li>
      <li><strong>Verify before deleting</strong> - Some "unused" code may be used dynamically or via string references</li>
    </ol>
    
    <h3>Commands for Further Analysis</h3>
    <pre>
# Vue/TypeScript
cd client && npx knip              # Full unused code analysis
cd client && npx madge --circular src/  # Check circular deps
cd client && npx madge --image graph.svg src/  # Generate visual graph

# Rust
cd client/src-tauri && cargo clippy -- -W dead_code
cargo +nightly udeps  # Requires: cargo install cargo-udeps

# Elixir
cd server && mix xref unreachable
cd server && mix xref graph --format dot
    </pre>
  </div>
</body>
</html>`;

  const reportPath = join(OUTPUT_DIR, 'analysis-report.html');
  writeFileSync(reportPath, html);
  log(`\nHTML report saved to: ${reportPath}`, 'green');
}

/**
 * Main execution
 */
async function main() {
  log('\n🔍 Codebase Analysis Tool', 'bright');
  log('Analyzing for unused files, exports, and dead code...\n', 'cyan');

  const allResults = {};

  if (options.vue) {
    allResults.vue = await analyzeVueClient();
  }

  if (options.rust) {
    allResults.rust = await analyzeRustBackend();
  }

  if (options.elixir) {
    allResults.elixir = await analyzeElixirServer();
  }

  // Output JSON if requested
  if (options.json) {
    const jsonPath = join(OUTPUT_DIR, 'analysis-results.json');
    writeFileSync(jsonPath, JSON.stringify(allResults, null, 2));
    log(`\nJSON results saved to: ${jsonPath}`, 'green');
  }

  // Generate HTML report if requested
  if (options.html) {
    generateHtmlReport(allResults);
  }

  // Summary
  logSection('Analysis Complete');
  
  if (options.vue) {
    const vueIssues = 
      (allResults.vue?.knip?.unusedFiles?.length || 0) +
      (allResults.vue?.knip?.unusedExports?.length || 0) +
      (allResults.vue?.madge?.orphans?.length || 0) +
      (allResults.vue?.madge?.circular?.length || 0);
    log(`Vue/TypeScript: ${vueIssues} potential issues found`, vueIssues > 0 ? 'yellow' : 'green');
  }

  if (options.rust) {
    const rustIssues = 
      (allResults.rust?.deadCode?.length || 0) +
      (allResults.rust?.unusedDependencies?.length || 0);
    log(`Rust/Tauri: ${rustIssues} potential issues found`, rustIssues > 0 ? 'yellow' : 'green');
  }

  if (options.elixir) {
    const elixirIssues = 
      (allResults.elixir?.unreachable?.length || 0) +
      (allResults.elixir?.deprecated?.length || 0) +
      (allResults.elixir?.credo?.length || 0);
    log(`Elixir: ${elixirIssues} potential issues found`, elixirIssues > 0 ? 'yellow' : 'green');
  }

  log(`\nOutput directory: ${OUTPUT_DIR}`, 'cyan');
  log('\nTip: Run with --html for a detailed HTML report', 'cyan');
  log('Tip: Run with --graph to generate dependency visualization', 'cyan');
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
