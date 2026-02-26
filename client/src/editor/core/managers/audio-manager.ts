import type { EditorCore } from "../../core";
import type { AudioClipSource } from "../../lib/media/audio";
import { createAudioContext, collectAudioClips } from "../../lib/media/audio";
import { buildAudioEffectChain, connectChain } from "../../lib/media/audio-effect-nodes";
import {
	ALL_FORMATS,
	AudioBufferSink,
	BlobSource,
	Input,
	type WrappedAudioBuffer,
} from "mediabunny";

export class AudioManager {
	private audioContext: AudioContext | null = null;
	private masterGain: GainNode | null = null;
	private playbackStartTime = 0;
	private playbackStartContextTime = 0;
	private scheduleTimer: number | null = null;
	private lookaheadSeconds = 5;
	private scheduleIntervalMs = 500;
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

	constructor(private editor: EditorCore) {
		this.lastVolume = this.editor.playback.getVolume();

		this.unsubscribers.push(
			this.editor.playback.subscribe(this.handlePlaybackChange),
			this.editor.timeline.subscribe(this.handleTimelineChange),
			this.editor.media.subscribe(this.handleTimelineChange),
		);
		if (typeof window !== "undefined") {
			window.addEventListener("playback-seek", this.handleSeek);
		}
	}

	dispose(): void {
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

	private async startPlayback({ time }: { time: number }): Promise<void> {
		const audioContext = this.ensureAudioContext();
		if (!audioContext) return;

		this.stopPlayback();
		this.playbackSessionId++;

		const tracks = this.editor.timeline.getTracks();
		const mediaAssets = this.editor.media.getAssets();
		const duration = this.editor.timeline.getTotalDuration();

		if (duration <= 0) return;

		if (audioContext.state === "suspended") {
			await audioContext.resume();
		}

		this.clips = await collectAudioClips({ tracks, mediaAssets });
		console.log(`[AudioManager] Collected ${this.clips.length} audio clips:`, this.clips.map(c => ({
			id: c.id,
			sourceKey: c.sourceKey,
			fileName: c.file.name,
			fileType: c.file.type,
			startTime: c.startTime,
			duration: c.duration,
			muted: c.muted,
			volume: c.volume
		})));
		if (!this.editor.playback.getIsPlaying()) return;

		this.playbackStartTime = time;
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

			const clipEnd = clip.startTime + clip.duration;
			if (clipEnd <= currentTime) continue;
			if (clip.startTime > windowEnd) continue;

			this.activeClipIds.add(clip.id);
			console.log(`[AudioManager] Scheduling clip ${clip.id} (${clip.file.name}) at ${clip.startTime}s`);
			this.runClipIterator({ clip, startTime: currentTime, sessionId: this.playbackSessionId })
				.catch((err) => {
					console.warn(`[AudioManager] Audio playback failed for clip ${clip.id}:`, err);
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
		if (!audioContext) return;

		const sink = await this.getAudioSink({ clip });
		if (!this.editor.playback.getIsPlaying()) return;
		if (sessionId !== this.playbackSessionId) return;

		// If mediabunny sink is unavailable (e.g. codec not supported on this platform),
		// fall back to native Web Audio API decoding
		if (!sink) {
			console.log(`[AudioManager] Mediabunny sink unavailable for ${clip.file.name}, using native fallback`);
			await this.runNativeFallback({ clip, startTime, sessionId });
			return;
		}
		console.log(`[AudioManager] Using mediabunny sink for ${clip.file.name}`);

		const clipStart = clip.startTime;
		const clipEnd = clip.startTime + clip.duration;

		const iteratorStartTime = Math.max(startTime, clipStart);
		const sourceStartTime =
			clip.trimStart + (iteratorStartTime - clip.startTime) * clip.speed;

		const iterator = sink.buffers(sourceStartTime);
		this.clipIterators.set(clip.id, iterator);

		// Per-clip GainNode for volume + fade envelope
		const clipGain = audioContext.createGain();
		clipGain.gain.value = clip.volume;
		clipGain.connect(this.masterGain ?? audioContext.destination);

		for await (const { buffer, timestamp } of iterator) {
			if (!this.editor.playback.getIsPlaying()) return;
			if (sessionId !== this.playbackSessionId) return;

			const timelineTime = clip.startTime + (timestamp - clip.trimStart) / clip.speed;
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
			if (startTimestamp >= audioContext.currentTime) {
				node.start(startTimestamp);
				actualStartTime = startTimestamp;
			} else {
				const offset = audioContext.currentTime - startTimestamp;
				if (offset < buffer.duration) {
					node.start(audioContext.currentTime, offset);
					actualStartTime = audioContext.currentTime;
				} else {
					continue;
				}
			}

			// Apply fade in/out via gain automation
			const elapsedInClip = timelineTime - clip.startTime;
			if (clip.fadeIn > 0 && elapsedInClip < clip.fadeIn) {
				const fadeProgress = elapsedInClip / clip.fadeIn;
				clipGain.gain.setValueAtTime(clip.volume * fadeProgress, actualStartTime);
				const fadeRemaining = clip.fadeIn - elapsedInClip;
				clipGain.gain.linearRampToValueAtTime(clip.volume, actualStartTime + fadeRemaining);
			}
			const timeUntilEnd = clipEnd - timelineTime;
			if (clip.fadeOut > 0 && timeUntilEnd < clip.fadeOut) {
				const fadeProgress = timeUntilEnd / clip.fadeOut;
				clipGain.gain.setValueAtTime(clip.volume * fadeProgress, actualStartTime);
				clipGain.gain.linearRampToValueAtTime(0, actualStartTime + timeUntilEnd);
			}

			this.queuedSources.add(node);
			node.addEventListener("ended", () => {
				node.disconnect();
				this.queuedSources.delete(node);
			});

			// Track last buffer time for health monitoring
			this.clipLastBufferTime.set(clip.id, performance.now());

			const aheadTime = timelineTime - this.getPlaybackTime();
			if (aheadTime >= 1) {
				await this.waitUntilCaughtUp({ timelineTime, targetAhead: 1 });
				if (sessionId !== this.playbackSessionId) return;
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
	private async runNativeFallback({
		clip,
		startTime,
		sessionId,
	}: {
		clip: AudioClipSource;
		startTime: number;
		sessionId: number;
	}): Promise<void> {
		const audioContext = this.ensureAudioContext();
		if (!audioContext) return;

		// Skip if we already know this source can't be decoded natively either
		if (this.nativeFailedKeys.has(clip.sourceKey)) return;

		let audioBuffer = this.nativeBuffers.get(clip.sourceKey);
		if (!audioBuffer) {
			try {
				const arrayBuffer = await clip.file.arrayBuffer();
				audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
				this.nativeBuffers.set(clip.sourceKey, audioBuffer);
				console.log(`[AudioManager] Native fallback: decoded audio for ${clip.sourceKey}`);
			} catch (err) {
				console.warn(`[AudioManager] Native fallback also failed for ${clip.sourceKey}:`, err);
				this.nativeFailedKeys.add(clip.sourceKey);
				return;
			}
		}

		if (!this.editor.playback.getIsPlaying()) return;
		if (sessionId !== this.playbackSessionId) return;

		const clipEnd = clip.startTime + clip.duration;
		const iteratorStartTime = Math.max(startTime, clip.startTime);

		// Calculate where in the source audio to start
		const sourceOffset = clip.trimStart + (iteratorStartTime - clip.startTime) * (clip.speed ?? 1);
		const remainingDuration = clipEnd - iteratorStartTime;

		if (remainingDuration <= 0) return;

		// Per-clip GainNode for volume + fade envelope
		const clipGain = audioContext.createGain();
		clipGain.gain.value = clip.volume;
		clipGain.connect(this.masterGain ?? audioContext.destination);

		const node = audioContext.createBufferSource();
		node.buffer = audioBuffer;

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

		// Schedule the node to start at the correct audio context time
		const contextStartTime =
			this.playbackStartContextTime +
			(iteratorStartTime - this.playbackStartTime);

		if (contextStartTime >= audioContext.currentTime) {
			node.start(contextStartTime, sourceOffset, remainingDuration * (clip.speed ?? 1));
		} else {
			const offset = audioContext.currentTime - contextStartTime;
			if (offset < remainingDuration) {
				node.start(audioContext.currentTime, sourceOffset + offset * (clip.speed ?? 1), (remainingDuration - offset) * (clip.speed ?? 1));
			} else {
				return;
			}
		}

		// Apply fade in/out
		const elapsedInClip = iteratorStartTime - clip.startTime;
		const actualStart = Math.max(contextStartTime, audioContext.currentTime);
		if (clip.fadeIn > 0 && elapsedInClip < clip.fadeIn) {
			const fadeProgress = elapsedInClip / clip.fadeIn;
			clipGain.gain.setValueAtTime(clip.volume * fadeProgress, actualStart);
			const fadeRemaining = clip.fadeIn - elapsedInClip;
			clipGain.gain.linearRampToValueAtTime(clip.volume, actualStart + fadeRemaining);
		}
		const timeUntilEnd = clipEnd - iteratorStartTime;
		if (clip.fadeOut > 0) {
			const fadeOutStart = actualStart + Math.max(0, timeUntilEnd - clip.fadeOut);
			clipGain.gain.setValueAtTime(clip.volume, fadeOutStart);
			clipGain.gain.linearRampToValueAtTime(0, actualStart + timeUntilEnd);
		}

		this.queuedSources.add(node);
		node.addEventListener("ended", () => {
			node.disconnect();
			this.queuedSources.delete(node);
		});
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
			console.log(`[AudioManager] Audio track is decodable for ${clip.file.name}`);

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
		const tracks = this.editor.timeline.getTracks();
		const mediaAssets = this.editor.media.getAssets();
		const clips = await collectAudioClips({ tracks, mediaAssets });

		console.log(`[AudioManager] Preloading ${clips.length} audio clips`);

		// Preload first 2 seconds of each clip
		for (const clip of clips) {
			if (clip.muted) continue;
			try {
				await this.getAudioSink({ clip });
			} catch (err) {
				console.warn(`[AudioManager] Failed to preload clip ${clip.id}:`, err);
			}
		}
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
		const stalledThresholdMs = 3000;

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
