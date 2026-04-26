/**
 * Persistent IndexedDB cache for filmstrip thumbnails.
 * Thumbnails are stored as JPEG Blobs so they survive remounts, scene
 * switches, and app restarts without re-decoding.
 *
 * Schema:
 *   DB: "clippster-filmstrip-cache"  version 1
 *   Store: "thumbnails"
 *     key: string  — "${mediaId}:${roundedTimestamp}"
 *     value: { blob: Blob, accessed: number }
 *
 * Eviction runs once at open time: entries older than 7 days or beyond
 * MAX_ENTRIES are deleted.
 */

const DB_NAME = "clippster-filmstrip-cache";
const DB_VERSION = 1;
const STORE_NAME = "thumbnails";
const MAX_ENTRIES = 2000;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface CacheRecord {
	blob: Blob;
	accessed: number;
}

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
	if (dbPromise) return dbPromise;

	dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
		const req = indexedDB.open(DB_NAME, DB_VERSION);

		req.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(STORE_NAME)) {
				const store = db.createObjectStore(STORE_NAME);
				store.createIndex("accessed", "accessed", { unique: false });
			}
		};

		req.onsuccess = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			// Fire-and-forget eviction on open
			evictOldEntries(db).catch(() => {});
			resolve(db);
		};

		req.onerror = () => reject(req.error);
	});

	return dbPromise;
}

async function evictOldEntries(db: IDBDatabase): Promise<void> {
	return new Promise((resolve) => {
		const tx = db.transaction(STORE_NAME, "readwrite");
		const store = tx.objectStore(STORE_NAME);
		const countReq = store.count();

		countReq.onsuccess = () => {
			const count = countReq.result;
			const cutoff = Date.now() - MAX_AGE_MS;
			const toDelete: IDBValidKey[] = [];

			const cursor = store.index("accessed").openCursor();
			let deleted = 0;

			cursor.onsuccess = (event) => {
				const c = (event.target as IDBRequest<IDBCursorWithValue>).result;
				if (!c) {
					// Delete expired entries
					for (const key of toDelete) {
						store.delete(key);
					}
					resolve();
					return;
				}

				const record = c.value as CacheRecord;
				const shouldDelete =
					record.accessed < cutoff ||
					deleted < count - MAX_ENTRIES;

				if (shouldDelete) {
					toDelete.push(c.primaryKey);
					deleted++;
				}

				c.continue();
			};

			cursor.onerror = () => resolve();
		};

		countReq.onerror = () => resolve();
	});
}

export async function filmstripCacheGet(key: string): Promise<Blob | null> {
	try {
		const db = await openDB();
		return new Promise((resolve) => {
			const tx = db.transaction(STORE_NAME, "readwrite");
			const store = tx.objectStore(STORE_NAME);
			const req = store.get(key);

			req.onsuccess = () => {
				const record = req.result as CacheRecord | undefined;
				if (!record) {
					resolve(null);
					return;
				}
				// Update access time
				store.put({ blob: record.blob, accessed: Date.now() }, key);
				resolve(record.blob);
			};

			req.onerror = () => resolve(null);
		});
	} catch {
		return null;
	}
}

export async function filmstripCachePut(key: string, blob: Blob): Promise<void> {
	try {
		const db = await openDB();
		return new Promise((resolve) => {
			const tx = db.transaction(STORE_NAME, "readwrite");
			const store = tx.objectStore(STORE_NAME);
			store.put({ blob, accessed: Date.now() }, key);
			tx.oncomplete = () => resolve();
			tx.onerror = () => resolve();
		});
	} catch {
		// Non-critical — ignore write failures
	}
}

export async function filmstripCacheClear(): Promise<void> {
	try {
		const db = await openDB();
		return new Promise((resolve) => {
			const tx = db.transaction(STORE_NAME, "readwrite");
			tx.objectStore(STORE_NAME).clear();
			tx.oncomplete = () => resolve();
			tx.onerror = () => resolve();
		});
	} catch {}
}
