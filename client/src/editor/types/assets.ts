import type { MediaAssetData } from "../storage/types";

export type MediaType = "image" | "video" | "audio";

export interface MediaAsset
	extends Omit<MediaAssetData, "size" | "lastModified"> {
	file: File;
	url?: string;
	filePath?: string;
	/** Tauri: absolute path to copy into editor-media. Prefer this over mutating `File.path` (Vue/reactivity can drop the latter). */
	diskImportPath?: string;
}
