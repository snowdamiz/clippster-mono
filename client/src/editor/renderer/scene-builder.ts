import type { TimelineTrack, VideoElement, ImageElement, EffectElement, CaptionElement } from "../types/timeline";
import type { MediaAsset } from "../types/assets";
import type { Transition } from "../types/transitions";
import { RootNode } from "./nodes/root-node";
import { VideoNode } from "./nodes/video-node";
import { ImageNode } from "./nodes/image-node";
import { TextNode } from "./nodes/text-node";
import { StickerNode } from "./nodes/sticker-node";
import { ColorNode } from "./nodes/color-node";
import { EffectNode } from "./nodes/effect-node";
import { CaptionNode } from "./nodes/caption-node";
import { BlurBackgroundNode } from "./nodes/blur-background-node";
import { TransitionNode } from "./nodes/transition-node";
import type { TBackground, TCanvasSize } from "../types/project";
import { DEFAULT_BLUR_INTENSITY } from "../constants/project-constants";
import { isMainTrack } from "../lib/timeline";
import type { BaseNode } from "./nodes/base-node";

export type BuildSceneParams = {
	canvasSize: TCanvasSize;
	tracks: TimelineTrack[];
	mediaAssets: MediaAsset[];
	duration: number;
	background: TBackground;
	transitions?: Transition[];
};

export function buildScene(params: BuildSceneParams) {
	const { tracks, mediaAssets, duration, canvasSize, background, transitions } = params;

	const rootNode = new RootNode({ duration });
	const mediaMap = new Map(mediaAssets.map((m) => [m.id, m]));

	const visibleTracks = tracks.filter(
		(track) => !("hidden" in track && track.hidden),
	);

	// Render order (bottom to top):
	// 1. Main video track (background)
	// 2. Non-main video tracks (overlays like cam/game views)
	// 3. Effect tracks
	// 4. Text, sticker, and caption tracks (always on top so they're never hidden)
	const isOverlayTrack = (track: TimelineTrack) =>
		track.type === "text" || track.type === "caption" || track.type === "sticker";

	const orderedTracksBottomToTop = [
		...visibleTracks.filter((track) => isMainTrack(track)),
		...visibleTracks.filter((track) => !isMainTrack(track) && !isOverlayTrack(track)),
		...visibleTracks.filter((track) => isOverlayTrack(track)),
	];

	// Build a lookup of transitions by targetElementId for quick access
	const transitionByTarget = new Map<string, Transition>();
	if (transitions) {
		for (const t of transitions) {
			transitionByTarget.set(t.targetElementId, t);
		}
	}

	const contentNodes: BaseNode[] = [];

	for (const track of orderedTracksBottomToTop) {
		const elements = track.elements
			.filter((element) => !("hidden" in element && element.hidden))
			.slice()
			.sort((a, b) => {
				// Sort by orderIndex first (layer order), then startTime, then id
				const aOrder = a.orderIndex ?? 0;
				const bOrder = b.orderIndex ?? 0;
				if (aOrder !== bOrder) return aOrder - bOrder;
				if (a.startTime !== b.startTime) return a.startTime - b.startTime;
				return a.id.localeCompare(b.id);
			});

		// Build a map of elementId → render node for this track (for transition pairing)
		const elementNodeMap = new Map<string, BaseNode>();
		// Track which element IDs are consumed by transitions (skip adding them individually)
		const consumedByTransition = new Set<string>();

		// First pass: build all nodes for this track
		for (const element of elements) {
			if (element.type === "video" || element.type === "image") {
				const mediaAsset = mediaMap.get(element.mediaId);
				if (!mediaAsset?.file || !mediaAsset?.url) {
					continue;
				}

				let node: BaseNode | null = null;
				if (mediaAsset.type === "video") {
					const videoEl = element as VideoElement;
					node = new VideoNode({
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
						reversed: videoEl.reversed,
						fadeIn: videoEl.fadeIn,
						fadeOut: videoEl.fadeOut,
						keyframes: videoEl.keyframes,
						effects: videoEl.effects,
						chromakey: videoEl.chromakey,
						animationIn: videoEl.animationIn,
						animationOut: videoEl.animationOut,
						animationLoop: videoEl.animationLoop,
					});
				}
				if (mediaAsset.type === "image") {
					const imageEl = element as ImageElement;
					node = new ImageNode({
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
						fadeIn: imageEl.fadeIn,
						fadeOut: imageEl.fadeOut,
						keyframes: imageEl.keyframes,
						effects: imageEl.effects,
						chromakey: imageEl.chromakey,
						animationIn: imageEl.animationIn,
						animationOut: imageEl.animationOut,
						animationLoop: imageEl.animationLoop,
					});
				}
				if (node) {
					elementNodeMap.set(element.id, node);
				}
			}
		}

		// Second pass: create TransitionNodes for adjacent pairs, then add remaining nodes
		for (let i = 0; i < elements.length; i++) {
			const element = elements[i];
			const transition = transitionByTarget.get(element.id);

			if (transition && transition.trackId === track.id && i > 0) {
				// Find the outgoing element (the one before this in the sorted list)
				const prevElement = elements[i - 1];
				const outgoingNode = elementNodeMap.get(prevElement.id);
				const incomingNode = elementNodeMap.get(element.id);

				if (outgoingNode && incomingNode) {
					const transitionNode = new TransitionNode({
						type: transition.type,
						duration: transition.duration,
						transitionStart: element.startTime,
					});
					transitionNode.outgoingNode = outgoingNode;
					transitionNode.incomingNode = incomingNode;
					contentNodes.push(transitionNode);
					consumedByTransition.add(prevElement.id);
					consumedByTransition.add(element.id);
				}
			}
		}

		// Add non-transition video/image nodes
		for (const element of elements) {
			if ((element.type === "video" || element.type === "image") && !consumedByTransition.has(element.id)) {
				const node = elementNodeMap.get(element.id);
				if (node) contentNodes.push(node);
			}
		}

		// Add non-video/image elements as before
		for (const element of elements) {
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
						fadeIn: element.fadeIn,
						fadeOut: element.fadeOut,
						keyframes: element.keyframes,
						animationIn: element.animationIn,
						animationOut: element.animationOut,
						animationLoop: element.animationLoop,
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
