type TimedItem = { start: number; end: number; words?: TimedItem[] };

/** Map source-based caption times onto the same concatenated timeline as the preview. */
export function mapFramingTranscript<T extends TimedItem>(
  items: T[],
  ranges: { start: number; end: number }[],
  sourceOffset: number
): T[] {
  let offset = 0;
  const result: T[] = [];
  for (const range of ranges) {
    for (const item of items) {
      const start = item.start + sourceOffset,
        end = item.end + sourceOffset;
      if (end <= range.start || start >= range.end) continue;
      result.push({
        ...item,
        start: Math.max(start, range.start) - range.start + offset,
        end: Math.min(end, range.end) - range.start + offset,
        ...(item.words
          ? {
              words: mapFramingTranscript(item.words, [range], sourceOffset).map((w) => ({
                ...w,
                start: w.start + offset,
                end: w.end + offset,
              })),
            }
          : {}),
      });
    }
    offset += range.end - range.start;
  }
  return result;
}
