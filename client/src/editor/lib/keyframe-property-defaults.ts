import type { KeyframableProperty, ElementKeyframes } from "../types/keyframes";
import { getKeyframedValue, sortedKeyframes } from "../types/keyframes";
import type { TimelineElement } from "../types/timeline";

/** Static property value on the element used when no keyframe track exists. */
export function getKeyframePropertyStaticDefault(
	element: TimelineElement,
	property: KeyframableProperty,
): number {
	switch (property) {
		case "opacity":
			return "opacity" in element && typeof element.opacity === "number" ? element.opacity : 1;
		case "scale":
			return "transform" in element ? element.transform.scale : 1;
		case "positionX":
			return "transform" in element ? element.transform.position.x : 0;
		case "positionY":
			return "transform" in element ? element.transform.position.y : 0;
		case "rotation":
			return "transform" in element ? element.transform.rotate : 0;
		case "volume":
			return "volume" in element && typeof element.volume === "number" ? element.volume : 1;
		case "speed":
			return "speed" in element && typeof element.speed === "number" ? element.speed : 1;
		default:
			return 0;
	}
}

/** Display multiplier as percentage for scale keyframe UI. */
export function formatKeyframeDisplayValue(property: KeyframableProperty, value: number): string {
	if (property === "scale") {
		return Math.round(value * 100).toString();
	}
	if (property === "opacity") {
		return Math.round(value * 100).toString();
	}
	return Number(value.toFixed(2)).toString();
}

/** Parse user input from keyframe UI back to stored value. */
export function parseKeyframeDisplayValue(property: KeyframableProperty, raw: number): number {
	if (property === "scale" || property === "opacity") {
		return raw / 100;
	}
	return raw;
}

/**
 * Value to store when placing a new keyframe at `offset`.
 * Outside the existing keyframe span, anchors to the element's static base (e.g. 100% scale).
 * Between keyframes, samples the current curve at that time.
 */
export function getValueForNewKeyframeAtOffset({
	elementKeyframes,
	property,
	offset,
	staticDefault,
}: {
	elementKeyframes: ElementKeyframes | undefined;
	property: KeyframableProperty;
	offset: number;
	staticDefault: number;
}): number {
	const track = elementKeyframes?.tracks[property];
	if (!track || track.keyframes.length === 0) {
		return staticDefault;
	}

	const sorted = sortedKeyframes(track.keyframes);
	const epsilon = 0.001;
	const replacing = sorted.some((k) => Math.abs(k.offset - offset) <= epsilon);
	if (replacing) {
		return getKeyframedValue({ elementKeyframes, property, normalizedTime: offset, defaultValue: staticDefault });
	}

	const firstOffset = sorted[0]!.offset;
	const lastOffset = sorted[sorted.length - 1]!.offset;
	if (offset < firstOffset - epsilon || offset > lastOffset + epsilon) {
		return staticDefault;
	}

	return getKeyframedValue({ elementKeyframes, property, normalizedTime: offset, defaultValue: staticDefault });
}
