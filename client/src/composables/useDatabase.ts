import Database from '@tauri-apps/plugin-sql';

let db: Database | null = null;

export async function useDatabase() {
  if (!db) {
    db = await Database.load('sqlite:clippster_v25.db');
  }
  return db;
}

// Example usage:
// const db = await useDatabase()
// await db.execute('CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, name TEXT)')
// await db.execute('INSERT INTO users (name) VALUES (?)', ['John Doe'])
// const result = await db.select('SELECT * FROM users')
