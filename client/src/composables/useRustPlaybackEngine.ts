import { ref, onUnmounted, type Ref } from 'vue';
import { invoke } from '@tauri-apps/api/core';

/**
 * Rust-based playback engine for CapCut-level performance
 * 
 * This composable wraps the Rust playback engine that uses:
 * - FFmpeg-based frame decoding in Rust
 * - Hardware-paced audio timing
 * - Ring buffer for decoded frames
 * - Lookahead decode workers
 * - LRU frame cache
 * 
 * Architecture:
 * 1. Rust backend decodes frames and stores in ring buffer
 * 2. Frontend polls for frame slots via Tauri commands
 * 3. Canvas rendering displays frames
 * 4. Audio engine provides master clock timing
 */

export interface RustPlaybackEngineOptions {
  videoPath: string;
  canvasRef: Ref<HTMLCanvasElement | null>;
  onTimeUpdate?: (time: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  onEnded?: () => void;
}

export interface RustPlaybackEngineReturn {
  isPlaying: Readonly<Ref<boolean>>;
  currentTime: Readonly<Ref<number>>;
  
  play: () => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  seek: (time: number) => Promise<void>;
  stop: () => Promise<void>;
  
  dispose: () => Promise<void>;
}

/**
 * Use Rust-based playback engine for professional-grade video playback
 */
export function useRustPlaybackEngine(
  options: RustPlaybackEngineOptions
): RustPlaybackEngineReturn {
  const isPlaying = ref(false);
  const currentTime = ref(0);
  
  let rafId: number | null = null;
  let isActive = false;
  let canvas2dContext: CanvasRenderingContext2D | null = null;
  
  // Initialize canvas context
  const initCanvas = () => {
    if (!options.canvasRef.value) return false;
    
    const ctx = options.canvasRef.value.getContext('2d', {
      alpha: false,
      desynchronized: true, // Hint for better performance
    });
    
    if (!ctx) return false;
    
    canvas2dContext = ctx;
    return true;
  };
  
  // Render loop - polls Rust backend for frames and renders to canvas
  const renderLoop = async () => {
    if (!isActive || !canvas2dContext || !options.canvasRef.value) {
      return;
    }
    
    try {
      // Get current playback state from Rust
      const state = await invoke<string>('get_playback_state');
      
      if (state === 'Playing') {
        // Read the latest frame slot (slot 0 is always the most recent)
        const frameData = await invoke<number[]>('read_frame_slot', { slotId: 0 });
        
        if (frameData && frameData.length > 0) {
          // Convert frame data to ImageData and render
          const canvas = options.canvasRef.value;
          const width = canvas.width;
          const height = canvas.height;
          
          // Create ImageData from BGRA frame data
          const imageData = new ImageData(width, height);
          const uint8Array = new Uint8Array(frameData);
          
          // Convert BGRA to RGBA for canvas
          for (let i = 0; i < uint8Array.length; i += 4) {
            imageData.data[i] = uint8Array[i + 2];     // R
            imageData.data[i + 1] = uint8Array[i + 1]; // G
            imageData.data[i + 2] = uint8Array[i];     // B
            imageData.data[i + 3] = uint8Array[i + 3]; // A
          }
          
          canvas2dContext.putImageData(imageData, 0, 0);
          
          // Notify time update (could be extracted from frame metadata)
          if (options.onTimeUpdate) {
            currentTime.value += 1 / 60; // Approximate, should get from Rust
            options.onTimeUpdate(currentTime.value);
          }
        }
      }
    } catch (error) {
      console.error('[RustPlayback] Frame render error:', error);
    }
    
    // Continue render loop at 60fps
    if (isActive) {
      rafId = requestAnimationFrame(renderLoop);
    }
  };
  
  // Start playback
  const play = async () => {
    try {
      if (!initCanvas()) {
        throw new Error('Failed to initialize canvas');
      }
      
      // Start Rust playback engine
      await invoke('start_playback', {
        videoPath: options.videoPath,
      });
      
      isPlaying.value = true;
      isActive = true;
      
      // Start render loop
      rafId = requestAnimationFrame(renderLoop);
      
      if (options.onPlayStateChange) {
        options.onPlayStateChange(true);
      }
    } catch (error) {
      console.error('[RustPlayback] Failed to start playback:', error);
      throw error;
    }
  };
  
  // Pause playback
  const pause = async () => {
    try {
      await invoke('pause_playback');
      isPlaying.value = false;
      
      if (options.onPlayStateChange) {
        options.onPlayStateChange(false);
      }
    } catch (error) {
      console.error('[RustPlayback] Failed to pause:', error);
      throw error;
    }
  };
  
  // Resume playback
  const resume = async () => {
    try {
      await invoke('resume_playback');
      isPlaying.value = true;
      
      if (options.onPlayStateChange) {
        options.onPlayStateChange(true);
      }
    } catch (error) {
      console.error('[RustPlayback] Failed to resume:', error);
      throw error;
    }
  };
  
  // Seek to time
  const seek = async (time: number) => {
    try {
      await invoke('seek_playback', { time });
      currentTime.value = time;
      
      if (options.onTimeUpdate) {
        options.onTimeUpdate(time);
      }
    } catch (error) {
      console.error('[RustPlayback] Failed to seek:', error);
      throw error;
    }
  };
  
  // Stop playback
  const stop = async () => {
    try {
      isActive = false;
      
      if (rafId !== null) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
      
      await invoke('stop_playback');
      isPlaying.value = false;
      currentTime.value = 0;
      
      if (options.onPlayStateChange) {
        options.onPlayStateChange(false);
      }
    } catch (error) {
      console.error('[RustPlayback] Failed to stop:', error);
      throw error;
    }
  };
  
  // Cleanup
  const dispose = async () => {
    await stop();
    canvas2dContext = null;
  };
  
  // Auto-cleanup on unmount
  onUnmounted(() => {
    dispose();
  });
  
  return {
    isPlaying: isPlaying as Readonly<Ref<boolean>>,
    currentTime: currentTime as Readonly<Ref<number>>,
    play,
    pause,
    resume,
    seek,
    stop,
    dispose,
  };
}
