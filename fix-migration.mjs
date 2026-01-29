import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';

const dbPath = join(homedir(), 'AppData', 'Roaming', 'com.openworth.clippster', 'clippster_v25.db');
console.log('Opening database:', dbPath);

const SQL = await initSqlJs();
const fileBuffer = readFileSync(dbPath);
const db = new SQL.Database(fileBuffer);

// Show current migrations
console.log('\nCurrent migrations (last 15):');
const migrations = db.exec('SELECT version, description FROM _sqlx_migrations ORDER BY version DESC LIMIT 15');
if (migrations.length > 0) {
  migrations[0].values.forEach(row => console.log(`  ${row[0]}: ${row[1]}`));
}

// Check if source_start_time column exists
console.log('\nChecking video_editor_audio_tracks schema...');
const schema = db.exec('PRAGMA table_info(video_editor_audio_tracks)');
const hasSourceStartTime = schema[0]?.values.some(col => col[1] === 'source_start_time');
console.log('Has source_start_time column:', hasSourceStartTime);

if (!hasSourceStartTime) {
  console.log('\nAdding source_start_time column...');
  db.run('ALTER TABLE video_editor_audio_tracks ADD COLUMN source_start_time REAL NOT NULL DEFAULT 0');
  console.log('Column added successfully');
  
  // Update existing records
  console.log('Setting default values for existing records...');
  db.run('UPDATE video_editor_audio_tracks SET source_start_time = 0 WHERE source_start_time IS NULL');
  console.log('Updated existing records');
} else {
  console.log('Column already exists, skipping...');
}

// Save the database
const data = db.export();
const buffer = Buffer.from(data);
writeFileSync(dbPath, buffer);

db.close();
console.log('\nDone! You can now run the app.');
