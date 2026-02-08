import type { TimelineTrack, VideoElement, ImageElement, EffectElement, CaptionElement } from "../types/timeline";
import type { MediaAsset } from "../types/assets";
import { RootNode } from "./nodes/root-node";
import { VideoNode } from "./nodes/video-node";
import { ImageNode } from "./nodes/image-node";
import { TextNode } from "./nodes/text-node";
import { StickerNode } from "./nodes/sticker-node";
import { ColorNode } from "./nodes/color-node";
import { EffectNode } from "./nodes/effect-node";
import { CaptionNode } from "./nodes/caption-node";
import { BlurBackgroundNode } from "./nodes/blur-background-node";
import type { TBackground, TCanvasSize } from "../types/project";
import { DEFAULT_BLUR_INTENSITY } from "../constants/project-constants";
import { isMainTrack } from "../lib/timeline";

export type BuildSceneParams = {
	canvasSize: TCanvasSize;
	tracks: TimelineTrack[];
	mediaAssets: MediaAsset[];
	duration: number;
	background: TBackground;
};

export function buildScene(params: BuildSceneParams) {
	const { tracks, mediaAssets, duration, canvasSize, background } = params;

	const rootNode = new RootNode({ duration });
	const mediaMap = new Map(mediaAssets.map((m) => [m.id, m]));

	const visibleTracks = tracks.filter(
		(track) => !("hidden" in track && track.hidden),
	);

	const orderedTracksTopToBottom = [
		...visibleTracks.filter((track) => !isMainTrack(track)),
		...visibleTracks.filter((track) => isMainTrack(track)),
	];

	const orderedTracksBottomToTop = orderedTracksTopToBottom.slice().reverse();

	const contentNodes = [];

	for (const track of orderedTracksBottomToTop) {
		const elements = track.elements
			.filter((element) => !("hidden" in element && element.hidden))
			.slice()
			.sort((a, b) => {
				if (a.startTime !== b.startTime) return a.startTime - b.startTime;
				return a.id.localeCompare(b.id);
			});

		for (const element of elements) {
			if (element.type === "video" || element.type === "image") {
				const mediaAsset = mediaMap.get(element.mediaId);
				if (!mediaAsset?.file || !mediaAsset?.url) {
					continue;
				}

				if (mediaAsset.type === "video") {
					const videoEl = element as VideoElement;
					contentNodes.push(
						new VideoNode({
							mediaId: mediaAsset.id,
							elementId: videoEl.id,
							url: mediaAsset.url,
							file: mediaAsset.file,
							duration: videoEl.duration,
							timeOffset: videoEl.startTime,
							trimStart: videoEl.trimStart,
							trimEnd: videoEl.trimEnd,
							opacity: videoEl.opacity,
							transform: videoEl.transform,
							flip: videoEl.flip,
							crop: videoEl.crop,
							colorAdjustments: videoEl.colorAdjustments,
							speed: videoEl.speed,
							keyframes: videoEl.keyframes,
							effects: videoEl.effects,
							chromakey: videoEl.chromakey,
						}),
					);
				}
				if (mediaAsset.type === "image") {
					const imageEl = element as ImageElement;
					contentNodes.push(
						new ImageNode({
							url: mediaAsset.url,
							duration: imageEl.duration,
							timeOffset: imageEl.startTime,
							trimStart: imageEl.trimStart,
							trimEnd: imageEl.trimEnd,
							opacity: imageEl.opacity,
							transform: imageEl.transform,
							flip: imageEl.flip,
							crop: imageEl.crop,
							colorAdjustments: imageEl.colorAdjustments,
							keyframes: imageEl.keyframes,
							effects: imageEl.effects,
							chromakey: imageEl.chromakey,
						}),
					);
				}
			}

			if (element.type === "text") {
				contentNodes.push(
					new TextNode({
						...element,
						canvasCenter: { x: canvasSize.width / 2, y: canvasSize.height / 2 },
						textBaseline: "middle",
					}),
				);
			}

			if (element.type === "sticker") {
				contentNodes.push(
					new StickerNode({
						iconName: element.iconName,
						duration: element.duration,
						timeOffset: element.startTime,
						trimStart: element.trimStart,
						trimEnd: element.trimEnd,
						transform: element.transform,
						opacity: element.opacity,
						color: element.color,
						keyframes: element.keyframes,
					}),
				);
			}

			if (element.type === "effect") {
				const effectEl = element as EffectElement;
				contentNodes.push(
					new EffectNode({
						effectType: effectEl.effectType,
						enabled: effectEl.enabled,
						intensity: effectEl.intensity,
						params: effectEl.params,
						duration: effectEl.duration,
						timeOffset: effectEl.startTime,
						trimStart: effectEl.trimStart,
						trimEnd: effectEl.trimEnd,
					}),
				);
			}

			if (element.type === "caption") {
				const captionEl = element as CaptionElement;
				contentNodes.push(
					new CaptionNode({
						...captionEl,
						canvasCenter: { x: canvasSize.width / 2, y: canvasSize.height / 2 },
					}),
				);
			}
		}
	}

	if (background.type === "blur") {
		rootNode.add(
			new BlurBackgroundNode({
				blurIntensity: background.blurIntensity ?? DEFAULT_BLUR_INTENSITY,
				contentNodes,
			}),
		);
		for (const node of contentNodes) {
			rootNode.add(node);
		}
	} else {
		if (background.type === "color" && background.color !== "transparent") {
			rootNode.add(new ColorNode({ color: background.color }));
		}
		for (const node of contentNodes) {
			rootNode.add(node);
		}
	}

	return rootNode;
}
