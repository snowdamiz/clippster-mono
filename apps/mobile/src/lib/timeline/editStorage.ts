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
