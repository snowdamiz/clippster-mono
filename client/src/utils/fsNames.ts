/**
 * Sanitize a string for use as a Windows filename segment (single path component).
 * Replaces characters that are invalid or reserved on Windows filesystems.
 */
export function sanitizeEditorMediaFileName(name: string): string {
	const withoutIllegal = name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "_");
	const trimmed = withoutIllegal.replace(/^[\s.]+|[\s.]+$/g, "");
	const base = trimmed.length > 0 ? trimmed : "media";
	// Avoid extremely long paths / SQL cell issues
	return base.length > 200 ? base.slice(0, 200) : base;
}

export type EditorMediaKind = "video" | "audio" | "image";

const DEFAULT_EXT: Record<EditorMediaKind, string> = {
	video: ".mp4",
	audio: ".mp3",
	image: ".png",
};

/** Extract a leading-dot extension from a file path or basename (e.g. `.mp4`). */
export function extensionFromFilesystemPath(pathOrName: string): string | undefined {
	const base = pathOrName.replace(/^.*[/\\]/, "");
	const dot = base.lastIndexOf(".");
	if (dot <= 0 || dot === base.length - 1) return undefined;
	const ext = base.slice(dot).toLowerCase();
	if (!/^\.[a-z0-9]{1,12}$/.test(ext)) return undefined;
	return ext;
}

/** Remove a trailing media extension from a title used for storage (best-effort). */
export function stripTrailingMediaExtension(name: string): string {
	return name.replace(/\.(mp4|mov|webm|mkv|avi|m4v|mp3|wav|m4a|aac|flac|ogg|opus|png|jpe?g|gif|webp)$/i, "");
}

/**
 * Final filename under editor-media when copying or saving bytes.
 * Always includes an extension so FFmpeg / the OS can identify container/codec.
 */
export function editorMediaDestinationFilename(params: {
	id: string;
	displayName: string;
	/** Built clip path, picker path, or upload `File.name` — used to pick extension */
	sourcePathHint?: string;
	kind: EditorMediaKind;
}): string {
	const fromHint =
		params.sourcePathHint && extensionFromFilesystemPath(params.sourcePathHint);
	const ext = fromHint ?? DEFAULT_EXT[params.kind];
	const base = sanitizeEditorMediaFileName(stripTrailingMediaExtension(params.displayName));
	return `${params.id}_${base}${ext}`;
}

/**
 * `File` name passed to mediabunny / WebCodecs must include an extension so format sniffing works.
 */
export function playbackFileLabel(
	filePath: string,
	displayName: string,
	kind: EditorMediaKind,
): string {
	const ext = extensionFromFilesystemPath(filePath) ?? DEFAULT_EXT[kind];
	const base = sanitizeEditorMediaFileName(stripTrailingMediaExtension(displayName));
	return `${base}${ext}`;
}
