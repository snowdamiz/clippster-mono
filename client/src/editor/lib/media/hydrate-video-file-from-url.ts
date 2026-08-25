/**
 * Load bytes for editor decode (mediabunny / Web Audio). Empty placeholder Files are invalid.
 * In Tauri, prefer `diskPath` + `readFile` — avoids a second full read through the localhost video server.
 */
export async function hydrateVideoFileFromLocalUrl({
	url,
	name,
	fallbackType = "video/mp4",
	diskPath,
}: {
	url: string;
	name: string;
	fallbackType?: string;
	/** Absolute path to the same bytes as `url` (Tauri); faster than fetch(localhost). */
	diskPath?: string | null;
}): Promise<File> {
	const trimmed = diskPath?.trim();
	if (trimmed) {
		try {
			const { readFile } = await import("@tauri-apps/plugin-fs");
			const bytes = await readFile(trimmed);
			const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
			return new File([u8], name, { type: fallbackType });
		} catch {
			// Web dev or FS scope: fall back to URL
		}
	}

	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`Failed to read video for decode (${res.status}): ${name}`);
	}
	const blob = await res.blob();
	const type =
		blob.type && blob.type !== "application/octet-stream" ? blob.type : fallbackType;
	return new File([blob], name, { type });
}
