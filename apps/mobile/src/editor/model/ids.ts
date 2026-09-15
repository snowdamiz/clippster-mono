import type { EditorId } from './schema';

export type EditorIdFactory = (prefix: string) => EditorId;

export function createDeterministicEditorIdFactory(namespace: string): EditorIdFactory {
  let sequence = 0;
  const safeNamespace = namespace.replace(/[^a-zA-Z0-9_-]/g, '_');
  return (prefix) => `${prefix}_${safeNamespace}_${sequence++}`;
}

export function deterministicMigrationId(prefix: string, documentKey: string, index: number): EditorId {
  const safeKey = documentKey.replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${prefix}_migrated_${safeKey}_${index}`;
}
