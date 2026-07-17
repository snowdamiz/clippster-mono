import { Command } from "../../../../lib/commands/base-command";
import type { TimelineTrack } from "../../../../types/timeline";
import type { Transition } from "../../../../types/transitions";
import { generateUUID } from "../../../../utils/id";
import { EditorCore } from "../../../../core";
import { collapseMainVideoTracksIfPresent } from "../../../../lib/timeline/main-track-layout";
import { isMainTrack } from "../../../../lib/timeline/track-utils";
import { getElementSourceSpanSeconds } from "../../../../lib/timeline/trim-source-utils";

function withoutStartFade<T extends { fadeIn?: number }>(element: T): T {
	return { ...element, fadeIn: undefined };
}

function withoutEndFade<T extends { fadeOut?: number }>(element: T): T {
	return { ...element, fadeOut: undefined };
}

export class SplitElementsCommand extends Command {
	private savedState: TimelineTrack[] | null = null;
	private rightSideElements: { trackId: string; elementId: string }[] = [];
	private previousSelection: { trackId: string; elementId: string }[] = [];

	constructor(
		private elements: { trackId: string; elementId: string }[],
		private splitTime: number,
		private retainSide: "both" | "left" | "right" = "both",
	) {
		super();
	}

	getRightSideElements(): { trackId: string; elementId: string }[] {
		return this.rightSideElements;
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();
		this.previousSelection = editor.selection.getSelectedElements();
		this.rightSideElements = [];

		const updatedTracks = this.savedState.map((track) => {
			const elementsToSplit = this.elements.filter(
				(el) => el.trackId === track.id,
			);

			if (elementsToSplit.length === 0) {
				return track;
			}

			return {
				...track,
				elements: track.elements.flatMap((element) => {
					const shouldSplit = elementsToSplit.some(
						(el) => el.elementId === element.id,
					);

					if (!shouldSplit) {
						return [element];
					}

					const effectiveStart = element.startTime;
					const effectiveEnd = element.startTime + element.duration;

					if (
						this.splitTime <= effectiveStart ||
						this.splitTime >= effectiveEnd
					) {
						return [element];
					}

					const relativeTime = this.splitTime - element.startTime;
					const leftVisibleDuration = relativeTime;
					const rightVisibleDuration = element.duration - relativeTime;
					const speed = "speed" in element ? element.speed : undefined;
					const leftSourceDuration = getElementSourceSpanSeconds({
						duration: leftVisibleDuration,
						speed,
					});
					const rightSourceDuration = getElementSourceSpanSeconds({
						duration: rightVisibleDuration,
						speed,
					});

					if (this.retainSide === "left") {
						return [
							{
								...withoutEndFade(element),
								duration: leftVisibleDuration,
								trimEnd: element.trimEnd + rightSourceDuration,
								name: `${element.name} (left)`,
							},
						];
					}

					if (this.retainSide === "right") {
						const newId = generateUUID();
						this.rightSideElements.push({
							trackId: track.id,
							elementId: newId,
						});
						return [
							{
								...withoutStartFade(element),
								id: newId,
								startTime: this.splitTime,
								duration: rightVisibleDuration,
								trimStart: element.trimStart + leftSourceDuration,
								name: `${element.name} (right)`,
							},
						];
					}

					// "both" - split into two pieces
					const secondElementId = generateUUID();
					this.rightSideElements.push({
						trackId: track.id,
						elementId: secondElementId,
					});

					return [
						{
							...withoutEndFade(element),
							duration: leftVisibleDuration,
							trimEnd: element.trimEnd + rightSourceDuration,
							name: `${element.name} (left)`,
						},
						{
							...withoutStartFade(element),
							id: secondElementId,
							startTime: this.splitTime,
							duration: rightVisibleDuration,
							trimStart: element.trimStart + leftSourceDuration,
							name: `${element.name} (right)`,
						},
					];
				}),
			} as typeof track;
		});

		const fps = editor.project.getActive()?.settings?.fps ?? 30;
		const collapsedTracks = collapseMainVideoTracksIfPresent(updatedTracks, fps);
		editor.timeline.updateTracks(collapsedTracks);

		// Clean up transitions whose targetElementId no longer exists in the updated tracks.
		// We do NOT save/restore these — SetTransitionCommand handles its own undo.
		try {
			const scene = editor.scenes.getActiveScene();
			if (scene?.transitions?.length) {
				const allElementIds = new Set(
					collapsedTracks.flatMap((t) => t.elements.map((e) => e.id)),
				);
				const cleanedTransitions = scene.transitions.filter(
					(t: Transition) => allElementIds.has(t.targetElementId),
				);
				if (cleanedTransitions.length !== scene.transitions.length) {
					const updatedScene = { ...scene, transitions: cleanedTransitions };
					const scenes = editor.scenes.getScenes().map((s) =>
						s.id === scene.id ? updatedScene : s,
					);
					editor.scenes.setScenes({ scenes, activeSceneId: scene.id });
				}
			}
		} catch {
			// no active scene
		}

		if (this.rightSideElements.length > 0) {
			const toSelect =
				this.rightSideElements.length === 1
					? this.rightSideElements
					: [this.pickSingleSplitSelection({ editor, refs: this.rightSideElements })];
			editor.selection.setSelectedElements({ elements: toSelect });
		}
	}

	private pickSingleSplitSelection({
		editor,
		refs,
	}: {
		editor: EditorCore;
		refs: { trackId: string; elementId: string }[];
	}): { trackId: string; elementId: string } {
		const tracks = editor.timeline.getTracks();
		const ranked = refs
			.map((ref) => {
				const track = tracks.find((t) => t.id === ref.trackId);
				const element = track?.elements.find((e) => e.id === ref.elementId);
				return {
					ref,
					startTime: element?.startTime ?? 0,
					isMain: track ? isMainTrack(track) : false,
				};
			})
			.sort((a, b) => {
				if (a.isMain !== b.isMain) return a.isMain ? -1 : 1;
				return b.startTime - a.startTime;
			});
		return ranked[0]?.ref ?? refs[refs.length - 1];
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
			editor.selection.setSelectedElements({ elements: this.previousSelection });
			// Do NOT restore transitions here — SetTransitionCommand handles its own undo
			// in the command stack. Restoring here would cause transitions to reappear
			// after undo+re-split sequences.
		}
	}
}
