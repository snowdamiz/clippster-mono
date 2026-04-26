import type {
	AudioElement,
	LibraryAudioElement,
	TimelineElement,
	TimelineTrack,
} from "../../types/timeline";
import type { Transition } from "../../types/transitions";
import type { MediaAsset } from "../../types/assets";
import { canElementHaveAudio } from "../../lib/timeline/element-utils";
import { canTracktHaveAudio } from "../../lib/timeline";
import { resolveTransitionMediaPair } from "../../lib/timeline/transition-pairing";
import { mediaSupportsAudio } from "../../lib/media/media-utils";
import { convertFileSrc } from "@tauri-apps/api/core";

export type CollectedAudioElement = Omit<
	AudioElement,
	"type" | "mediaId" | "volume" | "id" | "name" | "sourceType" | "sourceUrl"
> & { buffer: AudioBuffer };

export function createAudioContext(): AudioContext {
	const AudioContextConstructor =
		window.AudioContext ||
		(window as typeof window & { webkitAudioContext?: typeof AudioContext })
			.webkitAudioContext;

	try {
		return new AudioContextConstructor({
			latencyHint: "interactive",
		});
	} catch {
		return new AudioContextConstructor();
	}
}

export interface DecodedAudio {
	samples: Float32Array;
	sampleRate: number;
}

export async function decodeAudioToFloat32({
	audioBlob,
}: {
	audioBlob: Blob;
}): Promise<DecodedAudio> {
	const audioContext = createAudioContext();
	const arrayBuffer = await audioBlob.arrayBuffer();
	const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

	// mix down to mono
	const numChannels = audioBuffer.numberOfChannels;
	const length = audioBuffer.length;
	const samples = new Float32Array(length);

	for (let i = 0; i < length; i++) {
		let sum = 0;
		for (let channel = 0; channel < numChannels; channel++) {
			sum += audioBuffer.getChannelData(channel)[i];
		}
		samples[i] = sum / numChannels;
	}

	return { samples, sampleRate: audioBuffer.sampleRate };
}

export async function collectAudioElements({
	tracks,
	mediaAssets,
	audioContext,
}: {
	tracks: TimelineTrack[];
	mediaAssets: MediaAsset[];
	audioContext: AudioContext;
}): Promise<CollectedAudioElement[]> {
	const mediaMap = new Map<string, MediaAsset>(
		mediaAssets.map((media) => [media.id, media]),
	);
	const pendingElements: Array<Promise<CollectedAudioElement | null>> = [];

	for (const track of tracks) {
		if (canTracktHaveAudio(track) && track.muted) continue;

		for (const element of track.elements) {
			if (element.type !== "audio") continue;
			if (element.duration <= 0) continue;

			const isTrackMuted = canTracktHaveAudio(track) && track.muted;
			pendingElements.push(
				resolveAudioBufferForElement({
					element,
					mediaMap,
					audioContext,
				}).then((audioBuffer) => {
					if (!audioBuffer) return null;
					return {
						buffer: audioBuffer,
						startTime: element.startTime,
						duration: element.duration,
						trimStart: element.trimStart,
						trimEnd: element.trimEnd,
						muted: element.muted || isTrackMuted,
					};
				}),
			);
		}
	}

	const resolvedElements = await Promise.all(pendingElements);
	const audioElements: CollectedAudioElement[] = [];
	for (const element of resolvedElements) {
		if (element) audioElements.push(element);
	}
	return audioElements;
}

async function resolveAudioBufferForElement({
	element,
	mediaMap,
	audioContext,
}: {
	element: AudioElement;
	mediaMap: Map<string, MediaAsset>;
	audioContext: AudioContext;
}): Promise<AudioBuffer | null> {
	try {
		if (element.sourceType === "upload") {
			const asset = mediaMap.get(element.mediaId);
			if (!asset || asset.type !== "audio") return null;

			const arrayBuffer = await asset.file.arrayBuffer();
			return await audioContext.decodeAudioData(arrayBuffer.slice(0));
		}

		if (element.buffer) return element.buffer;

		const url = convertFileSrc(element.sourceUrl);
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Library audio fetch failed: ${response.status}`);
		}

		const arrayBuffer = await response.arrayBuffer();
		return await audioContext.decodeAudioData(arrayBuffer.slice(0));
	} catch (error) {
		console.warn("Failed to decode audio:", error);
		return null;
	}
}

interface AudioMixSource {
	file: File;
	startTime: number;
	duration: number;
	trimStart: number;
	trimEnd: number;
}

export interface AudioClipSource {
	id: string;
	sourceKey: string;
	file: File;
	startTime: number;
	duration: number;
	trimStart: number;
	trimEnd: number;
	muted: boolean;
	volume: number;
	speed: number;
	fadeIn: number;
	fadeOut: number;
	transitionExtensionBefore?: number;
	transitionExtensionAfter?: number;
	transitionFadeInDuration?: number;
	transitionFadeOutDuration?: number;
	audioEffects?: import("../../types/audio-effects").AudioEffect[];
	pan?: number; // -1 (left) to +1 (right), 0 = center
}

type AudioTransitionTiming = {
	before: number;
	after: number;
	fadeInDuration: number;
	fadeOutDuration: number;
};

async function fetchLibraryAudioSource({
	element,
}: {
	element: LibraryAudioElement;
}): Promise<AudioMixSource | null> {
	try {
		const url = convertFileSrc(element.sourceUrl);
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Library audio fetch failed: ${response.status}`);
		}

		const blob = await response.blob();
		const file = new File([blob], `${element.name}.mp3`, {
			type: "audio/mpeg",
		});

		return {
			file,
			startTime: element.startTime,
			duration: element.duration,
			trimStart: element.trimStart,
			trimEnd: element.trimEnd,
		};
	} catch (error) {
		console.warn("Failed to fetch library audio:", error);
		return null;
	}
}

async function fetchLibraryAudioClip({
	element,
	muted,
	volume,
	speed,
	fadeIn,
	fadeOut,
}: {
	element: LibraryAudioElement;
	muted: boolean;
	volume: number;
	speed: number;
	fadeIn: number;
	fadeOut: number;
}): Promise<AudioClipSource | null> {
	try {
		const url = convertFileSrc(element.sourceUrl);
		const response = await fetch(url);
		if (!response.ok) {
			throw new Error(`Library audio fetch failed: ${response.status}`);
		}

		const blob = await response.blob();
		const file = new File([blob], `${element.name}.mp3`, {
			type: "audio/mpeg",
		});

		return {
			id: element.id,
			sourceKey: element.id,
			file,
			startTime: element.startTime,
			duration: element.duration,
			trimStart: element.trimStart,
			trimEnd: element.trimEnd,
			muted,
			volume,
			speed,
			fadeIn,
			fadeOut,
		};
	} catch (error) {
		console.warn("Failed to fetch library audio:", error);
		return null;
	}
}

function collectMediaAudioSource({
	element,
	mediaAsset,
}: {
	element: TimelineElement;
	mediaAsset: MediaAsset;
}): AudioMixSource {
	return {
		file: mediaAsset.file,
		startTime: element.startTime,
		duration: element.duration,
		trimStart: element.trimStart,
		trimEnd: element.trimEnd,
	};
}

function collectMediaAudioClip({
	element,
	mediaAsset,
	muted,
	volume,
	speed,
	fadeIn,
	fadeOut,
	transitionTiming,
}: {
	element: TimelineElement;
	mediaAsset: MediaAsset;
	muted: boolean;
	volume: number;
	speed: number;
	fadeIn: number;
	fadeOut: number;
	transitionTiming?: AudioTransitionTiming;
}): AudioClipSource {
	return {
		id: element.id,
		sourceKey: mediaAsset.id,
		file: mediaAsset.file,
		startTime: element.startTime,
		duration: element.duration,
		trimStart: element.trimStart,
		trimEnd: element.trimEnd,
		muted,
		volume,
		speed,
		fadeIn,
		fadeOut,
		transitionExtensionBefore: transitionTiming?.before,
		transitionExtensionAfter: transitionTiming?.after,
		transitionFadeInDuration: transitionTiming?.fadeInDuration,
		transitionFadeOutDuration: transitionTiming?.fadeOutDuration,
		audioEffects: (element as any).audioEffects,
		pan: (element as any).pan,
	};
}

function buildAudioTransitionTimingMap({
	tracks,
	transitions,
}: {
	tracks: TimelineTrack[];
	transitions?: Transition[];
}): Map<string, AudioTransitionTiming> {
	const timingByElementId = new Map<string, AudioTransitionTiming>();

	for (const track of tracks) {
		if (track.type !== "video") continue;

		for (const transition of transitions ?? []) {
			if (!track.elements.some((element) => element.id === transition.targetElementId)) {
				continue;
			}

			const pair = resolveTransitionMediaPair({ transition, track });
			if (!pair) continue;

			const duration = Math.max(0, transition.duration);
			const halfDuration = duration / 2;

			const outgoingTiming = timingByElementId.get(pair.outgoing.id) ?? {
				before: 0,
				after: 0,
				fadeInDuration: 0,
				fadeOutDuration: 0,
			};
			outgoingTiming.after = Math.max(outgoingTiming.after, halfDuration);
			outgoingTiming.fadeOutDuration = Math.max(outgoingTiming.fadeOutDuration, duration);
			timingByElementId.set(pair.outgoing.id, outgoingTiming);

			const incomingTiming = timingByElementId.get(pair.incoming.id) ?? {
				before: 0,
				after: 0,
				fadeInDuration: 0,
				fadeOutDuration: 0,
			};
			incomingTiming.before = Math.max(incomingTiming.before, halfDuration);
			incomingTiming.fadeInDuration = Math.max(incomingTiming.fadeInDuration, duration);
			timingByElementId.set(pair.incoming.id, incomingTiming);
		}
	}

	return timingByElementId;
}

export async function collectAudioMixSources({
	tracks,
	mediaAssets,
}: {
	tracks: TimelineTrack[];
	mediaAssets: MediaAsset[];
}): Promise<AudioMixSource[]> {
	const audioMixSources: AudioMixSource[] = [];
	const mediaMap = new Map<string, MediaAsset>(
		mediaAssets.map((asset) => [asset.id, asset]),
	);
	const pendingLibrarySources: Array<Promise<AudioMixSource | null>> = [];

	for (const track of tracks) {
		if (canTracktHaveAudio(track) && track.muted) continue;

		for (const element of track.elements) {
			if (!canElementHaveAudio(element)) continue;

			if (element.type === "audio") {
				if (element.sourceType === "upload") {
					const mediaAsset = mediaMap.get(element.mediaId);
					if (!mediaAsset) continue;

					audioMixSources.push(
						collectMediaAudioSource({ element, mediaAsset }),
					);
				} else {
					pendingLibrarySources.push(fetchLibraryAudioSource({ element }));
				}
				continue;
			}

			if (element.type === "video") {
				const mediaAsset = mediaMap.get(element.mediaId);
				if (!mediaAsset) continue;

				if (mediaSupportsAudio({ media: mediaAsset })) {
					audioMixSources.push(
						collectMediaAudioSource({ element, mediaAsset }),
					);
				}
			}
		}
	}

	const resolvedLibrarySources = await Promise.all(pendingLibrarySources);
	for (const source of resolvedLibrarySources) {
		if (source) audioMixSources.push(source);
	}

	return audioMixSources;
}

export async function collectAudioClips({
	tracks,
	mediaAssets,
	transitions,
}: {
	tracks: TimelineTrack[];
	mediaAssets: MediaAsset[];
	transitions?: Transition[];
}): Promise<AudioClipSource[]> {
	const clips: AudioClipSource[] = [];
	// During project load, listeners can fire before media rows exist — avoid bogus warnings and
	// poisoning clip caches with unresolved references.
	if (mediaAssets.length === 0) {
		return [];
	}

	const mediaMap = new Map<string, MediaAsset>(
		mediaAssets.map((asset) => [asset.id, asset]),
	);
	const transitionTimingByElementId = buildAudioTransitionTimingMap({
		tracks,
		transitions,
	});
	const pendingLibraryClips: Array<Promise<AudioClipSource | null>> = [];

	for (const track of tracks) {
		const isTrackMuted = canTracktHaveAudio(track) && track.muted;

		for (const element of track.elements) {
			if (!canElementHaveAudio(element)) {
				continue;
			}

			const isElementMuted =
				"muted" in element ? (element.muted ?? false) : false;
			const muted = isTrackMuted || isElementMuted;

			if (element.type === "audio") {
				const volume = element.volume ?? 1;
				const speed = element.speed ?? 1;
				const fadeIn = element.fadeIn ?? 0;
				const fadeOut = element.fadeOut ?? 0;
				const transitionTiming = element.linkedElementId
					? transitionTimingByElementId.get(element.linkedElementId)
					: undefined;
				if (element.sourceType === "upload") {
					const mediaAsset = mediaMap.get(element.mediaId);
					if (!mediaAsset) continue;

					clips.push(
						collectMediaAudioClip({
							element,
							mediaAsset,
							muted,
							volume,
							speed,
							fadeIn,
							fadeOut,
							transitionTiming,
						}),
					);
				} else {
					pendingLibraryClips.push(fetchLibraryAudioClip({ element, muted, volume, speed, fadeIn, fadeOut }));
				}
				continue;
			}

			if (element.type === "video") {
				const mediaAsset = mediaMap.get(element.mediaId);
				if (!mediaAsset) {
					console.warn(`[collectAudioClips] Video element ${element.id} has no media asset (mediaId: ${element.mediaId})`);
					continue;
				}

				if (mediaSupportsAudio({ media: mediaAsset })) {
					clips.push(
						collectMediaAudioClip({
							element,
							mediaAsset,
							muted,
							volume: element.volume ?? 1,
							speed: element.speed ?? 1,
							fadeIn: element.fadeIn ?? 0,
							fadeOut: element.fadeOut ?? 0,
							transitionTiming: transitionTimingByElementId.get(element.id),
						}),
					);
				} else {
					console.warn(`[collectAudioClips] Video element ${element.id} media asset does not support audio (type: ${mediaAsset.type})`);
				}
			}
		}
	}

	const resolvedLibraryClips = await Promise.all(pendingLibraryClips);
	for (const clip of resolvedLibraryClips) {
		if (clip) clips.push(clip);
	}

	return clips;
}

export async function createTimelineAudioBuffer({
	tracks,
	mediaAssets,
	duration,
	sampleRate = 44100,
	audioContext,
}: {
	tracks: TimelineTrack[];
	mediaAssets: MediaAsset[];
	duration: number;
	sampleRate?: number;
	audioContext?: AudioContext;
}): Promise<AudioBuffer | null> {
	const context = audioContext ?? createAudioContext();

	const audioElements = await collectAudioElements({
		tracks,
		mediaAssets,
		audioContext: context,
	});

	if (audioElements.length === 0) return null;

	const outputChannels = 2;
	const outputLength = Math.ceil(duration * sampleRate);
	const outputBuffer = context.createBuffer(
		outputChannels,
		outputLength,
		sampleRate,
	);

	for (const element of audioElements) {
		if (element.muted) continue;

		mixAudioChannels({
			element,
			outputBuffer,
			outputLength,
			sampleRate,
		});
	}

	return outputBuffer;
}

function mixAudioChannels({
	element,
	outputBuffer,
	outputLength,
	sampleRate,
}: {
	element: CollectedAudioElement;
	outputBuffer: AudioBuffer;
	outputLength: number;
	sampleRate: number;
}): void {
	const { buffer, startTime, trimStart, duration: elementDuration } = element;

	const sourceStartSample = Math.floor(trimStart * buffer.sampleRate);
	const sourceLengthSamples = Math.floor(elementDuration * buffer.sampleRate);
	const outputStartSample = Math.floor(startTime * sampleRate);

	const resampleRatio = sampleRate / buffer.sampleRate;
	const resampledLength = Math.floor(sourceLengthSamples * resampleRatio);

	const outputChannels = 2;
	for (let channel = 0; channel < outputChannels; channel++) {
		const outputData = outputBuffer.getChannelData(channel);
		const sourceChannel = Math.min(channel, buffer.numberOfChannels - 1);
		const sourceData = buffer.getChannelData(sourceChannel);

		for (let i = 0; i < resampledLength; i++) {
			const outputIndex = outputStartSample + i;
			if (outputIndex >= outputLength) break;

			const sourceIndex = sourceStartSample + Math.floor(i / resampleRatio);
			if (sourceIndex >= sourceData.length) break;

			outputData[outputIndex] += sourceData[sourceIndex];
		}
	}
}
