import { Command } from "../../../../lib/commands/base-command";
import type {
	TimelineTrack,
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
	Pick<VideoElement, "mediaId" | "opacity" | "transform" | "muted" | "hidden" | "volume" | "speed" | "reversed" | "flip" | "crop" | "colorAdjustments" | "effects" | "filterPreset" | "chromakey" | "fadeIn" | "fadeOut">
>;

export type UpdatableImageProps = Partial<
	Pick<ImageElement, "mediaId" | "opacity" | "transform" | "hidden" | "flip" | "crop" | "colorAdjustments" | "effects" | "filterPreset" | "chromakey" | "fadeIn" | "fadeOut">
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
	private savedState: TimelineTrack[] | null = null;

	constructor(
		private trackId: string,
		private elementId: string,
		private updates: UpdatableElementProps,
	) {
		super();
	}

	execute(): void {
		const editor = EditorCore.getInstance();
		this.savedState = editor.timeline.getTracks();

		const updatedTracks = this.savedState.map((t) => {
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
		if (this.savedState) {
			const editor = EditorCore.getInstance();
			editor.timeline.updateTracks(this.savedState);
		}
	}
}
