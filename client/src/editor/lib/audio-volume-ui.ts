/**
 * Clip volume UI helpers: display and slider mapping in dB while persisted values remain
 * linear amplitude gain (same as Web Audio GainNode and FFmpeg `volume=` multiplier).
 *
 * Range: gain 0 (silence) … ~4 (+12 dB). Unity gain 1 = 0 dB.
 */

export const CLIP_GAIN_MIN = 0;

/** Left end of the inspector slider in dB (negative). */
export const CLIP_VOLUME_SLIDER_DB_MIN = -48;
/** Right end past unity in dB (positive). */
export const CLIP_VOLUME_SLIDER_DB_MAX = 12;
export const CLIP_GAIN_MAX = 10 ** (CLIP_VOLUME_SLIDER_DB_MAX / 20);

/** Values at or below this dB are treated as silence for display. */
export const CLIP_VOLUME_SILENCE_DB = -60;

/** Range input granularity (0 = silence, SLIDER_MAX = max boost). */
export const CLIP_VOLUME_SLIDER_STEPS = 1000;

export function linearGainToDb(gain: number): number {
	if (!Number.isFinite(gain) || gain <= 0) return CLIP_VOLUME_SILENCE_DB;
	const g = Math.min(CLIP_GAIN_MAX, Math.max(CLIP_GAIN_MIN + 1e-8, gain));
	return 20 * Math.log10(g);
}

export function dbToLinearGain(db: number): number {
	if (!Number.isFinite(db) || db <= CLIP_VOLUME_SILENCE_DB + 0.01) return CLIP_GAIN_MIN;
	const g = 10 ** (db / 20);
	return Math.min(CLIP_GAIN_MAX, Math.max(CLIP_GAIN_MIN, g));
}

/** Human-readable dB for inspector fields (not for FFmpeg strings). */
export function formatClipVolumeDb(db: number): string {
	if (!Number.isFinite(db) || db <= CLIP_VOLUME_SILENCE_DB + 0.5) return "−∞ dB";
	const rounded = Math.round(db * 10) / 10;
	const sign = rounded > 0 ? "+" : "";
	return `${sign}${rounded} dB`;
}

/**
 * Slider position in 0…1: 0 = silence, 0.5 = unity (0 dB), 1 = max boost.
 * Piecewise linear in dB from CLIP_VOLUME_SLIDER_DB_MIN to 0 on the left half,
 * then 0 to CLIP_VOLUME_SLIDER_DB_MAX on the right half.
 */
export function gainToSliderPosition(gain: number): number {
	if (!Number.isFinite(gain) || gain <= CLIP_GAIN_MIN) return 0;
	const db = linearGainToDb(gain);
	if (db <= 0) {
		if (db <= CLIP_VOLUME_SLIDER_DB_MIN) return 0.5 * 1e-6;
		const u = 1 - db / CLIP_VOLUME_SLIDER_DB_MIN;
		return 0.5 * Math.max(1e-6, Math.min(1, u));
	}
	if (db >= CLIP_VOLUME_SLIDER_DB_MAX) return 1;
	return 0.5 + 0.5 * (db / CLIP_VOLUME_SLIDER_DB_MAX);
}

export function sliderPositionToGain(t: number): number {
	if (!Number.isFinite(t)) return 1;
	const x = Math.max(0, Math.min(1, t));
	if (x <= 0) return CLIP_GAIN_MIN;
	if (x <= 0.5) {
		const u = x / 0.5;
		const db = CLIP_VOLUME_SLIDER_DB_MIN * (1 - u);
		return dbToLinearGain(db);
	}
	const u = (x - 0.5) / 0.5;
	const db = CLIP_VOLUME_SLIDER_DB_MAX * u;
	return dbToLinearGain(db);
}

/** Integer 0…CLIP_VOLUME_SLIDER_STEPS for `<input type="range">`. */
export function gainToSliderStep(gain: number): number {
	return Math.round(gainToSliderPosition(gain) * CLIP_VOLUME_SLIDER_STEPS);
}

export function sliderStepToGain(step: number): number {
	const t = Math.max(0, Math.min(CLIP_VOLUME_SLIDER_STEPS, step)) / CLIP_VOLUME_SLIDER_STEPS;
	return sliderPositionToGain(t);
}

/**
 * Parse user text like "-6", "+3 dB", "0", "−12" (unicode minus) into dB.
 * Returns NaN if empty / invalid.
 */
export function parseVolumeDbInput(text: string): number {
	const cleaned = text
		.trim()
		.replace(/db/gi, "")
		.replace(/∞|inf/gi, "")
		.replace(/\u2212/g, "-")
		.trim();
	if (cleaned === "" || cleaned === "-") return Number.NaN;
	const n = Number.parseFloat(cleaned);
	return Number.isFinite(n) ? n : Number.NaN;
}
