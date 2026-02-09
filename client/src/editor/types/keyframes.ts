/**
 * Complete keyframe animation system types.
 *
 * Keyframes are stored per-element and define how animatable properties
 * change over the element's local timeline (0 = element start, 1 = element end).
 */

/** Interpolation method between keyframes */
export type KeyframeInterpolation =
	| "linear"
	| "ease-in"
	| "ease-out"
	| "ease-in-out"
	| "hold"
	| "ease-in-cubic"
	| "ease-out-cubic"
	| "ease-in-out-cubic"
	| "ease-in-expo"
	| "ease-out-expo"
	| "ease-in-back"
	| "ease-out-back"
	| "ease-out-bounce"
	| "spring";

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
		case "ease-in-cubic":
			return t * t * t;
		case "ease-out-cubic":
			return 1 - Math.pow(1 - t, 3);
		case "ease-in-out-cubic":
			return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
		case "ease-in-expo":
			return t === 0 ? 0 : Math.pow(2, 10 * t - 10);
		case "ease-out-expo":
			return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
		case "ease-in-back": {
			const c1 = 1.70158;
			const c3 = c1 + 1;
			return c3 * t * t * t - c1 * t * t;
		}
		case "ease-out-back": {
			const c1 = 1.70158;
			const c3 = c1 + 1;
			return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
		}
		case "ease-out-bounce": {
			const n1 = 7.5625;
			const d1 = 2.75;
			let x = t;
			if (x < 1 / d1) return n1 * x * x;
			if (x < 2 / d1) { x -= 1.5 / d1; return n1 * x * x + 0.75; }
			if (x < 2.5 / d1) { x -= 2.25 / d1; return n1 * x * x + 0.9375; }
			x -= 2.625 / d1;
			return n1 * x * x + 0.984375;
		}
		case "spring": {
			const w = 4.71238; // ~1.5 * PI
			const decay = 4;
			return 1 - Math.exp(-decay * t) * Math.cos(w * t);
		}
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
