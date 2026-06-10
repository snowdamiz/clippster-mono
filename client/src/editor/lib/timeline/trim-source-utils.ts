/**
 * Source-time helpers for timeline video/audio elements.
 *
 * Timeline edits store `trimEnd` as unused tail seconds after the visible clip.
 * Bridge/DB imports may persist `trim_end` as an absolute source out-point.
 * Preview decode must always derive the out-point from trimStart + duration * speed.
 */

export function clampSpeed(speed?: number): number {
	return Math.max(0.1, Math.min(10, speed ?? 1));
}

/** Source seconds spanned by the visible timeline duration at the element speed. */
export function getElementSourceSpanSeconds(params: {
	duration: number;
	speed?: number;
}): number {
	return params.duration * clampSpeed(params.speed);
}

/** Absolute source timestamp where visible media ends. */
export function getElementSourceOutPoint(params: {
	trimStart: number;
	duration: number;
	speed?: number;
}): number {
	return params.trimStart + getElementSourceSpanSeconds(params);
}

/** Total source file extent referenced by trimStart + visible span + tail trim. */
export function getElementSourceExtent(params: {
	trimStart: number;
	duration: number;
	trimEnd: number;
	speed?: number;
}): number {
	return (
		params.trimStart +
		getElementSourceSpanSeconds(params) +
		Math.max(0, params.trimEnd)
	);
}

/** Preserve source extent when duration and/or speed change. */
export function recomputeTrimEndAfterTimingChange(params: {
	trimStart: number;
	oldDuration: number;
	newDuration: number;
	oldSpeed?: number;
	newSpeed?: number;
	trimEnd: number;
}): number {
	const oldSpeed = clampSpeed(params.oldSpeed);
	const newSpeed = clampSpeed(params.newSpeed);
	const sourceExtent =
		params.trimStart +
		params.oldDuration * oldSpeed +
		Math.max(0, params.trimEnd);
	const newSpan = params.newDuration * newSpeed;
	return Math.max(0, sourceExtent - params.trimStart - newSpan);
}

/**
 * Normalize persisted trim_end to tail semantics for timeline elements.
 * Absolute out-points (common from bridge imports) become unused tail seconds.
 */
export function normalizeTrimEndToTail(params: {
	trimStart: number;
	duration: number;
	trimEnd: number | null | undefined;
	speed?: number;
}): number {
	if (params.trimEnd == null || params.trimEnd <= 0) return 0;

	const outPoint = getElementSourceOutPoint({
		trimStart: params.trimStart,
		duration: params.duration,
		speed: params.speed,
	});

	// Absolute import: trim_end ~= natural out-point → tail 0
	if (params.trimEnd > params.trimStart && params.trimEnd >= outPoint - 0.001) {
		return Math.max(0, params.trimEnd - outPoint);
	}

	// Already tail semantics
	return Math.max(0, params.trimEnd);
}
