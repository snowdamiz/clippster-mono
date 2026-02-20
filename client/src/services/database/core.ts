import Database from '@tauri-apps/plugin-sql';
import { invoke } from '@tauri-apps/api/core';
import { BaseDirectory, exists, remove } from '@tauri-apps/plugin-fs';

let db: Database | null = null;
let initializing: Promise<Database> | null = null;

// Current user context for multi-user support
let currentUserId: number | null = null;

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
      const dbName = import.meta.env.DEV ? 'clippster_v25_dev.db' : 'clippster_v25.db';

      // In production, delete any existing database before initializing a fresh one
      if (!import.meta.env.DEV) {
        const appDirs = [
          { baseDir: BaseDirectory.AppConfig, label: 'AppConfig' },
          { baseDir: BaseDirectory.AppData, label: 'AppData' },
          { baseDir: BaseDirectory.AppLocalData, label: 'AppLocalData' },
        ];

        try {
          for (const { baseDir, label } of appDirs) {
            if (await exists(dbName, { baseDir })) {
              console.log(
                `[Database] Existing database found in ${label}, deleting before fresh init:`,
                dbName,
              );
              await remove(dbName, { baseDir });
            }
          }
        } catch (err) {
          console.error('[Database] Failed to check/delete existing database:', err);
        }
      }

      const instance = await Database.load(`sqlite:${dbName}`);

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

// ============================================
// User Context Management for Multi-User Support
// ============================================

/**
 * Set the current user ID for database queries.
 * Call this after successful authentication.
 */
export function setCurrentUserId(userId: number | null): void {
  currentUserId = userId;
  console.log('[Database] Current user ID set to:', userId);
}

/**
 * Get the current user ID for filtering database queries.
 * Returns null if no user is logged in.
 */
export function getCurrentUserId(): number | null {
  return currentUserId;
}

/**
 * Clear the current user ID on logout.
 */
export function clearCurrentUserId(): void {
  currentUserId = null;
  console.log('[Database] Current user ID cleared');
}

/**
 * Get the current user ID or throw an error if not set.
 * Use this for operations that require an authenticated user.
 */
export function requireCurrentUserId(): number {
  if (currentUserId === null) {
    throw new Error('No user is currently logged in. Please authenticate first.');
  }
  return currentUserId;
}

/**
 * Build a WHERE clause condition for user_id filtering.
 * Returns condition that matches current user OR null user_id (for backwards compatibility with existing data).
 */
export function getUserIdCondition(): string {
  if (currentUserId === null) {
    return 'user_id IS NULL';
  }
  return '(user_id = ? OR user_id IS NULL)';
}

/**
 * Get the parameters for user_id filtering.
 * Returns empty array if no user, or array with user_id if logged in.
 */
export function getUserIdParams(): (number | null)[] {
  if (currentUserId === null) {
    return [];
  }
  return [currentUserId];
}
