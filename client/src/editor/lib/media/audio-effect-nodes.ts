/**
 * Build Web Audio API filter nodes from audio effect definitions.
 * Returns a chain of AudioNodes that should be inserted between source and gain.
 */
import type { AudioEffect } from "../../types/audio-effects";

export function buildAudioEffectChain(
	ctx: AudioContext,
	effects: AudioEffect[],
): AudioNode[] {
	const nodes: AudioNode[] = [];

	for (const fx of effects) {
		if (!fx.enabled) continue;

		switch (fx.type) {
			case "eq": {
				// 3-band EQ: low shelf, mid peaking, high shelf
				const low = ctx.createBiquadFilter();
				low.type = "lowshelf";
				low.frequency.value = 320;
				low.gain.value = fx.lowGain;
				nodes.push(low);

				const mid = ctx.createBiquadFilter();
				mid.type = "peaking";
				mid.frequency.value = fx.midFreq;
				mid.Q.value = 1;
				mid.gain.value = fx.midGain;
				nodes.push(mid);

				const high = ctx.createBiquadFilter();
				high.type = "highshelf";
				high.frequency.value = 3200;
				high.gain.value = fx.highGain;
				nodes.push(high);
				break;
			}

			case "lowpass": {
				const filter = ctx.createBiquadFilter();
				filter.type = "lowpass";
				filter.frequency.value = fx.frequency;
				filter.Q.value = fx.resonance;
				nodes.push(filter);
				break;
			}

			case "highpass": {
				const filter = ctx.createBiquadFilter();
				filter.type = "highpass";
				filter.frequency.value = fx.frequency;
				filter.Q.value = fx.resonance;
				nodes.push(filter);
				break;
			}

			case "bandpass": {
				const filter = ctx.createBiquadFilter();
				filter.type = "bandpass";
				filter.frequency.value = fx.frequency;
				filter.Q.value = 1 / fx.bandwidth;
				nodes.push(filter);
				break;
			}

			case "noiseReduction": {
				// Approximate noise reduction with a combination of highpass + compressor
				// Real spectral gating would require OfflineAudioContext + FFT
				const hp = ctx.createBiquadFilter();
				hp.type = "highpass";
				hp.frequency.value = 80 + fx.strength * 2; // Higher cutoff = more noise removed
				hp.Q.value = 0.7;
				nodes.push(hp);

				const comp = ctx.createDynamicsCompressor();
				comp.threshold.value = -50 + fx.strength * 0.3;
				comp.knee.value = 30;
				comp.ratio.value = 4;
				comp.attack.value = 0.003;
				comp.release.value = 0.1;
				nodes.push(comp);
				break;
			}

			case "compressor": {
				const comp = ctx.createDynamicsCompressor();
				comp.threshold.value = fx.threshold;
				comp.ratio.value = fx.ratio;
				comp.attack.value = fx.attack / 1000;
				comp.release.value = fx.release / 1000;
				nodes.push(comp);
				break;
			}

			case "bassBoost": {
				const bass = ctx.createBiquadFilter();
				bass.type = "lowshelf";
				bass.frequency.value = fx.frequency;
				bass.gain.value = fx.gain;
				nodes.push(bass);
				break;
			}

			case "vocalEnhance": {
				// Presence boost around 3-5kHz
				const presence = ctx.createBiquadFilter();
				presence.type = "peaking";
				presence.frequency.value = 3500;
				presence.Q.value = 1.5;
				presence.gain.value = fx.presence * 0.08;
				nodes.push(presence);

				// Clarity boost around 8-10kHz
				const clarity = ctx.createBiquadFilter();
				clarity.type = "highshelf";
				clarity.frequency.value = 8000;
				clarity.gain.value = fx.clarity * 0.06;
				nodes.push(clarity);
				break;
			}

			case "telephone": {
				const hp = ctx.createBiquadFilter();
				hp.type = "highpass";
				hp.frequency.value = 300;
				hp.Q.value = 0.7;
				nodes.push(hp);

				const lp = ctx.createBiquadFilter();
				lp.type = "lowpass";
				lp.frequency.value = 3400;
				lp.Q.value = 0.7;
				nodes.push(lp);
				break;
			}

			case "radio": {
				const hp = ctx.createBiquadFilter();
				hp.type = "highpass";
				hp.frequency.value = 500;
				hp.Q.value = 1;
				nodes.push(hp);

				const lp = ctx.createBiquadFilter();
				lp.type = "lowpass";
				lp.frequency.value = 5000;
				lp.Q.value = 1;
				nodes.push(lp);

				const mid = ctx.createBiquadFilter();
				mid.type = "peaking";
				mid.frequency.value = 2000;
				mid.Q.value = 2;
				mid.gain.value = 6;
				nodes.push(mid);
				break;
			}

			case "deesser": {
				// Approximate de-esser with a narrow notch at sibilance frequency
				const notch = ctx.createBiquadFilter();
				notch.type = "peaking";
				notch.frequency.value = fx.frequency;
				notch.Q.value = 5;
				notch.gain.value = fx.threshold * 0.5; // Negative gain to reduce sibilance
				nodes.push(notch);
				break;
			}

			case "limiter": {
				const comp = ctx.createDynamicsCompressor();
				comp.threshold.value = fx.ceiling;
				comp.knee.value = 0;
				comp.ratio.value = 20;
				comp.attack.value = 0.001;
				comp.release.value = 0.01;
				nodes.push(comp);
				break;
			}

			// Effects that need more complex processing (reverb, delay, chorus, etc.)
			// are not easily done with simple Web Audio nodes — skip for now
			default:
				break;
		}
	}

	return nodes;
}

/**
 * Connect a chain of AudioNodes in series: source → node1 → node2 → ... → destination
 */
export function connectChain(source: AudioNode, chain: AudioNode[], destination: AudioNode): void {
	if (chain.length === 0) {
		source.connect(destination);
		return;
	}

	source.connect(chain[0]);
	for (let i = 0; i < chain.length - 1; i++) {
		chain[i].connect(chain[i + 1]);
	}
	chain[chain.length - 1].connect(destination);
}
