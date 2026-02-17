#!/usr/bin/env node

/**
 * Wipes the Clippster SQLite database files.
 *
 * Database locations per platform (Tauri SQL plugin app_data_dir):
 *   macOS:   ~/Library/Application Support/com.openworth.clippster/
 *   Windows: %APPDATA%\com.openworth.clippster\
 *   Linux:   ~/.config/com.openworth.clippster/
 *
 * Database files:
 *   Production: clippster_v25.db
 *   Development: clippster_v25_dev.db
 */

import { existsSync, unlinkSync, readdirSync } from 'fs';
import { join } from 'path';
import { homedir, platform } from 'os';

const DB_FILES = ['clippster_v25.db', 'clippster_v25_dev.db'];

function getAppDataDir() {
  const home = homedir();
  switch (platform()) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'com.openworth.clippster');
    case 'win32':
      return join(process.env.APPDATA || join(home, 'AppData', 'Roaming'), 'com.openworth.clippster');
    case 'linux':
      return join(process.env.XDG_DATA_HOME || join(home, '.local', 'share'), 'com.openworth.clippster');
    default:
      console.error(`Unsupported platform: ${platform()}`);
      process.exit(1);
  }
}

const appDataDir = getAppDataDir();
console.log(`App data directory: ${appDataDir}`);

if (!existsSync(appDataDir)) {
  console.log('Directory does not exist — no databases to wipe.');
  process.exit(0);
}

let deleted = 0;

for (const file of DB_FILES) {
  const filePath = join(appDataDir, file);
  if (existsSync(filePath)) {
    unlinkSync(filePath);
    console.log(`Deleted: ${filePath}`);
    deleted++;
  }

  // Also remove WAL and SHM journal files if present
  for (const suffix of ['-wal', '-shm', '-journal']) {
    const journalPath = filePath + suffix;
    if (existsSync(journalPath)) {
      unlinkSync(journalPath);
      console.log(`Deleted: ${journalPath}`);
      deleted++;
    }
  }
}

if (deleted === 0) {
  console.log('No database files found.');
} else {
  console.log(`Done — removed ${deleted} file(s).`);
}
