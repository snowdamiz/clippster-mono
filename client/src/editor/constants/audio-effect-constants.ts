import type { AudioEffectPreset, AudioEffectCategory } from "../types/audio-effects";

export const AUDIO_EFFECT_CATEGORIES: { key: AudioEffectCategory; label: string }[] = [
	{ key: "eq", label: "EQ" },
	{ key: "dynamics", label: "Dynamics" },
	{ key: "filter", label: "Filter" },
	{ key: "spatial", label: "Spatial" },
	{ key: "modulation", label: "Modulation" },
];

export const AUDIO_EFFECT_PRESETS: AudioEffectPreset[] = [
	// ── EQ ──
	{
		type: "eq",
		label: "3-Band EQ",
		description: "Low, mid, and high frequency adjustment",
		category: "eq",
		defaults: {
			type: "eq",
			enabled: true,
			mix: 100,
			lowGain: 0,
			midGain: 0,
			highGain: 0,
			midFreq: 1000,
		},
	},

	// ── Dynamics ──
	{
		type: "compressor",
		label: "Compressor",
		description: "Reduce dynamic range for consistent volume",
		category: "dynamics",
		defaults: {
			type: "compressor",
			enabled: true,
			mix: 100,
			threshold: -20,
			ratio: 4,
			attack: 10,
			release: 100,
		},
	},
	{
		type: "noisegate",
		label: "Noise Gate",
		description: "Silence audio below a threshold",
		category: "dynamics",
		defaults: {
			type: "noisegate",
			enabled: true,
			mix: 100,
			threshold: -40,
			attack: 5,
			release: 50,
		},
	},

	// ── Filter ──
	{
		type: "lowpass",
		label: "Low Pass",
		description: "Cut high frequencies",
		category: "filter",
		defaults: {
			type: "lowpass",
			enabled: true,
			mix: 100,
			frequency: 5000,
			resonance: 1,
		},
	},
	{
		type: "highpass",
		label: "High Pass",
		description: "Cut low frequencies",
		category: "filter",
		defaults: {
			type: "highpass",
			enabled: true,
			mix: 100,
			frequency: 200,
			resonance: 1,
		},
	},
	{
		type: "bandpass",
		label: "Band Pass",
		description: "Isolate a frequency range",
		category: "filter",
		defaults: {
			type: "bandpass",
			enabled: true,
			mix: 100,
			frequency: 1000,
			bandwidth: 1,
		},
	},

	// ── Spatial ──
	{
		type: "reverb",
		label: "Reverb",
		description: "Add room ambience and space",
		category: "spatial",
		defaults: {
			type: "reverb",
			enabled: true,
			mix: 30,
			decay: 2,
			preDelay: 20,
			damping: 50,
		},
	},
	{
		type: "delay",
		label: "Delay",
		description: "Echo effect with feedback",
		category: "spatial",
		defaults: {
			type: "delay",
			enabled: true,
			mix: 30,
			time: 250,
			feedback: 40,
		},
	},

	// ── Modulation ──
	{
		type: "chorus",
		label: "Chorus",
		description: "Thicken sound with detuned copies",
		category: "modulation",
		defaults: {
			type: "chorus",
			enabled: true,
			mix: 50,
			rate: 1.5,
			depth: 50,
		},
	},
	{
		type: "tremolo",
		label: "Tremolo",
		description: "Rhythmic volume modulation",
		category: "modulation",
		defaults: {
			type: "tremolo",
			enabled: true,
			mix: 100,
			rate: 5,
			depth: 50,
		},
	},
	{
		type: "pitchShift",
		label: "Pitch Shift",
		description: "Change pitch without changing speed",
		category: "modulation",
		defaults: {
			type: "pitchShift",
			enabled: true,
			mix: 100,
			semitones: 0,
		},
	},
	{
		type: "distortion",
		label: "Distortion",
		description: "Add grit and overdrive",
		category: "modulation",
		defaults: {
			type: "distortion",
			enabled: true,
			mix: 50,
			drive: 50,
			tone: 50,
		},
	},
];

export function getAudioEffectPreset(type: string): AudioEffectPreset | undefined {
	return AUDIO_EFFECT_PRESETS.find((p) => p.type === type);
}
