import { invoke } from "@tauri-apps/api/core";
import { getVideoEditorSourcesByProjectId } from "@/services/database/video-editor-projects";
import { createClipBuild, updateClipBuild } from "@/services/database/clip-build";
import { updateClip } from "@/services/database/clips";

export type EditorExportBuildOptions = {
	aspectLabel: string;
	quality: string;
	frameRate: number;
	format: string;
	isForCampaign: boolean;
	campaign: { id: string; title: string; organization?: { id: string; name: string } } | null;
};

export type RegisterEditorExportBuildParams = {
	outputPath: string;
	/** Timeline export duration (seconds). */
	exportedDuration: number;
	projectId: string;
	projectName: string;
	buildOptions?: EditorExportBuildOptions | null;
};

export type RegisterEditorExportBuildResult =
	| { mode: "clip_build"; clipId: string; buildId: string }
	| { mode: "standalone_clip"; clipId: string };

/**
 * Single registration path for editor exports: either a `clip_build` on the source clip
 * (when the project is opened from a clip) or a standalone `clips` row.
 */
export async function registerEditorExportBuild(
	params: RegisterEditorExportBuildParams,
): Promise<RegisterEditorExportBuildResult | null> {
	const { outputPath, exportedDuration, projectId, projectName, buildOptions } = params;

	const sources = await getVideoEditorSourcesByProjectId(projectId);
	const clipSource = sources.find((s) => s.source_type === "clip" && s.source_id);

	if (clipSource?.source_id && buildOptions) {
		let fileSize = 0;
		let duration = exportedDuration;
		try {
			const meta = await invoke<{ duration: number }>("get_video_metadata", { videoPath: outputPath });
			if (meta.duration > 0.05) {
				duration = meta.duration;
			}
		} catch (err) {
			console.warn("[registerEditorExportBuild] get_video_metadata:", err);
		}
		try {
			const info = await invoke<{ size: number }>("get_file_info", { path: outputPath });
			fileSize = info.size;
		} catch (err) {
			console.warn("[registerEditorExportBuild] get_file_info:", err);
		}

		const buildId = await createClipBuild(clipSource.source_id, {
			aspectRatios: [buildOptions.aspectLabel],
			quality: buildOptions.quality,
			frameRate: buildOptions.frameRate,
			outputFormat: buildOptions.format,
			includeSubtitles: false,
			organizationId:
				buildOptions.isForCampaign && buildOptions.campaign?.organization?.id != null
					? Number(buildOptions.campaign.organization.id)
					: null,
			organizationName:
				buildOptions.isForCampaign && buildOptions.campaign?.organization?.name
					? buildOptions.campaign.organization.name
					: null,
			campaignId:
				buildOptions.isForCampaign && buildOptions.campaign?.id != null
					? Number(buildOptions.campaign.id)
					: null,
			campaignName: buildOptions.isForCampaign && buildOptions.campaign ? buildOptions.campaign.title : null,
			brandingProfileId: null,
			brandingType: buildOptions.isForCampaign ? "campaign" : "personal",
		});

		await updateClipBuild(buildId, {
			status: "completed",
			filePath: outputPath,
			outputPaths: [outputPath],
			fileSize,
			duration,
			progress: 100,
		});

		if (buildOptions.isForCampaign && buildOptions.campaign) {
			try {
				await updateClip(clipSource.source_id, { campaign_id: Number(buildOptions.campaign.id) });
			} catch (err) {
				console.warn("[registerEditorExportBuild] Failed to save campaign_id:", err);
			}
		}

		return { mode: "clip_build", clipId: clipSource.source_id, buildId };
	}

	// Standalone clip row (no editor source clip)
	try {
		const { getDatabase, generateId, timestamp, getCurrentUserId } = await import("@/services/database/core");

		const db = await getDatabase();

		await db.execute(
			`UPDATE clips
				 SET project_name = COALESCE(project_name, name), project_id = NULL
				 WHERE source = 'video_editor' AND project_id IS NOT NULL`,
		);

		let clipDuration = exportedDuration;
		try {
			const meta = await invoke<{ duration: number; width: number; height: number }>("get_video_metadata", {
				videoPath: outputPath,
			});
			if (meta.duration > 0.05) {
				clipDuration = meta.duration;
			}
		} catch (err) {
			console.warn("[registerEditorExportBuild] Failed to probe exported file duration:", err);
		}

		const thumbnailTimestamp = Math.min(1.0, Math.max(0.05, clipDuration / 2));
		let thumbnailPath: string | null = null;

		try {
			thumbnailPath = await invoke<string>("generate_thumbnail_at_timestamp", {
				videoPath: outputPath,
				timestampSeconds: thumbnailTimestamp,
			});
		} catch (err) {
			console.warn("[registerEditorExportBuild] Failed to generate thumbnail:", err);
		}

		let fileSize: number | null = null;
		try {
			const info = await invoke<{ size: number }>("get_file_info", { path: outputPath });
			fileSize = info.size;
		} catch (err) {
			console.warn("[registerEditorExportBuild] Failed to get file size:", err);
		}

		const clipId = generateId();
		const now = timestamp();
		const userId = getCurrentUserId();

		await db.execute(
			`INSERT INTO clips (
					id, project_id, project_name, name, file_path, duration, start_time, end_time,
					status, build_status, built_file_path, built_thumbnail_path,
					built_duration, built_file_size, built_at, created_at, updated_at, user_id, source
				) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				clipId,
				null,
				projectName,
				projectName,
				outputPath,
				clipDuration,
				0,
				clipDuration,
				"generated",
				"completed",
				outputPath,
				thumbnailPath,
				clipDuration,
				fileSize,
				now,
				now,
				now,
				userId,
				"video_editor",
			],
		);

		return { mode: "standalone_clip", clipId };
	} catch (err) {
		console.error("[registerEditorExportBuild] Failed to create standalone clip:", err);
		return null;
	}
}
