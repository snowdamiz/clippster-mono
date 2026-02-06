/**
 * Complete keyframe animation system types.
 *
 * Keyframes are stored per-element and define how animatable properties
 * change over the element's local timeline (0 = element start, 1 = element end).
 */

/** Interpolation method between keyframes */
export type KeyframeInterpolation = "linear" | "ease-in" | "ease-out" | "ease-in-out" | "hold";

/** A single keyframe value at a specific normalized time offset */
export interface Keyframe<T = number> {
	/** Unique identifier */
	id: string;
	/** Normalized time offset within the element (0..1) */
	offset: number;
	/** The value at this keyframe */
	value: T;
	/** Interpolation to the NEXT keyframe */
	interpolation: KeyframeInterpolation;
}

/** Properties that can be keyframed on visual elements */
export type KeyframableProperty =
	| "opacity"
	| "scale"
	| "positionX"
	| "positionY"
	| "rotation"
	| "volume";

/** A keyframe track for a single property on a single element */
export interface KeyframeTrack<T = number> {
	/** The property being animated */
	property: KeyframableProperty;
	/** Ordered list of keyframes (sorted by offset ascending) */
	keyframes: Keyframe<T>[];
}

/** All keyframe tracks for a single element */
export interface ElementKeyframes {
	/** Element ID this belongs to */
	elementId: string;
	/** Map of property name to keyframe track */
	tracks: Partial<Record<KeyframableProperty, KeyframeTrack>>;
}

/**
 * Evaluate a keyframe track at a given normalized time (0..1).
 * Returns the interpolated value.
 */
export function evaluateKeyframeTrack(track: KeyframeTrack, normalizedTime: number): number {
	const { keyframes } = track;
	if (keyframes.length === 0) return 0;
	if (keyframes.length === 1) return keyframes[0].value;

	// Clamp
	if (normalizedTime <= keyframes[0].offset) return keyframes[0].value;
	if (normalizedTime >= keyframes[keyframes.length - 1].offset) {
		return keyframes[keyframes.length - 1].value;
	}

	// Find surrounding keyframes
	let left = keyframes[0];
	let right = keyframes[keyframes.length - 1];
	for (let i = 0; i < keyframes.length - 1; i++) {
		if (normalizedTime >= keyframes[i].offset && normalizedTime <= keyframes[i + 1].offset) {
			left = keyframes[i];
			right = keyframes[i + 1];
			break;
		}
	}

	if (left.interpolation === "hold") {
		return left.value;
	}

	const range = right.offset - left.offset;
	if (range === 0) return left.value;

	const t = (normalizedTime - left.offset) / range;
	const easedT = applyEasing(t, left.interpolation);

	return left.value + (right.value - left.value) * easedT;
}

/**
 * Apply easing function to a linear 0..1 parameter.
 */
function applyEasing(t: number, interpolation: KeyframeInterpolation): number {
	switch (interpolation) {
		case "linear":
			return t;
		case "ease-in":
			return t * t;
		case "ease-out":
			return t * (2 - t);
		case "ease-in-out":
			return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
		case "hold":
			return 0;
		default:
			return t;
	}
}

/**
 * Get the resolved value of a keyframable property at a given element-local time.
 * If no keyframes exist for the property, returns the static default value.
 */
export function getKeyframedValue({
	elementKeyframes,
	property,
	normalizedTime,
	defaultValue,
}: {
	elementKeyframes: ElementKeyframes | undefined;
	property: KeyframableProperty;
	normalizedTime: number;
	defaultValue: number;
}): number {
	if (!elementKeyframes) return defaultValue;
	const track = elementKeyframes.tracks[property];
	if (!track || track.keyframes.length === 0) return defaultValue;
	return evaluateKeyframeTrack(track, normalizedTime);
}
