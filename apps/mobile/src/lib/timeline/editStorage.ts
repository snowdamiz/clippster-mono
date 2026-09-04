import AsyncStorage from '@react-native-async-storage/async-storage';

function storageKey(kind: 'project' | 'clip', id: string): string {
  return `clippster.editDoc.v1.${kind}.${id}`;
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
