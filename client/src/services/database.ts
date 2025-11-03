import Database from '@tauri-apps/plugin-sql'
import { invoke } from '@tauri-apps/api/core'
import { getCurrentWindow } from '@tauri-apps/api/window'

let db: Database | null = null
let initializing: Promise<Database> | null = null

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function waitForRuntimeReady(timeoutMs = 7000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      // Any simple invoke ensures the runtime is ready for this window
      await invoke<string>('greet', { name: 'db-init' })
      return
    } catch {
      // Not ready yet
    }
    await sleep(100)
  }
  throw new Error('Tauri runtime not ready')
}

// Initialize database connection
export async function initDatabase() {
  if (db) return db
  if (initializing) return initializing

  initializing = (async () => {
    try {
      await waitForRuntimeReady()
      const label = getCurrentWindow().label
      console.debug('[Frontend] Tauri window label:', label)

      const instance = await Database.load('sqlite:clippster_v21.db')

      db = instance
      return instance
    } catch (error) {
      console.error('[Frontend] Database load error:', error)
      console.error('[Frontend] Error details:', JSON.stringify(error, null, 2))

      // For now, just rethrow the error so we can see what's happening
      throw error
    } finally {
      initializing = null
    }
  })()

  return initializing
}

// Get database instance
export async function getDatabase() {
  return await initDatabase()
}

// Types
export interface Project {
  id: string
  name: string
  description: string | null
  thumbnail_path: string | null
  created_at: number
  updated_at: number
}

export interface Prompt {
  id: string
  name: string
  content: string
  created_at: number
  updated_at: number
}

export interface Transcript {
  id: string
  raw_video_id: string
  raw_json: string
  text: string
  language: string | null
  duration: number | null
  created_at: number
  updated_at: number
}

export interface TranscriptSegment {
  id: string
  transcript_id: string
  clip_id: string | null
  start_time: number
  end_time: number
  text: string
  segment_index: number
  created_at: number
}

export interface IntroOutro {
  id: string
  type: 'intro' | 'outro'
  name: string
  file_path: string
  duration: number | null
  created_at: number
  updated_at: number
}

export interface Clip {
  id: string
  project_id: string
  name: string | null
  file_path: string
  duration: number | null
  start_time: number | null
  end_time: number | null
  order_index: number | null
  intro_id: string | null
  outro_id: string | null
  status: 'detected' | 'generated' | 'processing' | null
  created_at: number
  updated_at: number
}

export interface Thumbnail {
  id: string
  clip_id: string
  file_path: string
  width: number | null
  height: number | null
  created_at: number
}

export interface RawVideo {
  id: string
  project_id: string | null
  file_path: string
  original_filename: string | null
  thumbnail_path: string | null
  duration: number | null
  width: number | null
  height: number | null
  frame_rate: number | null
  codec: string | null
  file_size: number | null
  original_project_id: string | null
  created_at: number
  updated_at: number
}

export interface ClipDetectionSession {
  id: string
  project_id: string
  prompt: string
  detection_model: string
  server_response_id: string | null
  quality_score: number | null
  total_clips_detected: number
  processing_time_ms: number | null
  validation_data: string | null
  run_color: string
  created_at: number
}

export interface ClipVersion {
  id: string
  clip_id: string
  session_id: string
  version_number: number
  parent_version_id: string | null
  name: string
  description: string | null
  start_time: number
  end_time: number
  confidence_score: number | null
  relevance_score: number | null
  detection_reason: string | null
  tags: string | null
  change_type: 'detected' | 'modified' | 'deleted'
  change_description: string | null
  created_at: number
}

export interface ClipSegment {
  id: string
  clip_version_id: string
  segment_index: number
  start_time: number
  end_time: number
  duration: number
  transcript: string | null
  created_at: number
}

export interface ClipWithVersion extends Clip {
  current_version_id: string | null
  detection_session_id: string | null
  session_created_at?: number
  session_run_color?: string
  run_number?: number
  // Additional fields from JOIN
  current_version_name?: string
  current_version_description?: string
  current_version_start_time?: number
  current_version_end_time?: number
  current_version_confidence_score?: number
  current_version_relevance_score?: number
  current_version_detection_reason?: string
  current_version_tags?: string
  current_version_change_type?: string
  current_version_created_at?: number
  current_version?: ClipVersion
  current_version_segments?: ClipSegment[]
}

// Helper to generate timestamps
export function timestamp(): number {
  return Math.floor(Date.now() / 1000)
}

// Helper to generate UUIDs (simple version)
export function generateId(): string {
  return crypto.randomUUID()
}

// Manual migration fallback function
export async function ensureClipVersioningTables(): Promise<void> {
  const db = await getDatabase()

  try {
    // Check if tables exist
    const sessionResult = await db.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='clip_detection_sessions'"
    )

    if (sessionResult.length === 0) {
      await db.execute(`
        CREATE TABLE clip_detection_sessions (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          prompt TEXT NOT NULL,
          detection_model TEXT NOT NULL DEFAULT 'claude-3.5-sonnet',
          server_response_id TEXT,
          quality_score REAL,
          total_clips_detected INTEGER DEFAULT 0,
          processing_time_ms INTEGER,
          validation_data TEXT,
          run_color TEXT NOT NULL DEFAULT '#8B5CF6',
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `)
    } else {
      // Add run_color column if it doesn't exist (for existing tables)
      const pragmaResult = await db.select<{ name: string }[]>("PRAGMA table_info(clip_detection_sessions)")
      const hasRunColorColumn = pragmaResult.some(column => column.name === 'run_color')

      if (!hasRunColorColumn) {
        await db.execute("ALTER TABLE clip_detection_sessions ADD COLUMN run_color TEXT NOT NULL DEFAULT '#8B5CF6'")
      }
    }

    const versionResult = await db.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='clip_versions'"
    )

    if (versionResult.length === 0) {
      await db.execute(`
        CREATE TABLE clip_versions (
          id TEXT PRIMARY KEY,
          clip_id TEXT NOT NULL,
          session_id TEXT NOT NULL,
          version_number INTEGER NOT NULL,
          parent_version_id TEXT,
          name TEXT NOT NULL,
          description TEXT,
          start_time REAL NOT NULL,
          end_time REAL NOT NULL,
          confidence_score REAL,
          relevance_score REAL,
          detection_reason TEXT,
          tags TEXT,
          change_type TEXT NOT NULL CHECK(change_type IN ('detected', 'modified', 'deleted')),
          change_description TEXT,
          created_at INTEGER NOT NULL,
          FOREIGN KEY (clip_id) REFERENCES clips(id) ON DELETE CASCADE,
          FOREIGN KEY (session_id) REFERENCES clip_detection_sessions(id) ON DELETE CASCADE,
          FOREIGN KEY (parent_version_id) REFERENCES clip_versions(id)
        )
      `)
    }

    // Add columns to clips table if they don't exist
    // Check if columns exist first to avoid ALTER TABLE errors
    try {
      const columnResult = await db.select<any[]>("PRAGMA table_info(clips)")
      const columns = columnResult.map(col => col.name)

      if (!columns.includes('current_version_id')) {
        await db.execute("ALTER TABLE clips ADD COLUMN current_version_id TEXT")
      }

      if (!columns.includes('detection_session_id')) {
        await db.execute("ALTER TABLE clips ADD COLUMN detection_session_id TEXT")
      }
    } catch (e) {
      console.error('[Frontend] Error adding columns to clips table:', e)
      // Try the basic ALTER TABLE as fallback
      try {
        await db.execute("ALTER TABLE clips ADD COLUMN current_version_id TEXT")
      } catch {
        // Ignore if still fails
      }
      try {
        await db.execute("ALTER TABLE clips ADD COLUMN detection_session_id TEXT")
      } catch {
        // Ignore if still fails
      }
    }

    // Create indexes
    const indexes = [
      "CREATE INDEX IF NOT EXISTS idx_clip_detection_sessions_project_id ON clip_detection_sessions(project_id)",
      "CREATE INDEX IF NOT EXISTS idx_clip_detection_sessions_created_at ON clip_detection_sessions(created_at)",
      "CREATE INDEX IF NOT EXISTS idx_clip_versions_clip_id ON clip_versions(clip_id)",
      "CREATE INDEX IF NOT EXISTS idx_clip_versions_session_id ON clip_versions(session_id)",
      "CREATE INDEX IF NOT EXISTS idx_clip_versions_parent_version_id ON clip_versions(parent_version_id)",
      "CREATE INDEX IF NOT EXISTS idx_clips_detection_session_id ON clips(detection_session_id)",
      "CREATE INDEX IF NOT EXISTS idx_clips_current_version_id ON clips(current_version_id)"
    ]

    for (const indexSql of indexes) {
      await db.execute(indexSql)
    }
  } catch (error) {
    console.error('[Frontend] Error ensuring clip versioning tables:', error)
    throw error
  }
}

// Project queries
export async function createProject(name: string, description?: string): Promise<string> {
  const db = await getDatabase()
  const id = generateId()
  const now = timestamp()

  await db.execute(
    'INSERT INTO projects (id, name, description, thumbnail_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, description || null, null, now, now]
  )

  return id
}

export async function getProject(id: string): Promise<Project | null> {
  const db = await getDatabase()
  const result = await db.select<Project[]>('SELECT * FROM projects WHERE id = ?', [id])
  return result[0] || null
}

export async function getAllProjects(): Promise<Project[]> {
  const db = await getDatabase()
  return await db.select<Project[]>('SELECT * FROM projects ORDER BY updated_at DESC')
}

export async function updateProject(id: string, name?: string, description?: string, thumbnailPath?: string): Promise<void> {
  const db = await getDatabase()
  const now = timestamp()

  const updates: string[] = []
  const values: any[] = []

  if (name !== undefined) {
    updates.push('name = ?')
    values.push(name)
  }
  if (description !== undefined) {
    updates.push('description = ?')
    values.push(description)
  }
  if (thumbnailPath !== undefined) {
    updates.push('thumbnail_path = ?')
    values.push(thumbnailPath)
  }

  updates.push('updated_at = ?')
  values.push(now)
  values.push(id)

  await db.execute(
    `UPDATE projects SET ${updates.join(', ')} WHERE id = ?`,
    values
  )
}

export async function deleteProject(id: string): Promise<void> {
  const db = await getDatabase()

  // First, disassociate all associated content by setting project_id to NULL
  // This preserves the content while removing the project association

  try {
    // Disassociate raw videos from this project (has project_id)
    await db.execute(
      'UPDATE raw_videos SET project_id = NULL WHERE project_id = ?',
      [id]
    )
  } catch (error) {
    console.warn('[Database] raw_videos project_id column update failed:', error)
  }

  try {
    // Disassociate clips from this project (has project_id)
    await db.execute(
      'UPDATE clips SET project_id = NULL WHERE project_id = ?',
      [id]
    )
  } catch (error) {
    console.warn('[Database] clips project_id column update failed:', error)
  }

  try {
    // Disassociate clip detection sessions from this project (has project_id)
    await db.execute(
      'UPDATE clip_detection_sessions SET project_id = NULL WHERE project_id = ?',
      [id]
    )
  } catch (error) {
    console.warn('[Database] clip_detection_sessions project_id column update failed:', error)
  }

  // Note: transcripts table was changed in migration 4 to use raw_video_id instead of project_id
  // So we don't need to update transcripts here

  // Now safely delete the project
  await db.execute('DELETE FROM projects WHERE id = ?', [id])
}

export async function hasRawVideosForProject(projectId: string): Promise<boolean> {
  const db = await getDatabase()
  const result = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM raw_videos WHERE project_id = ?',
    [projectId]
  )
  return (result[0]?.count || 0) > 0
}

export async function hasClipsForProject(projectId: string): Promise<boolean> {
  const db = await getDatabase()
  const result = await db.select<{ count: number }[]>(
    'SELECT COUNT(*) as count FROM clips WHERE project_id = ?',
    [projectId]
  )
  return (result[0]?.count || 0) > 0
}

// Prompt queries
export async function createPrompt(name: string, content: string): Promise<string> {
  const db = await getDatabase()
  const id = generateId()
  const now = timestamp()
  
  await db.execute(
    'INSERT INTO prompts (id, name, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, name, content, now, now]
  )
  
  return id
}

export async function getPrompt(id: string): Promise<Prompt | null> {
  const db = await getDatabase()
  const result = await db.select<Prompt[]>('SELECT * FROM prompts WHERE id = ?', [id])
  return result[0] || null
}

export async function getAllPrompts(): Promise<Prompt[]> {
  const db = await getDatabase()
  return await db.select<Prompt[]>('SELECT * FROM prompts ORDER BY name')
}

export async function updatePrompt(id: string, name?: string, content?: string): Promise<void> {
  const db = await getDatabase()
  const now = timestamp()
  
  const updates: string[] = []
  const values: any[] = []
  
  if (name !== undefined) {
    updates.push('name = ?')
    values.push(name)
  }
  if (content !== undefined) {
    updates.push('content = ?')
    values.push(content)
  }
  
  updates.push('updated_at = ?')
  values.push(now)
  values.push(id)
  
  await db.execute(
    `UPDATE prompts SET ${updates.join(', ')} WHERE id = ?`,
    values
  )
}

export async function deletePrompt(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('DELETE FROM prompts WHERE id = ?', [id])
}

// Seed default prompt
export async function seedDefaultPrompt(): Promise<void> {
  const db = await getDatabase()
  
  // Check if the default prompt already exists
  const existing = await db.select<Prompt[]>(
    'SELECT * FROM prompts WHERE name = ?',
    ['Default Clip Detector']
  )
  
  if (existing.length > 0) {
    return
  }
  
  // Create the default prompt
  const defaultPromptContent = `Analyze this stream transcript and identify ALL clip-worthy moments for TikTok/Shorts/X.

**DETECTION PHILOSOPHY:**
- BIAS TOWARDS FINDING CLIPS — when in doubt, include it, BUT NEVER at the cost of coherence.
- Prioritize moments that stand alone: a clear setup → development → payoff.
- Extract moments at different stages: setup, peak, aftermath, reactions.
- Lower your threshold — if something stands out from normal conversation, it's likely clip-worthy.

**CLIP QUALITY & BOUNDARY RULES:**
1) Start of clip MUST be a natural beginning of a sentence or thought.
   - Avoid starting mid-sentence or on connective fillers ("and", "so", "but", "because", "like") unless they naturally begin a new bit.
   - If the hook begins mid-thought, scan backward within the chunk to the prior sentence boundary, speaker turn, or a pause ≥ 0.35s.
   - Add a pre-roll pad of 0.15–0.30s before the first spoken word (if available in the chunk).
2) End of clip MUST complete the thought.
   - Extend to the end of the sentence or the natural resolution/punchline.
   - Do NOT end at the first word of a new sentence. Stop just before the next sentence begins, then add a post-roll pad of 0.30–0.60s.
   - Prefer ending at ., ?, !, or at a pause ≥ 0.45s.
3) Consistency & coherence.
   - The clip should make sense without external context. Include the smallest necessary setup for clarity.
   - If a complete coherent thought cannot fit within duration limits, SKIP it.
4) Spliced clips.
   - Each segment must independently follow the same start/end rules (sentence boundary + pads).
   - Segments must be chronological, non-overlapping, and thematically unified.
   - Only splice to remove dull filler between high-value moments or to tighten a single topic.
5) Hard constraints.
   - Minimum 15s, maximum 120s total per clip.
   - Prefer 20–75s when possible for short-form platforms.

**WHAT TO LOOK FOR:**
- Strong emotions or shifts; humor/awkwardness; drama/tension/conflict; surprises/reveals; bold claims; unusual behavior; struggle/vulnerability; high energy; relatable/resonant lines; quotable statements; notable reactions or audience moments.`
  
  try {
    await createPrompt('Default Clip Detector', defaultPromptContent)
  } catch (error) {
    console.error('[Database] Failed to seed default prompt:', error)
    throw error
  }
}

// Transcript queries
export async function createTranscript(
  rawVideoId: string,
  rawJson: string,
  text: string,
  language?: string,
  duration?: number
): Promise<string> {
  const db = await getDatabase()
  const id = generateId()
  const now = timestamp()

  await db.execute(
    'INSERT INTO transcripts (id, raw_video_id, raw_json, text, language, duration, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, rawVideoId, rawJson, text, language || null, duration || null, now, now]
  )

  return id
}

export async function getTranscriptByRawVideoId(rawVideoId: string): Promise<Transcript | null> {
  const db = await getDatabase()
  const result = await db.select<Transcript[]>(
    'SELECT * FROM transcripts WHERE raw_video_id = ?',
    [rawVideoId]
  )
  return result[0] || null
}

export async function getTranscriptByProjectId(projectId: string): Promise<Transcript | null> {
  const db = await getDatabase()
  const result = await db.select<Transcript[]>(
    `SELECT t.* FROM transcripts t
     JOIN raw_videos rv ON t.raw_video_id = rv.id
     WHERE rv.project_id = ?`,
    [projectId]
  )
  return result[0] || null
}

// Transcript segment queries
export async function createTranscriptSegment(
  transcriptId: string,
  startTime: number,
  endTime: number,
  text: string,
  segmentIndex: number,
  clipId?: string
): Promise<string> {
  const db = await getDatabase()
  const id = generateId()
  const now = timestamp()
  
  await db.execute(
    'INSERT INTO transcript_segments (id, transcript_id, clip_id, start_time, end_time, text, segment_index, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, transcriptId, clipId || null, startTime, endTime, text, segmentIndex, now]
  )
  
  return id
}

export async function getTranscriptSegments(transcriptId: string): Promise<TranscriptSegment[]> {
  const db = await getDatabase()
  return await db.select<TranscriptSegment[]>(
    'SELECT * FROM transcript_segments WHERE transcript_id = ? ORDER BY segment_index',
    [transcriptId]
  )
}

export async function getTranscriptWithSegmentsByProjectId(projectId: string): Promise<{ transcript: Transcript | null, segments: TranscriptSegment[] }> {
  const transcript = await getTranscriptByProjectId(projectId)
  const segments = transcript ? await getTranscriptSegments(transcript.id) : []
  return { transcript, segments }
}

// Search queries
export async function searchTranscripts(query: string): Promise<Project[]> {
  const db = await getDatabase()
  return await db.select<Project[]>(
    `SELECT DISTINCT p.* 
     FROM projects p
     JOIN transcripts t ON t.project_id = p.id
     JOIN transcripts_fts fts ON fts.rowid = t.rowid
     WHERE transcripts_fts MATCH ?
     ORDER BY p.updated_at DESC`,
    [query]
  )
}

export async function searchSegments(query: string): Promise<TranscriptSegment[]> {
  const db = await getDatabase()
  return await db.select<TranscriptSegment[]>(
    `SELECT ts.*
     FROM transcript_segments ts
     JOIN transcript_segments_fts fts ON fts.rowid = ts.rowid
     WHERE transcript_segments_fts MATCH ?
     ORDER BY ts.start_time`,
    [query]
  )
}

// Clip queries
export async function createClip(
  projectId: string,
  filePath: string,
  options?: {
    name?: string
    duration?: number
    startTime?: number
    endTime?: number
    orderIndex?: number
    introId?: string
    outroId?: string
  }
): Promise<string> {
  const db = await getDatabase()
  const id = generateId()
  const now = timestamp()
  
  await db.execute(
    'INSERT INTO clips (id, project_id, name, file_path, duration, start_time, end_time, order_index, intro_id, outro_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      projectId,
      options?.name || null,
      filePath,
      options?.duration || null,
      options?.startTime || null,
      options?.endTime || null,
      options?.orderIndex || null,
      options?.introId || null,
      options?.outroId || null,
      now,
      now,
    ]
  )
  
  return id
}

export async function getAllClips(): Promise<Clip[]> {
  const db = await getDatabase()
  return await db.select<Clip[]>(
    'SELECT * FROM clips ORDER BY created_at DESC'
  )
}

export async function getGeneratedClips(): Promise<Clip[]> {
  const db = await getDatabase()
  return await db.select<Clip[]>(
    'SELECT * FROM clips WHERE status = ? ORDER BY created_at DESC',
    ['generated']
  )
}

export async function getDetectedClips(): Promise<Clip[]> {
  const db = await getDatabase()
  return await db.select<Clip[]>(
    'SELECT * FROM clips WHERE status = ? ORDER BY created_at DESC',
    ['detected']
  )
}

export async function getClipsByProjectId(projectId: string): Promise<Clip[]> {
  const db = await getDatabase()
  return await db.select<Clip[]>(
    'SELECT * FROM clips WHERE project_id = ? ORDER BY order_index, created_at',
    [projectId]
  )
}

export async function updateClip(id: string, updates: Partial<Omit<Clip, 'id' | 'project_id' | 'created_at'>>): Promise<void> {
  const db = await getDatabase()
  const now = timestamp()
  
  const updateFields: string[] = []
  const values: any[] = []
  
  for (const [key, value] of Object.entries(updates)) {
    updateFields.push(`${key} = ?`)
    values.push(value)
  }
  
  updateFields.push('updated_at = ?')
  values.push(now)
  values.push(id)
  
  await db.execute(
    `UPDATE clips SET ${updateFields.join(', ')} WHERE id = ?`,
    values
  )
}

export async function deleteClip(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('DELETE FROM clips WHERE id = ?', [id])
}

// IntroOutro queries
export async function createIntroOutro(
  type: 'intro' | 'outro',
  name: string,
  filePath: string,
  duration?: number
): Promise<string> {
  const db = await getDatabase()
  const id = generateId()
  const now = timestamp()
  
  await db.execute(
    'INSERT INTO intro_outros (id, type, name, file_path, duration, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, type, name, filePath, duration || null, now, now]
  )
  
  return id
}

export async function getAllIntroOutros(type?: 'intro' | 'outro'): Promise<IntroOutro[]> {
  const db = await getDatabase()
  
  if (type) {
    return await db.select<IntroOutro[]>(
      'SELECT * FROM intro_outros WHERE type = ? ORDER BY name',
      [type]
    )
  }
  
  return await db.select<IntroOutro[]>('SELECT * FROM intro_outros ORDER BY type, name')
}

export async function deleteIntroOutro(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('DELETE FROM intro_outros WHERE id = ?', [id])
}

// Thumbnail queries
export async function createThumbnail(
  clipId: string,
  filePath: string,
  width?: number,
  height?: number
): Promise<string> {
  const db = await getDatabase()
  const id = generateId()
  const now = timestamp()
  
  await db.execute(
    'INSERT INTO thumbnails (id, clip_id, file_path, width, height, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, clipId, filePath, width || null, height || null, now]
  )
  
  return id
}

export async function getThumbnailByClipId(clipId: string): Promise<Thumbnail | null> {
  const db = await getDatabase()
  const result = await db.select<Thumbnail[]>(
    'SELECT * FROM thumbnails WHERE clip_id = ?',
    [clipId]
  )
  return result[0] || null
}

// RawVideo queries
export async function createRawVideo(
  filePath: string,
  options?: {
    projectId?: string
    originalFilename?: string
    thumbnailPath?: string
    duration?: number
    width?: number
    height?: number
    frameRate?: number
    codec?: string
    fileSize?: number
  }
): Promise<string> {
  const db = await getDatabase()
  const id = generateId()
  const now = timestamp()
  
  await db.execute(
    'INSERT INTO raw_videos (id, project_id, file_path, original_filename, thumbnail_path, duration, width, height, frame_rate, codec, file_size, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
    [
      id,
      options?.projectId || null,
      filePath,
      options?.originalFilename || null,
      options?.thumbnailPath || null,
      options?.duration || null,
      options?.width || null,
      options?.height || null,
      options?.frameRate || null,
      options?.codec || null,
      options?.fileSize || null,
      now,
      now,
    ]
  )
  
  return id
}

export async function getAllRawVideos(): Promise<RawVideo[]> {
  const db = await getDatabase()
  return await db.select<RawVideo[]>(
    'SELECT * FROM raw_videos ORDER BY created_at DESC'
  )
}

export async function getRawVideo(id: string): Promise<RawVideo | null> {
  const db = await getDatabase()
  const result = await db.select<RawVideo[]>(
    'SELECT * FROM raw_videos WHERE id = ?',
    [id]
  )
  return result[0] || null
}

export async function getRawVideosByProjectId(projectId: string): Promise<RawVideo[]> {
  const db = await getDatabase()
  return await db.select<RawVideo[]>(
    'SELECT * FROM raw_videos WHERE project_id = ? ORDER BY created_at DESC',
    [projectId]
  )
}

export async function getRawVideoByPath(filePath: string): Promise<RawVideo | null> {
  const db = await getDatabase()
  const result = await db.select<RawVideo[]>(
    'SELECT * FROM raw_videos WHERE file_path = ?',
    [filePath]
  )
  return result[0] || null
}

export async function updateRawVideo(id: string, updates: Partial<{
  project_id?: string | null,
  file_path?: string,
  original_filename?: string,
  thumbnail_path?: string,
  duration?: number,
  width?: number,
  height?: number,
  frame_rate?: number,
  codec?: string,
  file_size?: number,
  original_project_id?: string | null
}>): Promise<void> {
  const db = await getDatabase()
  const dbUpdates: string[] = []
  const values: any[] = []

  if (updates.project_id !== undefined) {
    dbUpdates.push('project_id = ?')
    values.push(updates.project_id)
  }

  if (updates.file_path !== undefined) {
    dbUpdates.push('file_path = ?')
    values.push(updates.file_path)
  }

  if (updates.original_filename !== undefined) {
    dbUpdates.push('original_filename = ?')
    values.push(updates.original_filename)
  }

  if (updates.thumbnail_path !== undefined) {
    dbUpdates.push('thumbnail_path = ?')
    values.push(updates.thumbnail_path)
  }

  if (updates.duration !== undefined) {
    dbUpdates.push('duration = ?')
    values.push(updates.duration)
  }

  if (updates.width !== undefined) {
    dbUpdates.push('width = ?')
    values.push(updates.width)
  }

  if (updates.height !== undefined) {
    dbUpdates.push('height = ?')
    values.push(updates.height)
  }

  if (updates.frame_rate !== undefined) {
    dbUpdates.push('frame_rate = ?')
    values.push(updates.frame_rate)
  }

  if (updates.codec !== undefined) {
    dbUpdates.push('codec = ?')
    values.push(updates.codec)
  }

  if (updates.file_size !== undefined) {
    dbUpdates.push('file_size = ?')
    values.push(updates.file_size)
  }

  if (updates.original_project_id !== undefined) {
    dbUpdates.push('original_project_id = ?')
    values.push(updates.original_project_id)
  }

  if (dbUpdates.length === 0) return

  dbUpdates.push('updated_at = ?')
  values.push(timestamp())
  values.push(id)

  await db.execute(
    `UPDATE raw_videos SET ${dbUpdates.join(', ')} WHERE id = ?`,
    values
  )
}

export async function deleteRawVideo(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('DELETE FROM raw_videos WHERE id = ?', [id])
}

export async function hasClipsReferencingRawVideo(rawVideoId: string): Promise<boolean> {
  // Check if any clips reference this raw video through their project relationship
  // Note: Deleting a raw video does NOT delete the clips - it just sets their raw_video_id to NULL
  const db = await getDatabase()
  const result = await db.select<{ count: number }[]>(
    `SELECT COUNT(*) as count
     FROM clips c
     JOIN projects p ON c.project_id = p.id
     JOIN raw_videos rv ON p.id = rv.project_id
     WHERE rv.id = ?`,
    [rawVideoId]
  )
  return (result[0]?.count || 0) > 0
}

// Generate a random color for clip detection runs
function generateRunColor(): string {
  const colors = [
    '#8B5CF6', // Purple (default)
    '#3B82F6', // Blue
    '#10B981', // Green
    '#F59E0B', // Amber
    '#EF4444', // Red
    '#06B6D4', // Cyan
    '#F97316', // Orange
    '#84CC16', // Lime
    '#EC4899', // Pink
    '#6366F1', // Indigo
    '#14B8A6', // Teal
    '#A855F7', // Violet
  ]

  // Pick a random color from the predefined list
  return colors[Math.floor(Math.random() * colors.length)]
}

// Clip Detection Session queries
export async function createClipDetectionSession(
  projectId: string,
  prompt: string,
  options?: {
    detectionModel?: string
    serverResponseId?: string
    qualityScore?: number
    totalClipsDetected?: number
    processingTimeMs?: number
    validationData?: any
    runColor?: string
  }
): Promise<string> {
  const db = await getDatabase()
  const id = generateId()
  const now = timestamp()

  await db.execute(
    `INSERT INTO clip_detection_sessions (
      id, project_id, prompt, detection_model, server_response_id,
      quality_score, total_clips_detected, processing_time_ms,
      validation_data, run_color, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      projectId,
      prompt,
      options?.detectionModel || 'claude-3.5-sonnet',
      options?.serverResponseId || null,
      options?.qualityScore || null,
      options?.totalClipsDetected || 0,
      options?.processingTimeMs || null,
      options?.validationData ? JSON.stringify(options.validationData) : null,
      options?.runColor || generateRunColor(),
      now
    ]
  )

  return id
}

export async function getClipDetectionSession(id: string): Promise<ClipDetectionSession | null> {
  const db = await getDatabase()
  const result = await db.select<ClipDetectionSession[]>(
    'SELECT * FROM clip_detection_sessions WHERE id = ?',
    [id]
  )
  return result[0] || null
}

export async function getClipDetectionSessionsByProjectId(projectId: string): Promise<ClipDetectionSession[]> {
  const db = await getDatabase()
  return await db.select<ClipDetectionSession[]>(
    'SELECT * FROM clip_detection_sessions WHERE project_id = ? ORDER BY created_at DESC',
    [projectId]
  )
}

export async function updateClipDetectionSession(
  id: string,
  updates: Partial<Omit<ClipDetectionSession, 'id' | 'project_id' | 'prompt' | 'detection_model' | 'created_at'>>
): Promise<void> {
  const db = await getDatabase()

  const updateFields: string[] = []
  const values: any[] = []

  for (const [key, value] of Object.entries(updates)) {
    updateFields.push(`${key} = ?`)
    values.push(value)
  }

  if (updateFields.length === 0) return

  await db.execute(
    `UPDATE clip_detection_sessions SET ${updateFields.join(', ')} WHERE id = ?`,
    [...values, id]
  )
}

export async function deleteClipDetectionSession(id: string): Promise<void> {
  const db = await getDatabase()
  await db.execute('DELETE FROM clip_detection_sessions WHERE id = ?', [id])
}

// Clip Version queries
export async function createClipVersion(
  clipId: string,
  sessionId: string,
  versionNumber: number,
  clipData: {
    name: string
    description?: string
    startTime: number
    endTime: number
    confidenceScore?: number
    relevanceScore?: number
    detectionReason?: string
    tags?: string[]
  },
  changeType: 'detected' | 'modified' | 'deleted',
  changeDescription?: string,
  parentVersionId?: string
): Promise<string> {
  const db = await getDatabase()
  const id = generateId()
  const now = timestamp()

  await db.execute(
    `INSERT INTO clip_versions (
      id, clip_id, session_id, version_number, parent_version_id,
      name, description, start_time, end_time,
      confidence_score, relevance_score, detection_reason, tags,
      change_type, change_description, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      clipId,
      sessionId,
      versionNumber,
      parentVersionId || null,
      clipData.name,
      clipData.description || null,
      clipData.startTime,
      clipData.endTime,
      clipData.confidenceScore || null,
      clipData.relevanceScore || null,
      clipData.detectionReason || null,
      clipData.tags ? JSON.stringify(clipData.tags) : null,
      changeType,
      changeDescription || null,
      now
    ]
  )

  return id
}

export async function getClipVersion(id: string): Promise<ClipVersion | null> {
  const db = await getDatabase()
  const result = await db.select<ClipVersion[]>(
    'SELECT * FROM clip_versions WHERE id = ?',
    [id]
  )
  return result[0] || null
}

export async function getClipSegmentsByVersionId(versionId: string): Promise<ClipSegment[]> {
  const db = await getDatabase()
  return await db.select<ClipSegment[]>(
    'SELECT * FROM clip_segments WHERE clip_version_id = ? ORDER BY segment_index ASC',
    [versionId]
  )
}

// Update a single clip segment's timing
export async function updateClipSegment(
  clipId: string,
  segmentIndex: number,
  startTime: number,
  endTime: number
): Promise<void> {
  const db = await getDatabase()
  const duration = endTime - startTime

  // Get the current version ID for this clip
  const clipVersions = await db.select<ClipVersion[]>(
    'SELECT id FROM clip_versions WHERE clip_id = ? ORDER BY version_number DESC LIMIT 1',
    [clipId]
  )

  if (clipVersions.length === 0) {
    throw new Error('No clip version found for clip')
  }

  const versionId = clipVersions[0].id

  // Update the clip segment
  await db.execute(
    'UPDATE clip_segments SET start_time = ?, end_time = ?, duration = ? WHERE clip_version_id = ? AND segment_index = ?',
    [startTime, endTime, duration, versionId, segmentIndex]
  )
}


// Get adjacent clip segments for collision detection
export async function getAdjacentClipSegments(
  clipId: string,
  segmentIndex: number
): Promise<{ previous: ClipSegment | null, next: ClipSegment | null }> {
  const db = await getDatabase()

  // Get the current version ID for this clip
  const clipVersions = await db.select<ClipVersion[]>(
    'SELECT id FROM clip_versions WHERE clip_id = ? ORDER BY version_number DESC LIMIT 1',
    [clipId]
  )

  if (clipVersions.length === 0) {
    return { previous: null, next: null }
  }

  const versionId = clipVersions[0].id

  // Get all segments for this clip version, ordered by time
  const segments = await db.select<ClipSegment[]>(
    'SELECT * FROM clip_segments WHERE clip_version_id = ? ORDER BY start_time, segment_index',
    [versionId]
  )

  if (segments.length === 0 || segmentIndex < 0 || segmentIndex >= segments.length) {
    return { previous: null, next: null }
  }

  return {
    previous: segmentIndex > 0 ? segments[segmentIndex - 1] : null,
    next: segmentIndex < segments.length - 1 ? segments[segmentIndex + 1] : null
  }
}

// Get all clip segments for a clip (ordered by time)
export async function getClipSegmentsByClipId(clipId: string): Promise<ClipSegment[]> {
  const db = await getDatabase()

  // Get the current version ID for this clip
  const clipVersions = await db.select<ClipVersion[]>(
    'SELECT id FROM clip_versions WHERE clip_id = ? ORDER BY version_number DESC LIMIT 1',
    [clipId]
  )

  if (clipVersions.length === 0) {
    return []
  }

  const versionId = clipVersions[0].id

  return await db.select<ClipSegment[]>(
    'SELECT * FROM clip_segments WHERE clip_version_id = ? ORDER BY start_time, segment_index ASC',
    [versionId]
  )
}

// Split a clip segment into two separate segments at a specific time
export async function splitClipSegment(
  clipId: string,
  segmentIndex: number,
  cutTime: number
): Promise<{ leftSegmentIndex: number, rightSegmentIndex: number }> {
  const db = await getDatabase()

  // Get the current version ID for this clip
  const clipVersions = await db.select<ClipVersion[]>(
    'SELECT id FROM clip_versions WHERE clip_id = ? ORDER BY version_number DESC LIMIT 1',
    [clipId]
  )

  if (clipVersions.length === 0) {
    throw new Error('No clip version found for clip')
  }

  const versionId = clipVersions[0].id

  // Get the segment to split and all subsequent segments
  const segments = await db.select<ClipSegment[]>(
    'SELECT * FROM clip_segments WHERE clip_version_id = ? ORDER BY start_time, segment_index',
    [versionId]
  )

  if (segments.length <= segmentIndex) {
    throw new Error('Segment not found')
  }

  const segmentToSplit = segments[segmentIndex]

  // Validate cut time is within segment bounds
  if (cutTime <= segmentToSplit.start_time || cutTime >= segmentToSplit.end_time) {
    throw new Error('Cut time must be within segment boundaries')
  }

  // Validate minimum segment durations (0.5 seconds each)
  const leftDuration = cutTime - segmentToSplit.start_time
  const rightDuration = segmentToSplit.end_time - cutTime

  if (leftDuration < 0.5 || rightDuration < 0.5) {
    throw new Error('Both segments must be at least 0.5 seconds long')
  }

  try {
    // Split the transcript if it contains word-level timing
    let leftTranscript = null
    let rightTranscript = null

    if (segmentToSplit.transcript) {
      let transcriptData

      try {
        transcriptData = JSON.parse(segmentToSplit.transcript)
      } catch (parseError) {
        // Transcript is plain text, not JSON - handle as plain text split
        console.log('[Database] Transcript is plain text, handling as simple split')

        // For plain text, we'll use a simple approach: keep original on left, none on right
        // This preserves the transcript content without requiring word-level timing
        leftTranscript = segmentToSplit.transcript
        // Right segment gets no transcript for plain text splits
      }

      // Handle different transcript formats only if we successfully parsed JSON
      if (transcriptData) {
        if (transcriptData.words && Array.isArray(transcriptData.words)) {
          // Split words array
          const leftWords = []
          const rightWords = []

          for (const word of transcriptData.words) {
            if (word.end !== undefined && word.end <= cutTime) {
              leftWords.push(word)
            } else if (word.start !== undefined && word.start >= cutTime) {
              rightWords.push(word)
            }
          }

          leftTranscript = JSON.stringify({ ...transcriptData, words: leftWords })
          rightTranscript = JSON.stringify({ ...transcriptData, words: rightWords })
        } else if (transcriptData.segments && Array.isArray(transcriptData.segments)) {
          // Split segments array
          const leftSegments = []
          const rightSegments = []

          for (const seg of transcriptData.segments) {
            if (seg.end !== undefined && seg.end <= cutTime) {
              leftSegments.push(seg)
            } else if (seg.start !== undefined && seg.start >= cutTime) {
              rightSegments.push(seg)
            }
          }

          leftTranscript = JSON.stringify({ ...transcriptData, segments: leftSegments })
          rightTranscript = JSON.stringify({ ...transcriptData, segments: rightSegments })
        } else if (Array.isArray(transcriptData)) {
          // Split direct array of words
          const leftWords = []
          const rightWords = []

          for (const word of transcriptData) {
            if (word.end !== undefined && word.end <= cutTime) {
              leftWords.push(word)
            } else if (word.start !== undefined && word.start >= cutTime) {
              rightWords.push(word)
            }
          }

          leftTranscript = JSON.stringify(leftWords)
          rightTranscript = JSON.stringify(rightWords)
        }
      }
    }

    // Create the two new segments
    const leftSegmentId = generateId()
    const rightSegmentId = generateId()
    const now = timestamp()

    // First, shift all segments that come after the original segment up by 1
    // This creates space for our new right segment
    await db.execute(
      `UPDATE clip_segments
       SET segment_index = segment_index + 1
       WHERE clip_version_id = ? AND segment_index > ?`,
      [versionId, segmentIndex]
    )

    // Delete the original segment to free up its index
    await db.execute(
      'DELETE FROM clip_segments WHERE id = ?',
      [segmentToSplit.id]
    )

    // Now insert the left segment at the original index
    await db.execute(
      `INSERT INTO clip_segments (
        id, clip_version_id, segment_index, start_time, end_time, duration, transcript, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        leftSegmentId,
        versionId,
        segmentIndex,
        segmentToSplit.start_time,
        cutTime,
        leftDuration,
        leftTranscript,
        now
      ]
    )

    // Insert right segment at index + 1 (which is now free due to the shift)
    await db.execute(
      `INSERT INTO clip_segments (
        id, clip_version_id, segment_index, start_time, end_time, duration, transcript, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rightSegmentId,
        versionId,
        segmentIndex + 1,
        cutTime,
        segmentToSplit.end_time,
        rightDuration,
        rightTranscript,
        now
      ]
    )

    return {
      leftSegmentIndex: segmentIndex,
      rightSegmentIndex: segmentIndex + 1
    }

  } catch (error) {
    console.error('[Database] Failed to split segment:', error)
    throw new Error(`Failed to split segment: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// Realign transcript words within a moved clip segment
export async function realignClipSegment(
  clipId: string,
  segmentIndex: number,
  originalStartTime: number,
  originalEndTime: number,
  newStartTime: number,
  newEndTime: number
): Promise<void> {
  const db = await getDatabase()

  // Get the current version ID for this clip
  const clipVersions = await db.select<ClipVersion[]>(
    'SELECT id FROM clip_versions WHERE clip_id = ? ORDER BY version_number DESC LIMIT 1',
    [clipId]
  )

  if (clipVersions.length === 0) {
    throw new Error('No clip version found for clip')
  }

  const versionId = clipVersions[0].id

  // Get the clip segment to realign
  const segments = await db.select<ClipSegment[]>(
    'SELECT * FROM clip_segments WHERE clip_version_id = ? ORDER BY start_time, segment_index',
    [versionId]
  )

  if (segments.length <= segmentIndex) {
    throw new Error('Segment not found')
  }

  // Calculate time shift and scale for realignment
  const timeShift = newStartTime - originalStartTime
  const timeScale = (newEndTime - newStartTime) / (originalEndTime - originalStartTime)

  // Get the segment data
  const segment = segments[segmentIndex]
  if (!segment.transcript) {
    return
  }

  try {
    // Parse the transcript to extract word-level timing if available
    let realignedTranscript = segment.transcript

    // Check if transcript contains word-level timestamps (JSON format)
    if (segment.transcript.trim().startsWith('{') || segment.transcript.trim().startsWith('[')) {
      try {
        const transcriptData = JSON.parse(segment.transcript)

        // Handle different transcript formats
        if (transcriptData.words && Array.isArray(transcriptData.words)) {
          // Format: { words: [{word: "hello", start: 0.0, end: 0.5}, ...] }
          transcriptData.words.forEach((word: any) => {
            if (word.start !== undefined) word.start = word.start * timeScale + timeShift
            if (word.end !== undefined) word.end = word.end * timeScale + timeShift
          })
          realignedTranscript = JSON.stringify(transcriptData)
        } else if (transcriptData.segments && Array.isArray(transcriptData.segments)) {
          // Format: { segments: [{start: 0.0, end: 2.0, text: "hello world"}] }
          transcriptData.segments.forEach((seg: any) => {
            if (seg.start !== undefined) seg.start = seg.start * timeScale + timeShift
            if (seg.end !== undefined) seg.end = seg.end * timeScale + timeShift
          })
          realignedTranscript = JSON.stringify(transcriptData)
        } else if (Array.isArray(transcriptData)) {
          // Format: [{word: "hello", start: 0.0, end: 0.5}, ...]
          transcriptData.forEach((word: any) => {
            if (word.start !== undefined) word.start = word.start * timeScale + timeShift
            if (word.end !== undefined) word.end = word.end * timeScale + timeShift
          })
          realignedTranscript = JSON.stringify(transcriptData)
        }
      } catch (parseError) {
        console.log('[Database] Transcript is not valid JSON, treating as plain text')
        // Keep as plain text, no word-level timing to adjust
      }
    }

    // Update the segment with realigned transcript
    await db.execute(
      'UPDATE clip_segments SET transcript = ? WHERE clip_version_id = ? AND segment_index = ?',
      [realignedTranscript, versionId, segmentIndex]
    )

  } catch (error) {
    console.error('[Database] Failed to realign segment transcript:', error)
    // Continue without transcript realignment - segment timing is still updated
  }
}

export async function getClipVersionsByClipId(clipId: string): Promise<ClipVersion[]> {
  const db = await getDatabase()
  return await db.select<ClipVersion[]>(
    'SELECT * FROM clip_versions WHERE clip_id = ? ORDER BY version_number DESC',
    [clipId]
  )
}

export async function getClipVersionsBySessionId(sessionId: string): Promise<ClipVersion[]> {
  const db = await getDatabase()
  return await db.select<ClipVersion[]>(
    'SELECT * FROM clip_versions WHERE session_id = ? ORDER BY version_number',
    [sessionId]
  )
}

export async function getCurrentClipVersion(clipId: string): Promise<ClipVersion | null> {
  const db = await getDatabase()
  const result = await db.select<ClipVersion[]>(
    `SELECT cv.* FROM clip_versions cv
     JOIN clips c ON c.current_version_id = cv.id
     WHERE c.id = ?`,
    [clipId]
  )
  return result[0] || null
}

// Enhanced clip queries with versioning support
export async function createVersionedClip(
  projectId: string,
  sessionId: string,
  clipData: {
    name: string
    startTime: number
    endTime: number
    description?: string
    confidenceScore?: number
    relevanceScore?: number
    detectionReason?: string
    tags?: string[]
    segments?: Array<{
      start_time: number
      end_time: number
      duration: number
      transcript?: string
    }>
  },
  filePath?: string
): Promise<string> {
  const db = await getDatabase()
  const clipId = generateId()
  const now = timestamp()

  // Create the clip record first
  await db.execute(
    `INSERT INTO clips (
      id, project_id, name, file_path, start_time, end_time,
      detection_session_id, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      clipId,
      projectId,
      clipData.name,
      filePath || '',
      clipData.startTime,
      clipData.endTime,
      sessionId,
      now,
      now
    ]
  )

  // Create the initial version (version 1)
  const versionId = await createClipVersion(
    clipId,
    sessionId,
    1,
    clipData,
    'detected',
    'Initial clip detection'
  )

  // Create segments if provided
  if (clipData.segments && Array.isArray(clipData.segments) && clipData.segments.length > 0) {
    for (let i = 0; i < clipData.segments.length; i++) {
      const segment = clipData.segments[i]
      const segmentId = generateId()

      await db.execute(
        `INSERT INTO clip_segments (
          id, clip_version_id, segment_index, start_time, end_time, duration, transcript, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          segmentId,
          versionId,
          i,
          segment.start_time,
          segment.end_time,
          segment.duration || (segment.end_time - segment.start_time),
          segment.transcript || null,
          now
        ]
      )
    }
  }

  // Update the clip with the current version and session ID
  await db.execute(
    'UPDATE clips SET current_version_id = ?, detection_session_id = ? WHERE id = ?',
    [versionId, sessionId, clipId]
  )

  return clipId
}

export async function getClipsWithVersionsByProjectId(projectId: string): Promise<ClipWithVersion[]> {
  const db = await getDatabase()

  const clips = await db.select<ClipWithVersion[]>(
    `SELECT
      c.*,
      cv.id as current_version_id,
      cv.name as current_version_name,
      cv.description as current_version_description,
      cv.start_time as current_version_start_time,
      cv.end_time as current_version_end_time,
      cv.confidence_score as current_version_confidence_score,
      cv.relevance_score as current_version_relevance_score,
      cv.detection_reason as current_version_detection_reason,
      cv.tags as current_version_tags,
      cv.change_type as current_version_change_type,
      cv.created_at as current_version_created_at,
      s.id as detection_session_id,
      s.created_at as session_created_at,
      s.run_color as session_run_color,
      -- Calculate run number based on session creation order
      (SELECT COUNT(*) + 1 FROM clip_detection_sessions s2
       WHERE s2.project_id = ? AND s2.created_at < s.created_at) as run_number
     FROM clips c
     LEFT JOIN clip_versions cv ON c.current_version_id = cv.id
     LEFT JOIN clip_detection_sessions s ON c.detection_session_id = s.id
     WHERE c.project_id = ?
     ORDER BY s.created_at DESC, c.created_at DESC`,
    [projectId, projectId]
  )

  // Load segments for each clip's current version
  for (const clip of clips) {
    if (clip.current_version_id) {
      const segments = await db.select<ClipSegment[]>(
        `SELECT * FROM clip_segments
         WHERE clip_version_id = ?
         ORDER BY segment_index ASC`,
        [clip.current_version_id]
      )
      clip.current_version_segments = segments
    }
  }

  return clips.map(clip => {
    const mapped = {
      ...clip,
      current_version: clip.current_version_id ? {
        id: clip.current_version_id,
        clip_id: clip.id,
        session_id: clip.detection_session_id || '',
        version_number: 1,
        parent_version_id: null,
        name: clip.current_version_name || clip.name || '',
        description: clip.current_version_description || null,
        start_time: clip.current_version_start_time || clip.start_time || 0,
        end_time: clip.current_version_end_time || clip.end_time || 0,
        confidence_score: clip.current_version_confidence_score,
        relevance_score: clip.current_version_relevance_score,
        detection_reason: clip.current_version_detection_reason,
        tags: clip.current_version_tags,
        change_type: clip.current_version_change_type as 'detected' | 'modified' | 'deleted',
        change_description: null,
        created_at: clip.current_version_created_at
      } : undefined
    }

    return mapped
  }) as ClipWithVersion[]
}

export async function persistClipDetectionResults(
  projectId: string,
  prompt: string,
  detectionResults: {
    clips: any[]
    transcript?: any
    validation?: any
  },
  options?: {
    detectionModel?: string
    serverResponseId?: string
    processingTimeMs?: number
  }
): Promise<string> {
  const startTime = Date.now()
  // Check for nested structure in clips property
  if (detectionResults.clips && typeof detectionResults.clips === 'object' && (detectionResults.clips as any).clips) {
    ;(detectionResults as any).clips = (detectionResults.clips as any).clips
  }

  // Double-check if clips might be in a different property
  if (!detectionResults.clips || (detectionResults.clips as any[]).length === 0) {
    for (const key of Object.keys(detectionResults)) {
      const value = detectionResults[key as keyof typeof detectionResults]
      if (Array.isArray(value) && value.length > 0) {
        // Check if this looks like clips data
        if ((value[0] as any)?.id || (value[0] as any)?.title || (value[0] as any)?.segments) {
          ;(detectionResults as any).clips = value
          break
        }
      }
    }
  }

  // Ensure clip versioning tables exist before proceeding
  await ensureClipVersioningTables()

  // Store transcript if provided
  let transcriptId: string | null = null
  if (detectionResults.transcript) {
    try {
      // Get the raw video associated with this project
      const rawVideos = await getRawVideosByProjectId(projectId)
      if (rawVideos.length === 0) {
        console.warn('[Database] No raw video found for project, cannot store transcript')
      } else {
        const rawVideo = rawVideos[0] // Use the first raw video found

        // Check if transcript already exists for this raw video
        const existingTranscript = await getTranscriptByRawVideoId(rawVideo.id)

        if (existingTranscript) {
          transcriptId = existingTranscript.id

          // Check if this was a fresh transcription or cached
          const usedCachedTranscript = (detectionResults as any).processing_info?.used_cached_transcript

          if (!usedCachedTranscript) {
            // Update the existing transcript with fresh data
            const transcriptText = detectionResults.transcript.text ||
                                 (detectionResults.transcript.segments?.map((seg: any) => seg.text).join(' ') || '') ||
                                 JSON.stringify(detectionResults.transcript)

            const language = detectionResults.transcript.language
            const duration = detectionResults.transcript.duration ||
                            (detectionResults.transcript.segments?.reduce((acc: number, seg: any) =>
                              Math.max(acc, seg.end_time || 0), 0) || null)

            const db = await getDatabase()
            await db.execute(
              'UPDATE transcripts SET raw_json = ?, text = ?, language = ?, duration = ? WHERE id = ?',
              [
                JSON.stringify(detectionResults.transcript),
                transcriptText,
                language,
                duration,
                transcriptId
              ]
            )

            // Delete existing segments to refresh them
            await db.execute('DELETE FROM transcript_segments WHERE transcript_id = ?', [transcriptId])
          } else {
            console.log('[Database] Used cached transcript, no database update needed')
          }
        } else {
          // Extract transcript data from Whisper response (only when no existing transcript)
          const transcriptText = detectionResults.transcript.text ||
                               (detectionResults.transcript.segments?.map((seg: any) => seg.text).join(' ') || '') ||
                               JSON.stringify(detectionResults.transcript)

          const language = detectionResults.transcript.language
          const duration = detectionResults.transcript.duration ||
                          (detectionResults.transcript.segments?.reduce((acc: number, seg: any) =>
                            Math.max(acc, seg.end_time || 0), 0) || null)

          transcriptId = await createTranscript(
            rawVideo.id, // Use raw_video_id instead of project_id
            JSON.stringify(detectionResults.transcript), // Store full raw response
            transcriptText,
            language,
            duration
          )
        }

        // Store transcript segments if available (only for fresh transcriptions)
        const usedCachedTranscript = (detectionResults as any).processing_info?.used_cached_transcript
        if (!usedCachedTranscript && detectionResults.transcript.segments && Array.isArray(detectionResults.transcript.segments)) {
          for (let i = 0; i < detectionResults.transcript.segments.length; i++) {
            const segment = detectionResults.transcript.segments[i]
            await createTranscriptSegment(
              transcriptId,
              segment.start_time || 0,
              segment.end_time || 0,
              segment.text || '',
              i
            )
          }
        } else if (usedCachedTranscript) {
          console.log('[Database] Using cached transcript segments, no segment storage needed')
        }
      }
    } catch (error) {
      console.error('[Database] Failed to store transcript:', error)
    }
  } else {
    console.log('[Database] No transcript data provided in detection results')
  }

  // Create detection session
  const sessionId = await createClipDetectionSession(
    projectId,
    prompt,
    {
      detectionModel: options?.detectionModel || 'claude-3.5-sonnet',
      serverResponseId: options?.serverResponseId,
      qualityScore: detectionResults.validation?.qualityScore,
      totalClipsDetected: detectionResults.clips?.length || 0,
      processingTimeMs: options?.processingTimeMs || (Date.now() - startTime),
      validationData: detectionResults.validation
    }
  )

  // Keep all existing clips - each detection run creates new clips without removing previous ones
  // This allows users to see all clips generated across all detection runs

  // Persist detected clips
  const clipsArray = detectionResults.clips as any[]
  for (let i = 0; i < clipsArray.length; i++) {
    const clipData = clipsArray[i]

    // Extract timing data from segments
    let startTime = 0
    let endTime = 0

    if (clipData.segments && Array.isArray(clipData.segments) && clipData.segments.length > 0) {
      // Calculate total duration from all segments
      const firstSegment = clipData.segments[0]
      const lastSegment = clipData.segments[clipData.segments.length - 1]
      startTime = firstSegment.start_time || 0
      endTime = lastSegment.end_time || 0

    } else if (clipData.total_duration) {
      // Fallback to total_duration if available
      endTime = clipData.total_duration
    } else {
      console.log(`[Database] No timing data found for clip ${i + 1}:`, {
        hasSegments: !!clipData.segments,
        segmentsLength: clipData.segments?.length,
        hasTotalDuration: !!clipData.total_duration,
        clipDataKeys: Object.keys(clipData)
      })
    }

    // Extract clip information from the detected data
    const clipInfo = {
      name: clipData.name || clipData.title || `Clip ${i + 1}`,
      startTime: startTime,
      endTime: endTime,
      description: clipData.description || clipData.summary || clipData.socialMediaPost,
      confidenceScore: clipData.confidenceScore || clipData.confidence,
      relevanceScore: clipData.relevanceScore || clipData.relevance,
      detectionReason: clipData.reason || clipData.detectionReason || 'AI detected clip-worthy moment',
      tags: clipData.tags || clipData.keywords || [],
      segments: clipData.segments || []
    }

    try {
      await createVersionedClip(projectId, sessionId, clipInfo)
    } catch (e) {
      console.error(`[Database] Failed to create clip ${i + 1}:`, e)
    }
  }

  // Verify the clips were actually saved
  try {
    await getClipsWithVersionsByProjectId(projectId)
  } catch (e) {
    console.error('[Database] Error verifying saved clips:', e)
  }

  return sessionId
}

export async function restoreClipVersion(clipId: string, versionId: string): Promise<void> {
  const db = await getDatabase()

  // Get the version to restore
  const version = await getClipVersion(versionId)
  if (!version) {
    throw new Error(`Version ${versionId} not found`)
  }

  // Create a new version based on the old one
  const newVersionId = await createClipVersion(
    clipId,
    version.session_id,
    await getNextVersionNumber(clipId),
    {
      name: version.name,
      description: version.description || undefined,
      startTime: version.start_time,
      endTime: version.end_time,
      confidenceScore: version.confidence_score || undefined,
      relevanceScore: version.relevance_score || undefined,
      detectionReason: version.detection_reason || undefined,
      tags: version.tags ? JSON.parse(version.tags) : undefined
    },
    'modified',
    `Restored from version ${version.version_number}`,
    versionId
  )

  // Update the clip's current version
  await db.execute(
    'UPDATE clips SET current_version_id = ? WHERE id = ?',
    [newVersionId, clipId]
  )

  // Also update the clip's basic fields for compatibility
  await db.execute(
    'UPDATE clips SET name = ?, start_time = ?, end_time = ?, updated_at = ? WHERE id = ?',
    [version.name, version.start_time, version.end_time, timestamp(), clipId]
  )
}

async function getNextVersionNumber(clipId: string): Promise<number> {
  const db = await getDatabase()
  const result = await db.select<{ max_version: number }[]>(
    'SELECT COALESCE(MAX(version_number), 0) as max_version FROM clip_versions WHERE clip_id = ?',
    [clipId]
  )
  return (result[0]?.max_version || 0) + 1
}
