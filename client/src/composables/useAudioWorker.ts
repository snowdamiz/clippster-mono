import { ref, onUnmounted } from 'vue';

/**
 * Composable for using the audio processing Web Worker
 * Offloads heavy audio computations to a separate thread
 */

interface WorkerTask {
  id: string;
  resolve: (value: any) => void;
  reject: (error: Error) => void;
}

let worker: Worker | null = null;
const pendingTasks = new Map<string, WorkerTask>();
let taskIdCounter = 0;

function getWorker(): Worker {
  if (!worker) {
    worker = new Worker(
      new URL('../workers/audioProcessingWorker.ts', import.meta.url),
      { type: 'module' }
    );
    
    worker.onmessage = (event) => {
      const { type, id, data, error } = event.data;
      
      if (type === 'progress') {
        // Handle progress updates if needed
        return;
      }
      
      const task = pendingTasks.get(id);
      if (!task) return;
      
      pendingTasks.delete(id);
      
      if (type === 'error') {
        task.reject(new Error(error));
      } else {
        task.resolve(data);
      }
    };
    
    worker.onerror = (error) => {
      console.error('[useAudioWorker] Worker error:', error);
    };
  }
  
  return worker;
}

function generateTaskId(): string {
  return `task_${++taskIdCounter}_${Date.now()}`;
}

export function useAudioWorker() {
  const isProcessing = ref(false);
  const progress = ref(0);
  
  /**
   * Process waveform data in the worker
   */
  async function processWaveform(
    samples: Float32Array,
    sampleRate: number,
    targetPeaks: number
  ): Promise<{ peaks: { min: number; max: number }[]; duration: number }> {
    isProcessing.value = true;
    progress.value = 0;
    
    try {
      const result = await sendToWorker('processWaveform', {
        samples,
        sampleRate,
        targetPeaks,
      });
      return result;
    } finally {
      isProcessing.value = false;
      progress.value = 100;
    }
  }
  
  /**
   * Analyze audio levels for normalization
   */
  async function analyzeAudio(samples: Float32Array): Promise<{
    peakLevel: number;
    rmsLevel: number;
    dynamicRange: number;
    suggestedGain: number;
  }> {
    isProcessing.value = true;
    
    try {
      return await sendToWorker('analyzeAudio', { samples });
    } finally {
      isProcessing.value = false;
    }
  }
  
  /**
   * Detect beat markers from audio
   */
  async function detectBeats(
    samples: Float32Array,
    sampleRate: number,
    sensitivity: number = 0.5
  ): Promise<{ time: number; confidence: number }[]> {
    isProcessing.value = true;
    
    try {
      return await sendToWorker('detectBeats', {
        samples,
        sampleRate,
        sensitivity,
      });
    } finally {
      isProcessing.value = false;
    }
  }
  
  /**
   * Calculate peak levels for clipping detection
   */
  async function calculatePeaks(
    samples: Float32Array,
    windowSize: number
  ): Promise<{ time: number; level: number; isClipping: boolean }[]> {
    isProcessing.value = true;
    
    try {
      return await sendToWorker('calculatePeaks', {
        samples,
        windowSize,
      });
    } finally {
      isProcessing.value = false;
    }
  }
  
  /**
   * Send a message to the worker and wait for response
   */
  function sendToWorker(type: string, data: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = generateTaskId();
      const w = getWorker();
      
      pendingTasks.set(id, { id, resolve, reject });
      
      // Transfer ArrayBuffers for better performance
      const transferables: Transferable[] = [];
      if (data.samples instanceof Float32Array) {
        transferables.push(data.samples.buffer);
      }
      
      w.postMessage({ type, id, data }, transferables);
    });
  }
  
  // Cleanup on unmount
  onUnmounted(() => {
    // Don't terminate the worker as it's shared
    // Just clear any pending tasks for this component
  });
  
  return {
    isProcessing,
    progress,
    processWaveform,
    analyzeAudio,
    detectBeats,
    calculatePeaks,
  };
}

/**
 * Terminate the shared worker (call on app unmount)
 */
export function terminateAudioWorker() {
  if (worker) {
    worker.terminate();
    worker = null;
    pendingTasks.clear();
  }
}
