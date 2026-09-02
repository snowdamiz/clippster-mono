import AsyncStorage from '@react-native-async-storage/async-storage';
import { migrateEditDocument, type EditDocument } from './editDocument';

function storageKey(kind: 'project' | 'clip', id: string): string {
  return `clippster.editDoc.v1.${kind}.${id}`;
}

export async function loadEditDocument(
  kind: 'project' | 'clip',
  id: string,
): Promise<EditDocument | null> {
  const raw = await AsyncStorage.getItem(storageKey(kind, id));
  if (!raw) return null;
  try {
    return migrateEditDocument(JSON.parse(raw));
  } catch {
    return null;
  }
}

export async function saveEditDocument(doc: EditDocument): Promise<void> {
  await AsyncStorage.setItem(storageKey(doc.kind, doc.targetId), JSON.stringify(doc));
}

/** Clip IDs that have a saved timeline edit doc (desktop "in-editor" retention). */
export async function listInEditorClipIds(): Promise<Set<string>> {
  const keys = await AsyncStorage.getAllKeys();
  const ids = new Set<string>();
  const clipPrefix = 'clippster.editDoc.v1.clip.';
  for (const key of keys) {
    if (key.startsWith(clipPrefix)) {
      ids.add(key.slice(clipPrefix.length));
    }
  }
  return ids;
}

export async function deleteEditDocument(
  kind: 'project' | 'clip',
  id: string,
): Promise<void> {
  await AsyncStorage.removeItem(storageKey(kind, id));
}
