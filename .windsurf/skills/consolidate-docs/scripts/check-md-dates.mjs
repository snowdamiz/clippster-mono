#!/usr/bin/env node

/**
 * Scans the project for all .md files and outputs their paths with
 * creation and modification timestamps, sorted by most recently modified.
 * 
 * Usage: node check-md-dates.mjs [directory]
 * Default directory: current working directory
 * 
 * Output format (JSON):
 * {
 *   "files": [
 *     { "path": "relative/path.md", "modified": "ISO date", "created": "ISO date", "age_days": number }
 *   ],
 *   "summary": { "total": number, "newest": "path", "oldest": "path" }
 * }
 */

import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const EXCLUDE_PATTERNS = [
  /node_modules/,
  /\.git\//,
  /dist\//,
  /build\//,
  /\.cursor\/plans\//,
  /__DND\.md$/,
];

async function findMdFiles(dir, baseDir = dir) {
  const files = [];
  
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = join(dir, entry.name);
      const relativePath = relative(baseDir, fullPath);
      
      // Skip excluded patterns
      if (EXCLUDE_PATTERNS.some(pattern => pattern.test(relativePath))) {
        continue;
      }
      
      if (entry.isDirectory()) {
        const subFiles = await findMdFiles(fullPath, baseDir);
        files.push(...subFiles);
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        try {
          const stats = await stat(fullPath);
          const now = Date.now();
          const modifiedMs = stats.mtimeMs;
          const createdMs = stats.birthtimeMs;
          
          files.push({
            path: relativePath,
            modified: new Date(modifiedMs).toISOString(),
            created: new Date(createdMs).toISOString(),
            modified_ms: modifiedMs,
            age_days: Math.floor((now - modifiedMs) / (1000 * 60 * 60 * 24)),
          });
        } catch (e) {
          // Skip files we can't stat
        }
      }
    }
  } catch (e) {
    // Skip directories we can't read
  }
  
  return files;
}

async function main() {
  const targetDir = process.argv[2] || process.cwd();
  
  const files = await findMdFiles(targetDir);
  
  // Sort by modified date, newest first
  files.sort((a, b) => b.modified_ms - a.modified_ms);
  
  // Remove internal field
  const cleanedFiles = files.map(({ modified_ms, ...rest }) => rest);
  
  const result = {
    scanned_at: new Date().toISOString(),
    base_directory: targetDir,
    files: cleanedFiles,
    summary: {
      total: files.length,
      newest: files[0]?.path || null,
      newest_date: files[0]?.modified || null,
      oldest: files[files.length - 1]?.path || null,
      oldest_date: files[files.length - 1]?.modified || null,
    },
  };
  
  console.log(JSON.stringify(result, null, 2));
}

main().catch(console.error);
