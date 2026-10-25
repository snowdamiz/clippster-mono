/** Sources picked in the New project dialog, handed to the session page that opens the project next. */
import type { MediaFile } from './analysis/media';
import type { ExampleInput } from './analysis/reference';

export interface StartingSources {
  files: MediaFile[];
  example: ExampleInput | null;
}

const pending = new Map<number, StartingSources>();

export function stashStartingSources(sessionId: number, sources: StartingSources) {
  pending.set(sessionId, sources);
}

export function takeStartingSources(sessionId: number): StartingSources | null {
  const sources = pending.get(sessionId) ?? null;
  pending.delete(sessionId);
  return sources;
}
