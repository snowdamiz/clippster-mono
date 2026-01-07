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
// Volume & Dynamics Effects
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
    id: 'audio-normalize',
    name: 'Normalize',
    effectType: 'normalize',
    category: 'volume',
    description: 'Auto-level to target loudness',
    ffmpegFilter: 'loudnorm=I=${target}:TP=-1.5:LRA=11',
    defaultParameters: { target: -16 },
    parameterSchema: [
      { name: 'target', label: 'Target LUFS', type: 'number', min: -24, max: -9, step: 1, default: -16, unit: 'LUFS' },
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
  {
    id: 'audio-noise-gate',
    name: 'Noise Gate',
    effectType: 'noise-gate',
    category: 'volume',
    description: 'Cut audio below threshold',
    ffmpegFilter: 'agate=threshold=${threshold}dB:attack=${attack}:release=${release}',
    defaultParameters: { threshold: -40, attack: 5, release: 50 },
    parameterSchema: [
      { name: 'threshold', label: 'Threshold', type: 'number', min: -80, max: 0, step: 1, default: -40, unit: 'dB' },
      { name: 'attack', label: 'Attack', type: 'number', min: 0.1, max: 100, step: 0.1, default: 5, unit: 'ms' },
      { name: 'release', label: 'Release', type: 'number', min: 10, max: 1000, step: 10, default: 50, unit: 'ms' },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-expander',
    name: 'Expander',
    effectType: 'expander',
    category: 'volume',
    description: 'Increase dynamic range',
    ffmpegFilter: 'acompressor=threshold=${threshold}dB:ratio=${ratio}:attack=${attack}:release=${release}:mode=downward',
    defaultParameters: { threshold: -40, ratio: 2, attack: 10, release: 100 },
    parameterSchema: [
      { name: 'threshold', label: 'Threshold', type: 'number', min: -60, max: 0, step: 1, default: -40, unit: 'dB' },
      { name: 'ratio', label: 'Ratio', type: 'number', min: 1, max: 10, step: 0.5, default: 2 },
      { name: 'attack', label: 'Attack', type: 'number', min: 0.1, max: 100, step: 0.1, default: 10, unit: 'ms' },
      { name: 'release', label: 'Release', type: 'number', min: 10, max: 1000, step: 10, default: 100, unit: 'ms' },
    ],
    isBuiltIn: true,
  },
];

// ============================================
// EQ & Tone Effects
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
  {
    id: 'audio-de-esser',
    name: 'De-Esser',
    effectType: 'de-esser',
    category: 'eq',
    description: 'Reduce sibilance (s/sh sounds)',
    ffmpegFilter: 'highpass=f=4000,acompressor=threshold=-20dB:ratio=10:attack=0.3:release=50,lowpass=f=10000',
    defaultParameters: { threshold: -20, frequency: 6000 },
    parameterSchema: [
      { name: 'threshold', label: 'Threshold', type: 'number', min: -40, max: 0, step: 1, default: -20, unit: 'dB' },
      { name: 'frequency', label: 'Frequency', type: 'number', min: 4000, max: 10000, step: 100, default: 6000, unit: 'Hz' },
    ],
    isBuiltIn: true,
  },
];

// ============================================
// Spatial & Stereo Effects
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
  {
    id: 'audio-stereo-width',
    name: 'Stereo Width',
    effectType: 'stereo-width',
    category: 'spatial',
    description: 'Widen or narrow stereo field',
    ffmpegFilter: 'stereotools=sbal=${width}',
    defaultParameters: { width: 1 },
    parameterSchema: [
      { name: 'width', label: 'Width', type: 'number', min: 0, max: 2, step: 0.1, default: 1 },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-mono',
    name: 'Mono',
    effectType: 'mono',
    category: 'spatial',
    description: 'Convert to mono',
    ffmpegFilter: 'pan=mono|c0=0.5*c0+0.5*c1',
    defaultParameters: {},
    isBuiltIn: true,
  },
  {
    id: 'audio-channel-swap',
    name: 'Channel Swap',
    effectType: 'channel-swap',
    category: 'spatial',
    description: 'Swap left and right channels',
    ffmpegFilter: 'pan=stereo|c0=c1|c1=c0',
    defaultParameters: {},
    isBuiltIn: true,
  },
  {
    id: 'audio-surround',
    name: 'Surround Simulator',
    effectType: 'surround',
    category: 'spatial',
    description: 'Fake surround effect',
    ffmpegFilter: 'aecho=0.8:0.88:60:0.4,stereotools=sbal=1.5',
    defaultParameters: { depth: 0.5 },
    parameterSchema: [
      { name: 'depth', label: 'Depth', type: 'number', min: 0, max: 1, step: 0.1, default: 0.5 },
    ],
    isBuiltIn: true,
  },
];

// ============================================
// Time-Based Effects
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
  {
    id: 'audio-chorus',
    name: 'Chorus',
    effectType: 'chorus',
    category: 'time',
    description: 'Thicken with detuned copies',
    ffmpegFilter: 'chorus=0.5:0.9:50|60|40:0.4|0.32|0.3:0.25|0.4|0.3:2|2.3|1.3',
    defaultParameters: { rate: 1.5, depth: 0.5, mix: 0.5 },
    parameterSchema: [
      { name: 'rate', label: 'Rate', type: 'number', min: 0.1, max: 5, step: 0.1, default: 1.5, unit: 'Hz' },
      { name: 'depth', label: 'Depth', type: 'number', min: 0, max: 1, step: 0.1, default: 0.5 },
      { name: 'mix', label: 'Mix', type: 'number', min: 0, max: 1, step: 0.1, default: 0.5 },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-flanger',
    name: 'Flanger',
    effectType: 'flanger',
    category: 'time',
    description: 'Sweeping comb filter',
    ffmpegFilter: 'flanger=delay=${delay}:depth=${depth}:regen=${feedback}:speed=${rate}',
    defaultParameters: { delay: 5, depth: 2, feedback: 0.5, rate: 0.5 },
    parameterSchema: [
      { name: 'delay', label: 'Delay', type: 'number', min: 0, max: 30, step: 1, default: 5, unit: 'ms' },
      { name: 'depth', label: 'Depth', type: 'number', min: 0, max: 10, step: 0.5, default: 2, unit: 'ms' },
      { name: 'feedback', label: 'Feedback', type: 'number', min: 0, max: 0.95, step: 0.05, default: 0.5 },
      { name: 'rate', label: 'Rate', type: 'number', min: 0.1, max: 10, step: 0.1, default: 0.5, unit: 'Hz' },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-phaser',
    name: 'Phaser',
    effectType: 'phaser',
    category: 'time',
    description: 'Phase-shifted copies',
    ffmpegFilter: 'aphaser=in_gain=0.9:out_gain=0.9:delay=${delay}:decay=${decay}:speed=${rate}',
    defaultParameters: { delay: 3, decay: 0.4, rate: 0.5 },
    parameterSchema: [
      { name: 'delay', label: 'Delay', type: 'number', min: 0.1, max: 5, step: 0.1, default: 3, unit: 'ms' },
      { name: 'decay', label: 'Decay', type: 'number', min: 0, max: 0.99, step: 0.05, default: 0.4 },
      { name: 'rate', label: 'Rate', type: 'number', min: 0.1, max: 2, step: 0.1, default: 0.5, unit: 'Hz' },
    ],
    isBuiltIn: true,
  },
];

// ============================================
// Pitch & Speed Effects
// ============================================
const pitchEffects: AudioEffectPresetData[] = [
  {
    id: 'audio-pitch-shift',
    name: 'Pitch Shift',
    effectType: 'pitch-shift',
    category: 'pitch',
    description: 'Change pitch without speed',
    ffmpegFilter: 'rubberband=pitch=${pitch}',
    defaultParameters: { semitones: 0 },
    parameterSchema: [
      { name: 'semitones', label: 'Semitones', type: 'number', min: -12, max: 12, step: 1, default: 0 },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-speed',
    name: 'Speed Change',
    effectType: 'speed',
    category: 'pitch',
    description: 'Change speed (affects pitch)',
    ffmpegFilter: 'atempo=${speed}',
    defaultParameters: { speed: 1 },
    parameterSchema: [
      { name: 'speed', label: 'Speed', type: 'number', min: 0.5, max: 2, step: 0.05, default: 1 },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-time-stretch',
    name: 'Time Stretch',
    effectType: 'time-stretch',
    category: 'pitch',
    description: 'Change speed without pitch',
    ffmpegFilter: 'rubberband=tempo=${tempo}',
    defaultParameters: { tempo: 1 },
    parameterSchema: [
      { name: 'tempo', label: 'Tempo', type: 'number', min: 0.5, max: 2, step: 0.05, default: 1 },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-vibrato',
    name: 'Vibrato',
    effectType: 'vibrato',
    category: 'pitch',
    description: 'Pitch wobble',
    ffmpegFilter: 'vibrato=f=${rate}:d=${depth}',
    defaultParameters: { rate: 5, depth: 0.5 },
    parameterSchema: [
      { name: 'rate', label: 'Rate', type: 'number', min: 0.1, max: 20, step: 0.1, default: 5, unit: 'Hz' },
      { name: 'depth', label: 'Depth', type: 'number', min: 0, max: 1, step: 0.1, default: 0.5 },
    ],
    isBuiltIn: true,
  },
];

// ============================================
// Voice Effects (CapCut-style presets)
// ============================================
const voiceEffects: AudioEffectPresetData[] = [
  {
    id: 'voice-chipmunk',
    name: 'Chipmunk',
    effectType: 'voice-chipmunk',
    category: 'voice',
    description: 'High-pitched sped-up voice',
    ffmpegFilter: 'asetrate=44100*1.5,aresample=44100,atempo=0.67',
    defaultParameters: { intensity: 1 },
    parameterSchema: [
      { name: 'intensity', label: 'Intensity', type: 'number', min: 0.5, max: 1.5, step: 0.1, default: 1 },
    ],
    isBuiltIn: true,
  },
  {
    id: 'voice-deep',
    name: 'Deep Voice',
    effectType: 'voice-deep',
    category: 'voice',
    description: 'Low-pitched slowed voice',
    ffmpegFilter: 'asetrate=44100*0.7,aresample=44100,atempo=1.43',
    defaultParameters: { intensity: 1 },
    parameterSchema: [
      { name: 'intensity', label: 'Intensity', type: 'number', min: 0.5, max: 1.5, step: 0.1, default: 1 },
    ],
    isBuiltIn: true,
  },
  {
    id: 'voice-echo',
    name: 'Echo Voice',
    effectType: 'voice-echo',
    category: 'voice',
    description: 'Voice with heavy echo',
    ffmpegFilter: 'aecho=0.8:0.9:500|1000:0.5|0.3',
    defaultParameters: { intensity: 1 },
    isBuiltIn: true,
  },
  {
    id: 'voice-electronic',
    name: 'Electronic',
    effectType: 'voice-electronic',
    category: 'voice',
    description: 'Robotic/synth voice',
    ffmpegFilter: 'afftfilt=real=\'hypot(re,im)*cos(random(0)*2*PI)\':imag=\'hypot(re,im)*sin(random(0)*2*PI)\':win_size=512:overlap=0.75',
    defaultParameters: { intensity: 1 },
    isBuiltIn: true,
  },
  {
    id: 'voice-ethereal',
    name: 'Ethereal',
    effectType: 'voice-ethereal',
    category: 'voice',
    description: 'Dreamy, airy voice',
    ffmpegFilter: 'aecho=0.8:0.9:100|200|300:0.4|0.3|0.2,highpass=f=200,treble=g=3',
    defaultParameters: { intensity: 1 },
    isBuiltIn: true,
  },
  {
    id: 'voice-giant',
    name: 'Giant',
    effectType: 'voice-giant',
    category: 'voice',
    description: 'Deep booming voice',
    ffmpegFilter: 'asetrate=44100*0.6,aresample=44100,atempo=1.67,bass=g=10',
    defaultParameters: { intensity: 1 },
    isBuiltIn: true,
  },
  {
    id: 'voice-helium',
    name: 'Helium',
    effectType: 'voice-helium',
    category: 'voice',
    description: 'Very high-pitched squeaky',
    ffmpegFilter: 'asetrate=44100*2,aresample=44100,atempo=0.5',
    defaultParameters: { intensity: 1 },
    isBuiltIn: true,
  },
  {
    id: 'voice-megaphone',
    name: 'Megaphone',
    effectType: 'voice-megaphone',
    category: 'voice',
    description: 'Bullhorn/PA effect',
    ffmpegFilter: 'highpass=f=300,lowpass=f=3000,acrusher=bits=8:mode=log:aa=1',
    defaultParameters: { intensity: 1 },
    isBuiltIn: true,
  },
  {
    id: 'voice-mic',
    name: 'Studio Mic',
    effectType: 'voice-mic',
    category: 'voice',
    description: 'Studio microphone warmth',
    ffmpegFilter: 'highpass=f=80,equalizer=f=200:g=2,equalizer=f=3000:g=3,acompressor=threshold=-20dB:ratio=3',
    defaultParameters: { intensity: 1 },
    isBuiltIn: true,
  },
  {
    id: 'voice-monster',
    name: 'Monster',
    effectType: 'voice-monster',
    category: 'voice',
    description: 'Growling distorted voice',
    ffmpegFilter: 'asetrate=44100*0.5,aresample=44100,atempo=2,acrusher=bits=4:mode=log,bass=g=15',
    defaultParameters: { intensity: 1 },
    isBuiltIn: true,
  },
  {
    id: 'voice-radio',
    name: 'Radio',
    effectType: 'voice-radio',
    category: 'voice',
    description: 'AM/FM radio simulation',
    ffmpegFilter: 'highpass=f=300,lowpass=f=3400,acrusher=bits=6:mode=log:aa=1',
    defaultParameters: { intensity: 1 },
    isBuiltIn: true,
  },
  {
    id: 'voice-synth',
    name: 'Synth',
    effectType: 'voice-synth',
    category: 'voice',
    description: 'Synthesizer-processed voice',
    ffmpegFilter: 'aphaser=in_gain=0.9:out_gain=0.9:delay=3:decay=0.6:speed=2,chorus=0.5:0.9:50:0.4:0.25:2',
    defaultParameters: { intensity: 1 },
    isBuiltIn: true,
  },
  {
    id: 'voice-vibrato',
    name: 'Vibrato Voice',
    effectType: 'voice-vibrato',
    category: 'voice',
    description: 'Wobbly pitch modulation',
    ffmpegFilter: 'vibrato=f=6:d=0.5',
    defaultParameters: { rate: 6, depth: 0.5 },
    parameterSchema: [
      { name: 'rate', label: 'Rate', type: 'number', min: 1, max: 20, step: 0.5, default: 6, unit: 'Hz' },
      { name: 'depth', label: 'Depth', type: 'number', min: 0, max: 1, step: 0.1, default: 0.5 },
    ],
    isBuiltIn: true,
  },
];

// ============================================
// Voice Enhancement Effects
// ============================================
const enhancementEffects: AudioEffectPresetData[] = [
  {
    id: 'audio-noise-reduction',
    name: 'Noise Reduction',
    effectType: 'noise-reduction',
    category: 'enhancement',
    description: 'Reduce background noise',
    ffmpegFilter: 'afftdn=nf=${amount}:tn=1',
    defaultParameters: { amount: -25 },
    parameterSchema: [
      { name: 'amount', label: 'Reduction', type: 'number', min: -50, max: 0, step: 1, default: -25, unit: 'dB' },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-wind-reduction',
    name: 'Wind Reduction',
    effectType: 'wind-reduction',
    category: 'enhancement',
    description: 'Reduce wind noise',
    ffmpegFilter: 'highpass=f=100,afftdn=nf=-20:tn=1',
    defaultParameters: { amount: 0.5 },
    parameterSchema: [
      { name: 'amount', label: 'Amount', type: 'number', min: 0, max: 1, step: 0.1, default: 0.5 },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-de-reverb',
    name: 'Reduce Echo',
    effectType: 'de-reverb',
    category: 'enhancement',
    description: 'Reduce room reverb',
    ffmpegFilter: 'agate=threshold=0.02:attack=5:release=50,highpass=f=120',
    defaultParameters: { amount: 0.5 },
    parameterSchema: [
      { name: 'amount', label: 'Amount', type: 'number', min: 0, max: 1, step: 0.1, default: 0.5 },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-speech-enhance',
    name: 'Enhance Speech',
    effectType: 'speech-enhance',
    category: 'enhancement',
    description: 'Boost speech clarity',
    ffmpegFilter: 'highpass=f=80,equalizer=f=3000:width_type=o:width=2:g=4,acompressor=threshold=-20dB:ratio=4:attack=5:release=50',
    defaultParameters: { amount: 1 },
    parameterSchema: [
      { name: 'amount', label: 'Amount', type: 'number', min: 0, max: 1, step: 0.1, default: 1 },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-de-hum',
    name: 'De-Hum',
    effectType: 'de-hum',
    category: 'enhancement',
    description: 'Remove 50/60Hz hum',
    ffmpegFilter: 'bandreject=f=${frequency}:width_type=q:w=5,bandreject=f=${frequency2}:width_type=q:w=5',
    defaultParameters: { frequency: 60, frequency2: 120 },
    parameterSchema: [
      { name: 'frequency', label: 'Frequency', type: 'select', default: 60, options: [{ value: 50, label: '50Hz (EU)' }, { value: 60, label: '60Hz (US)' }] },
    ],
    isBuiltIn: true,
  },
];

// ============================================
// Creative & Stylized Effects
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
  {
    id: 'audio-bitcrusher',
    name: 'Bitcrusher',
    effectType: 'bitcrusher',
    category: 'creative',
    description: 'Lo-fi digital degradation',
    ffmpegFilter: 'acrusher=bits=${bits}:mode=log:aa=0:samples=${samples}',
    defaultParameters: { bits: 8, samples: 4 },
    parameterSchema: [
      { name: 'bits', label: 'Bit Depth', type: 'number', min: 1, max: 16, step: 1, default: 8 },
      { name: 'samples', label: 'Sample Rate Div', type: 'number', min: 1, max: 32, step: 1, default: 4 },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-telephone',
    name: 'Telephone',
    effectType: 'telephone',
    category: 'creative',
    description: 'Band-limited phone effect',
    ffmpegFilter: 'highpass=f=300,lowpass=f=3400',
    defaultParameters: {},
    isBuiltIn: true,
  },
  {
    id: 'audio-radio-effect',
    name: 'Radio Effect',
    effectType: 'radio-effect',
    category: 'creative',
    description: 'AM radio simulation',
    ffmpegFilter: 'highpass=f=300,lowpass=f=3400,acrusher=bits=6:mode=log:aa=1',
    defaultParameters: {},
    isBuiltIn: true,
  },
  {
    id: 'audio-underwater',
    name: 'Underwater',
    effectType: 'underwater',
    category: 'creative',
    description: 'Muffled submerged sound',
    ffmpegFilter: 'lowpass=f=500,aecho=0.8:0.88:60:0.4',
    defaultParameters: { depth: 500 },
    parameterSchema: [
      { name: 'depth', label: 'Depth', type: 'number', min: 200, max: 1000, step: 50, default: 500, unit: 'Hz' },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-robot',
    name: 'Robot Voice',
    effectType: 'robot',
    category: 'creative',
    description: 'Vocoder-style effect',
    ffmpegFilter: 'afftfilt=real=\'re*cos(2*PI*t*30)\':imag=\'im*sin(2*PI*t*30)\'',
    defaultParameters: { frequency: 30 },
    parameterSchema: [
      { name: 'frequency', label: 'Frequency', type: 'number', min: 10, max: 100, step: 5, default: 30, unit: 'Hz' },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-lofi',
    name: 'Lo-Fi',
    effectType: 'lofi',
    category: 'creative',
    description: 'Vintage lo-fi sound',
    ffmpegFilter: 'lowpass=f=4000,acrusher=bits=12:mode=log:aa=1,aecho=0.8:0.88:6:0.4',
    defaultParameters: {},
    isBuiltIn: true,
  },
  {
    id: 'audio-vinyl',
    name: 'Vinyl',
    effectType: 'vinyl',
    category: 'creative',
    description: 'Vinyl record crackle',
    ffmpegFilter: 'lowpass=f=8000,highpass=f=30,aecho=0.8:0.88:6:0.1',
    defaultParameters: {},
    isBuiltIn: true,
  },
];

// ============================================
// Fades & Automation Effects
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
    id: 'audio-crossfade',
    name: 'Crossfade',
    effectType: 'crossfade',
    category: 'fades',
    description: 'Blend between tracks',
    ffmpegFilter: 'acrossfade=d=${duration}:c1=${curve}:c2=${curve}',
    defaultParameters: { duration: 1, curve: 'tri' },
    parameterSchema: [
      { name: 'duration', label: 'Duration', type: 'number', min: 0.1, max: 10, step: 0.1, default: 1, unit: 's' },
      { name: 'curve', label: 'Curve', type: 'select', default: 'tri', options: [
        { value: 'tri', label: 'Linear' },
        { value: 'exp', label: 'Exponential' },
        { value: 'log', label: 'Logarithmic' },
      ]},
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-ducking',
    name: 'Auto Ducking',
    effectType: 'ducking',
    category: 'fades',
    description: 'Lower music when voice detected',
    ffmpegFilter: 'sidechaincompress=threshold=${threshold}dB:ratio=${ratio}:attack=${attack}:release=${release}',
    defaultParameters: { threshold: -30, ratio: 4, attack: 10, release: 200 },
    parameterSchema: [
      { name: 'threshold', label: 'Threshold', type: 'number', min: -60, max: 0, step: 1, default: -30, unit: 'dB' },
      { name: 'ratio', label: 'Ratio', type: 'number', min: 1, max: 20, step: 0.5, default: 4 },
      { name: 'attack', label: 'Attack', type: 'number', min: 1, max: 100, step: 1, default: 10, unit: 'ms' },
      { name: 'release', label: 'Release', type: 'number', min: 50, max: 1000, step: 10, default: 200, unit: 'ms' },
    ],
    isBuiltIn: true,
  },
  {
    id: 'audio-sidechain',
    name: 'Sidechain',
    effectType: 'sidechain',
    category: 'fades',
    description: 'Pumping effect synced to beat',
    ffmpegFilter: 'sidechaincompress=threshold=-20dB:ratio=10:attack=5:release=100',
    defaultParameters: { threshold: -20, ratio: 10, attack: 5, release: 100 },
    parameterSchema: [
      { name: 'threshold', label: 'Threshold', type: 'number', min: -60, max: 0, step: 1, default: -20, unit: 'dB' },
      { name: 'ratio', label: 'Ratio', type: 'number', min: 1, max: 20, step: 0.5, default: 10 },
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
// Export All Categories
// ============================================
export const AUDIO_EFFECT_CATEGORIES: {
  category: AudioEffectCategory;
  label: string;
  icon: string;
  presets: AudioEffectPresetData[];
}[] = [
  { category: 'volume', label: 'Volume & Dynamics', icon: 'volume-2', presets: volumeEffects },
  { category: 'eq', label: 'EQ & Tone', icon: 'sliders', presets: eqEffects },
  { category: 'spatial', label: 'Spatial & Stereo', icon: 'headphones', presets: spatialEffects },
  { category: 'time', label: 'Time-Based', icon: 'clock', presets: timeEffects },
  { category: 'pitch', label: 'Pitch & Speed', icon: 'music', presets: pitchEffects },
  { category: 'voice', label: 'Voice Effects', icon: 'mic', presets: voiceEffects },
  { category: 'enhancement', label: 'Voice Enhancement', icon: 'sparkles', presets: enhancementEffects },
  { category: 'creative', label: 'Creative & Stylized', icon: 'wand-2', presets: creativeEffects },
  { category: 'fades', label: 'Fades & Automation', icon: 'trending-up', presets: fadeEffects },
];

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
