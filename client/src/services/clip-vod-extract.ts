/**
 * Shared logic for extracting a clip segment from a project VOD (FFmpeg).
 * Used by "Open in editor" (ProjectWorkspaceDialog → video-editor-project-creator)
 * and by the clip editor media panel (ProjectClipsView).
 */

import { invoke } from "@tauri-apps/api/core";
import { getClip, getRawVideosByProjectId } from "@/services/database";
import type { Clip, RawVideo } from "@/services/database/types";
import { base64ToUtf8 } from "@/utils/encoding";

export type ClipLikeForTimeRange = Clip & {
	current_version_start_time?: number | null;
	current_version_end_time?: number | null;
	current_version_segments?: Array<{ start_time: number; end_time: number }>;
};

function normalizePathForCompare(p: string): string {
	return p.replace(/\\/g, "/").toLowerCase();
}

function isHttpUrl(p: string): boolean {
	return /^https?:\/\//i.test(p.trim());
}

export function isAbsoluteFilesystemPath(p: string): boolean {
	const t = p.trim();
	if (!t || isHttpUrl(t)) return false;
	if (t.startsWith("/")) return true;
	if (/^[a-zA-Z]:[\\/]/.test(t)) return true;
	if (t.startsWith("\\\\")) return true;
	return false;
}

/**
 * Built exports and editor scratch files are short — clip_versions times are on the full VOD timeline.
 * Using them as FFmpeg `-i` with VOD-relative start/end yields empty ~ftyp-only outputs.
 */
export function isPlausibleVodSourcePath(filePath: string): boolean {
	const t = normalizePathForCompare(filePath);
	if (!t.trim()) return false;
	if (t.includes("/built_clips/") || t.includes("\\built_clips\\")) return false;
	if (t.includes("/editor-media/") || t.includes("\\editor-media\\")) return false;
	return true;
}

function filterPlausibleVodRawVideos(rows: RawVideo[]): RawVideo[] {
	return rows.filter((rv) => rv.file_path && isPlausibleVodSourcePath(rv.file_path));
}

function tryDecodeVideoServerUrl(videoSrc: string): string | null {
	const match = videoSrc.match(/\/video\/([^?]+)/);
	if (!match) return null;
	try {
		return base64ToUtf8(match[1]);
	} catch {
		return null;
	}
}

/**
 * Raw VODs usually live on the parent project; segment/child projects often have zero raw_videos rows.
 */
export async function loadRawVideosForClipProject(
	clipProjectId: string,
	parentProjectId?: string | null,
): Promise<RawVideo[]> {
	const direct = await getRawVideosByProjectId(clipProjectId);
	const directPlausible = filterPlausibleVodRawVideos(direct);
	if (directPlausible.length > 0) return directPlausible;

	if (parentProjectId && clipProjectId !== parentProjectId) {
		const parentRows = await getRawVideosByProjectId(parentProjectId);
		const parentPlausible = filterPlausibleVodRawVideos(parentRows);
		if (parentPlausible.length > 0) return parentPlausible;
	}

	// Had raw_videos rows but only built_clips / editor paths — never use those for VOD-timeline extract.
	return [];
}

/**
 * Pick the VOD filesystem path for FFmpeg.
 * When `videoSrc` is the project player's `http://localhost:…/video/…` URL, prefer its decoded path
 * (same file the user is watching) — matches ProjectWorkspaceDialog + createVideoEditorProjectFromClip.
 */
export function resolveVodPathForClipExtraction(
	clip: Clip,
	rawVideos: RawVideo[],
	videoSrc?: string | null,
): string {
	const rows = filterPlausibleVodRawVideos(rawVideos);

	if (videoSrc) {
		const decoded = tryDecodeVideoServerUrl(videoSrc);
		if (
			decoded &&
			isAbsoluteFilesystemPath(decoded) &&
			!isHttpUrl(decoded) &&
			isPlausibleVodSourcePath(decoded)
		) {
			return decoded;
		}
	}

	if (rows.length === 0) {
		const fp = clip.file_path?.trim();
		if (!fp) throw new Error("Cannot find source video file for clip extraction");
		if (isHttpUrl(fp)) {
			throw new Error(
				"This clip references a remote URL; the editor needs a local VOD file. Download or attach the video to the project first.",
			);
		}
		if (!isAbsoluteFilesystemPath(fp)) {
			throw new Error(
				"No full-length source VOD found for this clip (only built/editor paths in raw_videos, or DB not linked). Open the parent project or re-attach the recording.",
			);
		}
		if (!isPlausibleVodSourcePath(fp)) {
			throw new Error(
				"Clip file_path points at a built or editor export, not the full recording. Version times are on the VOD timeline — link the original VOD on the parent project or open this clip from the project workspace.",
			);
		}
		return fp;
	}

	const clipFp = clip.file_path?.trim() ?? "";
	if (clipFp && !isHttpUrl(clipFp)) {
		const n = normalizePathForCompare(clipFp);
		const exact = rows.find((rv) => normalizePathForCompare(rv.file_path) === n);
		if (exact) return exact.file_path;

		const clipBase = clipFp.split(/[/\\]/).pop()?.toLowerCase() ?? "";
		if (clipBase) {
			const byBase = rows.find(
				(rv) => (rv.file_path.split(/[/\\]/).pop() ?? "").toLowerCase() === clipBase,
			);
			if (byBase) return byBase.file_path;

			const clipStem = clipBase.replace(/\.[^.]+$/, "");
			const byStem = rows.find((rv) => {
				const b = (rv.file_path.split(/[/\\]/).pop() ?? "").toLowerCase();
				return b.replace(/\.[^.]+$/, "") === clipStem;
			});
			if (byStem) return byStem.file_path;
		}

		const firstLocal = rows.find((rv) => !isHttpUrl(rv.file_path));
		if (firstLocal && !isAbsoluteFilesystemPath(clipFp)) {
			return firstLocal.file_path;
		}
		if (isAbsoluteFilesystemPath(clipFp) && isPlausibleVodSourcePath(clipFp)) return clipFp;
		if (firstLocal) return firstLocal.file_path;
	}

	const firstLocal = rows.find((rv) => !isHttpUrl(rv.file_path));
	if (firstLocal) return firstLocal.file_path;
	return rows[0].file_path;
}

/** Seconds on the VOD timeline — prefer clip_versions bounds (project playback). */
export function resolveClipTimeRangeForExtraction(clip: ClipLikeForTimeRange): {
	startTime: number;
	endTime: number;
} {
	const vStart = clip.current_version_start_time;
	const vEnd = clip.current_version_end_time;
	if (
		vStart != null &&
		vEnd != null &&
		Number.isFinite(vStart) &&
		Number.isFinite(vEnd) &&
		vEnd > vStart
	) {
		return { startTime: vStart, endTime: vEnd };
	}

	const segs = clip.current_version_segments;
	if (segs && segs.length > 0) {
		const startTime = Math.min(...segs.map((s) => s.start_time));
		const endTime = Math.max(...segs.map((s) => s.end_time));
		if (Number.isFinite(startTime) && Number.isFinite(endTime) && endTime > startTime) {
			return { startTime, endTime };
		}
	}

	const clipStartTime = clip.start_time ?? 0;
	const clipEndTime =
		clip.end_time ?? (clip.duration != null ? clipStartTime + clip.duration : clipStartTime + 10);
	return { startTime: clipStartTime, endTime: clipEndTime };
}

export interface ExtractUnbuiltClipSegmentParams {
	clipId: string;
	clipStartTime: number;
	clipEndTime: number;
	outputPath: string;
	/** Project workspace player URL — decoded path wins (same VOD the user is watching). */
	videoSrc?: string | null;
	/** When clip.project_id is a child/segment project with no raw_videos, pass parent project id. */
	rawVideoParentProjectId?: string | null;
}

/**
 * FFmpeg-extracts an unbuilt clip's time range from the resolved VOD into `outputPath`.
 * Caller must choose `outputPath` (e.g. `get_editor_clip_extract_path`).
 */
export async function extractUnbuiltClipSegmentToPath(
	params: ExtractUnbuiltClipSegmentParams,
): Promise<void> {
	const { clipId, clipStartTime, clipEndTime, outputPath, videoSrc, rawVideoParentProjectId } = params;

	const clip = await getClip(clipId);
	if (!clip) {
		throw new Error(`Clip not found: ${clipId}`);
	}
	if (!clip.project_id) {
		throw new Error("Clip has no project_id; cannot resolve source VOD");
	}

	const clipDuration = clipEndTime - clipStartTime;
	if (clipDuration <= 0) {
		throw new Error("Clip has no valid time range for extraction");
	}

	const rawVideos = await loadRawVideosForClipProject(clip.project_id, rawVideoParentProjectId ?? null);
	const vodPath = resolveVodPathForClipExtraction(clip, rawVideos, videoSrc);

	console.log("[clip-vod-extract] Extracting clip segment from VOD:", {
		vodPath,
		startTime: clipStartTime,
		endTime: clipEndTime,
		duration: clipDuration,
		outputPath,
		clipId,
	});

	await invoke("extract_clip", {
		sourcePath: vodPath,
		outputPath,
		startTime: clipStartTime,
		endTime: clipEndTime,
	});
}
