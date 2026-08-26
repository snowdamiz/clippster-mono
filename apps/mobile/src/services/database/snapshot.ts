import type {
  ClipBuildSnapshot,
  ClipSnapshot,
  CloudProjectSnapshot,
  ClipSegmentSnapshot,
  ClipVersionSnapshot,
  RawVideoSnapshot,
  TranscriptSnapshot,
} from '@clippster/cloud-sync-schema';
import type { ClipVersion } from '@clippster/shared-types';
import {
  generateId,
  getDatabase,
  getProject,
  timestamp,
} from './index';
import {
  getClipsByProjectId,
  getRawVideoByProjectId,
  getTranscriptByProjectId,
} from './workspace';
import { getClipBuildsByClipId } from './clips';
import { getCloudSyncMeta } from './cloud-sync-meta';

export async function buildProjectSnapshot(projectId: string): Promise<CloudProjectSnapshot | null> {
  const project = await getProject(projectId);
  if (!project) return null;

  const db = getDatabase();
  const rawVideo = await getRawVideoByProjectId(projectId);
  const transcript = await getTranscriptByProjectId(projectId);
  const clips = await getClipsByProjectId(projectId);
  const syncMeta = await getCloudSyncMeta(projectId);

  const rawVideos: RawVideoSnapshot[] = rawVideo
    ? [
        {
          id: rawVideo.id,
          title: rawVideo.original_filename ?? 'raw-video',
          duration: rawVideo.duration,
          platform: rawVideo.platform ?? null,
          source_url: rawVideo.source_url ?? null,
          cloud_media_asset_id: syncMeta?.cloud_media_asset_id ?? null,
          local_file_hash: null,
          original_filename: rawVideo.original_filename ?? null,
          thumbnail_path: rawVideo.thumbnail_path ?? null,
          width: rawVideo.width,
          height: rawVideo.height,
          codec: rawVideo.codec,
          file_size: rawVideo.file_size,
        },
      ]
    : [];

  const clipSnapshots: ClipSnapshot[] = [];

  for (const clip of clips) {
    const versions = await db.getAllAsync<ClipVersion>(
      'SELECT * FROM clip_versions WHERE clip_id = ? ORDER BY version_number ASC',
      [clip.id],
    );

    const versionSnapshots: ClipVersionSnapshot[] = [];

    for (const version of versions) {
      const segments = await db.getAllAsync<ClipSegmentSnapshot>(
        `SELECT id, clip_version_id, segment_index, start_time, end_time, duration, transcript, created_at
         FROM clip_segments WHERE clip_version_id = ? ORDER BY segment_index ASC`,
        [version.id],
      );

      versionSnapshots.push({
        ...version,
        segments,
      });
    }

    clipSnapshots.push({
      id: clip.id,
      project_id: clip.project_id ?? projectId,
      name: clip.name,
      duration: clip.duration,
      start_time: clip.start_time,
      end_time: clip.end_time,
      order_index: null,
      current_version_id: clip.current_version_id,
      detection_session_id: clip.detection_session_id,
      subtitle_enabled: clip.subtitle_enabled ?? null,
      subtitle_preset_id: clip.subtitle_preset_id ?? null,
      subtitle_settings: clip.subtitle_settings ?? null,
      clip_text_overlay: clip.clip_text_overlay ?? null,
      created_at: clip.created_at,
      updated_at: clip.updated_at,
      versions: versionSnapshots,
    });
  }

  const transcripts: TranscriptSnapshot[] = transcript
    ? [
        {
          id: transcript.id,
          raw_video_id: transcript.raw_video_id,
          raw_json: transcript.raw_json ?? '',
          text: transcript.text ?? '',
          language: transcript.language ?? null,
          duration: transcript.duration ?? null,
          created_at: transcript.created_at,
          updated_at: transcript.updated_at,
        },
      ]
    : [];

  const clipBuilds: ClipBuildSnapshot[] = [];

  for (const clip of clips) {
    const builds = await getClipBuildsByClipId(clip.id);
    for (const build of builds) {
      clipBuilds.push({
        id: build.id,
        clip_id: build.clip_id,
        aspect_ratio: build.aspect_ratios,
        quality: build.quality,
        frame_rate: build.frame_rate,
        output_format: build.output_format,
        include_subtitles: build.include_subtitles,
        file_path: build.file_path,
        thumbnail_path: build.thumbnail_path,
        file_size: build.file_size,
        duration: build.duration,
        build_number: build.build_number,
        status: build.status,
        error_message: build.error_message,
        cloud_media_asset_id: null,
        created_at: build.created_at,
        completed_at: build.completed_at,
      });
    }
  }

  let presetConfig: string | Record<string, unknown> | null = null;
  if (project.active_vod_preset_config) {
    try {
      presetConfig = JSON.parse(project.active_vod_preset_config);
    } catch {
      presetConfig = project.active_vod_preset_config;
    }
  }

  return {
    schema_version: 1,
    project: {
      id: project.id,
      name: project.name,
      description: project.description,
      platform: rawVideo?.platform ?? null,
      active_vod_preset_id: project.active_vod_preset_id ?? null,
      active_vod_preset_config: presetConfig,
      thumbnail_path: project.thumbnail_path,
      updated_at: project.updated_at,
    },
    raw_videos: rawVideos,
    clips: clipSnapshots,
    transcripts,
    clip_builds: clipBuilds,
  };
}

export async function mergeSnapshotIntoDatabase(snapshot: CloudProjectSnapshot): Promise<void> {
  const db = getDatabase();
  const projectId = snapshot.project.id;
  const existingRaw = await getRawVideoByProjectId(projectId);
  const now = timestamp();

  await db.execAsync('BEGIN');

  try {
    await db.runAsync(
      `INSERT INTO projects (
        id, name, description, thumbnail_path, parent_id,
        active_vod_preset_id, active_vod_preset_config, created_at, updated_at
      ) VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        description = excluded.description,
        thumbnail_path = excluded.thumbnail_path,
        active_vod_preset_id = excluded.active_vod_preset_id,
        active_vod_preset_config = excluded.active_vod_preset_config,
        updated_at = excluded.updated_at`,
      [
        projectId,
        snapshot.project.name,
        snapshot.project.description,
        snapshot.project.thumbnail_path,
        snapshot.project.active_vod_preset_id,
        typeof snapshot.project.active_vod_preset_config === 'string'
          ? snapshot.project.active_vod_preset_config
          : snapshot.project.active_vod_preset_config
            ? JSON.stringify(snapshot.project.active_vod_preset_config)
            : null,
        now,
        snapshot.project.updated_at,
      ],
    );

    const rawSnapshot = snapshot.raw_videos[0];
    if (rawSnapshot) {
      const filePath = existingRaw?.file_path ?? `pending://${rawSnapshot.id}`;
      await db.runAsync(
        `INSERT INTO raw_videos (
          id, project_id, file_path, original_filename, thumbnail_path,
          duration, width, height, frame_rate, codec, file_size, platform, source_url,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(project_id) DO UPDATE SET
          original_filename = excluded.original_filename,
          duration = excluded.duration,
          platform = excluded.platform,
          source_url = excluded.source_url,
          updated_at = excluded.updated_at`,
        [
          rawSnapshot.id,
          projectId,
          filePath,
          rawSnapshot.original_filename ?? rawSnapshot.title,
          rawSnapshot.thumbnail_path,
          rawSnapshot.duration,
          rawSnapshot.width,
          rawSnapshot.height,
          rawSnapshot.codec,
          rawSnapshot.file_size,
          rawSnapshot.platform,
          rawSnapshot.source_url,
          now,
          now,
        ],
      );

      if (rawSnapshot.cloud_media_asset_id) {
        await db.runAsync(
          `INSERT INTO cloud_sync_meta (project_id, sync_status, cloud_media_asset_id, store_vod_in_cloud, last_synced_at, cloud_updated_at)
           VALUES (?, 'synced', ?, 1, ?, ?)
           ON CONFLICT(project_id) DO UPDATE SET
             cloud_media_asset_id = excluded.cloud_media_asset_id,
             store_vod_in_cloud = 1`,
          [projectId, rawSnapshot.cloud_media_asset_id, now, snapshot.project.updated_at],
        );
      }
    }

    await db.runAsync('DELETE FROM clips WHERE project_id = ?', [projectId]);

    for (const clip of snapshot.clips) {
      const videoPath = existingRaw?.file_path ?? `clip://${clip.id}`;

      await db.runAsync(
        `INSERT INTO clips (
          id, project_id, name, file_path, duration, start_time, end_time,
          order_index, current_version_id, detection_session_id,
          subtitle_enabled, subtitle_preset_id, subtitle_settings, clip_text_overlay,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          clip.id,
          projectId,
          clip.name,
          videoPath,
          clip.duration,
          clip.start_time,
          clip.end_time,
          clip.order_index,
          clip.current_version_id,
          clip.detection_session_id,
          clip.subtitle_enabled,
          clip.subtitle_preset_id,
          clip.subtitle_settings,
          clip.clip_text_overlay,
          clip.created_at,
          clip.updated_at,
        ],
      );

      for (const version of clip.versions) {
        await db.runAsync(
          `INSERT INTO clip_versions (
            id, clip_id, session_id, version_number, parent_version_id, name, description,
            start_time, end_time, confidence_score, virality_score, relevance_score,
            detection_reason, tags, change_type, change_description, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            version.id,
            version.clip_id,
            version.session_id,
            version.version_number,
            version.parent_version_id,
            version.name,
            version.description,
            version.start_time,
            version.end_time,
            version.confidence_score,
            version.virality_score,
            version.relevance_score,
            version.detection_reason,
            version.tags,
            version.change_type,
            version.change_description,
            version.created_at,
          ],
        );

        for (const segment of version.segments) {
          await db.runAsync(
            `INSERT INTO clip_segments (
              id, clip_version_id, segment_index, start_time, end_time, duration, transcript, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [
              segment.id,
              segment.clip_version_id,
              segment.segment_index,
              segment.start_time,
              segment.end_time,
              segment.duration,
              segment.transcript,
              segment.created_at,
            ],
          );
        }
      }
    }

    for (const transcript of snapshot.transcripts) {
      await db.runAsync(
        `INSERT INTO transcripts (id, raw_video_id, raw_json, text, language, duration, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(raw_video_id) DO UPDATE SET
           raw_json = excluded.raw_json,
           text = excluded.text,
           language = excluded.language,
           duration = excluded.duration,
           updated_at = excluded.updated_at`,
        [
          transcript.id,
          transcript.raw_video_id,
          transcript.raw_json,
          transcript.text,
          transcript.language,
          transcript.duration,
          transcript.created_at,
          transcript.updated_at,
        ],
      );
    }

    for (const build of snapshot.clip_builds) {
      await db.runAsync(
        `INSERT OR REPLACE INTO clip_builds (
          id, clip_id, aspect_ratios, quality, frame_rate, output_format, include_subtitles,
          file_path, thumbnail_path, file_size, duration, build_number, status, error_message,
          progress, started_at, completed_at, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1.0, ?, ?, ?)`,
        [
          build.id,
          build.clip_id,
          build.aspect_ratio,
          build.quality,
          build.frame_rate,
          build.output_format,
          build.include_subtitles,
          build.file_path,
          build.thumbnail_path,
          build.file_size,
          build.duration,
          build.build_number,
          build.status,
          build.error_message,
          build.created_at,
          build.completed_at,
          build.created_at,
        ],
      );
    }

    await db.execAsync('COMMIT');
  } catch (error) {
    await db.execAsync('ROLLBACK');
    throw error;
  }
}

export async function duplicateProjectFromSnapshot(
  snapshot: CloudProjectSnapshot,
): Promise<string> {
  const newId = generateId();
  const now = timestamp();
  const idMap = new Map<string, string>();
  const mapId = (old: string) => {
    if (!idMap.has(old)) idMap.set(old, generateId());
    return idMap.get(old)!;
  };

  const cloned: CloudProjectSnapshot = {
    ...snapshot,
    project: {
      ...snapshot.project,
      id: newId,
      name: `${snapshot.project.name} (copy)`,
      updated_at: now,
    },
    raw_videos: snapshot.raw_videos.map((rv) => ({ ...rv, id: mapId(rv.id) })),
    clips: snapshot.clips.map((clip) => {
      const newClipId = mapId(clip.id);
      return {
        ...clip,
        id: newClipId,
        project_id: newId,
        current_version_id: clip.current_version_id ? mapId(clip.current_version_id) : null,
        detection_session_id: clip.detection_session_id ? mapId(clip.detection_session_id) : null,
        versions: clip.versions.map((v) => {
          const newVersionId = mapId(v.id);
          return {
            ...v,
            id: newVersionId,
            clip_id: newClipId,
            session_id: v.session_id ? mapId(v.session_id) : v.session_id,
            segments: v.segments.map((s) => ({
              ...s,
              id: mapId(s.id),
              clip_version_id: newVersionId,
            })),
          };
        }),
      };
    }),
    transcripts: snapshot.transcripts.map((t) => ({
      ...t,
      id: mapId(t.id),
      raw_video_id: mapId(t.raw_video_id),
    })),
    clip_builds: snapshot.clip_builds.map((b) => ({
      ...b,
      id: mapId(b.id),
      clip_id: mapId(b.clip_id),
    })),
  };

  await mergeSnapshotIntoDatabase(cloned);
  return newId;
}
