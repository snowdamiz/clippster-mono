export type AudioEffectType =
	| "eq"
	| "compressor"
	| "reverb"
	| "delay"
	| "chorus"
	| "distortion"
	| "lowpass"
	| "highpass"
	| "bandpass"
	| "noisegate"
	| "pitchShift"
	| "tremolo"
	| "vocalEnhance"
	| "noiseReduction"
	| "deesser"
	| "limiter"
	| "bassBoost"
	| "telephone"
	| "radio"
	| "echo";

export type AudioEffectCategory = "eq" | "dynamics" | "spatial" | "modulation" | "filter";

export interface AudioEffectBase {
	id: string;
	type: AudioEffectType;
	enabled: boolean;
	mix: number; // 0-100 dry/wet mix
}

export interface EqEffect extends AudioEffectBase {
	type: "eq";
	lowGain: number; // -12 to 12 dB
	midGain: number;
	highGain: number;
	midFreq: number; // 200-5000 Hz
}

export interface CompressorEffect extends AudioEffectBase {
	type: "compressor";
	threshold: number; // -60 to 0 dB
	ratio: number; // 1-20
	attack: number; // 0-100 ms
	release: number; // 10-1000 ms
}

export interface ReverbEffect extends AudioEffectBase {
	type: "reverb";
	decay: number; // 0.1-10 seconds
	preDelay: number; // 0-100 ms
	damping: number; // 0-100
}

export interface DelayEffect extends AudioEffectBase {
	type: "delay";
	time: number; // 0-2000 ms
	feedback: number; // 0-90 percent
}

export interface ChorusEffect extends AudioEffectBase {
	type: "chorus";
	rate: number; // 0.1-10 Hz
	depth: number; // 0-100
}

export interface DistortionEffect extends AudioEffectBase {
	type: "distortion";
	drive: number; // 0-100
	tone: number; // 0-100
}

export interface LowpassEffect extends AudioEffectBase {
	type: "lowpass";
	frequency: number; // 20-20000 Hz
	resonance: number; // 0-20
}

export interface HighpassEffect extends AudioEffectBase {
	type: "highpass";
	frequency: number; // 20-20000 Hz
	resonance: number; // 0-20
}

export interface BandpassEffect extends AudioEffectBase {
	type: "bandpass";
	frequency: number; // 20-20000 Hz
	bandwidth: number; // 0.1-10 octaves
}

export interface NoisegateEffect extends AudioEffectBase {
	type: "noisegate";
	threshold: number; // -80 to 0 dB
	attack: number; // 0-50 ms
	release: number; // 10-500 ms
}

export interface PitchShiftEffect extends AudioEffectBase {
	type: "pitchShift";
	semitones: number; // -12 to 12
}

export interface TremoloEffect extends AudioEffectBase {
	type: "tremolo";
	rate: number; // 0.5-20 Hz
	depth: number; // 0-100
}

export interface VocalEnhanceEffect extends AudioEffectBase {
	type: "vocalEnhance";
	presence: number; // 0-100
	clarity: number; // 0-100
}

export interface NoiseReductionEffect extends AudioEffectBase {
	type: "noiseReduction";
	strength: number; // 0-100
}

export interface DeesserEffect extends AudioEffectBase {
	type: "deesser";
	frequency: number; // 4000-10000 Hz
	threshold: number; // -40 to 0 dB
}

export interface LimiterEffect extends AudioEffectBase {
	type: "limiter";
	ceiling: number; // -6 to 0 dB
}

export interface BassBoostEffect extends AudioEffectBase {
	type: "bassBoost";
	gain: number; // 0-12 dB
	frequency: number; // 60-200 Hz
}

export interface TelephoneEffect extends AudioEffectBase {
	type: "telephone";
}

export interface RadioEffect extends AudioEffectBase {
	type: "radio";
}

export interface EchoEffect extends AudioEffectBase {
	type: "echo";
	delayMs: number; // 100-1000 ms
	decay: number; // 0.1-0.8
}

export type AudioEffect =
	| EqEffect
	| CompressorEffect
	| ReverbEffect
	| DelayEffect
	| ChorusEffect
	| DistortionEffect
	| LowpassEffect
	| HighpassEffect
	| BandpassEffect
	| NoisegateEffect
	| PitchShiftEffect
	| TremoloEffect
	| VocalEnhanceEffect
	| NoiseReductionEffect
	| DeesserEffect
	| LimiterEffect
	| BassBoostEffect
	| TelephoneEffect
	| RadioEffect
	| EchoEffect;

export type AudioEffectDefaults = {
	[K in AudioEffect["type"]]: Omit<Extract<AudioEffect, { type: K }>, "id">;
}[AudioEffect["type"]];

export interface AudioEffectPreset {
	type: AudioEffectType;
	label: string;
	description: string;
	category: AudioEffectCategory;
	defaults: AudioEffectDefaults;
}
