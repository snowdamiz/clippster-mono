import { Command } from "../../../../lib/commands/base-command";
import { EditorCore } from "../../../../core";
import type {
	TimelineTrack,
	VideoElement,
	UploadAudioElement,
	AudioTrack,
} from "../../../../types/timeline";
import { generateUUID } from "../../../../utils/id";
import { buildEmptyTrack } from "../../../../lib/timeline/track-utils";

/**
 * ExtractAudioCommand — CapCut-style audio extraction from a video element.
 *
 * Behavior:
 * 1. Creates a new audio track in the audio section (after all video/overlay tracks)
 * 2. Inserts at the top of the audio section so it's the first audio track
 * 3. Adds an audio element that mirrors the video's timing (startTime, duration, trimStart, trimEnd, speed)
 * 4. Mutes the original video element so you don't hear double audio
 * 5. The extracted audio is fully independent — split, delete, move freely
 * 6. Fully undoable: removes the audio track and un-mutes the video on undo
 */
export class ExtractAudioCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private audioTrackId: string;
	private audioElementId: string;
	private previousMutedState: boolean = false;

	constructor(
		private trackId: string,
		private elementId: string,
	) {
		super();
		this.audioTrackId = generateUUID();
		this.audioElementId = generateUUID();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		const tracks = editor.timeline.getTracks();
		this.savedState = tracks;

		const sourceTrackIndex = tracks.findIndex((t) => t.id === this.trackId);
		if (sourceTrackIndex === -1) {
			console.error("[ExtractAudio] Source track not found:", this.trackId);
			return;
		}

		const sourceTrack = tracks[sourceTrackIndex];
		if (sourceTrack.type !== "video") {
			console.error("[ExtractAudio] Can only extract audio from video tracks");
			return;
		}

		const videoElement = sourceTrack.elements.find(
			(el) => el.id === this.elementId,
		) as VideoElement | undefined;

		if (!videoElement || videoElement.type !== "video") {
			console.error("[ExtractAudio] Video element not found:", this.elementId);
			return;
		}

		// Save previous muted state for undo
		this.previousMutedState = videoElement.muted ?? false;

		// Build the extracted audio element mirroring the video's timing
		const audioElement: UploadAudioElement = {
			id: this.audioElementId,
			type: "audio",
			sourceType: "upload",
			mediaId: videoElement.mediaId,
			name: `${videoElement.name} (Audio)`,
			startTime: videoElement.startTime,
			duration: videoElement.duration,
			trimStart: videoElement.trimStart,
			trimEnd: videoElement.trimEnd,
			volume: videoElement.volume ?? 1,
			muted: false,
			speed: videoElement.speed,
			linkedElementId: this.elementId,
		};

		// Build the new audio track
		const audioTrack = buildEmptyTrack({
			id: this.audioTrackId,
			type: "audio",
		}) as AudioTrack;
		audioTrack.elements = [audioElement];

		const updatedTracks = [...tracks];

		// Mute the original video element and link it to the extracted audio
		const updatedSourceTrack = {
			...updatedTracks[sourceTrackIndex],
			elements: updatedTracks[sourceTrackIndex].elements.map((el) =>
				el.id === this.elementId
					? { ...el, muted: true, linkedElementId: this.audioElementId }
					: el,
			),
		} as TimelineTrack;
		updatedTracks[sourceTrackIndex] = updatedSourceTrack;

		// Insert audio track at the top of the audio section
		// (right before the first existing audio track, or at the end)
		const firstAudioTrackIndex = updatedTracks.findIndex(
			(t) => t.type === "audio",
		);
		const insertIndex =
			firstAudioTrackIndex >= 0 ? firstAudioTrackIndex : updatedTracks.length;
		updatedTracks.splice(insertIndex, 0, audioTrack);

		editor.timeline.updateTracks(updatedTracks);
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}

	getAudioTrackId(): string {
		return this.audioTrackId;
	}

	getAudioElementId(): string {
		return this.audioElementId;
	}
}
