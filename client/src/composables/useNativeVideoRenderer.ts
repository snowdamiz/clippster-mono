import { ref, onUnmounted, computed, type Ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'

/**
 * Event-driven video renderer using Rust playback engine
 * 
 * Step 1: Push model - Rust owns timing, emits frame slot events
 * No RAF loop, no per-frame invoke calls
 */
interface ProxyPaths {
  original: string
  proxy_720p: string
  proxy_1080p: string
}

export function useNativeVideoRenderer(canvasRef: Ref<HTMLCanvasElement | null>) {
  const isPlaying = ref(false)
  const currentTime = ref(0)
  const duration = ref(0)
  const videoPath = ref<string | null>(null)
  const dimensions = ref<{ width: number; height: number } | null>(null)
  const isFullscreen = ref(false)
  const proxyPaths = ref<ProxyPaths | null>(null)
  const proxiesReady = ref(false)
  
  let unlistenFrame: UnlistenFn | null = null
  let gl: WebGLRenderingContext | null = null
  let texture: WebGLTexture | null = null
  let program: WebGLProgram | null = null
  let vertexBuffer: WebGLBuffer | null = null
  let positionLoc: number = -1
  let texCoordLoc: number = -1
  let playbackEngineStarted = false // Track if playback engine is running
  let pendingFrameRender: number | null = null // For canceling pending RAF

  function initWebGL() {
    if (!canvasRef.value) {
      console.warn('[useNativeVideoRenderer] initWebGL: no canvas ref')
      return false
    }
    
    gl = canvasRef.value.getContext('webgl', { 
      alpha: false,
      antialias: false,
      preserveDrawingBuffer: true
    })
    
    if (!gl) {
      console.error('[useNativeVideoRenderer] WebGL not supported')
      return false
    }
    
    console.log('[useNativeVideoRenderer] WebGL context created')
    
    // Vertex shader - simple fullscreen quad
    const vertexShaderSource = `
      attribute vec2 a_position;
      attribute vec2 a_texCoord;
      varying vec2 v_texCoord;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
        v_texCoord = a_texCoord;
      }
    `
    
    // Fragment shader - sample texture
    const fragmentShaderSource = `
      precision mediump float;
      varying vec2 v_texCoord;
      uniform sampler2D u_texture;
      void main() {
        gl_FragColor = texture2D(u_texture, v_texCoord);
      }
    `
    
    const vertexShader = gl.createShader(gl.VERTEX_SHADER)!
    gl.shaderSource(vertexShader, vertexShaderSource)
    gl.compileShader(vertexShader)
    
    const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER)!
    gl.shaderSource(fragmentShader, fragmentShaderSource)
    gl.compileShader(fragmentShader)
    
    program = gl.createProgram()!
    gl.attachShader(program, vertexShader)
    gl.attachShader(program, fragmentShader)
    gl.linkProgram(program)
    gl.useProgram(program)
    
    // Create fullscreen quad
    const positions = new Float32Array([
      -1, -1,  0, 1,
       1, -1,  1, 1,
      -1,  1,  0, 0,
       1,  1,  1, 0
    ])
    
    vertexBuffer = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW)
    
    positionLoc = gl.getAttribLocation(program, 'a_position')
    texCoordLoc = gl.getAttribLocation(program, 'a_texCoord')
    
    gl.enableVertexAttribArray(positionLoc)
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 16, 0)
    
    gl.enableVertexAttribArray(texCoordLoc)
    gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 16, 8)
    
    // Create texture
    texture = gl.createTexture()
    gl.bindTexture(gl.TEXTURE_2D, texture)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
    
    // Set pixel unpack alignment to 1 for tightly packed RGBA data
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1)
    
    console.log('[useNativeVideoRenderer] WebGL initialized successfully, texture created')
    return true
  }

  async function loadVideo(path: string) {
    videoPath.value = path
    currentTime.value = 0
    proxiesReady.value = false
    proxyPaths.value = null
    
    try {
      const [width, height] = await invoke<[number, number]>('get_video_dimensions', {
        videoPath: path
      })
      
      dimensions.value = { width, height }
      
      if (canvasRef.value) {
        canvasRef.value.width = width
        canvasRef.value.height = height
        
        // Initialize WebGL
        if (!gl) {
          initWebGL()
        }
      }
      
      console.log('[useNativeVideoRenderer] Video loaded:', path, dimensions.value)
      
      // Generate proxies in background (non-blocking)
      generateProxies(path)
    } catch (error) {
      console.error('[useNativeVideoRenderer] Failed to load video:', error)
      throw error
    }
  }
  
  async function generateProxies(path: string) {
    try {
      console.log('[useNativeVideoRenderer] Checking/generating proxies for:', path)
      
      // First check if proxies already exist
      const existing = await invoke<ProxyPaths>('get_video_proxy_paths', { videoPath: path })
      
      if (existing.proxy_720p && existing.proxy_1080p) {
        console.log('[useNativeVideoRenderer] Proxies already exist')
        proxyPaths.value = existing
        proxiesReady.value = true
        return
      }
      
      // Generate missing proxies (this may take a while)
      console.log('[useNativeVideoRenderer] Generating proxies (this may take a moment)...')
      const generated = await invoke<ProxyPaths>('generate_video_proxies', { videoPath: path })
      
      proxyPaths.value = generated
      proxiesReady.value = true
      console.log('[useNativeVideoRenderer] Proxies ready:', generated)
    } catch (error) {
      console.warn('[useNativeVideoRenderer] Failed to generate proxies, will use original:', error)
      // Don't throw - we can still play the original
    }
  }

  async function startPlayback() {
    if (!videoPath.value) {
      console.error('[useNativeVideoRenderer] No video path set')
      return
    }

    // Prevent starting multiple playback engines
    if (playbackEngineStarted) {
      console.log('[useNativeVideoRenderer] Playback engine already started, sending play command')
      await invoke('resume_playback')
      isPlaying.value = true
      return
    }

    try {
      console.log('[useNativeVideoRenderer] Starting Rust playback engine for:', videoPath.value)
      
      // Determine which proxy to use based on fullscreen state
      const useProxy = proxiesReady.value 
        ? (isFullscreen.value ? '1080p' : '720p')
        : null
      
      console.log(`[useNativeVideoRenderer] Using proxy: ${useProxy || 'none (original)'}`)
      
      // Start Rust playback engine (spawns background thread with audio clock)
      await invoke('start_playback', {
        videoPath: videoPath.value,
        useProxy
      })
      
      playbackEngineStarted = true
      
      // Listen for frame events from Rust (slot-based - only slot ID sent, not 8MB of pixels)
      if (!unlistenFrame) {
        let frameCount = 0
        let latestSlot = -1
        let latestTime = 0
        let isRendering = false
        
        // Render loop - only render the latest frame, skip stale frames
        const renderLatestFrame = async () => {
          if (isRendering || latestSlot < 0) return
          
          isRendering = true
          const slotToRender = latestSlot
          
          try {
            const pixels = await invoke<number[]>('read_frame_slot', { slotId: slotToRender })
            if (pixels && pixels.length > 0) {
              const pixelData = new Uint8Array(pixels)
              uploadAndRender(pixelData)
            }
          } catch (error) {
            // Slot may have been overwritten, that's ok
          }
          
          isRendering = false
          
          // If a newer frame arrived while we were rendering, render it
          if (latestSlot !== slotToRender && isPlaying.value) {
            requestAnimationFrame(renderLatestFrame)
          }
        }
        
        unlistenFrame = await listen<{ time: number; sequence: number; slot: number; width: number; height: number }>(
          'playback:frame',
          (event) => {
            const { time, slot, width, height } = event.payload
            
            frameCount++
            if (frameCount <= 3 || frameCount % 30 === 0) {
              console.log(`[useNativeVideoRenderer] Frame ${frameCount}: time=${time.toFixed(2)}, slot=${slot}, ${width}x${height}`)
            }
            
            // Update current time from Rust audio clock
            currentTime.value = time
            
            // Update dimensions if changed
            if (!dimensions.value || dimensions.value.width !== width || dimensions.value.height !== height) {
              console.log(`[useNativeVideoRenderer] Dimensions updated: ${width}x${height}`)
              dimensions.value = { width, height }
              if (canvasRef.value) {
                canvasRef.value.width = width
                canvasRef.value.height = height
              }
            }
            
            // Store latest frame info (always update, even if older frames are still rendering)
            latestSlot = slot
            latestTime = time
            
            // Trigger render if not already rendering
            if (!isRendering) {
              requestAnimationFrame(renderLatestFrame)
            }
          }
        )
      }
      
      isPlaying.value = true
      console.log('[useNativeVideoRenderer] Playback engine started successfully')
    } catch (error) {
      console.error('[useNativeVideoRenderer] Failed to start playback:', error)
      playbackEngineStarted = false
    }
  }

  let renderCount = 0
  
  function uploadAndRender(pixels: Uint8Array) {
    if (!gl || !texture || !dimensions.value || !canvasRef.value) {
      console.warn('[useNativeVideoRenderer] uploadAndRender skipped:', {
        gl: !!gl,
        texture: !!texture,
        dimensions: !!dimensions.value,
        canvasRef: !!canvasRef.value,
        pixelsLength: pixels?.length
      })
      return
    }

    const { width, height } = dimensions.value
    
    renderCount++
    
    // Debug: use middle of frame for checksum (first 1000 bytes may be static region)
    if (renderCount <= 5 || renderCount % 60 === 0) {
      const mid = Math.floor(pixels.length / 2)
      const checksum = pixels.slice(mid, mid + 100).reduce((a, b) => a + b, 0)
      const pixel0 = [pixels[0], pixels[1], pixels[2], pixels[3]]
      const pixelMid = [pixels[mid], pixels[mid+1], pixels[mid+2], pixels[mid+3]]
      console.log(`[useNativeVideoRenderer] Render ${renderCount}: ${width}x${height}, mid_checksum=${checksum}, pixel0=[${pixel0}], pixelMid=[${pixelMid}], canvas=${canvasRef.value.width}x${canvasRef.value.height}`)
    }

    // Ensure viewport matches canvas size
    gl.viewport(0, 0, canvasRef.value.width, canvasRef.value.height)
    
    // Clear canvas
    gl.clearColor(0, 0, 0, 1)
    gl.clear(gl.COLOR_BUFFER_BIT)
    
    // Use the shader program (must be set before each draw)
    if (program) {
      gl.useProgram(program)
    }
    
    // Re-bind vertex buffer and set up attribute pointers (WebGL state can be lost)
    if (vertexBuffer) {
      gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer)
      gl.enableVertexAttribArray(positionLoc)
      gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 16, 0)
      gl.enableVertexAttribArray(texCoordLoc)
      gl.vertexAttribPointer(texCoordLoc, 2, gl.FLOAT, false, 16, 8)
    }
    
    // Bind texture and upload RGBA pixels
    gl.bindTexture(gl.TEXTURE_2D, texture)
    
    // Use texImage2D for upload (recreates texture each frame - simpler and works)
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      width,
      height,
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      pixels
    )
    
    // Check for WebGL errors
    const texError = gl.getError()
    if (texError !== gl.NO_ERROR && renderCount <= 5) {
      console.error(`[useNativeVideoRenderer] WebGL texImage2D error: ${texError}`)
    }

    // Draw fullscreen quad with texture
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    
    // Check for draw errors
    const drawError = gl.getError()
    if (drawError !== gl.NO_ERROR && renderCount <= 5) {
      console.error(`[useNativeVideoRenderer] WebGL drawArrays error: ${drawError}`)
    }
    
    // Force flush to ensure rendering happens immediately
    gl.flush()
  }

  async function play() {
    if (isPlaying.value) return
    
    if (!videoPath.value) {
      console.error('[useNativeVideoRenderer] Cannot play: no video loaded')
      return
    }
    
    // Start or resume playback
    await startPlayback()
  }

  async function pause() {
    if (!isPlaying.value) return
    
    try {
      await invoke('pause_playback')
      isPlaying.value = false
    } catch (error) {
      console.error('[useNativeVideoRenderer] Failed to pause:', error)
    }
  }

  async function seek(time: number) {
    currentTime.value = time
    
    // Tell Rust to seek
    try {
      await invoke('seek_playback', { time })
    } catch (error) {
      console.warn('[useNativeVideoRenderer] Seek command failed:', error)
    }
    
    // Fetch and render the frame at the seek position using get_video_frame (for scrubbing)
    if (videoPath.value && dimensions.value) {
      try {
        const pixels = await invoke<number[]>('get_video_frame', {
          videoPath: videoPath.value,
          timestamp: time
        })
        
        if (pixels && pixels.length > 0) {
          const pixelData = new Uint8Array(pixels)
          uploadAndRender(pixelData)
        }
      } catch (error) {
        console.warn('[useNativeVideoRenderer] Seek frame fetch failed:', error)
      }
    }
  }

  function setDuration(dur: number) {
    duration.value = dur
  }

  async function stop() {
    try {
      // Stop Rust playback engine
      if (playbackEngineStarted) {
        await invoke('stop_playback')
        playbackEngineStarted = false
      }
      
      isPlaying.value = false
      currentTime.value = 0
      
      // Cancel pending frame render
      if (pendingFrameRender !== null) {
        cancelAnimationFrame(pendingFrameRender)
        pendingFrameRender = null
      }
      
      // Clean up event listener
      if (unlistenFrame) {
        unlistenFrame()
        unlistenFrame = null
      }
      
    } catch (error) {
      console.error('[useNativeVideoRenderer] Failed to stop:', error)
    }
  }

  // Fullscreen handling - switch between 720p and 1080p proxy
  function handleFullscreenChange() {
    const wasFullscreen = isFullscreen.value
    isFullscreen.value = !!document.fullscreenElement
    
    // If fullscreen state changed and we're playing, restart with appropriate proxy
    if (wasFullscreen !== isFullscreen.value && playbackEngineStarted && proxiesReady.value) {
      console.log(`[useNativeVideoRenderer] Fullscreen changed: ${wasFullscreen} -> ${isFullscreen.value}`)
      restartWithProxy()
    }
  }
  
  async function restartWithProxy() {
    if (!videoPath.value || !proxiesReady.value) return
    
    const wasPlaying = isPlaying.value
    const currentPos = currentTime.value
    
    try {
      // Stop current playback
      await invoke('stop_playback')
      playbackEngineStarted = false
      
      // Clean up listener
      if (unlistenFrame) {
        unlistenFrame()
        unlistenFrame = null
      }
      
      // Restart with new proxy
      if (wasPlaying) {
        await startPlayback()
        // Seek to previous position
        if (currentPos > 0) {
          await seek(currentPos)
        }
      }
    } catch (error) {
      console.error('[useNativeVideoRenderer] Failed to restart with proxy:', error)
    }
  }
  
  async function setFullscreen(element: HTMLElement | null) {
    if (element && !document.fullscreenElement) {
      await element.requestFullscreen()
    } else if (document.fullscreenElement) {
      await document.exitFullscreen()
    }
  }
  
  // Add fullscreen event listener
  document.addEventListener('fullscreenchange', handleFullscreenChange)

  onUnmounted(() => {
    stop()
    document.removeEventListener('fullscreenchange', handleFullscreenChange)
  })

  const playbackRate = ref(1.0)
  
  async function setPlaybackRate(rate: number) {
    playbackRate.value = rate
    // TODO: Implement playback rate in Rust engine
    console.log('[useNativeVideoRenderer] setPlaybackRate not yet implemented:', rate)
  }
  
  async function clearCache() {
    try {
      await invoke('clear_frame_cache')
    } catch (error) {
      console.error('[useNativeVideoRenderer] Failed to clear cache:', error)
    }
  }
  
  async function getCacheStats() {
    try {
      return await invoke<{ cached_frames: number; is_empty: boolean }>('get_frame_cache_stats')
    } catch (error) {
      console.error('[useNativeVideoRenderer] Failed to get cache stats:', error)
      return { cached_frames: 0, is_empty: true }
    }
  }

  return {
    isPlaying: computed(() => isPlaying.value),
    currentTime: computed(() => currentTime.value),
    duration: computed(() => duration.value),
    dimensions: computed(() => dimensions.value),
    playbackRate: computed(() => playbackRate.value),
    isFullscreen: computed(() => isFullscreen.value),
    proxiesReady: computed(() => proxiesReady.value),
    loadVideo,
    play,
    pause,
    seek,
    setDuration,
    setPlaybackRate,
    setFullscreen,
    clearCache,
    getCacheStats,
    stop
  }
}
