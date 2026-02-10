import type { EditorCore } from "../../core";
import type {
	TrackType,
	TimelineTrack,
	TextElement,
	TimelineElement,
	ClipboardItem,
} from "../../types/timeline";
import { calculateTotalDuration } from "../../lib/timeline";
import { getMainTrackMagnet } from "../../composables/timeline/useTimelineTools";
import {
	AddTrackCommand,
	RemoveTrackCommand,
	ToggleTrackMuteCommand,
	ToggleTrackVisibilityCommand,
	ToggleTrackLockCommand,
	InsertElementCommand,
	UpdateElementTrimCommand,
	UpdateElementDurationCommand,
	DeleteElementsCommand,
	DuplicateElementsCommand,
	ToggleElementsVisibilityCommand,
	ToggleElementsMutedCommand,
	UpdateTextElementCommand,
	UpdateElementCommand,
	SplitElementsCommand,
	PasteCommand,
	UpdateElementStartTimeCommand,
	MoveElementCommand,
	MoveElementsBatchCommand,
	ChangeSpeedCommand,
	UpdateElementKeyframesCommand,
	ExtractAudioCommand,
	UpdateCaptionElementCommand,
} from "../../lib/commands/timeline";
import type { UpdatableElementProps } from "../../lib/commands/timeline";
import type { InsertElementParams } from "../../lib/commands/timeline/element/insert-element";
import type { ElementKeyframes } from "../../types/keyframes";

export class TimelineManager {
	private listeners = new Set<() => void>();

	constructor(private editor: EditorCore) {}

	addTrack({ type, index }: { type: TrackType; index?: number }): string {
		const command = new AddTrackCommand(type, index);
		this.editor.command.execute({ command });
		return command.getTrackId();
	}

	removeTrack({ trackId }: { trackId: string }): void {
		const command = new RemoveTrackCommand(trackId);
		this.editor.command.execute({ command });
	}

	insertElement({ element, placement }: InsertElementParams): void {
		const command = new InsertElementCommand({ element, placement });
		this.editor.command.execute({ command });
	}

	updateElementTrim({
		elementId,
		trimStart,
		trimEnd,
		startTime,
		duration,
		pushHistory = true,
	}: {
		elementId: string;
		trimStart: number;
		trimEnd: number;
		startTime?: number;
		duration?: number;
		pushHistory?: boolean;
	}): void {
		const command = new UpdateElementTrimCommand(elementId, trimStart, trimEnd, startTime, duration);
		if (pushHistory) {
			this.editor.command.execute({ command });
		} else {
			command.execute();
		}
	}

	updateElementDuration({
		trackId,
		elementId,
		duration,
		pushHistory = true,
	}: {
		trackId: string;
		elementId: string;
		duration: number;
		pushHistory?: boolean;
	}): void {
		const command = new UpdateElementDurationCommand(
			trackId,
			elementId,
			duration,
		);
		if (pushHistory) {
			this.editor.command.execute({ command });
		} else {
			command.execute();
		}
	}

	updateElementStartTime({
		elements,
		startTime,
	}: {
		elements: { trackId: string; elementId: string }[];
		startTime: number;
	}): void {
		const command = new UpdateElementStartTimeCommand(elements, startTime);
		this.editor.command.execute({ command });
	}

	moveElement({
		sourceTrackId,
		targetTrackId,
		elementId,
		newStartTime,
		createTrack,
	}: {
		sourceTrackId: string;
		targetTrackId: string;
		elementId: string;
		newStartTime: number;
		createTrack?: { type: TrackType; index: number };
	}): void {
		const command = new MoveElementCommand(
			sourceTrackId,
			targetTrackId,
			elementId,
			newStartTime,
			createTrack,
		);
		this.editor.command.execute({ command });
	}

	moveElementsBatch({
		trackId,
		elementIds,
		timeDelta,
	}: {
		trackId: string;
		elementIds: string[];
		timeDelta: number;
	}): void {
		const command = new MoveElementsBatchCommand(trackId, elementIds, timeDelta);
		this.editor.command.execute({ command });
	}

	toggleTrackMute({ trackId }: { trackId: string }): void {
		const command = new ToggleTrackMuteCommand(trackId);
		this.editor.command.execute({ command });
	}

	toggleTrackVisibility({ trackId }: { trackId: string }): void {
		const command = new ToggleTrackVisibilityCommand(trackId);
		this.editor.command.execute({ command });
	}

	toggleTrackLock({ trackId }: { trackId: string }): void {
		const command = new ToggleTrackLockCommand(trackId);
		this.editor.command.execute({ command });
	}

	isTrackLocked({ trackId }: { trackId: string }): boolean {
		const track = this.getTrackById({ trackId });
		return track?.locked === true;
	}

	splitElements({
		elements,
		splitTime,
		retainSide = "both",
	}: {
		elements: { trackId: string; elementId: string }[];
		splitTime: number;
		retainSide?: "both" | "left" | "right";
	}): { trackId: string; elementId: string }[] {
		const command = new SplitElementsCommand(elements, splitTime, retainSide);
		this.editor.command.execute({ command });
		return command.getRightSideElements();
	}

	getTotalDuration(): number {
		return calculateTotalDuration({ tracks: this.getTracks() });
	}

	getTrackById({ trackId }: { trackId: string }): TimelineTrack | null {
		return this.getTracks().find((track) => track.id === trackId) ?? null;
	}

	getElementsWithTracks({
		elements,
	}: {
		elements: { trackId: string; elementId: string }[];
	}): Array<{ track: TimelineTrack; element: TimelineElement }> {
		const result: Array<{ track: TimelineTrack; element: TimelineElement }> =
			[];

		for (const { trackId, elementId } of elements) {
			const track = this.getTrackById({ trackId });
			const element = track?.elements.find(
				(trackElement) => trackElement.id === elementId,
			);

			if (track && element) {
				result.push({ track, element });
			}
		}

		return result;
	}

	pasteAtTime({
		time,
		clipboardItems,
	}: {
		time: number;
		clipboardItems: ClipboardItem[];
	}): { trackId: string; elementId: string }[] {
		const command = new PasteCommand(time, clipboardItems);
		this.editor.command.execute({ command });
		return command.getPastedElements();
	}

	deleteElements({
		elements,
	}: {
		elements: { trackId: string; elementId: string }[];
	}): void {
		const command = new DeleteElementsCommand(elements, getMainTrackMagnet());
		this.editor.command.execute({ command });
	}

	updateTextElement({
		trackId,
		elementId,
		updates,
	}: {
		trackId: string;
		elementId: string;
		updates: import("../../lib/commands/timeline/element/update-text-element").TextElementUpdatable;
	}): void {
		const command = new UpdateTextElementCommand(trackId, elementId, updates);
		this.editor.command.execute({ command });
	}

	updateElement({
		trackId,
		elementId,
		updates,
	}: {
		trackId: string;
		elementId: string;
		updates: UpdatableElementProps;
	}): void {
		const command = new UpdateElementCommand(trackId, elementId, updates);
		this.editor.command.execute({ command });
	}

	changeElementSpeed({
		trackId,
		elementId,
		speed,
	}: {
		trackId: string;
		elementId: string;
		speed: number;
	}): void {
		const command = new ChangeSpeedCommand(trackId, elementId, speed);
		this.editor.command.execute({ command });
	}

	updateElementKeyframes({
		trackId,
		elementId,
		keyframes,
	}: {
		trackId: string;
		elementId: string;
		keyframes: ElementKeyframes;
	}): void {
		const command = new UpdateElementKeyframesCommand(trackId, elementId, keyframes);
		this.editor.command.execute({ command });
	}

	updateCaptionElement({
		trackId,
		elementId,
		updates,
	}: {
		trackId: string;
		elementId: string;
		updates: import("../../lib/commands/timeline/element/update-caption-element").CaptionElementUpdatable;
	}): void {
		const command = new UpdateCaptionElementCommand(trackId, elementId, updates);
		this.editor.command.execute({ command });
	}

	extractAudio({
		trackId,
		elementId,
	}: {
		trackId: string;
		elementId: string;
	}): { audioTrackId: string; audioElementId: string } {
		const command = new ExtractAudioCommand(trackId, elementId);
		this.editor.command.execute({ command });
		return {
			audioTrackId: command.getAudioTrackId(),
			audioElementId: command.getAudioElementId(),
		};
	}

	duplicateElements({
		elements,
	}: {
		elements: { trackId: string; elementId: string }[];
	}): { trackId: string; elementId: string }[] {
		const command = new DuplicateElementsCommand({ elements });
		this.editor.command.execute({ command });
		return command.getDuplicatedElements();
	}

	toggleElementsVisibility({
		elements,
	}: {
		elements: { trackId: string; elementId: string }[];
	}): void {
		const command = new ToggleElementsVisibilityCommand(elements);
		this.editor.command.execute({ command });
	}

	toggleElementsMuted({
		elements,
	}: {
		elements: { trackId: string; elementId: string }[];
	}): void {
		const command = new ToggleElementsMutedCommand(elements);
		this.editor.command.execute({ command });
	}

	getTracks(): TimelineTrack[] {
		return this.editor.scenes.getActiveScene()?.tracks ?? [];
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		this.listeners.forEach((fn) => fn());
	}

	updateTracks(newTracks: TimelineTrack[]): void {
		this.editor.scenes.updateSceneTracks({ tracks: newTracks });
		this.notify();
	}
}
