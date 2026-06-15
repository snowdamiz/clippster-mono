/**
 * Resolve full-length source videos for a library project (downloads, VODs, segments).
 */

import {
	getRawVideosByProjectId,
	getRawVideosByOriginalProjectId,
} from '@/services/database/raw-videos';
import type { RawVideo } from '@/services/database/types';
import { isPlausibleVodSourcePath } from '@/services/clip-vod-extract';

function filterPlausibleVodRawVideos(rows: RawVideo[]): RawVideo[] {
	return rows.filter((rv) => rv.file_path && isPlausibleVodSourcePath(rv.file_path));
}

/**
 * Find raw VOD files for a project. Prefers direct project rows, then parent project,
 * then segment rows linked via original_project_id.
 */
export async function resolveRawVideosForProject(
	projectId: string,
	parentProjectId?: string | null,
): Promise<RawVideo[]> {
	const direct = filterPlausibleVodRawVideos(await getRawVideosByProjectId(projectId));
	if (direct.length > 0) return direct;

	if (parentProjectId && parentProjectId !== projectId) {
		const parentRows = filterPlausibleVodRawVideos(await getRawVideosByProjectId(parentProjectId));
		if (parentRows.length > 0) return parentRows;
	}

	const segments = filterPlausibleVodRawVideos(
		await getRawVideosByOriginalProjectId(projectId),
	);
	if (segments.length > 0) {
		return [...segments].sort((a, b) => {
			const segA = a.segment_number ?? 0;
			const segB = b.segment_number ?? 0;
			if (segA !== segB) return segA - segB;
			return (a.created_at ?? 0) - (b.created_at ?? 0);
		});
	}

	return [];
}

/** Pick the best single full-length source when importing one asset. */
export function pickPrimaryRawVideo(rawVideos: RawVideo[]): RawVideo | null {
	if (rawVideos.length === 0) return null;

	const nonSegment = rawVideos.find((rv) => !rv.is_segment);
	if (nonSegment) return nonSegment;

	return [...rawVideos].sort((a, b) => (b.duration ?? 0) - (a.duration ?? 0))[0] ?? null;
}
