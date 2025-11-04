import { ref, onUnmounted } from 'vue'

interface ProgressUpdate {
  stage: string
  progress: number
  message: string | null
  timestamp: string
}

export function useProgressSocket(initialProjectId: string | null) {
  const isConnected = ref(false)
  const progress = ref(0)
  const stage = ref('')
  const message = ref('')
  const error = ref('')
  const projectId = ref(initialProjectId)
  let socket: any = null
  let channel: any = null

  const connect = () => {
    if (!projectId.value) {
      return
    }

    if (socket) {
      disconnect()
    }

    try {
      // Import Phoenix Socket dynamically to avoid SSR issues
      import('phoenix')
        .then(({ Socket }) => {
          const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
          const wsUrl = API_BASE.replace('http://', 'ws://').replace('https://', 'wss://')
          const socketUrl = `${wsUrl}/socket`

          socket = new Socket(socketUrl, {
            params: {},
            heartbeatIntervalMs: 30000,
            reconnectAfterMs: (tries: number) => {
              return [1000, 2000, 5000, 10000][tries - 1] || 10000
            }
          })

          socket.connect()

          channel = socket.channel(`progress:${projectId.value}`)

          channel.on('progress_update', (update: ProgressUpdate) => {
            progress.value = update.progress
            stage.value = update.stage
            message.value = update.message || ''
            error.value = update.stage === 'error' ? update.message || 'Unknown error' : ''
          })

          channel.onClose(() => {
            isConnected.value = false
          })

          channel.onError((err: any) => {
            console.error('[ProgressSocket] ❌ Channel error:', err)
            error.value = 'Connection error: ' + JSON.stringify(err)
          })

          channel
            .join()
            .receive('ok', (resp: any) => {
              console.log(
                '[ProgressSocket] ✅ Successfully joined progress channel for project:',
                projectId.value,
                resp
              )
              isConnected.value = true
              error.value = ''
            })
            .receive('error', (err: any) => {
              console.error('[ProgressSocket] ❌ Failed to join channel:', err)
              error.value = 'Failed to connect to progress updates: ' + JSON.stringify(err)
              isConnected.value = false
            })
            .receive('timeout', () => {
              console.error('[ProgressSocket] ⏰ Channel join timeout')
              error.value = 'Connection timeout'
              isConnected.value = false
            })

          socket.onOpen(() => {
            console.log('[ProgressSocket] 🔗 Socket connected')
            isConnected.value = true
          })

          socket.onClose(() => {
            console.log('[ProgressSocket] 🔌 Socket disconnected')
            isConnected.value = false
          })

          socket.onError((err: any) => {
            console.error('[ProgressSocket] ❌ Socket error:', err)
            error.value = 'Socket connection error: ' + JSON.stringify(err)
          })
        })
        .catch((err) => {
          console.error('[ProgressSocket] Failed to import Phoenix:', err)
          error.value = 'Failed to load WebSocket library'
        })
    } catch (err) {
      console.error('[ProgressSocket] Failed to initialize socket:', err)
      error.value = 'Failed to initialize connection: ' + String(err)
    }
  }

  const disconnect = () => {
    if (channel) {
      channel.leave()
      channel = null
    }
    if (socket) {
      socket.disconnect()
      socket = null
    }
    isConnected.value = false
  }

  const reset = () => {
    progress.value = 0
    stage.value = ''
    message.value = ''
    error.value = ''
  }

  // Update projectId and reconnect
  const setProjectId = (newProjectId: string | null) => {
    // Only disconnect and reconnect if the project ID actually changed
    if (projectId.value === newProjectId) {
      console.log('[ProgressSocket] Project ID unchanged, skipping reconnect')
      return
    }

    projectId.value = newProjectId
    disconnect()
    reset()
    if (newProjectId) {
      connect()
    }
  }

  // Cleanup on unmount
  onUnmounted(() => {
    disconnect()
  })

  return {
    isConnected,
    progress,
    stage,
    message,
    error,
    connect,
    disconnect,
    reset,
    setProjectId
  }
}
