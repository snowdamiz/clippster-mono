import type { CreatorSkillClipEdit } from '@clippster/shared-types';
import { getCurrentUserId, getDatabase, timestamp } from './core';

let tableReady: Promise<void> | null = null;

async function table() {
  const db = await getDatabase();
  tableReady ??= (async () => {
    await db.execute(`CREATE TABLE IF NOT EXISTS creator_skill_edits (
    clip_id TEXT PRIMARY KEY REFERENCES clips(id) ON DELETE CASCADE,
    detection_session_id TEXT NOT NULL,
    ai_session_id INTEGER,
    prepaid_job_id INTEGER,
    playbook_package TEXT,
    creator_profile TEXT,
    thumbnail_candidates TEXT,
    thumbnail_variants TEXT,
    status TEXT NOT NULL,
    selected_version TEXT NOT NULL DEFAULT 'raw',
    raw_source TEXT NOT NULL,
    raw_clip_md5 TEXT,
    source_captures TEXT,
    claim_evidence TEXT,
    edited TEXT,
    sources TEXT NOT NULL DEFAULT '[]',
    review_items TEXT NOT NULL DEFAULT '[]',
    updated_at INTEGER NOT NULL
  )`);
    const columns = await db.select<Array<{ name: string }>>('PRAGMA table_info(creator_skill_edits)');
    if (!columns.some((column) => column.name === 'ai_session_id')) {
      await db.execute('ALTER TABLE creator_skill_edits ADD COLUMN ai_session_id INTEGER');
    }
    if (!columns.some((column) => column.name === 'prepaid_job_id')) {
      await db.execute('ALTER TABLE creator_skill_edits ADD COLUMN prepaid_job_id INTEGER');
    }
    if (columns.some((column) => column.name === 'approved_credit_cost')) {
      await db.execute('ALTER TABLE creator_skill_edits DROP COLUMN approved_credit_cost');
    }
    if (!columns.some((column) => column.name === 'playbook_package')) {
      await db.execute('ALTER TABLE creator_skill_edits ADD COLUMN playbook_package TEXT');
    }
    if (!columns.some((column) => column.name === 'creator_profile')) {
      await db.execute('ALTER TABLE creator_skill_edits ADD COLUMN creator_profile TEXT');
    }
    if (!columns.some((column) => column.name === 'thumbnail_candidates')) {
      await db.execute('ALTER TABLE creator_skill_edits ADD COLUMN thumbnail_candidates TEXT');
    }
    if (!columns.some((column) => column.name === 'thumbnail_variants')) {
      await db.execute('ALTER TABLE creator_skill_edits ADD COLUMN thumbnail_variants TEXT');
    }
    if (!columns.some((column) => column.name === 'raw_clip_md5')) {
      await db.execute('ALTER TABLE creator_skill_edits ADD COLUMN raw_clip_md5 TEXT');
    }
    if (!columns.some((column) => column.name === 'source_captures')) {
      await db.execute('ALTER TABLE creator_skill_edits ADD COLUMN source_captures TEXT');
    }
    if (!columns.some((column) => column.name === 'claim_evidence')) {
      await db.execute('ALTER TABLE creator_skill_edits ADD COLUMN claim_evidence TEXT');
    }
    await db.execute('CREATE INDEX IF NOT EXISTS idx_creator_skill_edits_session ON creator_skill_edits(detection_session_id)');
  })();
  try { await tableReady; } catch (error) { tableReady = null; throw error; }
  return db;
}

type Row = {
  clip_id: string;
  detection_session_id: string;
  ai_session_id: number | null;
  prepaid_job_id: number | null;
  playbook_package: string | null;
  creator_profile: string | null;
  thumbnail_candidates: string | null;
  thumbnail_variants: string | null;
  status: CreatorSkillClipEdit['status'];
  selected_version: CreatorSkillClipEdit['selectedVersion'];
  raw_source: string;
  raw_clip_md5: string | null;
  source_captures: string | null;
  claim_evidence: string | null;
  edited: string | null;
  sources: string;
  review_items: string;
};

function decode(row: Row): CreatorSkillClipEdit {
  return {
    clipId: row.clip_id,
    detectionSessionId: row.detection_session_id,
    aiSessionId: row.ai_session_id ?? undefined,
    prepaidJobId: row.prepaid_job_id ?? undefined,
    playbookPackage: row.playbook_package ? JSON.parse(row.playbook_package) : undefined,
    creatorProfile: row.creator_profile ? JSON.parse(row.creator_profile) : undefined,
    thumbnailCandidates: row.thumbnail_candidates ? JSON.parse(row.thumbnail_candidates) : undefined,
    thumbnailVariants: row.thumbnail_variants ? JSON.parse(row.thumbnail_variants) : undefined,
    status: row.status,
    selectedVersion: row.selected_version,
    rawSource: JSON.parse(row.raw_source),
    rawClipMd5: row.raw_clip_md5 ?? undefined,
    sourceCaptures: row.source_captures ? JSON.parse(row.source_captures) : undefined,
    claimEvidence: row.claim_evidence ? JSON.parse(row.claim_evidence) : undefined,
    edited: row.edited ? JSON.parse(row.edited) : undefined,
    sources: JSON.parse(row.sources),
    reviewItems: JSON.parse(row.review_items),
  };
}

export async function saveCreatorSkillEdit(edit: CreatorSkillClipEdit): Promise<void> {
  const db = await table();
  await db.execute(`INSERT INTO creator_skill_edits
    (clip_id, detection_session_id, ai_session_id, prepaid_job_id, playbook_package, creator_profile, thumbnail_candidates, thumbnail_variants, status, selected_version, raw_source, raw_clip_md5, source_captures, claim_evidence, edited, sources, review_items, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(clip_id) DO UPDATE SET
      ai_session_id = excluded.ai_session_id,
      prepaid_job_id = excluded.prepaid_job_id,
      playbook_package = excluded.playbook_package,
      creator_profile = excluded.creator_profile,
      thumbnail_candidates = excluded.thumbnail_candidates,
      thumbnail_variants = excluded.thumbnail_variants,
      status = excluded.status,
      raw_source = excluded.raw_source,
      raw_clip_md5 = excluded.raw_clip_md5,
      source_captures = excluded.source_captures,
      claim_evidence = excluded.claim_evidence,
      edited = excluded.edited,
      sources = excluded.sources,
      review_items = excluded.review_items,
      updated_at = excluded.updated_at`, [
    edit.clipId, edit.detectionSessionId, edit.aiSessionId ?? null, edit.prepaidJobId ?? null,
    edit.playbookPackage ? JSON.stringify(edit.playbookPackage) : null,
    edit.creatorProfile ? JSON.stringify(edit.creatorProfile) : null,
    edit.thumbnailCandidates ? JSON.stringify(edit.thumbnailCandidates) : null,
    edit.thumbnailVariants ? JSON.stringify(edit.thumbnailVariants) : null,
    edit.status, edit.selectedVersion,
    JSON.stringify(edit.rawSource), edit.rawClipMd5 ?? null, edit.sourceCaptures ? JSON.stringify(edit.sourceCaptures) : null, edit.claimEvidence ? JSON.stringify(edit.claimEvidence) : null, edit.edited ? JSON.stringify(edit.edited) : null,
    JSON.stringify(edit.sources), JSON.stringify(edit.reviewItems), timestamp(),
  ]);
}

export async function getCreatorSkillEdit(clipId: string): Promise<CreatorSkillClipEdit | null> {
  const rows = await (await table()).select<Row[]>('SELECT * FROM creator_skill_edits WHERE clip_id = ?', [clipId]);
  return rows[0] ? decode(rows[0]) : null;
}

export async function getCreatorSkillEditsForSession(sessionId: string): Promise<CreatorSkillClipEdit[]> {
  const rows = await (await table()).select<Row[]>('SELECT * FROM creator_skill_edits WHERE detection_session_id = ?', [sessionId]);
  return rows.map(decode);
}

export async function getInterruptedCreatorSkillEdits(): Promise<CreatorSkillClipEdit[]> {
  const userId = getCurrentUserId();
  const rows = await (await table()).select<Row[]>(
    `SELECT e.* FROM creator_skill_edits e
     JOIN clips c ON c.id = e.clip_id
     JOIN projects p ON p.id = c.project_id
     WHERE e.status IN ('queued', 'editing', 'rendering')
       AND (p.user_id = ? OR p.user_id IS NULL)
     ORDER BY e.updated_at ASC`,
    [userId]
  );
  return rows.map(decode);
}

export async function selectCreatorSkillVersion(clipId: string, version: CreatorSkillClipEdit['selectedVersion']): Promise<void> {
  const db = await table();
  const edit = await getCreatorSkillEdit(clipId);
  if (!edit) throw new Error('This clip has no Clippster Skill edit.');
  if (version === 'edited' && !edit.edited?.path) throw new Error('The edited clip is not ready.');
  await db.execute('UPDATE creator_skill_edits SET selected_version = ?, updated_at = ? WHERE clip_id = ?', [version, timestamp(), clipId]);
}
