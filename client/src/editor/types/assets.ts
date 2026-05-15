import type { MediaAssetData } from "../storage/types";

export type MediaType = "image" | "video" | "audio";

export interface MediaAsset
	extends Omit<MediaAssetData, "size" | "lastModified"> {
	file: File;
	url?: string;
	filePath?: string;
	/** Tauri: absolute path to copy into editor-media. Prefer this over mutating `File.path` (Vue/reactivity can drop the latter). */
	diskImportPath?: string;
	/**
	 * Absolute path already under editor-media (e.g. after `copy_file_to_project_media`).
	 * `resolveFilePath` returns this as-is — no second copy.
	 */
	alreadyResolvedFilePath?: string;
	/** When set with `alreadyResolvedFilePath`, DB insert uses this instead of `file.size`. */
	importFileSizeBytes?: number;
	/** When set with `alreadyResolvedFilePath`, DB insert uses this instead of `file.lastModified`. */
	importFileLastModifiedMs?: number;
}
