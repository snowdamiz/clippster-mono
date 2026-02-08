import initSqlJs from 'sql.js';
import { readFileSync, writeFileSync } from 'fs';
import { createHash } from 'crypto';
import { homedir } from 'os';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

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

// Fix migration 81 checksum - SQLx stores checksum as a BLOB (raw bytes), not hex string
const migrationPath = join(__dirname, 'client', 'src-tauri', 'migrations', '081_add_source_start_time_to_audio_tracks.sql');
console.log('\nReading migration file:', migrationPath);
const migrationContent = readFileSync(migrationPath, 'utf8');
// SQLx uses SHA-384 and stores the raw bytes as a BLOB
const checksumBuffer = createHash('sha384').update(migrationContent).digest();
const checksumArray = Array.from(checksumBuffer);
console.log('New checksum (first 8 bytes):', checksumArray.slice(0, 8));

// Update the checksum in the database as a BLOB
console.log('\nUpdating migration 81 checksum...');
db.run('UPDATE _sqlx_migrations SET checksum = ? WHERE version = 81', [checksumArray]);
console.log('Checksum updated for migration 81');

// Verify the update
const verify = db.exec('SELECT version FROM _sqlx_migrations WHERE version = 81');
if (verify.length > 0) {
  console.log('Verified migration 81 exists');
}

// Save the database
const data = db.export();
const buffer = Buffer.from(data);
writeFileSync(dbPath, buffer);

db.close();
console.log('\nDone! You can now run the app.');
