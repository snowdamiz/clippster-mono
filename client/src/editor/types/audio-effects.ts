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
	| "tremolo";

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
	| TremoloEffect;

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
