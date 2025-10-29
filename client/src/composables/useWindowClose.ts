import { ref } from 'vue'
import { listen } from '@tauri-apps/api/event'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWebviewWindow } from '@tauri-apps/api/webviewWindow'

const showCloseDialog = ref(false)
const activeDownloadsCount = ref(0)

export function useWindowClose() {

  async function initializeWindowCloseHandler() {
    console.log('[WindowClose] Initializing window close handler...')

    // Listen for window close events from Tauri
    await listen<number>('window-close-requested', (event) => {
      console.log('[WindowClose] Window close requested with active downloads:', event.payload)
      activeDownloadsCount.value = event.payload
      showCloseDialog.value = true
    })

    console.log('[WindowClose] Window close handler initialized')
  }

  async function confirmCloseWithCleanup() {
    console.log('[WindowClose] User confirmed close, cleaning up downloads...')

    try {
      // Cancel all active downloads and clean up partial files
      const cancelledDownloads = await invoke<string[]>('cancel_all_downloads')
      console.log('[WindowClose] Cancelled downloads:', cancelledDownloads)

      // Close the window
      const window = getCurrentWebviewWindow()
      await window.close()

      return true
    } catch (error) {
      console.error('[WindowClose] Failed to cleanup downloads:', error)
      // Still close the window even if cleanup failed
      const window = getCurrentWebviewWindow()
      await window.close()
      return true
    }
  }

  function cancelClose() {
    console.log('[WindowClose] User cancelled close')
    showCloseDialog.value = false
    activeDownloadsCount.value = 0
  }

  return {
    showCloseDialog,
    activeDownloadsCount,
    initializeWindowCloseHandler,
    confirmCloseWithCleanup,
    cancelClose
  }
}