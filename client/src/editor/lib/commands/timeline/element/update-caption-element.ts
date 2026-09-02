import { Command } from "../../../../lib/commands/base-command";
import type { CaptionElement, TimelineTrack } from "../../../../types/timeline";
import { cloneTransform } from "../../../timeline/element-utils";
import { EditorCore } from "../../../../core";

export type CaptionElementUpdatable = Partial<
	Pick<
		CaptionElement,
		| "lines"
		| "presetId"
		| "highlightStyle"
		| "highlightColor"
		| "fontSize"
		| "fontFamily"
		| "fontFilePath"
		| "color"
		| "backgroundColor"
		| "textAlign"
		| "fontWeight"
		| "fontStyle"
		| "letterSpacing"
		| "lineHeight"
		| "textCase"
		| "stroke"
		| "shadow"
		| "glow"
		| "gradient"
		| "transform"
		| "opacity"
		| "maxWordsPerLine"
		| "animationIn"
		| "animationOut"
		| "animationLoop"
	>
>;

export function cloneCaptionTracksForUndo(tracks: TimelineTrack[]): TimelineTrack[] {
	return tracks.map((t) => ({
		...t,
		elements: t.elements.map((el) => (el.type === "caption" ? structuredClone(el) : el)),
	})) as TimelineTrack[];
}

/** Apply caption updates and detach shared default object references. */
export function applyCaptionUpdates(el: CaptionElement, updates: CaptionElementUpdatable): CaptionElement {
	const next: CaptionElement = {
		...el,
		...updates,
		transform: cloneTransform({
			scale: updates.transform?.scale ?? el.transform.scale,
			rotate: updates.transform?.rotate ?? el.transform.rotate,
			position: {
				x: updates.transform?.position?.x ?? el.transform.position.x,
				y: updates.transform?.position?.y ?? el.transform.position.y,
			},
		}),
	};

	if (updates.lines !== undefined) {
		next.lines = structuredClone(updates.lines);
	}
	if (next.stroke) next.stroke = { ...next.stroke };
	if (next.shadow) next.shadow = { ...next.shadow };
	if (next.glow) next.glow = { ...next.glow };
	if (next.gradient) next.gradient = { ...next.gradient, colors: [...next.gradient.colors] };
	if (next.animationIn) next.animationIn = { ...next.animationIn };
	if (next.animationOut) next.animationOut = { ...next.animationOut };
	if (next.animationLoop) next.animationLoop = { ...next.animationLoop };

	return next;
}

export class UpdateCaptionElementCommand extends Command {
	private savedState: TimelineTrack[] | null = null;

	constructor(
		private trackId: string,
		private elementId: string,
		private updates: CaptionElementUpdatable,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		const tracks = editor.timeline.getTracks();
		this.savedState = cloneCaptionTracksForUndo(tracks);

		const updatedTracks = tracks.map((t) => {
			if (t.id !== this.trackId) return t;
			return {
				...t,
				elements: t.elements.map((el) =>
					el.id === this.elementId && el.type === "caption"
						? applyCaptionUpdates(el, this.updates)
						: el,
				),
			} as typeof t;
		});

		editor.timeline.updateTracks(updatedTracks);
	}

	undo(): void {
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}
}
