import Database from '@tauri-apps/plugin-sql'

let db: Database | null = null

// Initialize database connection
export async function initDatabase() {
  if (!db) {
    db = await Database.load('sqlite:clippster.db')
  }
  return db
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

// Helper to generate timestamps
export function timestamp(): number {
  return Math.floor(Date.now() / 1000)
}

// Helper to generate UUIDs (simple version)
export function generateId(): string {
  return crypto.randomUUID()
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
