import { describe, expect, it } from 'vitest';
import { parseTranscriptToWords } from './timelineUtils';

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
