import { getDatabase, timestamp, generateId } from './core';
import type { Prompt } from './types';

// Prompt queries
export async function createPrompt(name: string, content: string): Promise<string> {
  const db = await getDatabase();
  const id = generateId();
  const now = timestamp();

  await db.execute(
    'INSERT INTO prompts (id, name, content, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
    [id, name, content, now, now]
  );

  return id;
}

export async function getPrompt(id: string): Promise<Prompt | null> {
  const db = await getDatabase();
  const result = await db.select<Prompt[]>('SELECT * FROM prompts WHERE id = ?', [id]);
  return result[0] || null;
}

export async function getAllPrompts(): Promise<Prompt[]> {
  const db = await getDatabase();
  return await db.select<Prompt[]>('SELECT * FROM prompts ORDER BY name');
}

export async function updatePrompt(id: string, name?: string, content?: string): Promise<void> {
  const db = await getDatabase();
  const now = timestamp();

  const updates: string[] = [];
  const values: any[] = [];

  if (name !== undefined) {
    updates.push('name = ?');
    values.push(name);
  }
  if (content !== undefined) {
    updates.push('content = ?');
    values.push(content);
  }

  updates.push('updated_at = ?');
  values.push(now);
  values.push(id);

  await db.execute(`UPDATE prompts SET ${updates.join(', ')} WHERE id = ?`, values);
}

export async function deletePrompt(id: string): Promise<void> {
  const db = await getDatabase();
  await db.execute('DELETE FROM prompts WHERE id = ?', [id]);
}

// Seed default prompt
export async function seedDefaultPrompt(): Promise<void> {
  const db = await getDatabase();

  // Check if the default prompt already exists
  const existing = await db.select<Prompt[]>('SELECT * FROM prompts WHERE name = ?', [
    'Default Clip Detector',
  ]);

  if (existing.length > 0) {
    return;
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
- Strong emotions or shifts; humor/awkwardness; drama/tension/conflict; surprises/reveals; bold claims; unusual behavior; struggle/vulnerability; high energy; relatable/resonant lines; quotable statements; notable reactions or audience moments.`;

  try {
    await createPrompt('Default Clip Detector', defaultPromptContent);
  } catch (error) {
    throw error;
  }
}
