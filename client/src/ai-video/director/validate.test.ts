import { describe, expect, it } from 'vitest';
import type { MediaItem } from '../types';
import { documentDuration, validateDocument, type ValidationContext } from './validate';

const media: MediaItem[] = [
  { id: 'm1', name: 'drive.mp4', kind: 'video', path: 'C:/a.mp4', duration: 20, width: 1920, height: 1080, hasAudio: true, contentHash: 'h1' },
  { id: 'p1', name: 'car.jpg', kind: 'photo', path: 'C:/b.jpg', duration: 0, width: 1200, height: 800, hasAudio: false, contentHash: 'h2' },
  { id: 'a1', name: 'song.mp3', kind: 'audio', path: 'C:/c.mp3', duration: 30, width: 0, height: 0, hasAudio: true, contentHash: 'h3' },
];

const context: ValidationContext = { media, maxSeconds: 60, exampleShots: 10, files: ['compositions/title.html'], requireFiles: false };

const base = () => ({
  title: 'Night drive',
  format: { width: 1920, height: 1080, fps: 30 },
  music: { mediaId: 'a1', start: 2, volume: 0.8 },
  clipAudio: 0,
  shots: [
    { id: 's1', mediaId: 'm1', sourceIn: 1, duration: 2.51, speed: 1, move: 'push-in', transitionIn: 'flash', refShot: 0, description: 'Hood' },
    { id: 's2', mediaId: 'p1', sourceIn: 99, duration: 1.5, speed: 3, move: 'pan-left', transitionIn: 'dissolve', refShot: 1, description: 'Photo' },
  ],
  overlays: [
    { id: 't1', lane: 'text', start: 0.5, duration: 2, label: 'old', composition: 'compositions/title.html', variables: { text: 'BUILT FOR NIGHT' } },
  ],
});

describe('validateDocument', () => {
  it('normalises a valid document', () => {
    const { document, errors, warnings } = validateDocument(base(), context);
    expect(errors).toEqual([]);
    expect(warnings).toEqual([]);
    expect(document.shots[0].duration).toBe(2.5);
    expect(document.shots[0].transitionIn).toBe('cut');
    expect(document.shots[1]).toMatchObject({ sourceIn: 0, speed: 1, alternates: [] });
    expect(document.overlays[0].label).toBe('BUILT FOR NIGHT');
    expect(documentDuration(document)).toBe(4);
  });

  it('reports source overruns, bad ids, refShot and the length cap', () => {
    const input = base();
    input.shots[0].sourceIn = 19;
    input.shots[1].id = 's1';
    input.shots[1].refShot = 12;
    input.shots.push({ id: 's3', mediaId: 'm1', sourceIn: 0, duration: 59, speed: 0.25, move: 'none', transitionIn: 'cut', refShot: 2, description: '' });
    const { errors } = validateDocument(input, context);
    expect(errors.some((e) => e.includes('needs 2.5 s of source from 19 s'))).toBe(true);
    expect(errors.some((e) => e.includes('"s1" is used more than once'))).toBe(true);
    expect(errors.some((e) => e.includes('refShot must be an example shot index'))).toBe(true);
    expect(errors.some((e) => e.includes('the limit is 60 s'))).toBe(true);
  });

  it('checks overlays: text variable, lanes, overlap, files and bounds', () => {
    const input = base();
    input.overlays.push(
      { id: 't2', lane: 'text', start: 1, duration: 1, label: 'x', composition: 'compositions/title.html', variables: {} as never },
      { id: 'g1', lane: 'graphics', start: 3, duration: 5, label: 'Flash', composition: 'compositions/flash.html', variables: {} as never }
    );
    const result = validateDocument(input, context);
    expect(result.errors).toContain('overlays[1] (t2): text overlays need a non-empty "text" variable.');
    expect(result.errors).toContain('Overlays t1 and t2 overlap on the text lane.');
    expect(result.errors.some((e) => e.startsWith('overlays[2] (g1): ends at 8 s'))).toBe(true);
    expect(result.warnings).toContain("overlays[2] (g1): compositions/flash.html hasn't been written yet.");
    expect(validateDocument(input, { ...context, requireFiles: true }).errors).toContain(
      "overlays[2] (g1): compositions/flash.html doesn't exist."
    );
  });

  it('drops alternates that do not fit and rejects non-audio music', () => {
    const input = base() as ReturnType<typeof base> & { music: { mediaId: string } };
    (input.shots[0] as Record<string, unknown>).alternates = [
      { mediaId: 'm1', sourceIn: 18.5, description: 'too late' },
      { mediaId: 'p1', sourceIn: 0, description: 'photo ok' },
    ];
    input.music.mediaId = 'm1';
    const { document, errors, warnings } = validateDocument(input, context);
    expect(document.shots[0].alternates).toEqual([{ mediaId: 'p1', sourceIn: 0, description: 'photo ok' }]);
    expect(warnings).toContain("shots[0] (s1): dropped an alternate that doesn't fit the shot's length.");
    expect(errors).toContain("music.mediaId must be one of the user's songs.");
    expect(document.clipAudio).toBe(0);
  });
});
