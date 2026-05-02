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
	Pick<VideoElement, "mediaId" | "opacity" | "transform" | "muted" | "hidden" | "volume" | "speed" | "reversed" | "flip" | "crop" | "colorAdjustments" | "effects" | "filterPreset" | "chromakey" | "fadeIn" | "fadeOut" | "masks">
>;

export type UpdatableImageProps = Partial<
	Pick<ImageElement, "mediaId" | "opacity" | "transform" | "hidden" | "flip" | "crop" | "colorAdjustments" | "effects" | "filterPreset" | "chromakey" | "fadeIn" | "fadeOut" | "masks">
>;

export type UpdatableAudioProps = Partial<
	Pick<AudioElement, "volume" | "muted" | "speed" | "reversed" | "fadeIn" | "fadeOut" | "audioEffects">
>;

export type UpdatableStickerProps = Partial<
	Pick<StickerElement, "opacity" | "transform" | "color" | "hidden" | "fadeIn" | "fadeOut">
>;

export type UpdatableEffectProps = Partial<
	Pick<EffectElement, "enabled" | "intensity" | "params">
>;

export type UpdatableCaptionProps = Partial<
	Pick<CaptionElement, "opacity" | "transform" | "hidden">
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
