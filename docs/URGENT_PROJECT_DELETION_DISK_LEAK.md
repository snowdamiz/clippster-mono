# 🚨 URGENT: Project Deletion Has a Disk Space Leak Bug

## Summary

When a user deletes a project, **raw video files are never actually deleted from disk**. This is a silent bug — the UI shows success, but the files remain, filling up disk space indefinitely.

---

## Root Cause

The ordering in `deleteProjectWithFiles` (`client/src/pages/Projects.vue` ~line 4398) is wrong:

```
1. deleteProjectWithRetention(projectId)
   → UPDATE raw_videos SET project_id = NULL   ← nulls out project_id FIRST
   → DELETE FROM projects

2. getRawVideosByProjectId(projectId)
   → SELECT * FROM raw_videos WHERE project_id = ?
   → Returns [] because project_id is already NULL  ← BUG

3. Loop over videos → never executes → files stay on disk forever
```

The comment in `deleteProjectWithRetention` (`client/src/services/database/projects.ts` line 276) even acknowledges it:
> *"they will be deleted separately by the caller"*

But the caller queries by `project_id` which has already been nulled out before the query runs.

---

## What Is NOT Deleted (Should Be)

| Item | Status |
|---|---|
| Raw video file on disk | ❌ Never deleted |
| Video thumbnail on disk | ❌ Never deleted |
| Waveform/audio cache on disk | ❌ Never deleted |
| `raw_videos` DB row | ❌ Orphaned forever (only `project_id` set to NULL) |
| `transcripts` DB row | ❌ Orphaned forever (joined through raw_videos) |
| `transcript_segments` DB rows | ❌ Orphaned forever |

## What IS Deleted Correctly

| Item | Status |
|---|---|
| Proxy files | ✅ Deleted (uses `source_id` pattern, not `project_id`) |
| Livestream HLS directories | ✅ Deleted |
| Unbuilt clip DB records | ✅ Deleted |
| `clip_versions`, `clip_segments`, `clip_edits` for unbuilt clips | ✅ Deleted |
| `clip_detection_sessions` | ✅ Deleted (CASCADE) |

---

## What Is Safe (Built Clips & Transcript Search)

**Built clips are completely safe.** Their transcript data lives in `clip_segments.transcript` — copied into the clip at detection time, independent of `raw_videos`. The built clips search page uses `searchTranscriptSegmentsByClipIds` which queries `clip_versions JOIN clip_segments` by `clip_id` only — no join to `raw_videos` or `transcripts`. Works fine after project deletion.

In-editor clips are also preserved correctly.

---

## The Fix

### 1. Fetch raw videos BEFORE calling `deleteProjectWithRetention`

In `client/src/pages/Projects.vue`, `deleteProjectWithFiles()`:

```typescript
async function deleteProjectWithFiles(projectId: string): Promise<void> {
  const inEditorClipIds = new Set(inEditorStore.entries.map((e) => e.clipId));

  // ✅ Fetch BEFORE deleteProjectWithRetention nulls project_id
  const videos = await getRawVideosByProjectId(projectId);

  const { deletedClipIds, retainedClipIds } = await deleteProjectWithRetention(projectId, inEditorClipIds);

  // ... rest of function uses `videos` already fetched above
```

### 2. Delete raw_video DB rows after fetching them

In `client/src/services/database/projects.ts`, `deleteProjectWithRetention()`, replace:
```typescript
await db.execute('UPDATE raw_videos SET project_id = NULL WHERE project_id = ?', [projectId]);
```
With:
```typescript
await db.execute('DELETE FROM raw_videos WHERE project_id = ?', [projectId]);
```

This also cascades to clean up `transcripts` and `transcript_segments` if foreign keys are set up, or those need explicit deletes too.

### 3. Verify transcript cleanup

Check if `transcripts` has a FK to `raw_videos` with CASCADE. If not, add explicit:
```typescript
// In deleteProjectWithRetention, before deleting raw_videos:
await db.execute(
  `DELETE FROM transcript_segments WHERE transcript_id IN (
    SELECT t.id FROM transcripts t
    JOIN raw_videos rv ON t.raw_video_id = rv.id
    WHERE rv.project_id = ?
  )`, [projectId]
);
await db.execute(
  `DELETE FROM transcripts WHERE raw_video_id IN (
    SELECT id FROM raw_videos WHERE project_id = ?
  )`, [projectId]
);
await db.execute('DELETE FROM raw_videos WHERE project_id = ?', [projectId]);
```

---

## Files to Modify

- `client/src/pages/Projects.vue` — `deleteProjectWithFiles()` ~line 4398: move `getRawVideosByProjectId` call to before `deleteProjectWithRetention`
- `client/src/services/database/projects.ts` — `deleteProjectWithRetention()` ~line 278: change UPDATE to DELETE for raw_videos, add transcript cleanup

---

## Risk Assessment

- **Low risk** — built clips and their transcripts are completely independent of raw_videos
- **No UI changes needed** — purely backend/database logic
- **Test**: Delete a project, verify raw video file is gone from disk, verify built clips still searchable
