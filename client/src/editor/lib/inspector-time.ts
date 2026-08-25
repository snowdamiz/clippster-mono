/** Format seconds as `M:SS.ss` for inspector timing fields. */
export function formatInspectorTime(seconds: number): string {
	const min = Math.floor(seconds / 60);
	const sec = (seconds % 60).toFixed(2);
	return `${min}:${sec.padStart(5, "0")}`;
}

/** Parse `M:SS.ss` or plain seconds from inspector timing input. */
export function parseInspectorTime(value: string): number | null {
	const trimmed = value.trim();
	if (!trimmed) return null;

	if (!trimmed.includes(":")) {
		const asNumber = Number(trimmed);
		return Number.isFinite(asNumber) && asNumber >= 0 ? asNumber : null;
	}

	const parts = trimmed.split(":");
	if (parts.length !== 2) return null;

	const minutes = Number(parts[0]);
	const seconds = Number(parts[1]);
	if (!Number.isFinite(minutes) || !Number.isFinite(seconds)) return null;
	if (minutes < 0 || seconds < 0 || seconds >= 60) return null;

	return minutes * 60 + seconds;
}
