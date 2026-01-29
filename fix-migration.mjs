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

// Delete migration 81
console.log('\nDeleting migration 81...');
db.run('DELETE FROM _sqlx_migrations WHERE version = 81');
console.log('Deleted migration 81');

// Verify
console.log('\nMigrations after deletion (last 15):');
const after = db.exec('SELECT version, description FROM _sqlx_migrations ORDER BY version DESC LIMIT 15');
if (after.length > 0) {
  after[0].values.forEach(row => console.log(`  ${row[0]}: ${row[1]}`));
}

// Save the database
const data = db.export();
const buffer = Buffer.from(data);
writeFileSync(dbPath, buffer);

db.close();
console.log('\nDone! You can now run the app.');
