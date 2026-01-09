/**
 * Web Worker for offloading heavy audio processing computations
 * This runs in a separate thread to avoid blocking the main UI
 */

// Message types for communication with main thread
interface WorkerMessage {
  type: 'processWaveform' | 'analyzeAudio' | 'detectBeats' | 'calculatePeaks';
  id: string;
  data: any;
}

interface WorkerResponse {
  type: 'result' | 'error' | 'progress';
  id: string;
  data?: any;
  error?: string;
  progress?: number;
}

// Process incoming messages
self.onmessage = async (event: MessageEvent<WorkerMessage>) => {
  const { type, id, data } = event.data;
  
  try {
    let result: any;
    
    switch (type) {
      case 'processWaveform':
        result = processWaveformData(data.samples, data.sampleRate, data.targetPeaks);
        break;
        
      case 'analyzeAudio':
        result = analyzeAudioLevels(data.samples);
        break;
        
      case 'detectBeats':
        result = detectBeatMarkers(data.samples, data.sampleRate, data.sensitivity);
        break;
        
      case 'calculatePeaks':
        result = calculatePeakLevels(data.samples, data.windowSize);
        break;
        
      default:
        throw new Error(`Unknown message type: ${type}`);
    }
    
    const response: WorkerResponse = { type: 'result', id, data: result };
    self.postMessage(response);
    
  } catch (error) {
    const response: WorkerResponse = { 
      type: 'error', 
      id, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    };
    self.postMessage(response);
  }
};

/**
 * Process raw audio samples into waveform peaks for visualization
 */
function processWaveformData(
  samples: Float32Array, 
  sampleRate: number, 
  targetPeaks: number
): { peaks: { min: number; max: number }[]; duration: number } {
  const duration = samples.length / sampleRate;
  const samplesPerPeak = Math.floor(samples.length / targetPeaks);
  const peaks: { min: number; max: number }[] = [];
  
  for (let i = 0; i < targetPeaks; i++) {
    const start = i * samplesPerPeak;
    const end = Math.min(start + samplesPerPeak, samples.length);
    
    let min = 0;
    let max = 0;
    
    for (let j = start; j < end; j++) {
      const sample = samples[j];
      if (sample < min) min = sample;
      if (sample > max) max = sample;
    }
    
    peaks.push({ min, max });
    
    // Report progress every 10%
    if (i % Math.floor(targetPeaks / 10) === 0) {
      const progress = (i / targetPeaks) * 100;
      self.postMessage({ type: 'progress', id: '', progress });
    }
  }
  
  return { peaks, duration };
}

/**
 * Analyze audio levels for normalization
 */
function analyzeAudioLevels(samples: Float32Array): { 
  peakLevel: number; 
  rmsLevel: number; 
  dynamicRange: number;
  suggestedGain: number;
} {
  let peak = 0;
  let sumSquares = 0;
  
  for (let i = 0; i < samples.length; i++) {
    const abs = Math.abs(samples[i]);
    if (abs > peak) peak = abs;
    sumSquares += samples[i] * samples[i];
  }
  
  const rms = Math.sqrt(sumSquares / samples.length);
  const peakDb = 20 * Math.log10(peak || 0.0001);
  const rmsDb = 20 * Math.log10(rms || 0.0001);
  const dynamicRange = peakDb - rmsDb;
  
  // Suggest gain to bring peak to -3dB
  const targetPeakDb = -3;
  const suggestedGain = targetPeakDb - peakDb;
  
  return {
    peakLevel: peakDb,
    rmsLevel: rmsDb,
    dynamicRange,
    suggestedGain,
  };
}

/**
 * Detect beat markers using onset detection
 */
function detectBeatMarkers(
  samples: Float32Array, 
  sampleRate: number, 
  sensitivity: number = 0.5
): { time: number; confidence: number }[] {
  const windowSize = Math.floor(sampleRate * 0.02); // 20ms windows
  const hopSize = Math.floor(windowSize / 2);
  const beats: { time: number; confidence: number }[] = [];
  
  let prevEnergy = 0;
  const threshold = 1.5 + (1 - sensitivity) * 2; // Adjust threshold based on sensitivity
  
  for (let i = 0; i < samples.length - windowSize; i += hopSize) {
    // Calculate energy in this window
    let energy = 0;
    for (let j = 0; j < windowSize; j++) {
      energy += samples[i + j] * samples[i + j];
    }
    energy /= windowSize;
    
    // Detect onset (sudden increase in energy)
    if (prevEnergy > 0 && energy / prevEnergy > threshold) {
      const time = i / sampleRate;
      const confidence = Math.min(1, (energy / prevEnergy - 1) / 3);
      
      // Avoid detecting beats too close together (minimum 100ms apart)
      if (beats.length === 0 || time - beats[beats.length - 1].time > 0.1) {
        beats.push({ time, confidence });
      }
    }
    
    prevEnergy = energy;
  }
  
  return beats;
}

/**
 * Calculate peak levels for clipping detection
 */
function calculatePeakLevels(
  samples: Float32Array, 
  windowSize: number
): { time: number; level: number; isClipping: boolean }[] {
  const peaks: { time: number; level: number; isClipping: boolean }[] = [];
  const clippingThreshold = 0.95;
  
  for (let i = 0; i < samples.length; i += windowSize) {
    let maxLevel = 0;
    const end = Math.min(i + windowSize, samples.length);
    
    for (let j = i; j < end; j++) {
      const abs = Math.abs(samples[j]);
      if (abs > maxLevel) maxLevel = abs;
    }
    
    peaks.push({
      time: i / windowSize,
      level: maxLevel,
      isClipping: maxLevel >= clippingThreshold,
    });
  }
  
  return peaks;
}

export {};
