import { describe, it, expect } from 'vitest';
import type { AiBrollSuggestion } from '@/types/ai-broll';

/** Client-side mirror of server normalization checks for suggestion shape */
function isValidSuggestion(s: AiBrollSuggestion): boolean {
  return (
    s.visualQuery.trim().length > 0 &&
    s.endTime > s.startTime &&
    s.endTime - s.startTime <= 8
  );
}

describe('AiBrollSuggestion validation', () => {
  it('accepts well-formed suggestions', () => {
    const s: AiBrollSuggestion = {
      id: '1',
      clipId: 'clip-1',
      startTime: 5,
      endTime: 8,
      transcriptText: 'hello world',
      reason: 'visual interest',
      visualQuery: 'sunrise city',
      sourceType: 'stock',
      status: 'suggested',
      confidence: 0.8,
      candidates: [],
    };
    expect(isValidSuggestion(s)).toBe(true);
  });

  it('rejects empty visual query', () => {
    const s: AiBrollSuggestion = {
      id: '1',
      clipId: 'clip-1',
      startTime: 5,
      endTime: 8,
      transcriptText: '',
      reason: '',
      visualQuery: '   ',
      sourceType: 'stock',
      status: 'suggested',
      confidence: 0.5,
      candidates: [],
    };
    expect(isValidSuggestion(s)).toBe(false);
  });
});
