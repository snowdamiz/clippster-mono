import type { AudioEffectCategory, AudioEffectParameterSchema, WebAudioConfig } from '@/types';

export interface AudioEffectPresetData {
  id: string;
  name: string;
  effectType: string;
  category: AudioEffectCategory;
  description: string;
  icon?: string;
  ffmpegFilter: string;
  webAudioConfig?: WebAudioConfig;
  defaultParameters?: Record<string, unknown>;
  parameterSchema?: AudioEffectParameterSchema[];
  isBuiltIn: boolean;
}

// ============================================
// Volume & Dynamics Effects (Web Audio previewable only)
// ============================================
const volumeEffects: AudioEffectPresetData[] = [
  {
    id: 'audio-gain',
    name: 'Gain',
    effectType: 'gain',
    category: 'volume',
    description: 'Adjust audio volume level',
    ffmpegFilter: 'volume=${gain}dB',
    webAudioConfig: { nodeType: 'gain', params: { gain: 1 } },
    defaultParameters: { gain: 0 },
    parameterSchema: [
      { name: 'gain', label: 'Gain', type: 'number', min: -60, max: 24, step: 0.5, default: 0, unit: 'dB' },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-compressor',
    name: 'Compressor',
    effectType: 'compressor',
    category: 'volume',
    description: 'Reduce dynamic range',
    ffmpegFilter: 'acompressor=threshold=${threshold}dB:ratio=${ratio}:attack=${attack}:release=${release}',
    webAudioConfig: { nodeType: 'dynamics', params: { threshold: -24, ratio: 4, attack: 0.003, release: 0.25 } },
    defaultParameters: { threshold: -24, ratio: 4, attack: 5, release: 50 },
    parameterSchema: [
      { name: 'threshold', label: 'Threshold', type: 'number', min: -60, max: 0, step: 1, default: -24, unit: 'dB' },
      { name: 'ratio', label: 'Ratio', type: 'number', min: 1, max: 20, step: 0.5, default: 4 },
      { name: 'attack', label: 'Attack', type: 'number', min: 0.1, max: 100, step: 0.1, default: 5, unit: 'ms' },
      { name: 'release', label: 'Release', type: 'number', min: 10, max: 1000, step: 10, default: 50, unit: 'ms' },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-limiter',
    name: 'Limiter',
    effectType: 'limiter',
    category: 'volume',
    description: 'Hard ceiling to prevent clipping',
    ffmpegFilter: 'alimiter=limit=${limit}dB:attack=${attack}:release=${release}',
    webAudioConfig: { nodeType: 'dynamics', params: { threshold: -1, ratio: 20, attack: 0.001, release: 0.1 } },
    defaultParameters: { limit: -1, attack: 5, release: 50 },
    parameterSchema: [
      { name: 'limit', label: 'Limit', type: 'number', min: -12, max: 0, step: 0.5, default: -1, unit: 'dB' },
      { name: 'attack', label: 'Attack', type: 'number', min: 0.1, max: 50, step: 0.1, default: 5, unit: 'ms' },
      { name: 'release', label: 'Release', type: 'number', min: 1, max: 500, step: 1, default: 50, unit: 'ms' },
    ],
    isBuiltIn: true,
  },
];

// ============================================
// EQ & Tone Effects (Web Audio previewable only)
// ============================================
const eqEffects: AudioEffectPresetData[] = [
  {
    id: 'audio-lowpass',
    name: 'Low Pass',
    effectType: 'lowpass',
    category: 'eq',
    description: 'Cut high frequencies',
    ffmpegFilter: 'lowpass=f=${frequency}:p=${poles}',
    webAudioConfig: { nodeType: 'biquad', params: { type: 'lowpass', frequency: 2000, Q: 1 } },
    defaultParameters: { frequency: 2000, poles: 2 },
    parameterSchema: [
      { name: 'frequency', label: 'Cutoff', type: 'number', min: 20, max: 20000, step: 10, default: 2000, unit: 'Hz' },
      { name: 'poles', label: 'Slope', type: 'select', default: 2, options: [{ value: 1, label: '6dB/oct' }, { value: 2, label: '12dB/oct' }] },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-highpass',
    name: 'High Pass',
    effectType: 'highpass',
    category: 'eq',
    description: 'Cut low frequencies',
    ffmpegFilter: 'highpass=f=${frequency}:p=${poles}',
    webAudioConfig: { nodeType: 'biquad', params: { type: 'highpass', frequency: 200, Q: 1 } },
    defaultParameters: { frequency: 200, poles: 2 },
    parameterSchema: [
      { name: 'frequency', label: 'Cutoff', type: 'number', min: 20, max: 20000, step: 10, default: 200, unit: 'Hz' },
      { name: 'poles', label: 'Slope', type: 'select', default: 2, options: [{ value: 1, label: '6dB/oct' }, { value: 2, label: '12dB/oct' }] },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-bandpass',
    name: 'Band Pass',
    effectType: 'bandpass',
    category: 'eq',
    description: 'Isolate frequency range',
    ffmpegFilter: 'bandpass=f=${frequency}:width_type=q:w=${q}',
    webAudioConfig: { nodeType: 'biquad', params: { type: 'bandpass', frequency: 1000, Q: 2 } },
    defaultParameters: { frequency: 1000, q: 2 },
    parameterSchema: [
      { name: 'frequency', label: 'Center', type: 'number', min: 20, max: 20000, step: 10, default: 1000, unit: 'Hz' },
      { name: 'q', label: 'Width (Q)', type: 'number', min: 0.1, max: 10, step: 0.1, default: 2 },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-bass-boost',
    name: 'Bass Boost',
    effectType: 'bass-boost',
    category: 'eq',
    description: 'Enhance low frequencies',
    ffmpegFilter: 'bass=g=${gain}:f=${frequency}',
    webAudioConfig: { nodeType: 'biquad', params: { type: 'lowshelf', frequency: 100, gain: 6 } },
    defaultParameters: { gain: 6, frequency: 100 },
    parameterSchema: [
      { name: 'gain', label: 'Boost', type: 'number', min: 0, max: 20, step: 1, default: 6, unit: 'dB' },
      { name: 'frequency', label: 'Frequency', type: 'number', min: 20, max: 500, step: 10, default: 100, unit: 'Hz' },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-treble-boost',
    name: 'Treble Boost',
    effectType: 'treble-boost',
    category: 'eq',
    description: 'Enhance high frequencies',
    ffmpegFilter: 'treble=g=${gain}:f=${frequency}',
    webAudioConfig: { nodeType: 'biquad', params: { type: 'highshelf', frequency: 3000, gain: 6 } },
    defaultParameters: { gain: 6, frequency: 3000 },
    parameterSchema: [
      { name: 'gain', label: 'Boost', type: 'number', min: 0, max: 20, step: 1, default: 6, unit: 'dB' },
      { name: 'frequency', label: 'Frequency', type: 'number', min: 1000, max: 16000, step: 100, default: 3000, unit: 'Hz' },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-parametric-eq',
    name: 'Parametric EQ',
    effectType: 'parametric-eq',
    category: 'eq',
    description: 'Adjustable frequency band',
    ffmpegFilter: 'equalizer=f=${frequency}:width_type=q:width=${q}:g=${gain}',
    webAudioConfig: { nodeType: 'biquad', params: { type: 'peaking', frequency: 1000, Q: 1, gain: 0 } },
    defaultParameters: { frequency: 1000, q: 1, gain: 0 },
    parameterSchema: [
      { name: 'frequency', label: 'Frequency', type: 'number', min: 20, max: 20000, step: 10, default: 1000, unit: 'Hz' },
      { name: 'q', label: 'Q Factor', type: 'number', min: 0.1, max: 10, step: 0.1, default: 1 },
      { name: 'gain', label: 'Gain', type: 'number', min: -24, max: 24, step: 0.5, default: 0, unit: 'dB' },
    ],
    isBuiltIn: true,
  },
];

// ============================================
// Spatial & Stereo Effects (Web Audio previewable only)
// ============================================
const spatialEffects: AudioEffectPresetData[] = [
  {
    id: 'audio-pan',
    name: 'Pan',
    effectType: 'pan',
    category: 'spatial',
    description: 'Left/right stereo position',
    ffmpegFilter: 'stereotools=balance_out=${pan}',
    webAudioConfig: { nodeType: 'panner', params: { pan: 0 } },
    defaultParameters: { pan: 0 },
    parameterSchema: [
      { name: 'pan', label: 'Pan', type: 'number', min: -1, max: 1, step: 0.01, default: 0 },
    ],
    isBuiltIn: true,
  },
];

// ============================================
// Time-Based Effects (Web Audio previewable only)
// ============================================
const timeEffects: AudioEffectPresetData[] = [
  {
    id: 'audio-reverb',
    name: 'Reverb',
    effectType: 'reverb',
    category: 'time',
    description: 'Room/hall ambience',
    ffmpegFilter: 'aecho=0.8:0.9:${delay}:${decay}',
    webAudioConfig: { nodeType: 'convolver', params: {} },
    defaultParameters: { delay: 100, decay: 0.5, mix: 0.3 },
    parameterSchema: [
      { name: 'delay', label: 'Delay', type: 'number', min: 10, max: 500, step: 10, default: 100, unit: 'ms' },
      { name: 'decay', label: 'Decay', type: 'number', min: 0, max: 1, step: 0.1, default: 0.5 },
      { name: 'mix', label: 'Mix', type: 'number', min: 0, max: 1, step: 0.1, default: 0.3 },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-delay',
    name: 'Delay/Echo',
    effectType: 'delay',
    category: 'time',
    description: 'Repeated sound',
    ffmpegFilter: 'aecho=0.8:0.88:${time}:${feedback}',
    webAudioConfig: { nodeType: 'delay', params: { delayTime: 0.3 } },
    defaultParameters: { time: 300, feedback: 0.5, mix: 0.3 },
    parameterSchema: [
      { name: 'time', label: 'Time', type: 'number', min: 10, max: 2000, step: 10, default: 300, unit: 'ms' },
      { name: 'feedback', label: 'Feedback', type: 'number', min: 0, max: 0.95, step: 0.05, default: 0.5 },
      { name: 'mix', label: 'Mix', type: 'number', min: 0, max: 1, step: 0.1, default: 0.3 },
    ],
    isBuiltIn: true,
  },
];

// Pitch & Speed Effects - REMOVED (not previewable with Web Audio)
// These require rubberband/atempo which cannot be done in real-time
const pitchEffects: AudioEffectPresetData[] = [];

// Voice Effects - REMOVED (not previewable with Web Audio)
// These require sample rate manipulation which cannot be done in real-time
const voiceEffects: AudioEffectPresetData[] = [];

// Voice Enhancement Effects - REMOVED (not previewable with Web Audio)
// These require FFT-based processing which cannot be done in real-time
const enhancementEffects: AudioEffectPresetData[] = [];

// ============================================
// Creative & Stylized Effects (Web Audio previewable only)
// ============================================
const creativeEffects: AudioEffectPresetData[] = [
  {
    id: 'audio-distortion',
    name: 'Distortion',
    effectType: 'distortion',
    category: 'creative',
    description: 'Overdrive/saturation',
    ffmpegFilter: 'acrusher=bits=${bits}:mode=log:aa=1:samples=${samples}',
    webAudioConfig: { nodeType: 'waveshaper', params: { curve: 'soft' } },
    defaultParameters: { bits: 8, samples: 1, amount: 0.5 },
    parameterSchema: [
      { name: 'amount', label: 'Amount', type: 'number', min: 0, max: 1, step: 0.1, default: 0.5 },
    ],
    isBuiltIn: true,
  },
];

// ============================================
// Fades & Automation Effects (Web Audio previewable only)
// ============================================
const fadeEffects: AudioEffectPresetData[] = [
  {
    id: 'audio-fade-in',
    name: 'Fade In',
    effectType: 'fade-in',
    category: 'fades',
    description: 'Gradual volume increase',
    ffmpegFilter: 'afade=t=in:st=${start}:d=${duration}',
    webAudioConfig: { nodeType: 'gain', params: { gain: 0 } },
    defaultParameters: { start: 0, duration: 1, curve: 'linear' },
    parameterSchema: [
      { name: 'duration', label: 'Duration', type: 'number', min: 0.1, max: 10, step: 0.1, default: 1, unit: 's' },
      { name: 'curve', label: 'Curve', type: 'select', default: 'linear', options: [
        { value: 'linear', label: 'Linear' },
        { value: 'exp', label: 'Exponential' },
        { value: 'log', label: 'Logarithmic' },
      ]},
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-fade-out',
    name: 'Fade Out',
    effectType: 'fade-out',
    category: 'fades',
    description: 'Gradual volume decrease',
    ffmpegFilter: 'afade=t=out:st=${start}:d=${duration}',
    webAudioConfig: { nodeType: 'gain', params: { gain: 1 } },
    defaultParameters: { start: 0, duration: 1, curve: 'linear' },
    parameterSchema: [
      { name: 'duration', label: 'Duration', type: 'number', min: 0.1, max: 10, step: 0.1, default: 1, unit: 's' },
      { name: 'curve', label: 'Curve', type: 'select', default: 'linear', options: [
        { value: 'linear', label: 'Linear' },
        { value: 'exp', label: 'Exponential' },
        { value: 'log', label: 'Logarithmic' },
      ]},
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-volume-automation',
    name: 'Volume Automation',
    effectType: 'volume-automation',
    category: 'fades',
    description: 'Manual volume keyframes',
    ffmpegFilter: 'volume=enable=\'between(t,${start},${end})\':volume=${gain}dB',
    webAudioConfig: { nodeType: 'gain', params: { gain: 1 } },
    defaultParameters: { start: 0, end: 1, gain: 0 },
    parameterSchema: [
      { name: 'gain', label: 'Gain', type: 'number', min: -60, max: 24, step: 0.5, default: 0, unit: 'dB' },
    ],
    isBuiltIn: true,
  },
];

// ============================================
// Export All Categories (only those with Web Audio previewable effects)
// ============================================
const allCategories: {
  category: AudioEffectCategory;
  label: string;
  icon: string;
  presets: AudioEffectPresetData[];
}[] = [
  { category: 'volume', label: 'Volume & Dynamics', icon: 'volume-2', presets: volumeEffects },
  { category: 'eq', label: 'EQ & Tone', icon: 'sliders', presets: eqEffects },
  { category: 'spatial', label: 'Spatial & Stereo', icon: 'headphones', presets: spatialEffects },
  { category: 'time', label: 'Time-Based', icon: 'clock', presets: timeEffects },
  { category: 'creative', label: 'Creative & Stylized', icon: 'wand-2', presets: creativeEffects },
  { category: 'fades', label: 'Fades & Automation', icon: 'trending-up', presets: fadeEffects },
];

export const AUDIO_EFFECT_CATEGORIES = allCategories.filter(c => c.presets.length > 0);

export const ALL_AUDIO_EFFECT_PRESETS: AudioEffectPresetData[] = [
  ...volumeEffects,
  ...eqEffects,
  ...spatialEffects,
  ...timeEffects,
  ...pitchEffects,
  ...voiceEffects,
  ...enhancementEffects,
  ...creativeEffects,
  ...fadeEffects,
];

export function getAudioEffectPresetsByCategory(category: AudioEffectCategory): AudioEffectPresetData[] {
  return AUDIO_EFFECT_CATEGORIES.find(c => c.category === category)?.presets ?? [];
}

export function getAudioEffectPresetById(id: string): AudioEffectPresetData | undefined {
  return ALL_AUDIO_EFFECT_PRESETS.find(p => p.id === id);
}
