/**
 * Desktop snapshot build/merge — aligned with @clippster/cloud-sync-schema v1.
 */
import type { CloudProjectSnapshot } from '@clippster/cloud-sync-schema';
import { getDatabase, timestamp, generateId } from './core';
import { getProject } from './projects';
import { getClipsByProjectId } from './clips';
import { getRawVideosByProjectId } from './raw-videos';

export async function buildProjectSnapshot(projectId: string): Promise<CloudProjectSnapshot | null> {
  const project = await getProject(projectId);
  if (!project) return null;

  const db = await getDatabase();
  const rawVideos = await getRawVideosByProjectId(projectId);
  const raw = rawVideos[0] ?? null;
  const clips = await getClipsByProjectId(projectId);

  const clipSnapshots = [];

  for (const clip of clips) {
    const versions = await db.select<any[]>(
      'SELECT * FROM clip_versions WHERE clip_id = ? ORDER BY version_number ASC',
      [clip.id],
    );

    const versionSnapshots = [];

    for (const version of versions) {
      const segments = await db.select<any[]>(
        'SELECT * FROM clip_segments WHERE clip_version_id = ? ORDER BY segment_index ASC',
        [version.id],
      );
      versionSnapshots.push({ ...version, segments });
    }

    clipSnapshots.push({
      id: clip.id,
      project_id: clip.project_id ?? projectId,
      name: clip.name ?? null,
      duration: clip.duration ?? null,
      start_time: clip.start_time ?? null,
      end_time: clip.end_time ?? null,
      order_index: clip.order_index ?? null,
      current_version_id: clip.current_version_id ?? null,
      detection_session_id: clip.detection_session_id ?? null,
      subtitle_enabled: clip.subtitle_enabled ?? null,
      subtitle_preset_id: clip.subtitle_preset_id ?? null,
      subtitle_settings: clip.subtitle_settings ?? null,
      clip_text_overlay: clip.clip_text_overlay ?? null,
      created_at: clip.created_at,
      updated_at: clip.updated_at,
      versions: versionSnapshots,
    });
  }

  let transcripts: CloudProjectSnapshot['transcripts'] = [];
  if (raw) {
    const rows = await db.select<any[]>(
      'SELECT * FROM transcripts WHERE raw_video_id = ? LIMIT 1',
      [raw.id],
    );
    transcripts = rows.map((t) => ({
      id: t.id,
      raw_video_id: t.raw_video_id,
      raw_json: t.raw_json,
      text: t.text,
      language: t.language ?? null,
      duration: t.duration ?? null,
      created_at: t.created_at,
      updated_at: t.updated_at,
    }));
  }

  const clipBuilds: CloudProjectSnapshot['clip_builds'] = [];
  for (const clip of clips) {
    const builds = await db.select<any[]>('SELECT * FROM clip_builds WHERE clip_id = ?', [clip.id]);
    for (const build of builds) {
      clipBuilds.push({
        id: build.id,
        clip_id: build.clip_id,
        aspect_ratio: build.aspect_ratios ?? null,
        quality: build.quality ?? null,
        frame_rate: build.frame_rate ?? null,
        output_format: build.output_format ?? null,
        include_subtitles: build.include_subtitles ?? null,
        file_path: build.file_path,
        thumbnail_path: build.thumbnail_path ?? null,
        file_size: build.file_size ?? null,
        duration: build.duration ?? null,
        build_number: build.build_number ?? 1,
        status: build.status ?? 'completed',
        error_message: build.error_message ?? null,
        cloud_media_asset_id: null,
        created_at: build.created_at,
        completed_at: build.completed_at ?? null,
      });
    }
  }

  return {
    schema_version: 1,
    project: {
      id: project.id,
      name: project.name,
      description: project.description ?? null,
      platform: project.platform ?? raw?.platform ?? null,
      active_vod_preset_id: project.active_vod_preset_id ?? null,
      active_vod_preset_config: project.active_vod_preset_config ?? null,
      thumbnail_path: project.thumbnail_path ?? null,
      updated_at: project.updated_at,
    },
    raw_videos: raw
      ? [
          {
            id: raw.id,
            title: raw.original_filename ?? raw.filename ?? 'raw-video',
            duration: raw.duration ?? null,
            platform: raw.platform ?? null,
            source_url: raw.source_url ?? null,
            cloud_media_asset_id: null,
            local_file_hash: null,
            original_filename: raw.original_filename ?? null,
            thumbnail_path: raw.thumbnail_path ?? null,
            width: raw.width ?? null,
            height: raw.height ?? null,
            codec: raw.codec ?? null,
            file_size: raw.file_size ?? null,
          },
        ]
      : [],
    clips: clipSnapshots,
    transcripts,
    clip_builds: clipBuilds,
  };
}

export async function mergeSnapshotIntoDatabase(snapshot: CloudProjectSnapshot): Promise<void> {
  const db = await getDatabase();
  const projectId = snapshot.project.id;
  const now = timestamp();
  const existingRawList = await getRawVideosByProjectId(projectId);
  const existingRaw = existingRawList[0] ?? null;

  await db.execute(
    `INSERT INTO projects (id, name, description, thumbnail_path, parent_id, platform, created_at, updated_at)
     VALUES (?, ?, ?, ?, NULL, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       name = excluded.name,
       description = excluded.description,
       thumbnail_path = excluded.thumbnail_path,
       platform = excluded.platform,
       updated_at = excluded.updated_at`,
    [
      projectId,
      snapshot.project.name,
      snapshot.project.description,
      snapshot.project.thumbnail_path,
      snapshot.project.platform,
      now,
      snapshot.project.updated_at,
    ],
  );

  const rawSnapshot = snapshot.raw_videos[0];
  if (rawSnapshot) {
    const filePath = existingRaw?.file_path ?? `pending://${rawSnapshot.id}`;
    await db.execute(
      `INSERT INTO raw_videos (id, project_id, file_path, original_filename, duration, platform, source_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
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
        rawSnapshot.duration,
        rawSnapshot.platform,
        rawSnapshot.source_url,
        now,
        now,
      ],
    );
  }

  await db.execute('DELETE FROM clips WHERE project_id = ?', [projectId]);

  for (const clip of snapshot.clips) {
    const videoPath = existingRaw?.file_path ?? `clip://${clip.id}`;
    await db.execute(
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
      await db.execute(
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
        await db.execute(
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
    await db.execute(
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
}

export async function duplicateProjectFromSnapshot(snapshot: CloudProjectSnapshot): Promise<string> {
  const newId = generateId();
  const now = timestamp();
  const idMap = new Map<string, string>();
  const mapId = (old: string) => {
    if (!idMap.has(old)) idMap.set(old, generateId());
    return idMap.get(old)!;
  };

  const cloned: CloudProjectSnapshot = {
    ...snapshot,
    project: { ...snapshot.project, id: newId, name: `${snapshot.project.name} (copy)`, updated_at: now },
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
