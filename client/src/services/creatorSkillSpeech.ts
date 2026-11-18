import type { SpeechSegment } from '@/ai-video/types';

type TimedText = { start: number; end: number; text: string; speakerId: string | null };

function timedText(value: unknown): TimedText | null {
  if (!value || typeof value !== 'object') return null;
  const row = value as Record<string, unknown>;
  const start = Number(row.start ?? row.start_time);
  const end = Number(row.end ?? row.end_time);
  const text = typeof row.word === 'string' ? row.word : typeof row.text === 'string' ? row.text : '';
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || !text.trim()) return null;
  const speaker = row.speaker_id ?? row.speaker;
  return { start, end, text: text.trim(), speakerId: speaker == null ? null : String(speaker) };
}

/** Rebase detected words onto the concatenated source clip. Empty means word timing was unavailable. */
export function wordSpeechForCreatorSkillClip(
  rawJson: string,
  ranges: Array<{ start: number; end: number }>,
): SpeechSegment[] {
  return rebaseCreatorSkillSpeech(rawJson, ranges, true);
}

/** Rebase existing detection speech onto the concatenated source clip. */
export function speechForCreatorSkillClip(
  rawJson: string,
  ranges: Array<{ start: number; end: number }>,
): SpeechSegment[] {
  return rebaseCreatorSkillSpeech(rawJson, ranges, false);
}

function rebaseCreatorSkillSpeech(
  rawJson: string,
  ranges: Array<{ start: number; end: number }>,
  wordOnly: boolean,
): SpeechSegment[] {
  let transcript: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(rawJson);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];
    transcript = parsed as Record<string, unknown>;
  } catch { return []; }

  const segments = Array.isArray(transcript.segments) ? transcript.segments : [];
  const words = Array.isArray(transcript.words) && transcript.words.length
    ? transcript.words
    : segments.flatMap((segment: unknown) => {
        if (!segment || typeof segment !== 'object') return [];
        const row = segment as Record<string, unknown>;
        return Array.isArray(row.words) ? row.words : [];
      });
  if (wordOnly && !words.length) return [];
  const timed = (words.length ? words : segments)
    .map(timedText).filter((item): item is TimedText => item !== null)
    .sort((a, b) => a.start - b.start);
  const result: SpeechSegment[] = [];
  let offset = 0;
  for (const range of ranges) {
    if (!(range.end > range.start)) continue;
    const rangeResultStart = result.length;
    for (const item of timed) {
      if (item.end <= range.start || item.start >= range.end) continue;
      const start = offset + Math.max(0, item.start - range.start);
      const end = offset + Math.min(range.end - range.start, item.end - range.start);
      const previous = result[result.length - 1];
      if (!wordOnly && words.length && result.length > rangeResultStart && previous && previous.speakerId === item.speakerId &&
          start - previous.end < 0.7 && end - previous.start <= 4) {
        previous.end = Math.max(previous.end, end);
        previous.text += ` ${item.text}`;
      } else {
        result.push({ start, end, text: item.text, speakerId: item.speakerId });
      }
    }
    offset += range.end - range.start;
  }
  return result;
}
