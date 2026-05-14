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
import { resolveTransitionMediaPair } from "../lib/timeline/transition-pairing";
import type { BaseNode } from "./nodes/base-node";

/**
 * Preview scene cache invalidation: keep in sync with
 * [`fingerprintTimelineElement`](../lib/scene-input-fingerprint.ts) — any new `VideoNode` /
 * `ImageNode` / … params must affect that fingerprint.
 */
export type BuildSceneParams = {
	canvasSize: TCanvasSize;
	tracks: TimelineTrack[];
	mediaAssets: MediaAsset[];
	duration: number;
	background: TBackground;
	transitions?: Transition[];
};

type TransitionExtendableNode = BaseNode & {
	setTransitionExtension: (extension: { before?: number; after?: number }) => void;
};

function isTransitionExtendableNode(node: BaseNode): node is TransitionExtendableNode {
	return typeof (node as { setTransitionExtension?: unknown }).setTransitionExtension === "function";
}

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
				// Decode uses the File handle; url/filePath are optional (some assets only persist path + File).
				if (!mediaAsset?.file) {
					continue;
				}
				if (mediaAsset.type === "video" && mediaAsset.file.size === 0) {
					continue;
				}

				let node: BaseNode | null = null;
			if (mediaAsset.type === "video") {
				const videoEl = element as VideoElement;
			node = new VideoNode({
				mediaId: mediaAsset.id,
				elementId: videoEl.id,
				url: mediaAsset.url ?? "",
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
				colorCurves: videoEl.colorCurves,
				colorWheels: videoEl.colorWheels,
				blendMode: videoEl.blendMode,
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
				masks: videoEl.masks,
			});
		}
		if (mediaAsset.type === "image") {
			const imageEl = element as ImageElement;
			node = new ImageNode({
				url: mediaAsset.url ?? "",
				duration: imageEl.duration,
				timeOffset: imageEl.startTime,
				trimStart: imageEl.trimStart,
				trimEnd: imageEl.trimEnd,
				opacity: imageEl.opacity,
				transform: imageEl.transform,
				flip: imageEl.flip,
				crop: imageEl.crop,
				colorAdjustments: imageEl.colorAdjustments,
				colorCurves: imageEl.colorCurves,
				colorWheels: imageEl.colorWheels,
				blendMode: imageEl.blendMode,
				fadeIn: imageEl.fadeIn,
				fadeOut: imageEl.fadeOut,
				keyframes: imageEl.keyframes,
				effects: imageEl.effects,
				chromakey: imageEl.chromakey,
				animationIn: imageEl.animationIn,
				animationOut: imageEl.animationOut,
				animationLoop: imageEl.animationLoop,
				masks: imageEl.masks,
			});
		}
				if (node) {
					elementNodeMap.set(element.id, node);
				}
			}
		}

		// Second pass: create TransitionNodes for adjacent pairs, then add remaining nodes.
		// Pair by timeline order (startTime), not layer order (orderIndex), so the left clip
		// is always the true outgoing segment. Extend the outgoing tail by any gap before the
		// incoming clip so it still renders through the full overlap window (junction is the
		// incoming startTime; a micro-gap used to make clips "adjacent" would otherwise drop
		// the outgoing layer mid-transition and make wipes/fades look one-sided).
		const TRANSITION_TIME_SLACK = 1 / 30;
		/** Same rule as first pass — must stay in sync so transitions pair clips that actually have nodes. */
		const hasRenderableMedia = (el: (typeof track.elements)[number]) => {
			if (el.type !== "video" && el.type !== "image") return false;
			const m = mediaMap.get((el as VideoElement | ImageElement).mediaId);
			if (!m?.file) return false;
			if (el.type === "video") return m.type === "video" && m.file.size > 0;
			return m.type === "image";
		};

		const sortedMediaElements = track.elements
			.filter((element) => !("hidden" in element && element.hidden))
			.filter((element) => element.type === "video" || element.type === "image")
			.slice()
			.sort((a, b) => (a.startTime !== b.startTime ? a.startTime - b.startTime : a.id.localeCompare(b.id)));

		type TrackTransitionPlan = {
			transition: Transition;
			pair: { outgoing: VideoElement | ImageElement; incoming: VideoElement | ImageElement };
			outgoingNode: BaseNode;
			incomingNode: BaseNode;
			duration: number;
			junctionTime: number;
			gapAfterOutgoing: number;
			sameVideo: boolean;
		};

		const transitionPlans: TrackTransitionPlan[] = [];

		for (const element of sortedMediaElements) {
			if (!hasRenderableMedia(element)) continue;

			const transition = transitionByTarget.get(element.id);
			// Do not require transition.trackId === track.id: targetElementId is unique and
			// already ties the transition to this element; trackId can drift after edits/imports
			// and would otherwise skip building TransitionNode (preview/export would show no effect).
			if (!transition) continue;

			const pair = resolveTransitionMediaPair({ transition, track });
			if (!pair) continue;

			const { outgoing: outgoingMedia, incoming: incomingMedia } = pair;
			if (!hasRenderableMedia(outgoingMedia) || !hasRenderableMedia(incomingMedia)) {
				continue;
			}

			const outgoingEnd = outgoingMedia.startTime + outgoingMedia.duration;
			const gapAfterOutgoing = Math.max(0, incomingMedia.startTime - outgoingEnd);

			const outgoingNode = elementNodeMap.get(outgoingMedia.id);
			const incomingNode = elementNodeMap.get(incomingMedia.id);

			if (outgoingNode && incomingNode) {
				const d = Math.max(1e-6, transition.duration);
				const sameVideo =
					outgoingMedia.type === "video" &&
					incomingMedia.type === "video" &&
					(outgoingMedia as VideoElement).mediaId === (incomingMedia as VideoElement).mediaId;

				transitionPlans.push({
					transition,
					pair: { outgoing: outgoingMedia, incoming: incomingMedia },
					outgoingNode,
					incomingNode,
					duration: d,
					junctionTime: incomingMedia.startTime,
					gapAfterOutgoing,
					sameVideo,
				});
			}
		}

		for (const plan of transitionPlans) {
			// Peer suppression: while `time` is inside another transition's composite window, this node
			// must not run simple outgoing/incoming draws (avoids stomping shared VideoNode state).
			//
			// - For *earlier* peers (p.junction < this.junction): use their **full** window so this
			//   later cut stays idle during the earlier composite (regression if we only intersected:
			//   adjacent windows rarely overlap, so the 2nd TransitionNode drew B on top and hid T1).
			// - For *later* peers (p.junction > this.junction): clip **start** to this junction so a
			//   long later transition does not suppress this cut's outgoing clip while still on the
			//   left-hand segment (upstream black / false "early" transition).
			const peerWindows = transitionPlans
				.filter((p) => p !== plan)
				.map((p) => {
					const ph = p.duration / 2;
					let start = p.junctionTime - ph;
					const end = p.junctionTime + ph;
					if (p.junctionTime > plan.junctionTime + 1e-9) {
						start = Math.max(start, plan.junctionTime);
					}
					return { start, end };
				});

			// Middle segment (incoming of this cut) must not use "incoming-only" fallback when it
			// is the outgoing side of a later cut — otherwise both TransitionNodes paint that clip
			// and the later pass wipes out the earlier transition (and doubles decode work).
			const suppressIncoming = transitionPlans.some(
				(p) =>
					p !== plan &&
					p.pair.outgoing.id === plan.pair.incoming.id &&
					p.junctionTime > plan.junctionTime,
			);

			const d = plan.duration;
			const halfDuration = d / 2;

			const sampleSpread = plan.sameVideo
				? Math.min(3, Math.max(d * 2, d + 1.25))
				: undefined;

			const transitionNode = new TransitionNode({
				type: plan.transition.type,
				duration: d,
				junctionTime: plan.junctionTime,
				peerTransitionWindows: peerWindows,
				suppressIncomingOutsideWindow: suppressIncoming,
				...(sampleSpread !== undefined ? { sampleSpread } : {}),
			});

			if (isTransitionExtendableNode(plan.outgoingNode)) {
				plan.outgoingNode.setTransitionExtension({
					after: halfDuration + plan.gapAfterOutgoing + TRANSITION_TIME_SLACK,
				});
			}
			if (isTransitionExtendableNode(plan.incomingNode)) {
				plan.incomingNode.setTransitionExtension({ before: halfDuration + TRANSITION_TIME_SLACK });
			}

			transitionNode.outgoingNode = plan.outgoingNode;
			transitionNode.incomingNode = plan.incomingNode;
			contentNodes.push(transitionNode);
			consumedByTransition.add(plan.pair.outgoing.id);
			consumedByTransition.add(plan.pair.incoming.id);
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
					blendMode: element.blendMode,
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
