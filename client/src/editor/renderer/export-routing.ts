import type { TimelineTrack, VideoElement } from "../types/timeline";
import type { TBackground } from "../types/project";
import type { Transition } from "../types/transitions";
import { isMainTrack } from "../lib/timeline/track-utils";

const EPSILON = 1e-6;
const approximately = (value: number | undefined, expected: number) =>
	Math.abs((value ?? expected) - expected) < EPSILON;

function isUntouchedVideo(element: VideoElement): boolean {
	const transform = element.transform;
	const crop = element.crop;
	const flip = element.flip;
	const color = element.colorAdjustments;
	const curves = element.colorCurves;
	const wheels = element.colorWheels;
	return (
		(!element.mediaFit || element.mediaFit === "contain") &&
		approximately(element.opacity, 1) &&
		approximately(element.speed, 1) &&
		!element.reversed &&
		approximately(element.fadeIn, 0) &&
		approximately(element.fadeOut, 0) &&
		(!transform ||
			(approximately(transform.scale, 1) &&
				approximately(transform.position?.x, 0) &&
				approximately(transform.position?.y, 0) &&
				approximately(transform.rotate, 0))) &&
		(!crop ||
			(approximately(crop.top, 0) &&
				approximately(crop.right, 0) &&
				approximately(crop.bottom, 0) &&
				approximately(crop.left, 0))) &&
		(!flip || (!flip.horizontal && !flip.vertical)) &&
		(!color ||
			(Object.values(color).every(
				(value) => typeof value !== "number" || approximately(value, 0),
			) &&
				(color.tint ?? "") === "")) &&
		(!curves ||
			[
				...(curves.master ?? []),
				...(curves.red ?? []),
				...(curves.green ?? []),
				...(curves.blue ?? []),
			]
				.length === 0) &&
		(!wheels ||
			[wheels.shadows, wheels.midtones, wheels.highlights].every(
				(wheel) =>
					!wheel ||
					(approximately(wheel.hue, 0) &&
						approximately(wheel.saturation, 0) &&
						approximately(wheel.luminance, 0)),
			)) &&
		!element.lutPath &&
		(!element.blendMode || element.blendMode === "normal") &&
		!(element.effects ?? []).some((effect) => effect.enabled !== false) &&
		!element.chromakey?.enabled &&
		(element.masks?.length ?? 0) === 0 &&
		!element.animationIn &&
		!element.animationOut &&
		!element.animationLoop &&
		!Object.values(element.keyframes?.tracks ?? {}).some(
			(track) => track && track.keyframes.length > 0,
		)
	);
}

export function canUseFastVideoExport({
	tracks,
	sceneTransitions,
	canvasSourceFraming,
	background,
}: {
	tracks: TimelineTrack[];
	sceneTransitions: Transition[];
	canvasSourceFraming: unknown;
	background: TBackground;
}): boolean {
	if (canvasSourceFraming || sceneTransitions.length > 0) return false;
	if (background.type !== "color" || background.color.toLowerCase() !== "#000000") {
		return false;
	}

	const visible = tracks.flatMap((track) => {
		if (track.type === "audio" || track.hidden) return [];
		return track.elements
			.filter((element) => !("hidden" in element && element.hidden))
			.map((element) => ({ track, element }));
	});
	if (visible.length === 0) return false;
	if (!visible.every(
		({ track, element }) =>
			element.type === "video" &&
			isMainTrack(track) &&
			isUntouchedVideo(element),
	)) {
		return false;
	}

	// The native concat path preserves trims and embedded audio without scene-frame staging.
	// Restrict it to a gapless main-track sequence so its timeline pixels are identical to preview.
	const videos = visible
		.map(({ element }) => element as VideoElement)
		.sort((a, b) => a.startTime - b.startTime);
	if (!approximately(videos[0]?.startTime, 0)) return false;
	for (let i = 1; i < videos.length; i++) {
		const previous = videos[i - 1];
		const current = videos[i];
		if (!approximately(current.startTime, previous.startTime + previous.duration)) {
			return false;
		}
	}
	return true;
}
