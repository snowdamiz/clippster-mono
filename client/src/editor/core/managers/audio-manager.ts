import { watch } from "vue";
import type { EditorCore } from "../../core";
import type { AudioClipSource } from "../../lib/media/audio";
import { createAudioContext, collectAudioClips } from "../../lib/media/audio";
import {
	clipVolumeDraftVersion,
	getClipVolumeDraft,
} from "../../lib/clip-volume-draft";
import { buildAudioEffectChain, connectChain } from "../../lib/media/audio-effect-nodes";
import {
	ALL_FORMATS,
	AudioBufferSink,
	BlobSource,
	Input,
	type WrappedAudioBuffer,
} from "mediabunny";

function buildAudioTimelineSignature(editor: EditorCore): string {
	const tracks = editor.timeline.getTracks();
	const mediaAssets = editor.media.getAssets();
	let transitions;
	try {
		transitions = editor.scenes.getActiveScene().transitions;
	} catch {
		transitions = undefined;
	}

	const media = mediaAssets.map((asset) => ({
		id: asset.id,
		type: asset.type,
		name: asset.file.name,
		size: asset.file.size,
		lastModified: asset.file.lastModified,
	}));

	const audioTracks = tracks.map((track) => ({
		id: track.id,
		type: track.type,
		muted: "muted" in track ? track.muted ?? false : false,
		elements: track.elements
			.filter((element) => element.type === "video" || element.type === "audio")
			.map((element) => {
				if (element.type === "audio") {
					return {
						id: element.id,
						type: element.type,
						mediaId: element.sourceType === "upload" ? element.mediaId : null,
						sourceType: element.sourceType,
						sourceUrl: element.sourceType === "library" ? element.sourceUrl : null,
						startTime: element.startTime,
						duration: element.duration,
						trimStart: element.trimStart,
						trimEnd: element.trimEnd,
						muted: element.muted ?? false,
						volume: element.volume ?? 1,
						speed: element.speed ?? 1,
						fadeIn: element.fadeIn ?? 0,
						fadeOut: element.fadeOut ?? 0,
						audioEffects: element.audioEffects ?? null,
						pan: element.pan ?? null,
						linkedElementId: element.linkedElementId ?? null,
					};
				}

				return {
					id: element.id,
					type: element.type,
					mediaId: element.mediaId,
					startTime: element.startTime,
					duration: element.duration,
					trimStart: element.trimStart,
					trimEnd: element.trimEnd,
					muted: element.muted ?? false,
					volume: element.volume ?? 1,
					speed: element.speed ?? 1,
					fadeIn: element.fadeIn ?? 0,
					fadeOut: element.fadeOut ?? 0,
					audioEffects: "audioEffects" in element ? element.audioEffects ?? null : null,
					pan: element.pan ?? null,
				};
			}),
	}));

	const audioTransitions = (transitions ?? []).map((transition) => ({
		id: transition.id,
		type: transition.type,
		targetElementId: transition.targetElementId,
		duration: transition.duration,
	}));

	return JSON.stringify({ media, tracks: audioTracks, transitions: audioTransitions });
}

export class AudioManager {
	private audioContext: AudioContext | null = null;
	private masterGain: GainNode | null = null;
	private playbackStartTime = 0;
	private playbackStartContextTime = 0;
	private scheduleTimer: number | null = null;
	private lookaheadSeconds = 5;
	private scheduleIntervalMs = 250;
	private audioQueueAheadSeconds = 4;
	private audioQueueResumeThresholdSeconds = 2;
	private clips: AudioClipSource[] = [];
	private clipLastBufferTime = new Map<string, number>();
	private clipHealthCheckTimer: number | null = null;
	private sinks = new Map<string, AudioBufferSink>();
	private inputs = new Map<string, Input>();
	private activeClipIds = new Set<string>();
	private clipIterators = new Map<
		string,
		AsyncGenerator<WrappedAudioBuffer, void, unknown>
	>();
	private queuedSources = new Set<AudioBufferSourceNode>();
	private playbackSessionId = 0;
	private lastIsPlaying = false;
	private lastVolume = 1;
	private unsubscribers: Array<() => void> = [];
	private nativeBuffers = new Map<string, AudioBuffer>();
	private nativeFailedKeys = new Set<string>();
	private clipsReady = false;
	private clipLoadPromise: Promise<AudioClipSource[]> | null = null;
	private clipCacheVersion = 0;
	private lastAudioTimelineSignature = "";
	private activeClipGains = new Map<string, GainNode[]>();
	private stopDraftVolumeWatch: (() => void) | null = null;

	constructor(private editor: EditorCore) {
		this.lastVolume = this.editor.playback.getVolume();

		this.unsubscribers.push(
			this.editor.playback.subscribe(this.handlePlaybackChange),
			this.editor.timeline.subscribe(this.handleTimelineChange),
			this.editor.media.subscribe(this.handleTimelineChange),
			// Scene-only updates (e.g. heal orphan mediaIds) must refresh audio clip resolution
			this.editor.scenes.subscribe(this.handleTimelineChange),
		);
		if (typeof window !== "undefined") {
			window.addEventListener("playback-seek", this.handleSeek);
		}

		this.stopDraftVolumeWatch = watch(clipVolumeDraftVersion, () => {
			this.refreshActiveClipPreviewVolumes();
		});
	}

	dispose(): void {
		this.stopDraftVolumeWatch?.();
		this.stopDraftVolumeWatch = null;
		this.activeClipGains.clear();
		this.stopPlayback();
		for (const unsub of this.unsubscribers) {
			unsub();
		}
		this.unsubscribers = [];
		if (typeof window !== "undefined") {
			window.removeEventListener("playback-seek", this.handleSeek);
		}
		this.stopHealthCheck();
		this.disposeSinks();
		if (this.audioContext) {
			void this.audioContext.close();
			this.audioContext = null;
			this.masterGain = null;
		}
	}

	private handlePlaybackChange = (): void => {
		const isPlaying = this.editor.playback.getIsPlaying();
		const volume = this.editor.playback.getVolume();

		if (volume !== this.lastVolume) {
			this.lastVolume = volume;
			this.updateGain();
		}

		if (isPlaying !== this.lastIsPlaying) {
			this.lastIsPlaying = isPlaying;
			if (isPlaying) {
				// Resume the AudioContext synchronously while still inside the user
				// gesture (click/keyboard). Deferred resume after async clip loading
				// can fail in embedded webviews and leave video playing without audio.
				const audioContext = this.ensureAudioContext();
				if (audioContext?.state === "suspended") {
					void audioContext.resume();
				}
				void this.startPlayback({
					time: this.editor.playback.getCurrentTime(),
				});
			} else {
				this.stopPlayback();
			}
		}
	};

	private handleSeek = (event: Event): void => {
		const detail = (event as CustomEvent<{ time: number }>).detail;
		if (!detail) return;

		if (this.editor.playback.getIsPlaying()) {
			void this.startPlayback({ time: detail.time });
			return;
		}

		this.stopPlayback();
	};

	private handleTimelineChange = (): void => {
		const nextSignature = buildAudioTimelineSignature(this.editor);
		if (nextSignature === this.lastAudioTimelineSignature) {
			return;
		}
		this.lastAudioTimelineSignature = nextSignature;

		this.invalidateClipCache();
		this.stopPlayback();
		this.disposeSinks();

		if (!this.editor.playback.getIsPlaying()) {
			// Preload audio buffers for clips on timeline
			void this.preloadClips();
			return;
		}

		void this.startPlayback({ time: this.editor.playback.getCurrentTime() });
	};

	private ensureAudioContext(): AudioContext | null {
		if (this.audioContext) return this.audioContext;
		if (typeof window === "undefined") return null;

		this.audioContext = createAudioContext();
		this.masterGain = this.audioContext.createGain();
		this.masterGain.gain.value = this.lastVolume;
		this.masterGain.connect(this.audioContext.destination);
		return this.audioContext;
	}

	private updateGain(): void {
		if (!this.masterGain) return;
		this.masterGain.gain.value = this.lastVolume;
	}

	private getPlaybackTime(): number {
		if (!this.audioContext) return this.playbackStartTime;
		const elapsed = this.audioContext.currentTime - this.playbackStartContextTime;
		return this.playbackStartTime + elapsed;
	}

	private getTransitionExtensionBefore(clip: AudioClipSource): number {
		return Math.max(0, Math.min(clip.transitionExtensionBefore ?? 0, clip.startTime));
	}

	private getTransitionExtensionAfter(clip: AudioClipSource): number {
		return Math.max(0, clip.transitionExtensionAfter ?? 0);
	}

	private getEffectiveClipStart(clip: AudioClipSource): number {
		return clip.startTime - this.getTransitionExtensionBefore(clip);
	}

	private getEffectiveClipEnd(clip: AudioClipSource): number {
		return clip.startTime + clip.duration + this.getTransitionExtensionAfter(clip);
	}

	private getEffectiveClipElapsed({ clip, timelineTime }: { clip: AudioClipSource; timelineTime: number }): number {
		return Math.max(0, timelineTime - this.getEffectiveClipStart(clip));
	}

	private getEffectiveClipVolume(elementId: string, committedVolume: number): number {
		return getClipVolumeDraft(elementId) ?? committedVolume;
	}

	private registerActiveClipGain(elementId: string, gainNode: GainNode): void {
		const existing = this.activeClipGains.get(elementId) ?? [];
		existing.push(gainNode);
		this.activeClipGains.set(elementId, existing);
	}

	private refreshActiveClipPreviewVolumes(): void {
		const audioContext = this.audioContext;
		if (!audioContext || !this.editor.playback.getIsPlaying()) return;

		const timelineNow = this.getPlaybackTime();
		const now = audioContext.currentTime;

		for (const clip of this.clips) {
			const gainNodes = this.activeClipGains.get(clip.id);
			if (!gainNodes || gainNodes.length === 0) continue;

			const effectiveStart = this.getEffectiveClipStart(clip);
			const effectiveEnd = this.getEffectiveClipEnd(clip);
			if (timelineNow < effectiveStart || timelineNow >= effectiveEnd) continue;

			for (const clipGain of gainNodes) {
				this.applyClipGainAutomation({
					clip,
					clipGain,
					actualStartTime: now,
					timelineTime: timelineNow,
					scheduledTimelineDuration: Math.max(0.1, effectiveEnd - timelineNow),
					replaceExistingAutomation: true,
				});
			}
		}
	}

	private applyClipGainAutomation({
		clip,
		clipGain,
		actualStartTime,
		timelineTime,
		scheduledTimelineDuration,
		replaceExistingAutomation = false,
	}: {
		clip: AudioClipSource;
		clipGain: GainNode;
		actualStartTime: number;
		timelineTime: number;
		scheduledTimelineDuration: number;
		replaceExistingAutomation?: boolean;
	}): void {
		const effectiveStart = this.getEffectiveClipStart(clip);
		const effectiveEnd = this.getEffectiveClipEnd(clip);
		const transitionFadeInDuration = Math.max(0, clip.transitionFadeInDuration ?? 0);
		const transitionFadeOutDuration = Math.max(0, clip.transitionFadeOutDuration ?? 0);
		const gainAtTimelineTime = (time: number): number => {
			const elapsedInClip = Math.max(0, time - effectiveStart);
			const timeUntilEnd = Math.max(0, effectiveEnd - time);
			const naturalFadeIn = clip.fadeIn > 0 ? Math.min(clip.fadeIn, elapsedInClip) / clip.fadeIn : 1;
			const naturalFadeOut = clip.fadeOut > 0 && timeUntilEnd < clip.fadeOut
				? Math.max(0, Math.min(1, timeUntilEnd / clip.fadeOut))
				: 1;
			const transitionFadeIn = transitionFadeInDuration > 0
				? Math.max(0, Math.min(1, elapsedInClip / transitionFadeInDuration))
				: 1;
			const transitionFadeOut = transitionFadeOutDuration > 0 && timeUntilEnd < transitionFadeOutDuration
				? Math.max(0, Math.min(1, timeUntilEnd / transitionFadeOutDuration))
				: 1;

			return (
				this.getEffectiveClipVolume(clip.id, clip.volume) *
				Math.min(naturalFadeIn, naturalFadeOut, transitionFadeIn, transitionFadeOut)
			);
		};

		const windowStart = Math.max(effectiveStart, timelineTime);
		const windowEnd = Math.min(effectiveEnd, timelineTime + Math.max(0, scheduledTimelineDuration));
		if (windowEnd <= windowStart) {
			clipGain.gain.setValueAtTime(gainAtTimelineTime(timelineTime), actualStartTime);
			return;
		}

		if (replaceExistingAutomation) {
			clipGain.gain.cancelScheduledValues(actualStartTime);
		}

		clipGain.gain.setValueAtTime(gainAtTimelineTime(windowStart), actualStartTime);

		const rampPoints = [
			effectiveStart + clip.fadeIn,
			effectiveStart + transitionFadeInDuration,
			effectiveEnd - clip.fadeOut,
			effectiveEnd - transitionFadeOutDuration,
			windowEnd,
		]
			.filter((point) => point > windowStart + 0.001 && point <= windowEnd + 0.001)
			.sort((a, b) => a - b);

		for (const point of rampPoints) {
			const clampedPoint = Math.min(windowEnd, point);
			const contextTime = actualStartTime + (clampedPoint - windowStart);
			clipGain.gain.linearRampToValueAtTime(gainAtTimelineTime(clampedPoint), contextTime);
		}
	}

	private async startPlayback({ time }: { time: number }): Promise<void> {
		const audioContext = this.ensureAudioContext();
		if (!audioContext) return;

		this.stopPlayback();
		const sessionId = ++this.playbackSessionId;
		const duration = this.editor.timeline.getTotalDuration();

		if (duration <= 0) return;

		if (audioContext.state === "suspended") {
			await audioContext.resume();
		}
		if (sessionId !== this.playbackSessionId) return;

		this.clips = await this.ensureClipsLoaded();
		if (!this.editor.playback.getIsPlaying()) return;
		if (sessionId !== this.playbackSessionId) return;

		await this.preloadNativeBuffers(this.clips);
		if (!this.editor.playback.getIsPlaying()) return;
		if (sessionId !== this.playbackSessionId) return;

		// Anchor after audio prep. If decoding was late, start from the current playhead
		// instead of trying to catch up from the original click and skipping large regions.
		this.playbackStartTime = this.editor.playback.getCurrentTime();
		this.playbackStartContextTime = audioContext.currentTime;

		this.scheduleUpcomingClips();

		if (typeof window !== "undefined") {
			this.scheduleTimer = window.setInterval(() => {
				this.scheduleUpcomingClips();
			}, this.scheduleIntervalMs);
			this.startHealthCheck();
		}
	}

	private scheduleUpcomingClips(): void {
		if (!this.editor.playback.getIsPlaying()) return;

		const currentTime = this.getPlaybackTime();
		const windowEnd = currentTime + this.lookaheadSeconds;

		for (const clip of this.clips) {
			if (clip.muted) continue;
			if (this.activeClipIds.has(clip.id)) continue;

			const clipStart = this.getEffectiveClipStart(clip);
			const clipEnd = this.getEffectiveClipEnd(clip);
			if (clipEnd <= currentTime) continue;
			if (clipStart > windowEnd) continue;

			this.activeClipIds.add(clip.id);
			this.runClipIterator({ clip, startTime: currentTime, sessionId: this.playbackSessionId })
				.catch((err) => {
					console.warn(`[AudioManager] Audio playback failed for clip ${clip.id}:`, err);
					this.activeClipIds.delete(clip.id);
				});
		}
	}

	private stopPlayback(): void {
		if (this.scheduleTimer && typeof window !== "undefined") {
			window.clearInterval(this.scheduleTimer);
		}
		this.scheduleTimer = null;
		this.stopHealthCheck();

		for (const iterator of this.clipIterators.values()) {
			void iterator.return();
		}
		this.clipIterators.clear();
		this.activeClipIds.clear();
		this.clipLastBufferTime.clear();

		for (const source of this.queuedSources) {
			try {
				source.stop();
			} catch {}
			source.disconnect();
		}
		this.queuedSources.clear();
		this.activeClipGains.clear();
	}

	private invalidateClipCache(): void {
		this.clipCacheVersion += 1;
		this.clips = [];
		this.clipsReady = false;
		this.clipLoadPromise = null;
	}

	private async ensureClipsLoaded(): Promise<AudioClipSource[]> {
		if (this.clipsReady) {
			return this.clips;
		}

		if (this.clipLoadPromise) {
			return this.clipLoadPromise;
		}

		const cacheVersion = this.clipCacheVersion;
		const tracks = this.editor.timeline.getTracks();
		const mediaAssets = this.editor.media.getAssets();
		const timelineExpectsMedia = tracks.some((t) =>
			(t.elements ?? []).some((el) => {
				if (el.type === "video") return true;
				if (el.type === "audio" && "sourceType" in el && (el as { sourceType: string }).sourceType === "upload")
					return true;
				return false;
			}),
		);
		let transitions;
		try {
			transitions = this.editor.scenes.getActiveScene().transitions;
		} catch {
			transitions = undefined;
		}

		const clipLoadPromise = collectAudioClips({ tracks, mediaAssets, transitions })
			.then((clips) => {
				if (cacheVersion !== this.clipCacheVersion) {
					return this.clips;
				}

				// Do not lock in an empty clip list while the timeline references media but assets
				// are not loaded yet (e.g. notify between clearAllAssets and loadProjectMedia).
				if (mediaAssets.length === 0 && timelineExpectsMedia) {
					this.clipLoadPromise = null;
					return this.clips;
				}

				this.clips = clips;
				this.clipsReady = true;
				return clips;
			})
			.catch((error) => {
				if (cacheVersion === this.clipCacheVersion) {
					this.clipLoadPromise = null;
				}
				throw error;
			})
			.finally(() => {
				if (
					cacheVersion === this.clipCacheVersion &&
					this.clipLoadPromise === clipLoadPromise
				) {
					this.clipLoadPromise = null;
				}
			});

		this.clipLoadPromise = clipLoadPromise;
		return clipLoadPromise;
	}

	private async runClipIterator({
		clip,
		startTime,
		sessionId,
	}: {
		clip: AudioClipSource;
		startTime: number;
		sessionId: number;
	}): Promise<void> {
		const audioContext = this.ensureAudioContext();
		if (!audioContext) {
			this.activeClipIds.delete(clip.id);
			return;
		}

		let didSchedule = false;
		try {
			if (await this.runNativeFallback({ clip, startTime, sessionId })) {
				didSchedule = true;
				return;
			}

			const sink = await this.getAudioSink({ clip });
			if (!this.editor.playback.getIsPlaying()) return;
			if (sessionId !== this.playbackSessionId) return;

			// If mediabunny sink is unavailable (e.g. codec not supported on this platform),
			// fall back to native Web Audio API decoding
			if (!sink) {
				return;
			}

			const effectiveClipStart = this.getEffectiveClipStart(clip);
			const clipEnd = this.getEffectiveClipEnd(clip);

			const iteratorStartTime = Math.max(startTime, effectiveClipStart);
			const sourceStartTime =
				clip.trimStart + this.getEffectiveClipElapsed({ clip, timelineTime: iteratorStartTime }) * clip.speed;

			const iterator = sink.buffers(sourceStartTime);
			this.clipIterators.set(clip.id, iterator);

			// Per-clip GainNode for volume + fade envelope
			const clipGain = audioContext.createGain();
			clipGain.gain.value = this.getEffectiveClipVolume(clip.id, clip.volume);
			this.registerActiveClipGain(clip.id, clipGain);

			// Stereo pan node (if pan is non-zero)
			const panVal = clip.pan ?? 0;
			if (Math.abs(panVal) > 0.01 && typeof StereoPannerNode !== "undefined") {
				const panNode = audioContext.createStereoPanner();
				panNode.pan.value = Math.max(-1, Math.min(1, panVal));
				clipGain.connect(panNode);
				panNode.connect(this.masterGain ?? audioContext.destination);
			} else {
				clipGain.connect(this.masterGain ?? audioContext.destination);
			}

			for await (const { buffer, timestamp } of iterator) {
				if (!this.editor.playback.getIsPlaying()) return;
				if (sessionId !== this.playbackSessionId) return;

				const timelineTime = effectiveClipStart + (timestamp - clip.trimStart) / clip.speed;
				if (timelineTime >= clipEnd) break;

				const node = audioContext.createBufferSource();
				node.buffer = buffer;

				// Apply speed via playbackRate with pitch correction
				if (clip.speed !== 1) {
					node.playbackRate.value = clip.speed;
					node.detune.value = -1200 * Math.log2(clip.speed);
				}

				// Insert audio effect chain between source and gain
				if (clip.audioEffects && clip.audioEffects.length > 0) {
					const effectNodes = buildAudioEffectChain(audioContext, clip.audioEffects);
					connectChain(node, effectNodes, clipGain);
				} else {
					node.connect(clipGain);
				}

				const startTimestamp =
					this.playbackStartContextTime +
					(timelineTime - this.playbackStartTime);

				let actualStartTime: number;
				let scheduledTimelineTime = timelineTime;
				let scheduledTimelineDuration = buffer.duration / Math.max(0.1, clip.speed);
				if (startTimestamp >= audioContext.currentTime) {
					node.start(startTimestamp);
					actualStartTime = startTimestamp;
				} else {
					const offset = audioContext.currentTime - startTimestamp;
					if (offset < buffer.duration) {
						node.start(audioContext.currentTime, offset);
						actualStartTime = audioContext.currentTime;
						scheduledTimelineTime = timelineTime + offset;
						scheduledTimelineDuration = (buffer.duration - offset) / Math.max(0.1, clip.speed);
					} else {
						continue;
					}
				}

				didSchedule = true;

				this.applyClipGainAutomation({
					clip,
					clipGain,
					actualStartTime,
					timelineTime: scheduledTimelineTime,
					scheduledTimelineDuration,
				});

				this.queuedSources.add(node);
				node.addEventListener("ended", () => {
					node.disconnect();
					this.queuedSources.delete(node);
				});

				// Track last buffer time for health monitoring
				this.clipLastBufferTime.set(clip.id, performance.now());

				const aheadTime = timelineTime - this.getPlaybackTime();
				if (aheadTime >= this.audioQueueAheadSeconds) {
					await this.waitUntilCaughtUp({
						timelineTime,
						targetAhead: this.audioQueueResumeThresholdSeconds,
					});
					if (sessionId !== this.playbackSessionId) return;
				}
			}
		} finally {
			if (!didSchedule) {
				this.activeClipIds.delete(clip.id);
			}
		}

		this.clipIterators.delete(clip.id);
		this.clipLastBufferTime.delete(clip.id);
		// don't remove from activeClipIds - prevents scheduler from restarting this clip
		// the set is cleared on stopPlayback anyway
	}

	/**
	 * Native Web Audio API fallback for when mediabunny can't decode the audio.
	 * Uses the browser's built-in decodeAudioData which supports codecs that
	 * WebCodecs may not (e.g. AAC on macOS WKWebView).
	 */
	private async getNativeAudioBuffer(clip: AudioClipSource): Promise<AudioBuffer | null> {
		const audioContext = this.ensureAudioContext();
		if (!audioContext) return null;
		if (this.nativeFailedKeys.has(clip.sourceKey)) return null;

		const existing = this.nativeBuffers.get(clip.sourceKey);
		if (existing) return existing;

		try {
			const arrayBuffer = await clip.file.arrayBuffer();
			const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
			this.nativeBuffers.set(clip.sourceKey, audioBuffer);
			return audioBuffer;
		} catch (err) {
			console.warn(`[AudioManager] Native decode failed for ${clip.sourceKey}:`, err);
			this.nativeFailedKeys.add(clip.sourceKey);
			return null;
		}
	}

	private async preloadNativeBuffers(clips: AudioClipSource[]): Promise<void> {
		await Promise.all(
			clips
				.filter((clip) => !clip.muted)
				.map((clip) => this.getNativeAudioBuffer(clip).then(() => undefined)),
		);
	}

	private async runNativeFallback({
		clip,
		startTime,
		sessionId,
	}: {
		clip: AudioClipSource;
		startTime: number;
		sessionId: number;
	}): Promise<boolean> {
		const audioContext = this.ensureAudioContext();
		if (!audioContext) return false;

		// Skip if we already know this source can't be decoded natively either
		if (this.nativeFailedKeys.has(clip.sourceKey)) return false;

		const audioBuffer = await this.getNativeAudioBuffer(clip);
		if (!audioBuffer) return false;

		if (!this.editor.playback.getIsPlaying()) return false;
		if (sessionId !== this.playbackSessionId) return false;

		const effectiveClipStart = this.getEffectiveClipStart(clip);
		const clipEnd = this.getEffectiveClipEnd(clip);
		const iteratorStartTime = Math.max(startTime, effectiveClipStart);

		// Calculate where in the source audio to start
		const sourceOffset =
			clip.trimStart + this.getEffectiveClipElapsed({ clip, timelineTime: iteratorStartTime }) * (clip.speed ?? 1);
		const remainingDuration = clipEnd - iteratorStartTime;

		if (remainingDuration <= 0) return false;
		if (sourceOffset >= audioBuffer.duration) return false;
		const speed = clip.speed ?? 1;
		const sourceDuration = Math.min(
			remainingDuration * speed,
			Math.max(0, audioBuffer.duration - sourceOffset),
		);
		if (sourceDuration <= 0) return false;

		// Per-clip GainNode for volume + fade envelope
		const clipGain = audioContext.createGain();
		clipGain.gain.value = this.getEffectiveClipVolume(clip.id, clip.volume);
		this.registerActiveClipGain(clip.id, clipGain);

		// Stereo pan node
		const panVal2 = clip.pan ?? 0;
		if (Math.abs(panVal2) > 0.01 && typeof StereoPannerNode !== "undefined") {
			const panNode = audioContext.createStereoPanner();
			panNode.pan.value = Math.max(-1, Math.min(1, panVal2));
			clipGain.connect(panNode);
			panNode.connect(this.masterGain ?? audioContext.destination);
		} else {
			clipGain.connect(this.masterGain ?? audioContext.destination);
		}

		const node = audioContext.createBufferSource();
		node.buffer = audioBuffer;

		// Apply speed via playbackRate with pitch correction
		if (speed !== 1) {
			node.playbackRate.value = speed;
			node.detune.value = -1200 * Math.log2(speed);
		}

		// Insert audio effect chain between source and gain
		if (clip.audioEffects && clip.audioEffects.length > 0) {
			const effectNodes = buildAudioEffectChain(audioContext, clip.audioEffects);
			connectChain(node, effectNodes, clipGain);
		} else {
			node.connect(clipGain);
		}

		// Schedule the node to start at the correct audio context time
		const contextStartTime =
			this.playbackStartContextTime +
			(iteratorStartTime - this.playbackStartTime);

		let actualStart = Math.max(contextStartTime, audioContext.currentTime);
		let scheduledTimelineTime = iteratorStartTime;
		let scheduledTimelineDuration = sourceDuration / Math.max(0.1, speed);

		if (contextStartTime >= audioContext.currentTime) {
			node.start(contextStartTime, sourceOffset, sourceDuration);
		} else {
			const offset = audioContext.currentTime - contextStartTime;
			if (offset < remainingDuration) {
				const lateSourceOffset = sourceOffset + offset * speed;
				if (lateSourceOffset >= audioBuffer.duration) return false;
				const lateSourceDuration = Math.min(
					(remainingDuration - offset) * speed,
					Math.max(0, audioBuffer.duration - lateSourceOffset),
				);
				if (lateSourceDuration <= 0) return false;
				node.start(audioContext.currentTime, lateSourceOffset, lateSourceDuration);
				scheduledTimelineTime = iteratorStartTime + offset;
				scheduledTimelineDuration = lateSourceDuration / Math.max(0.1, speed);
			} else {
				return false;
			}
		}

		this.applyClipGainAutomation({
			clip,
			clipGain,
			actualStartTime: actualStart,
			timelineTime: scheduledTimelineTime,
			scheduledTimelineDuration,
			replaceExistingAutomation: true,
		});

		this.queuedSources.add(node);
		node.addEventListener("ended", () => {
			node.disconnect();
			this.queuedSources.delete(node);
		});
		return true;
	}

	private waitUntilCaughtUp({
		timelineTime,
		targetAhead,
	}: {
		timelineTime: number;
		targetAhead: number;
	}): Promise<void> {
		return new Promise((resolve) => {
			const checkInterval = setInterval(() => {
				if (!this.editor.playback.getIsPlaying()) {
					clearInterval(checkInterval);
					resolve();
					return;
				}

				const playbackTime = this.getPlaybackTime();
				if (timelineTime - playbackTime < targetAhead) {
					clearInterval(checkInterval);
					resolve();
				}
			}, 100);
		});
	}

	private disposeSinks(): void {
		// Bump session ID first so any in-flight runClipIterator bails immediately
		// before it can call .next() on a disposed Input (prevents InputDisposedError)
		this.playbackSessionId++;

		for (const iterator of this.clipIterators.values()) {
			void iterator.return();
		}
		this.clipIterators.clear();
		this.activeClipIds.clear();
		this.clipLastBufferTime.clear();

		for (const input of this.inputs.values()) {
			input.dispose();
		}
		this.inputs.clear();
		this.sinks.clear();
		this.nativeBuffers.clear();
		this.nativeFailedKeys.clear();
	}

	private async getAudioSink({
		clip,
	}: {
		clip: AudioClipSource;
	}): Promise<AudioBufferSink | null> {
		const existingSink = this.sinks.get(clip.sourceKey);
		if (existingSink) return existingSink;

		try {
			const input = new Input({
				source: new BlobSource(clip.file),
				formats: ALL_FORMATS,
			});
			const audioTrack = await input.getPrimaryAudioTrack();
			if (!audioTrack) {
				input.dispose();
				return null;
			}

			const decodable = await audioTrack.canDecode();
			if (!decodable) {
				console.warn(`[AudioManager] Audio track not decodable for clip ${clip.sourceKey} (${clip.file.name}), will try native fallback`);
				input.dispose();
				return null;
			}

			const sink = new AudioBufferSink(audioTrack);
			this.inputs.set(clip.sourceKey, input);
			this.sinks.set(clip.sourceKey, sink);
			return sink;
		} catch (error) {
			console.warn(`[AudioManager] Failed to initialize audio sink for ${clip.file.name}:`, error);
			return null;
		}
	}

	/**
	 * Preload audio buffers for clips on timeline (called when timeline changes)
	 */
	private async preloadClips(): Promise<void> {
		const clips = await this.ensureClipsLoaded();
		await this.preloadNativeBuffers(clips);
	}

	/**
	 * Start health check timer to detect stalled iterators
	 */
	private startHealthCheck(): void {
		this.stopHealthCheck();
		if (typeof window === "undefined") return;

		this.clipHealthCheckTimer = window.setInterval(() => {
			this.checkIteratorHealth();
		}, 2000); // Check every 2 seconds
	}

	/**
	 * Stop health check timer
	 */
	private stopHealthCheck(): void {
		if (this.clipHealthCheckTimer && typeof window !== "undefined") {
			window.clearInterval(this.clipHealthCheckTimer);
		}
		this.clipHealthCheckTimer = null;
	}

	/**
	 * Check if any iterators have stalled (no buffers for 3+ seconds)
	 */
	private checkIteratorHealth(): void {
		if (!this.editor.playback.getIsPlaying()) return;

		const now = performance.now();
		const currentTime = this.getPlaybackTime();
		const stalledThresholdMs = 8000;

		for (const clip of this.clips) {
			if (clip.muted) continue;
			if (!this.activeClipIds.has(clip.id)) continue;

			// Check if clip should be playing now
			const clipEnd = clip.startTime + clip.duration;
			if (currentTime < clip.startTime || currentTime >= clipEnd) continue;

			const lastBufferTime = this.clipLastBufferTime.get(clip.id);
			if (!lastBufferTime) continue;

			const timeSinceLastBuffer = now - lastBufferTime;
			if (timeSinceLastBuffer > stalledThresholdMs) {
				console.warn(
					`[AudioManager] Iterator stalled for clip ${clip.id} (${clip.file.name}), restarting...`,
				);

				// Stop stalled iterator
				const iterator = this.clipIterators.get(clip.id);
				if (iterator) {
					void iterator.return();
					this.clipIterators.delete(clip.id);
				}

				// Restart from current position
				this.activeClipIds.delete(clip.id);
				this.clipLastBufferTime.delete(clip.id);

				// Will be picked up by next scheduleUpcomingClips call
			}
		}
	}
}
