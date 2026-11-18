import { describe, expect, it } from 'vitest';
import type { EditDocument, EditShot } from '@/ai-video/types';
import { assertCreatorSkillSpeechPreserved, auditCreatorSkillSourceAudio, auditCreatorSkillWordCoverage } from './creatorSkillQa';

function shot(sourceIn: number, duration: number, speed = 1): EditShot {
  return {
    id: `shot-${sourceIn}`, mediaId: 'source', scene: null, sourceIn, duration, speed,
    move: 'none', transitionIn: 'cut', refShot: null, description: '', alternates: [],
  };
}

function document(shots: EditShot[], clipAudio = 1): EditDocument {
  return { title: 'test', format: { width: 1080, height: 1920, fps: 30 }, music: null, clipAudio, shots, overlays: [] };
}

describe('creator skill source audio audit', () => {
  it('does not flag a continuous, normal-speed source edit', () => {
    expect(auditCreatorSkillSourceAudio(document([shot(0, 4), shot(4, 6)]), 'source', 10, true)).toEqual([]);
  });

  it('flags skipped and reordered source audio without claiming a transcript diff', () => {
    const issues = auditCreatorSkillSourceAudio(document([shot(0, 3), shot(5, 2), shot(2, 2)]), 'source', 10, true);
    expect(issues).toEqual(expect.arrayContaining([
      expect.stringContaining('skips source audio'),
      expect.stringContaining('reorders source footage'),
    ]));
  });

  it('flags muted and sped-up speech', () => {
    const issues = auditCreatorSkillSourceAudio(document([shot(0, 5, 2)], 0), 'source', 10, true);
    expect(issues).toEqual(expect.arrayContaining([
      expect.stringContaining('muted'),
      expect.stringContaining('playback speed'),
    ]));
  });
});

describe('creator skill word coverage', () => {
  const words = [
    { start: 1, end: 1.4, text: 'first', speakerId: null },
    { start: 4, end: 4.4, text: 'second', speakerId: null },
  ];

  it('accepts words retained across adjacent source shots', () => {
    expect(auditCreatorSkillWordCoverage(document([shot(0, 2), shot(2, 4)]), 'source', words)).toEqual([]);
  });

  it('identifies a word skipped by a proposed edit', () => {
    const issues = auditCreatorSkillWordCoverage(document([shot(0, 2), shot(5, 1)]), 'source', words);
    expect(issues[0]).toContain('second');
    expect(issues[0]).toContain('4.00s');
  });

  it('does not let repeated footage hide a cut word', () => {
    const issues = auditCreatorSkillWordCoverage(document([shot(0, 1.1), shot(0, 1.1)]), 'source', words);
    expect(issues[0]).toContain('first');
  });

  it('requires manual review when there are no word timestamps', () => {
    expect(auditCreatorSkillWordCoverage(document([shot(0, 6)]), 'source', [])).toEqual([expect.stringContaining('unavailable')]);
  });

  it('rejects measured lost words or audible removed source while allowing unknown timing to remain a review item', () => {
    expect(() => assertCreatorSkillSpeechPreserved(auditCreatorSkillWordCoverage(document([shot(0, 2), shot(5, 1)]), 'source', words), [])).toThrow('Raw remains available');
    expect(() => assertCreatorSkillSpeechPreserved([], ['1 removed source range contains audio above -50 dB: 2.00-3.00s. Restore speech.'])).toThrow('speech preservation');
    expect(() => assertCreatorSkillSpeechPreserved([], [], auditCreatorSkillSourceAudio(document([shot(0, 6)], 0), 'source', 6, true))).toThrow('Source audio is muted');
    expect(() => assertCreatorSkillSpeechPreserved([], [], auditCreatorSkillSourceAudio(document([]), 'source', 6, true))).toThrow('no footage');
    expect(() => assertCreatorSkillSpeechPreserved(['The edited timeline may cut 1 transcribed word.'], [], [], false)).not.toThrow();
    expect(() => assertCreatorSkillSpeechPreserved([], [], ['Source audio is muted in the edited timeline.'], false)).toThrow('Source audio is muted');
    expect(() => assertCreatorSkillSpeechPreserved(auditCreatorSkillWordCoverage(document([shot(0, 6)]), 'source', []), [])).not.toThrow();
  });
});
