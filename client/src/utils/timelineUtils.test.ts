import { describe, expect, it } from 'vitest';
import { getSegmentPositionStyle, parseTranscriptToWords } from './timelineUtils';

describe('parseTranscriptToWords', () => {
  it('dedupes overlapping top-level and segment words with slightly different timings', () => {
    const words = parseTranscriptToWords(
      JSON.stringify({
        words: [
          { word: 'not', start: 10, end: 10.16 },
          { word: 'necessarily', start: 10.17, end: 10.62 },
          { word: 'successful', start: 10.63, end: 11 },
        ],
        segments: [
          {
            start: 9.95,
            end: 11.1,
            text: 'not necessarily successful',
            words: [
              { word: 'not', start: 10.03, end: 10.18 },
              { word: 'necessarily', start: 10.2, end: 10.66 },
              { word: 'successful', start: 10.68, end: 11.03 },
            ],
          },
        ],
      })
    );

    expect(words.map((w) => w.word)).toEqual(['not', 'necessarily', 'successful']);
  });

  it('keeps intentionally repeated words when their timing does not overlap', () => {
    const words = parseTranscriptToWords(
      JSON.stringify({
        words: [
          { word: 'no', start: 1, end: 1.1 },
          { word: 'no', start: 1.35, end: 1.45 },
          { word: 'way', start: 1.5, end: 1.7 },
        ],
      })
    );

    expect(words.map((w) => w.word)).toEqual(['no', 'no', 'way']);
  });
});

describe('source segment geometry', () => {
  it('places the detected VOD clip at its actual 35:32 source position', () => {
    const style = getSegmentPositionStyle({ start_time: 2132.82, end_time: 2156.64 }, 7910.25);
    expect(parseFloat(style.left)).toBeCloseTo(26.96, 2);
    expect(parseFloat(style.width)).toBeCloseTo(0.3011, 3);
  });
  it('cannot draw a stale 22-second range past an 8.41-second file', () => {
    expect(getSegmentPositionStyle({ start_time: 0, end_time: 22.12 }, 8.41)).toMatchObject({ left: '0%', width: '100%' });
    expect(getSegmentPositionStyle({ start_time: 1852.1, end_time: 1874.22 }, 8.41).display).toBe('none');
  });
});
