import { ref } from 'vue'
import { createRawVideo, deleteRawVideo, type RawVideo } from '@/services/database'
import { open } from '@tauri-apps/plugin-dialog'
import { invoke } from '@tauri-apps/api/core'
import { useToast } from '@/composables/useToast'

export function useVideoOperations() {
  const uploading = ref(false)
  const { success, error } = useToast()

  async function uploadVideo() {
    if (uploading.value) return { success: false }

    try {
      // Open file dialog with video file filters
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Video',
          extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v']
        }]
      })

      if (!selected) return { success: false, cancelled: true } // User cancelled

      uploading.value = true

      // Copy video to storage directory
      const result = await invoke<{ destination_path: string; original_filename: string }>('copy_video_to_storage', {
        sourcePath: selected
      })

      // Generate thumbnail
      let thumbnailPath: string | undefined
      try {
        thumbnailPath = await invoke<string>('generate_thumbnail', {
          videoPath: result.destination_path
        })
      } catch (error) {
        console.warn('Failed to generate thumbnail:', error)
      }

      // Create raw_videos record with original filename and thumbnail
      await createRawVideo(result.destination_path, {
        originalFilename: result.original_filename,
        thumbnailPath
      })

      // Show success toast
      success('Video uploaded', `"${result.original_filename}" has been uploaded successfully`)

      return {
        success: true,
        video: {
          destination_path: result.destination_path,
          original_filename: result.original_filename,
          thumbnail_path: thumbnailPath
        }
      }
    } catch (err) {
      console.error('Failed to upload video:', err)
      error('Upload failed', `Failed to upload video: ${err}`)
      return { success: false, error: err }
    } finally {
      uploading.value = false
    }
  }

  async function deleteVideo(video: RawVideo) {
    const deletedVideoName = video.original_filename || video.file_path.split(/[\\\/]/).pop() || 'Video'

    try {
      // Delete video file but preserve thumbnail for project cards
      await invoke('delete_video_file', {
        filePath: video.file_path,
        thumbnailPath: undefined // Don't delete the thumbnail
      })

      // Delete the database record completely
      await deleteRawVideo(video.id)

      // Show success toast
      success('Video deleted', `"${deletedVideoName}" has been deleted successfully`)

      return { success: true }
    } catch (err) {
      console.error('Failed to delete video:', err)
      error('Delete failed', `Failed to delete video: ${err}`)
      return { success: false, error: err }
    }
  }

  async function loadVideoThumbnail(video: RawVideo, cache: Map<string, string>) {
    if (video.thumbnail_path && !cache.has(video.id)) {
      try {
        const dataUrl = await invoke<string>('read_file_as_data_url', {
          filePath: video.thumbnail_path
        })
        cache.set(video.id, dataUrl)
        return dataUrl
      } catch (error) {
        console.warn('Failed to load thumbnail for video:', video.id, error)
        return null
      }
    }
    return cache.get(video.id) || null
  }

  async function prepareVideoForPlayback(video: RawVideo) {
    try {
      // Get video server port
      const port = await invoke<number>('get_video_server_port')
      // Encode file path as base64 for URL
      const encodedPath = btoa(video.file_path)
      return `http://localhost:${port}/video/${encodedPath}`
    } catch (err) {
      console.error('Failed to prepare video:', err)
      throw err
    }
  }

  return {
    uploading,
    uploadVideo,
    deleteVideo,
    loadVideoThumbnail,
    prepareVideoForPlayback
  }
}