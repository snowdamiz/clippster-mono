import { Command } from "../../../../lib/commands/base-command";
import type {
	TimelineElement,
	VideoElement,
	ImageElement,
	AudioElement,
	StickerElement,
	EffectElement,
	CaptionElement,
	Transform,
	ColorAdjustments,
	FlipState,
	CropRect,
} from "../../../../types/timeline";
import { EditorCore } from "../../../../core";

export type UpdatableVideoProps = Partial<
	Pick<VideoElement, "name" | "mediaId" | "opacity" | "blendMode" | "transform" | "muted" | "hidden" | "locked" | "groupId" | "volume" | "speed" | "reversed" | "flip" | "crop" | "colorAdjustments" | "effects" | "filterPreset" | "chromakey" | "fadeIn" | "fadeOut" | "masks" | "keyframes">
>;

export type UpdatableImageProps = Partial<
	Pick<ImageElement, "name" | "mediaId" | "opacity" | "blendMode" | "transform" | "hidden" | "locked" | "groupId" | "flip" | "crop" | "colorAdjustments" | "effects" | "filterPreset" | "chromakey" | "fadeIn" | "fadeOut" | "masks" | "keyframes">
>;

export type UpdatableAudioProps = Partial<
	Pick<AudioElement, "name" | "volume" | "muted" | "speed" | "reversed" | "fadeIn" | "fadeOut" | "audioEffects" | "keyframes">
>;

export type UpdatableStickerProps = Partial<
	Pick<StickerElement, "name" | "opacity" | "blendMode" | "transform" | "color" | "hidden" | "locked" | "groupId" | "fadeIn" | "fadeOut" | "keyframes">
>;

export type UpdatableEffectProps = Partial<
	Pick<EffectElement, "name" | "enabled" | "intensity" | "params">
>;

export type UpdatableCaptionProps = Partial<
	Pick<CaptionElement, "name" | "opacity" | "blendMode" | "transform" | "hidden" | "locked" | "groupId">
>;

export type UpdatableElementProps =
	| UpdatableVideoProps
	| UpdatableImageProps
	| UpdatableAudioProps
	| UpdatableStickerProps
	| UpdatableEffectProps
	| UpdatableCaptionProps;

export class UpdateElementCommand extends Command {
	/** Deep snapshot of the target element only (avoids cloning full timeline for undo). */
	private savedElement: TimelineElement | null = null;
	private updatedAt = performance.now();

	constructor(
		private trackId: string,
		private elementId: string,
		private updates: UpdatableElementProps,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		const tracks = editor.timeline.getTracks();
		const track = tracks.find((t) => t.id === this.trackId);
		const prev = track?.elements.find((el) => el.id === this.elementId);
		this.savedElement = prev ? structuredClone(prev) : null;

		const updatedTracks = tracks.map((t) => {
			if (t.id !== this.trackId) return t;
			const newElements = t.elements.map((el) =>
				el.id === this.elementId
					? { ...el, ...this.updates }
					: el,
			);
			return { ...t, elements: newElements } as typeof t;
		});

		editor.timeline.updateTracks(updatedTracks);
	}

	canMergeWith(next: Command): boolean {
		if (!(next instanceof UpdateElementCommand)) return false;
		if (next.trackId !== this.trackId || next.elementId !== this.elementId) return false;
		if (next.updatedAt - this.updatedAt > 500) return false;
		const currentKeys = Object.keys(this.updates).sort().join("|");
		const nextKeys = Object.keys(next.updates).sort().join("|");
		return currentKeys === nextKeys;
	}

	mergeWith(next: Command): void {
		if (!(next instanceof UpdateElementCommand)) return;
		this.updates = { ...this.updates, ...next.updates };
		this.updatedAt = next.updatedAt;
	}

	undo(): void {
		if (!this.savedElement) return;
		const editor = EditorCore.getInstance();
		const tracks = editor.timeline.getTracks();
		const restored = tracks.map((t) => {
			if (t.id !== this.trackId) return t;
			const newElements = t.elements.map((el) =>
				el.id === this.elementId ? structuredClone(this.savedElement!) : el,
			);
			return { ...t, elements: newElements } as typeof t;
		});
		editor.timeline.updateTracks(restored);
	}
}
