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
      console.log('[Frontend] Attempting to load sqlite:clippster.db')

      const instance = await Database.load('sqlite:clippster.db')
      console.log('[Frontend] Database loaded successfully')
      db = instance
      return instance
    } catch (error) {
      console.error('[Frontend] Database load error:', error)
      console.error('[Frontend] Error details:', JSON.stringify(error, null, 2))
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
  raw_video_path: string | null
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

// Helper to generate timestamps
export function timestamp(): number {
  return Math.floor(Date.now() / 1000)
}

// Helper to generate UUIDs (simple version)
export function generateId(): string {
  return crypto.randomUUID()
}

// Project queries
export async function createProject(name: string, description?: string, rawVideoPath?: string): Promise<string> {
  const db = await getDatabase()
  const id = generateId()
  const now = timestamp()
  
  await db.execute(
    'INSERT INTO projects (id, name, description, raw_video_path, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, name, description || null, rawVideoPath || null, now, now]
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

export async function updateProject(id: string, name?: string, description?: string, rawVideoPath?: string): Promise<void> {
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
  if (rawVideoPath !== undefined) {
    updates.push('raw_video_path = ?')
    values.push(rawVideoPath)
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
