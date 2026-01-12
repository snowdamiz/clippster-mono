import { ref, watch, onUnmounted, type Ref } from 'vue';
import type { AudioTrackEffect } from '@/types';

interface AudioEffectNode {
  id: string;
  node: AudioNode;
  type: string;
}

/**
 * Composable for applying audio effects using Web Audio API
 * Only supports effects that have preview-export parity with FFmpeg
 */
export function useAudioEffects(
  videoElement: Ref<HTMLVideoElement | null>,
  audioEffects: Ref<AudioTrackEffect[]>,
  currentTime: Ref<number>
) {
  const audioContext = ref<AudioContext | null>(null);
  const sourceNode = ref<MediaElementAudioSourceNode | null>(null);
  const effectNodes = ref<AudioEffectNode[]>([]);
  const isInitialized = ref(false);

  // Initialize Web Audio context and connect to video element
  function initializeAudio() {
    if (!videoElement.value || isInitialized.value) return;

    try {
      audioContext.value = new AudioContext();
      sourceNode.value = audioContext.value.createMediaElementSource(videoElement.value);

      // Initially connect source directly to destination
      sourceNode.value.connect(audioContext.value.destination);
      isInitialized.value = true;

      console.log('[useAudioEffects] Audio context initialized');
    } catch (error) {
      console.error('[useAudioEffects] Failed to initialize audio context:', error);
    }
  }

  // Create a Web Audio node for an effect
  function createEffectNode(effect: AudioTrackEffect): AudioNode | null {
    if (!audioContext.value) return null;

    const ctx = audioContext.value;
    const params = effect.parameters || {};

    switch (effect.effectType) {
      // Volume & Dynamics
      case 'gain': {
        const gainNode = ctx.createGain();
        const gainDb = (params.gain as number) || 0;
        gainNode.gain.value = Math.pow(10, gainDb / 20); // Convert dB to linear
        return gainNode;
      }

      case 'compressor': {
        const compressor = ctx.createDynamicsCompressor();
        compressor.threshold.value = (params.threshold as number) || -24;
        compressor.ratio.value = (params.ratio as number) || 4;
        compressor.attack.value = ((params.attack as number) || 5) / 1000;
        compressor.release.value = ((params.release as number) || 50) / 1000;
        return compressor;
      }

      case 'limiter': {
        const limiter = ctx.createDynamicsCompressor();
        limiter.threshold.value = (params.limit as number) || -1;
        limiter.ratio.value = 20; // High ratio for limiting
        limiter.attack.value = ((params.attack as number) || 5) / 1000;
        limiter.release.value = ((params.release as number) || 50) / 1000;
        return limiter;
      }

      // EQ & Tone
      case 'lowpass': {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = (params.frequency as number) || 2000;
        filter.Q.value = 1;
        return filter;
      }

      case 'highpass': {
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.value = (params.frequency as number) || 200;
        filter.Q.value = 1;
        return filter;
      }

      case 'bandpass': {
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = (params.frequency as number) || 1000;
        filter.Q.value = (params.q as number) || 2;
        return filter;
      }

      case 'bass-boost': {
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowshelf';
        filter.frequency.value = (params.frequency as number) || 100;
        filter.gain.value = (params.gain as number) || 6;
        return filter;
      }

      case 'treble-boost': {
        const filter = ctx.createBiquadFilter();
        filter.type = 'highshelf';
        filter.frequency.value = (params.frequency as number) || 3000;
        filter.gain.value = (params.gain as number) || 6;
        return filter;
      }

      case 'parametric-eq': {
        const filter = ctx.createBiquadFilter();
        filter.type = 'peaking';
        filter.frequency.value = (params.frequency as number) || 1000;
        filter.Q.value = (params.q as number) || 1;
        filter.gain.value = (params.gain as number) || 0;
        return filter;
      }

      // Spatial & Stereo
      case 'pan': {
        const panner = ctx.createStereoPanner();
        panner.pan.value = (params.pan as number) || 0;
        return panner;
      }

      // Time-Based Effects
      case 'reverb': {
        // Simple reverb using delay + feedback
        const delay = ctx.createDelay();
        const feedback = ctx.createGain();
        const mix = ctx.createGain();

        delay.delayTime.value = ((params.delay as number) || 100) / 1000;
        feedback.gain.value = (params.decay as number) || 0.5;
        mix.gain.value = (params.mix as number) || 0.3;

        delay.connect(feedback);
        feedback.connect(delay);
        delay.connect(mix);

        return delay;
      }

      case 'delay': {
        const delay = ctx.createDelay(5); // Max 5 seconds
        delay.delayTime.value = ((params.time as number) || 300) / 1000;
        return delay;
      }

      // Creative & Stylized
      case 'distortion': {
        const waveshaper = ctx.createWaveShaper();
        const amount = (params.amount as number) || 0.5;
        waveshaper.curve = makeDistortionCurve(amount * 400);
        waveshaper.oversample = '4x';
        return waveshaper;
      }

      // Fades & Automation
      case 'fade-in':
      case 'fade-out':
      case 'volume-automation': {
        const gainNode = ctx.createGain();
        const gainDb = (params.gain as number) || 0;
        gainNode.gain.value = Math.pow(10, gainDb / 20);
        return gainNode;
      }

      default:
        console.warn(`[useAudioEffects] Unknown effect type: ${effect.effectType}`);
        return null;
    }
  }

  // Generate distortion curve for waveshaper
  function makeDistortionCurve(amount: number): Float32Array {
    const samples = 44100;
    const buffer = new ArrayBuffer(samples * Float32Array.BYTES_PER_ELEMENT);
    const curve = new Float32Array(buffer);
    const deg = Math.PI / 180;

    for (let i = 0; i < samples; i++) {
      const x = (i * 2) / samples - 1;
      curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
    }

    return curve;
  }

  // Rebuild the effect chain
  function rebuildEffectChain() {
    if (!audioContext.value || !sourceNode.value) return;

    // Disconnect all existing nodes
    try {
      sourceNode.value.disconnect();
    } catch (e) {
      // Ignore if not connected
    }

    effectNodes.value.forEach(({ node }) => {
      try {
        node.disconnect();
      } catch (e) {
        // Ignore if not connected
      }
    });

    effectNodes.value = [];

    // Get active effects for current time
    const activeEffects = audioEffects.value.filter((effect) => {
      if (!effect.isEnabled) return false;
      // Check if effect is active at current time
      return currentTime.value >= effect.startTime && currentTime.value <= effect.endTime;
    });

    if (activeEffects.length === 0) {
      // No effects, connect source directly to destination
      sourceNode.value.connect(audioContext.value.destination);
      return;
    }

    // Create and chain effect nodes
    let previousNode: AudioNode = sourceNode.value;

    for (const effect of activeEffects) {
      const node = createEffectNode(effect);
      if (node) {
        previousNode.connect(node);
        effectNodes.value.push({
          id: effect.id,
          node,
          type: effect.effectType,
        });
        previousNode = node;
      }
    }

    // Connect last node to destination
    previousNode.connect(audioContext.value.destination);

    console.log(`[useAudioEffects] Effect chain rebuilt with ${effectNodes.value.length} nodes`);
  }

  // Update effect parameters without rebuilding chain
  function updateEffectParameters() {
    effectNodes.value.forEach(({ id, node, type }) => {
      const effect = audioEffects.value.find((e) => e.id === id);
      if (!effect) return;

      const params = effect.parameters || {};

      switch (type) {
        case 'gain':
        case 'fade-in':
        case 'fade-out':
        case 'volume-automation': {
          const gainDb = (params.gain as number) || 0;
          (node as GainNode).gain.value = Math.pow(10, gainDb / 20);
          break;
        }
        case 'pan': {
          (node as StereoPannerNode).pan.value = (params.pan as number) || 0;
          break;
        }
        // Add more parameter updates as needed
      }
    });
  }

  // Watch for video element changes
  watch(
    videoElement,
    (newVideo) => {
      if (newVideo && !isInitialized.value) {
        initializeAudio();
      }
    },
    { immediate: true }
  );

  // Watch for effect changes
  watch(
    audioEffects,
    () => {
      rebuildEffectChain();
    },
    { deep: true }
  );

  // Watch for time changes to enable/disable time-based effects
  watch(currentTime, () => {
    // Check if any effects need to be enabled/disabled based on time
    const needsRebuild = audioEffects.value.some((effect) => {
      const isActive = currentTime.value >= effect.startTime && currentTime.value <= effect.endTime;
      const wasActive = effectNodes.value.some((n) => n.id === effect.id);
      return isActive !== wasActive;
    });

    if (needsRebuild) {
      rebuildEffectChain();
    }
  });

  // Cleanup on unmount
  onUnmounted(() => {
    if (audioContext.value) {
      audioContext.value.close();
      audioContext.value = null;
    }
    effectNodes.value = [];
    isInitialized.value = false;
  });

  return {
    isInitialized,
    rebuildEffectChain,
    updateEffectParameters,
  };
}
