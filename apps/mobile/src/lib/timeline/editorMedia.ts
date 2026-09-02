import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

const MEDIA_DIR = `${FileSystem.documentDirectory}editor-media/`;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(MEDIA_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MEDIA_DIR, { intermediates: true });
  }
}

function extFromName(name: string, fallback: string): string {
  const match = name.match(/\.[a-zA-Z0-9]+$/);
  return match?.[0] ?? fallback;
}

export async function copyEditorAsset(sourceUri: string, filename: string): Promise<string> {
  await ensureDir();
  const dest = `${MEDIA_DIR}${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
  await FileSystem.copyAsync({ from: sourceUri, to: dest });
  return dest;
}

async function importPickedVideo(asset: {
  uri: string;
  fileName?: string | null;
  duration?: number | null;
}): Promise<{ path: string; duration: number; label: string }> {
  const filename = asset.fileName ?? `video${extFromName(asset.uri, '.mp4')}`;
  const path = await copyEditorAsset(asset.uri, filename);
  const rawDuration = asset.duration ?? 0;
  return {
    path,
    duration: rawDuration > 1000 ? rawDuration / 1000 : rawDuration,
    label: filename.replace(/\.[^.]+$/, ''),
  };
}

export async function recordEditorVideo(): Promise<{ path: string; duration: number; label: string } | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const picked = await ImagePicker.launchCameraAsync({
    mediaTypes: ['videos'],
    quality: 1,
    videoMaxDuration: 120,
  });
  if (picked.canceled || !picked.assets[0]) return null;
  return importPickedVideo(picked.assets[0]);
}

export async function pickEditorVideo(): Promise<{ path: string; duration: number; label: string } | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.granted) {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
    });
    if (!picked.canceled && picked.assets[0]) {
      return importPickedVideo(picked.assets[0]);
    }
  }

  const result = await DocumentPicker.getDocumentAsync({
    type: 'video/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const filename = asset.name ?? 'upload.mp4';
  return {
    path: await copyEditorAsset(asset.uri, filename),
    duration: 0,
    label: filename.replace(/\.[^.]+$/, ''),
  };
}

export async function pickEditorImage(): Promise<{ path: string; label: string } | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) return null;
  const picked = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 1,
  });
  if (picked.canceled || !picked.assets[0]) return null;
  const asset = picked.assets[0];
  const filename = asset.fileName ?? `image${extFromName(asset.uri, '.png')}`;
  return {
    path: await copyEditorAsset(asset.uri, filename),
    label: filename.replace(/\.[^.]+$/, ''),
  };
}

export async function pickEditorAudio(): Promise<{ path: string; label: string } | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  const asset = result.assets[0];
  const filename = asset.name ?? 'music.mp3';
  return {
    path: await copyEditorAsset(asset.uri, filename),
    label: filename.replace(/\.[^.]+$/, ''),
  };
}
