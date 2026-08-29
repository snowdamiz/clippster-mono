import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { importLocalVideo } from '@/services/downloadQueue';

export async function recordAndImportLocalVideo(): Promise<string | null> {
  const permission = await ImagePicker.requestCameraPermissionsAsync();
  if (!permission.granted) return null;
  const picked = await ImagePicker.launchCameraAsync({
    mediaTypes: ['videos'],
    quality: 1,
    videoMaxDuration: 120,
  });
  if (picked.canceled || !picked.assets[0]) return null;
  const asset = picked.assets[0];
  const filename = asset.fileName ?? `camera-${Date.now()}.mp4`;
  return importLocalVideo({
    sourceUri: asset.uri,
    filename,
    title: filename.replace(/\.[^.]+$/, ''),
  });
}

export async function pickAndImportLocalVideo(): Promise<string | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (permission.granted) {
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['videos'],
      quality: 1,
    });
    if (!picked.canceled && picked.assets[0]) {
      const asset = picked.assets[0];
      const filename = asset.fileName ?? `camera-roll-${Date.now()}.mp4`;
      return importLocalVideo({
        sourceUri: asset.uri,
        filename,
        title: filename.replace(/\.[^.]+$/, ''),
      });
    }
  }

  const result = await DocumentPicker.getDocumentAsync({
    type: 'video/*',
    copyToCacheDirectory: true,
  });
  if (result.canceled || !result.assets?.[0]) return null;

  const asset = result.assets[0];
  return importLocalVideo({
    sourceUri: asset.uri,
    filename: asset.name ?? 'imported.mp4',
    title: asset.name?.replace(/\.[^.]+$/, '') ?? 'Imported video',
  });
}
