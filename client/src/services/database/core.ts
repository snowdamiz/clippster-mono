import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';

let db: Database | null = null;
let initializing: Promise<Database> | null = null;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForRuntimeReady(timeoutMs = 7000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      // Any simple invoke ensures the runtime is ready for this window
      await invoke<string>('greet', { name: 'db-init' });
      return;
    } catch {
      // Not ready yet
    }
    await sleep(100);
  }
  throw new Error('Tauri runtime not ready');
}

// Initialize database connection
export async function initDatabase() {
  if (db) return db;
  if (initializing) return initializing;

  initializing = (async () => {
    try {
      await waitForRuntimeReady();
      const instance = await Database.load('sqlite:clippster_v21.db');

      db = instance;
      return instance;
    } catch (error) {
      // For now, just rethrow the error so we can see what's happening
      throw error;
    } finally {
      initializing = null;
    }
  })();

  return initializing;
}

// Get database instance
export async function getDatabase() {
  return await initDatabase();
}

// Helper to generate timestamps
export function timestamp(): number {
  return Math.floor(Date.now() / 1000);
}

// Helper to generate UUIDs (simple version)
export function generateId(): string {
  return crypto.randomUUID();
}
