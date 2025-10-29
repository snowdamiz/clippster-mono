import { ref, reactive } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { createRawVideo } from '@/services/database'
import { generateId } from '@/services/database'

// Event emitter for download completion notifications
const completionCallbacks = new Set<(download: ActiveDownload) => void>()

export interface DownloadProgress {
  download_id: string
  progress: number
  current_time?: number
  total_time?: number
  status: string
}

export interface DownloadResult {
  download_id: string
  success: boolean
  file_path?: string
  thumbnail_path?: string
  duration?: number
  width?: number
  height?: number
  codec?: string
  file_size?: number
  error?: string
}

export interface ActiveDownload {
  id: string
  title: string
  mintId: string
  progress: DownloadProgress
  result?: DownloadResult
  rawVideoId?: string
}

const activeDownloads = reactive<Map<string, ActiveDownload>>(new Map())
const isInitialized = ref(false)

export function useDownloads() {

  async function initialize() {
    if (isInitialized.value) {
      console.log('[Downloads] Already initialized')
      return
    }

    console.log('[Downloads] Initializing downloads system...')

    // Listen for download progress updates
    await listen<DownloadProgress>('download-progress', (event) => {
      console.log('[Downloads] Progress event received:', event.payload)
      const download = activeDownloads.get(event.payload.download_id)
      if (download) {
        download.progress = event.payload
        console.log('[Downloads] Progress updated for download:', download.id, event.payload.progress)
      } else {
        console.warn('[Downloads] Received progress for unknown download:', event.payload.download_id)
      }
    })

    // Listen for download completion
    await listen<DownloadResult>('download-complete', async (event) => {
      console.log('[Downloads] Completion event received:', event.payload)
      const download = activeDownloads.get(event.payload.download_id)
      if (download) {
        download.result = event.payload
        console.log('[Downloads] Download completed:', download.id, 'Success:', event.payload.success)

        // If download was successful, create database record
        if (event.payload.success && event.payload.file_path) {
          try {
            console.log('[Downloads] Creating database record for completed download')
            const rawVideoId = await createRawVideo(event.payload.file_path, {
              originalFilename: download.title,
              thumbnailPath: event.payload.thumbnail_path,
              duration: event.payload.duration,
              width: event.payload.width,
              height: event.payload.height,
              frameRate: undefined, // We don't have this info from the basic download
              codec: event.payload.codec,
              fileSize: event.payload.file_size,
            })

            download.rawVideoId = rawVideoId
            console.log('[Downloads] Database record created with ID:', rawVideoId)

            // Notify all listeners about completion
            completionCallbacks.forEach(callback => {
              try {
                callback(download)
              } catch (error) {
                console.error('[Downloads] Error in completion callback:', error)
              }
            })
          } catch (error) {
            console.error('Failed to create raw video record:', error)
          }
        }
      } else {
        console.warn('[Downloads] Received completion for unknown download:', event.payload.download_id)
      }
    })

    isInitialized.value = true
    console.log('[Downloads] Downloads system initialized successfully')
  }

  async function startDownload(
    title: string,
    videoUrl: string,
    mintId: string
  ): Promise<string> {
    console.log('[Downloads] startDownload called:', { title, videoUrl, mintId })

    await initialize()
    console.log('[Downloads] Downloads system initialized')

    const downloadId = generateId()
    console.log('[Downloads] Generated download ID:', downloadId)

    const download: ActiveDownload = {
      id: downloadId,
      title,
      mintId,
      progress: {
        download_id: downloadId,
        progress: 0,
        status: 'Initializing...',
      }
    }

    activeDownloads.set(downloadId, download)
    console.log('[Downloads] Download added to activeDownloads:', downloadId)

    try {
      console.log('[Downloads] Invoking download_pumpfun_vod command...')
      // Start the download without waiting for it to complete
      invoke('download_pumpfun_vod', {
        downloadId,
        title,
        videoUrl,
        mintId
      }).catch(error => {
        console.error('[Downloads] Error in download command (async):', error)
        // Remove from active downloads if failed to start
        activeDownloads.delete(downloadId)
        // We can't throw here since the async operation has already returned
      })
      console.log('[Downloads] download_pumpfun_vod command initiated successfully')
    } catch (error) {
      console.error('[Downloads] Error invoking download command:', error)
      // Remove from active downloads if failed to start
      activeDownloads.delete(downloadId)
      throw error
    }

    return downloadId
  }

  function getDownload(downloadId: string): ActiveDownload | undefined {
    return activeDownloads.get(downloadId)
  }

  function getAllDownloads(): ActiveDownload[] {
    return Array.from(activeDownloads.values())
  }

  function getActiveDownloads(): ActiveDownload[] {
    return Array.from(activeDownloads.values()).filter(
      download => !download.result || download.result.success === undefined
    )
  }

  function getCompletedDownloads(): ActiveDownload[] {
    return Array.from(activeDownloads.values()).filter(
      download => download.result && download.result.success !== undefined
    )
  }

  function removeDownload(downloadId: string): boolean {
    return activeDownloads.delete(downloadId)
  }

  function clearCompleted(): void {
    for (const [id, download] of activeDownloads.entries()) {
      if (download.result && download.result.success !== undefined) {
        activeDownloads.delete(id)
      }
    }
  }

  // Cleanup old completed downloads (older than 5 minutes)
  function cleanupOldDownloads(): void {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000

    for (const [id, download] of activeDownloads.entries()) {
      if (download.result && download.result.success !== undefined) {
        // If it's a completed download, remove it if it's older than 5 minutes
        // This prevents the downloads list from growing indefinitely
        if (Date.now() - fiveMinutesAgo > 0) {
          activeDownloads.delete(id)
        }
      }
    }
  }

  // Register a callback for download completion events
  function onDownloadComplete(callback: (download: ActiveDownload) => void): () => void {
    completionCallbacks.add(callback)

    // Return a function to unregister the callback
    return () => {
      completionCallbacks.delete(callback)
    }
  }

  return {
    activeDownloads,
    isInitialized,
    initialize,
    startDownload,
    getDownload,
    getAllDownloads,
    getActiveDownloads,
    getCompletedDownloads,
    removeDownload,
    clearCompleted,
    cleanupOldDownloads,
    onDownloadComplete,
  }
}