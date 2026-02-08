/**
 * Storage Service - Tauri SQLite Backend
 * 
 * This re-exports the Tauri storage adapter which replaces
 * OpenCut's IndexedDB/OPFS browser storage with Tauri SQLite.
 */
export { storageService, StorageService } from "./tauri-storage-adapter";
