import AsyncStorage from '@react-native-async-storage/async-storage'

export type ClipVersionPreference = 'raw' | 'edited'

const key = (clipId: string) => `clippster.clipVersion.${clipId}`

export async function getClipVersionPreference(clipId: string): Promise<ClipVersionPreference> {
  return (await AsyncStorage.getItem(key(clipId))) === 'edited' ? 'edited' : 'raw'
}

export async function setClipVersionPreference(clipId: string, version: ClipVersionPreference): Promise<void> {
  await AsyncStorage.setItem(key(clipId), version)
}

export async function clearClipVersionPreference(clipId: string): Promise<void> {
  await AsyncStorage.removeItem(key(clipId))
}
