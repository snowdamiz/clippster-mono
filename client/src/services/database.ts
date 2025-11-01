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

      // Debug: Check if Database is available
      console.log('[Frontend] Database object:', Database)
      console.log('[Frontend] Database.load:', Database.load)
      console.log('[Frontend] Attempting to load sqlite:clippster_v2.db')

      const instance = await Database.load('sqlite:clippster_v2.db')
      console.log('[Frontend] Database loaded successfully')

      // Debug: Check if clip versioning tables exist
      await checkDatabaseSchema(instance)

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

async function checkDatabaseSchema(db: Database) {
  try {
    console.log('[Frontend] Checking database schema...')

    // Check if clip_detection_sessions table exists
    const sessionResult = await db.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='clip_detection_sessions'"
    )
    console.log('[Frontend] clip_detection_sessions table exists:', sessionResult.length > 0)

    // Check if clip_versions table exists
    const versionResult = await db.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='clip_versions'"
    )
    console.log('[Frontend] clip_versions table exists:', versionResult.length > 0)

    // Check if clips table has the new columns
    try {
      const columnResult = await db.select<any[]>(
        "PRAGMA table_info(clips)"
      )
      const columns = columnResult.map(col => col.name)
      console.log('[Frontend] clips table columns:', columns)
      console.log('[Frontend] has current_version_id:', columns.includes('current_version_id'))
      console.log('[Frontend] has detection_session_id:', columns.includes('detection_session_id'))
    } catch (e) {
      console.error('[Frontend] Error checking clips table:', e)
    }

  } catch (error) {
    console.error('[Frontend] Error checking database schema:', error)
  }
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
  project_id: string
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

export interface ClipWithVersion extends Clip {
  current_version_id: string | null
  detection_session_id: string | null
  current_version?: ClipVersion
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
    console.log('[Frontend] Ensuring clip versioning tables exist...')

    // Check if tables exist
    const sessionResult = await db.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='clip_detection_sessions'"
    )

    if (sessionResult.length === 0) {
      console.log('[Frontend] Creating clip_detection_sessions table...')
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
          created_at INTEGER NOT NULL,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )
      `)
    }

    const versionResult = await db.select<{ name: string }[]>(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='clip_versions'"
    )

    if (versionResult.length === 0) {
      console.log('[Frontend] Creating clip_versions table...')
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
        console.log('[Frontend] Adding current_version_id column to clips table...')
        await db.execute("ALTER TABLE clips ADD COLUMN current_version_id TEXT")
      }

      if (!columns.includes('detection_session_id')) {
        console.log('[Frontend] Adding detection_session_id column to clips table...')
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

    console.log('[Frontend] Clip versioning tables ensured successfully')

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
    'INSERT INTO projects (id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, name, description || null, now, now]
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

export async function updateProject(id: string, name?: string, description?: string): Promise<void> {
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
  await db.execute('DELETE FROM projects WHERE id = ?', [id])
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
    console.log('[Database] Default prompt already exists, skipping seed')
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
    console.log('[Database] Default prompt seeded successfully')
  } catch (error) {
    console.error('[Database] Failed to seed default prompt:', error)
    throw error
  }
}

// Transcript queries
export async function createTranscript(
  projectId: string,
  rawJson: string,
  text: string,
  language?: string,
  duration?: number
): Promise<string> {
  const db = await getDatabase()
  const id = generateId()
  const now = timestamp()
  
  await db.execute(
    'INSERT INTO transcripts (id, project_id, raw_json, text, language, duration, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    [id, projectId, rawJson, text, language || null, duration || null, now, now]
  )
  
  return id
}

export async function getTranscriptByProjectId(projectId: string): Promise<Transcript | null> {
  const db = await getDatabase()
  const result = await db.select<Transcript[]>(
    'SELECT * FROM transcripts WHERE project_id = ?',
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

export async function updateRawVideo(id: string, updates: Partial<{ project_id: string | null }>): Promise<void> {
  const db = await getDatabase()
  const dbUpdates: string[] = []
  const values: any[] = []

  if (updates.project_id !== undefined) {
    dbUpdates.push('project_id = ?')
    values.push(updates.project_id)
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
  }
): Promise<string> {
  const db = await getDatabase()
  const id = generateId()
  const now = timestamp()

  await db.execute(
    `INSERT INTO clip_detection_sessions (
      id, project_id, prompt, detection_model, server_response_id,
      quality_score, total_clips_detected, processing_time_ms,
      validation_data, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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

  // Update the clip with the current version and session ID
  await db.execute(
    'UPDATE clips SET current_version_id = ?, detection_session_id = ? WHERE id = ?',
    [versionId, sessionId, clipId]
  )

  return clipId
}

export async function getClipsWithVersionsByProjectId(projectId: string): Promise<ClipWithVersion[]> {
  const db = await getDatabase()
  console.log('[Database] Querying clips with versions for project:', projectId)

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
      s.id as detection_session_id
     FROM clips c
     LEFT JOIN clip_versions cv ON c.current_version_id = cv.id
     LEFT JOIN clip_detection_sessions s ON c.detection_session_id = s.id
     WHERE c.project_id = ?
     ORDER BY c.created_at DESC`,
    [projectId]
  )

  console.log('[Database] Found clips:', clips.length)
  if (clips.length > 0) {
    console.log('[Database] Sample clip data:', {
      id: clips[0].id,
      name: clips[0].current_version_name || clips[0].name,
      hasCurrentVersion: !!clips[0].current_version_id,
      sessionId: clips[0].detection_session_id
    })
  }

  return clips.map(clip => ({
    ...clip,
    current_version: clip.current_version_id ? {
      id: clip.current_version_id,
      clip_id: clip.id,
      session_id: clip.detection_session_id || '',
      version_number: 1, // This would need a proper query to get the actual version number
      parent_version_id: null,
      name: clip.current_version_name || clip.name || '',
      description: clip.current_version_description,
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
  }))
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
  const db = await getDatabase()
  const startTime = Date.now()

  console.log('[Database] Starting persistClipDetectionResults for project:', projectId)
  console.log('[Database] Full detectionResults structure:', Object.keys(detectionResults))
  console.log('[Database] detectionResults.clips:', detectionResults.clips)
  console.log('[Database] detectionResults.clips type:', typeof detectionResults.clips)
  console.log('[Database] detectionResults.clips length:', detectionResults.clips?.length)
  console.log('[Database] Number of clips to persist:', detectionResults.clips?.length || 0)

  // Check for nested structure in clips property
  if (detectionResults.clips && typeof detectionResults.clips === 'object' && detectionResults.clips.clips) {
    console.log('[Database] FOUND NESTED CLIPS STRUCTURE - Using detectionResults.clips.clips')
    detectionResults.clips = detectionResults.clips.clips
  }

  // Double-check if clips might be in a different property
  if (!detectionResults.clips || detectionResults.clips.length === 0) {
    console.log('[Database] No clips found in expected location, searching all properties...')
    for (const key of Object.keys(detectionResults)) {
      const value = detectionResults[key]
      if (Array.isArray(value) && value.length > 0) {
        console.log(`[Database] Found array in property '${key}':`, value.length, 'items')
        console.log(`[Database] First item in '${key}':`, value[0])
        // Check if this looks like clips data
        if (value[0]?.id || value[0]?.title || value[0]?.segments) {
          console.log(`[Database] PROPERTY '${key}' LOOKS LIKE CLIPS - USING THIS INSTEAD`)
          detectionResults.clips = value
          break
        }
      }
    }
  }

  // Ensure clip versioning tables exist before proceeding
  await ensureClipVersioningTables()

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

  // Delete existing clips for this project (cascade will handle versions)
  await db.execute('DELETE FROM clips WHERE project_id = ?', [projectId])

  // Persist detected clips
  console.log('[Database] Starting to persist individual clips...')
  console.log('[Database] Final clips array length:', detectionResults.clips?.length)
  for (let i = 0; i < detectionResults.clips.length; i++) {
    const clipData = detectionResults.clips[i]
    console.log(`[Database] Processing clip ${i + 1}:`, clipData)

    // Extract clip information from the detected data
    const clipInfo = {
      name: clipData.name || clipData.title || `Clip ${i + 1}`,
      startTime: clipData.startTime || clipData.start_time || 0,
      endTime: clipData.endTime || clipData.end_time || 0,
      description: clipData.description || clipData.summary,
      confidenceScore: clipData.confidenceScore || clipData.confidence,
      relevanceScore: clipData.relevanceScore || clipData.relevance,
      detectionReason: clipData.reason || clipData.detectionReason,
      tags: clipData.tags || clipData.keywords || []
    }

    console.log(`[Database] Creating clip ${i + 1} with info:`, clipInfo)
    try {
      const clipId = await createVersionedClip(projectId, sessionId, clipInfo)
      console.log(`[Database] Successfully created clip ${i + 1} with ID:`, clipId)
    } catch (e) {
      console.error(`[Database] Failed to create clip ${i + 1}:`, e)
    }
  }

  console.log(`[Database] Persisted ${detectionResults.clips.length} clips for session ${sessionId}`)

  // Verify the clips were actually saved
  try {
    const savedClips = await getClipsWithVersionsByProjectId(projectId)
    console.log(`[Database] Verification: Found ${savedClips.length} clips in database after saving`)
    if (savedClips.length > 0) {
      console.log('[Database] Sample saved clip:', {
        id: savedClips[0].id,
        name: savedClips[0].current_version?.name || savedClips[0].name,
        session_id: savedClips[0].detection_session_id
      })
    }
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
