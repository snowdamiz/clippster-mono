import type { MobileEditProjectV3 } from '../model/schema';
import { migrateMobileEditProject } from '../model/migrations';
import {
  DEFAULT_EDITOR_SESSION,
  sanitizeEditorSession,
  type EditorSessionState,
} from '../model/session';
import { parseMobileEditProject } from '../model/validation';

export interface DraftStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export interface DraftEnvelope {
  schemaVersion: 3;
  revision: number;
  savedAt: number;
  sourceFingerprints: Record<string, string>;
  document: MobileEditProjectV3;
  session: EditorSessionState;
}

export interface LoadedDraft {
  document: MobileEditProjectV3;
  revision: number;
  recovered: boolean;
  source: 'current' | 'pending' | 'last-known-good' | 'legacy';
  session: EditorSessionState;
}

export interface DraftRepositoryClock {
  now(): number;
}

export class DraftLoadError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'DraftLoadError';
  }
}

const systemClock: DraftRepositoryClock = { now: () => Date.now() };

function keyRoot(kind: 'project' | 'clip', targetId: string): string {
  return `clippster.mobileEdit.v3.${kind}.${targetId}`;
}

function parseEnvelope(raw: string | null): DraftEnvelope | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<DraftEnvelope>;
    if (
      value.schemaVersion !== 3 ||
      !Number.isSafeInteger(value.revision) ||
      (value.revision ?? 0) < 1 ||
      !Number.isFinite(value.savedAt) ||
      !value.sourceFingerprints ||
      typeof value.sourceFingerprints !== 'object'
    ) {
      return null;
    }
    const document = parseMobileEditProject(value.document);
    return {
      schemaVersion: 3,
      revision: value.revision!,
      savedAt: value.savedAt!,
      sourceFingerprints: value.sourceFingerprints,
      document,
      session: sanitizeEditorSession(document, value.session),
    };
  } catch {
    return null;
  }
}

function fingerprints(document: MobileEditProjectV3): Record<string, string> {
  return Object.fromEntries(
    Object.values(document.assets).map((asset) => [asset.id, asset.sourceFingerprint]),
  );
}

export class LocalDraftRepository {
  constructor(
    private readonly storage: DraftStorage,
    private readonly clock: DraftRepositoryClock = systemClock,
  ) {}

  async load(kind: 'project' | 'clip', targetId: string): Promise<LoadedDraft | null> {
    const root = keyRoot(kind, targetId);
    const legacyKey = `clippster.editDoc.v1.${kind}.${targetId}`;
    const [currentRaw, pendingRaw, backupRaw, legacyRaw] = await Promise.all([
      this.storage.getItem(`${root}.current`),
      this.storage.getItem(`${root}.pending`),
      this.storage.getItem(`${root}.last-known-good`),
      this.storage.getItem(legacyKey),
    ]);
    const candidates = [
      { envelope: parseEnvelope(currentRaw), source: 'current' as const, recovered: false },
      { envelope: parseEnvelope(pendingRaw), source: 'pending' as const, recovered: true },
      { envelope: parseEnvelope(backupRaw), source: 'last-known-good' as const, recovered: true },
    ]
      .filter((candidate): candidate is typeof candidate & { envelope: DraftEnvelope } =>
        Boolean(candidate.envelope),
      )
      .sort((a, b) => b.envelope.revision - a.envelope.revision);
    const newest = candidates[0];
    if (!newest) {
      if (legacyRaw) {
        try {
          const legacy = await this.loadLegacy(legacyRaw);
          const saved = await this.save(legacy.document);
          await this.storage.removeItem(legacyKey);
          return { ...legacy, revision: saved.revision };
        } catch (error) {
          throw new DraftLoadError('The saved edit is invalid and could not be recovered', error);
        }
      }
      if (currentRaw || pendingRaw || backupRaw) {
        throw new DraftLoadError('No valid revision of the saved edit could be recovered');
      }
      return null;
    }
    return {
      document: newest.envelope.document,
      revision: newest.envelope.revision,
      source: newest.source,
      recovered: newest.recovered,
      session: newest.envelope.session,
    };
  }

  async loadLegacy(raw: string): Promise<LoadedDraft> {
    return {
      document: migrateMobileEditProject(JSON.parse(raw), { now: this.clock.now() }),
      revision: 0,
      recovered: true,
      source: 'legacy',
      session: DEFAULT_EDITOR_SESSION,
    };
  }

  async save(
    document: MobileEditProjectV3,
    previousRevision = 0,
    session: EditorSessionState = DEFAULT_EDITOR_SESSION,
  ): Promise<DraftEnvelope> {
    const validated = parseMobileEditProject(document);
    const root = keyRoot(validated.kind, validated.targetId);
    const currentRaw = await this.storage.getItem(`${root}.current`);
    const current = parseEnvelope(currentRaw);
    const revision = Math.max(previousRevision, current?.revision ?? 0) + 1;
    const envelope: DraftEnvelope = {
      schemaVersion: 3,
      revision,
      savedAt: this.clock.now(),
      sourceFingerprints: fingerprints(validated),
      document: validated,
      session: sanitizeEditorSession(validated, session),
    };
    const serialized = JSON.stringify(envelope);

    await this.storage.setItem(`${root}.pending`, serialized);
    const verified = parseEnvelope(await this.storage.getItem(`${root}.pending`));
    if (!verified || verified.revision !== revision) {
      throw new Error('Could not verify pending editor draft');
    }
    if (currentRaw && current) {
      await this.storage.setItem(`${root}.last-known-good`, currentRaw);
    }
    await this.storage.setItem(`${root}.current`, serialized);
    await this.storage.removeItem(`${root}.pending`);
    return envelope;
  }

  async delete(kind: 'project' | 'clip', targetId: string): Promise<void> {
    const root = keyRoot(kind, targetId);
    await Promise.all([
      this.storage.removeItem(`${root}.current`),
      this.storage.removeItem(`${root}.pending`),
      this.storage.removeItem(`${root}.last-known-good`),
    ]);
  }
}
