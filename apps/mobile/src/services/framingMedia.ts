import * as DocumentPicker from 'expo-document-picker'
import * as FileSystem from 'expo-file-system/legacy'

export async function pickFramingMedia(): Promise<{
  uri: string
  name: string
  type: 'image' | 'video'
} | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['image/png', 'image/jpeg', 'image/webp', 'video/mp4', 'video/webm', 'video/quicktime'],
    copyToCacheDirectory: true
  })
  if (result.canceled || !result.assets[0]) return null
  const file = result.assets[0]
  if ((file.size ?? 0) > 128 * 1024 * 1024)
    throw new Error('Choose a media file smaller than 128 MB.')
  const directory = FileSystem.documentDirectory + 'framing-media/'
  await FileSystem.makeDirectoryAsync(directory, { intermediates: true })
  const uri =
    directory +
    Date.now() +
    '-' +
    Math.random().toString(36).slice(2, 8) +
    '-' +
    file.name.replace(/[^a-zA-Z0-9._-]/g, '_')
  await FileSystem.copyAsync({ from: file.uri, to: uri })
  return {
    uri,
    name: file.name,
    type:
      file.mimeType?.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)
        ? 'image'
        : 'video'
  }
}
