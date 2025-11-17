import { getDatabase, timestamp, generateId } from './core';
import type { ClipDetectionSession } from './types';

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
  ];

  // Pick a random color from the predefined list
  return colors[Math.floor(Math.random() * colors.length)];
}

export async function createClipDetectionSession(
  projectId: string,
  prompt: string,
  options?: {
    detectionModel?: string;
    serverResponseId?: string;
    qualityScore?: number;
    totalClipsDetected?: number;
    processingTimeMs?: number;
    validationData?: any;
    runColor?: string;
  }
): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

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
      now,
    ]
  );

  return id;
}

export async function getClipDetectionSession(id: string): Promise<ClipDetectionSession | null> {
  const db = await getDatabase();
  const result = await db.select<ClipDetectionSession[]>(
    'SELECT * FROM clip_detection_sessions WHERE id = ?',
    [id]
  );
  return result[0] || null;
}

export async function getClipDetectionSessionsByProjectId(
  projectId: string
): Promise<ClipDetectionSession[]> {
  const db = await getDatabase();
  return await db.select<ClipDetectionSession[]>(
    'SELECT * FROM clip_detection_sessions WHERE project_id = ? ORDER BY created_at DESC',
    [projectId]
  );
}

export async function updateClipDetectionSession(
  id: string,
  updates: Partial<
    Omit<ClipDetectionSession, 'id' | 'project_id' | 'prompt' | 'detection_model' | 'created_at'>
  >
): Promise<void> {
  const db = await getDatabase();

  const updateFields: string[] = [];
  const values: any[] = [];

  for (const [key, value] of Object.entries(updates)) {
    updateFields.push(`${key} = ?`);
    values.push(value);
  }

  if (updateFields.length === 0) return;

  await db.execute(`UPDATE clip_detection_sessions SET ${updateFields.join(', ')} WHERE id = ?`, [
    ...values,
    id,
  ]);
}

export async function deleteClipDetectionSession(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM clip_detection_sessions WHERE id = ?', [id]);
}
