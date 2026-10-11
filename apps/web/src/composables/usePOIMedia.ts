import { onUnmounted, ref } from 'vue'
import { framingAssetPath, errorMessage } from '../api'

export interface POIMediaAsset { id: string; name: string; type: 'image' | 'video' }
export function usePOIMedia(projectId: string) {
  const assets = ref<POIMediaAsset[]>([]), uploading = ref(false), error = ref('')
  const elements = new Map<string, HTMLImageElement | HTMLVideoElement>()
  function cache(asset: POIMediaAsset) {
    if (elements.has(asset.id)) return
    const element = asset.type === 'image' ? new Image() : document.createElement('video')
    element.src = framingAssetPath(projectId, asset.id)
    if (element instanceof HTMLVideoElement) { element.muted = true; element.preload = 'auto'; element.load() }
    elements.set(asset.id, element)
  }
  async function load() {
    try { const response = await fetch(framingAssetPath(projectId)); if (!response.ok) throw new Error('Unable to load framing media'); assets.value = (await response.json()).assets; assets.value.forEach(cache) }
    catch (cause) { error.value = errorMessage(cause) }
  }
  async function upload(file?: File) {
    if (!file) return
    uploading.value = true; error.value = ''
    try {
      const type = file.type.startsWith('image/') ? 'image' : 'video'
      const response = await fetch(`${framingAssetPath(projectId)}?${new URLSearchParams({ type, name: file.name })}`, { method: 'POST', headers: { 'Content-Type': 'application/octet-stream' }, body: file })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Media upload failed')
      assets.value.push(data.asset); cache(data.asset)
    } catch (cause) { error.value = errorMessage(cause) }
    finally { uploading.value = false }
  }
  async function importStock(url: string, type: 'image' | 'video', name: string) {
    uploading.value = true; error.value = ''
    try {
      const response = await fetch(`${framingAssetPath(projectId)}?${new URLSearchParams({ type, name, url })}`, { method: 'POST' })
      const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Stock import failed')
      assets.value.push(data.asset); cache(data.asset); return data.asset as POIMediaAsset
    } catch (cause) { error.value = errorMessage(cause) }
    finally { uploading.value = false }
  }
  onUnmounted(() => { for (const element of elements.values()) if (element instanceof HTMLVideoElement) { element.pause(); element.removeAttribute('src'); element.load() }; elements.clear() })
  return { assets, elements, uploading, error, load, upload, importStock }
}
