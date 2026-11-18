import type { EditDocument, SpeechSegment } from '@/ai-video/types';
import type { CreatorSkillFormat, WordInfo } from '@clippster/shared-types';

function timestamp(seconds: number): string {
  const millis = Math.max(0, Math.round(seconds * 1000));
  const hours = Math.floor(millis / 3_600_000);
  const minutes = Math.floor(millis / 60_000) % 60;
  const secs = Math.floor(millis / 1000) % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')},${String(millis % 1000).padStart(3, '0')}`;
}

/** Mask common explicit words in on-screen text while retaining the original spoken audio. */
export function maskCaptionProfanity(text: string): string {
  return text.replace(/\b(?:motherfucker|assholes?|fuck(?:ing|ed|er|s)?|shit(?:ty|s)?|bitch(?:es)?)\b/gi,
    word => `${word[0]}${'*'.repeat(Math.max(2, word.length - 1))}`);
}

export interface CreatorSkillCaptionWord { start: number; end: number; text: string }

/** One cue-break policy for the final SRT and the burned vertical overlay. */
export function groupCreatorSkillCaptionWords(words: CreatorSkillCaptionWord[], format: CreatorSkillFormat): CreatorSkillCaptionWord[][] {
  const cues: CreatorSkillCaptionWord[][] = [];
  const maxWords = format === '9:16' ? 3 : 10;
  const maxChars = format === '9:16' ? 32 : 72;
  const valid = words.filter(word => Number.isFinite(word.start) && Number.isFinite(word.end) && word.end > word.start && word.text.trim())
    .map(word => ({ ...word, text: maskCaptionProfanity(word.text.replace(/\s+/g, ' ').trim()) }))
    .sort((a, b) => a.start - b.start);
  for (const word of valid) {
    const current = cues[cues.length - 1];
    if (!current || current.length >= maxWords || word.start - Math.max(...current.map(item => item.end)) > .65 || word.end - current[0].start > 3 || [...current, word].map(item => item.text).join(' ').length > maxChars)
      cues.push([word]);
    else current.push(word);
  }
  return cues;
}

/** Captions timed from the rendered audio's own word-level transcription. */
export function creatorSkillFinalSrt(words: WordInfo[], format: CreatorSkillFormat): string {
  const cues = groupCreatorSkillCaptionWords(words.map(word => ({ start: word.start, end: word.end, text: word.word })), format);
  return cues.map((cue, index) => {
    const split = format === '16:9' && cue.length > 5 ? Math.ceil(cue.length / 2) : cue.length;
    const lines = [cue.slice(0, split).map(word => word.text).join(' '), cue.slice(split).map(word => word.text).join(' ')].filter(Boolean);
    return `${index + 1}\n${timestamp(cue[0].start)} --> ${timestamp(Math.max(...cue.map(word => word.end)))}\n${lines.join('\n')}\n`;
  }).join('\n');
}

/** Map source speech onto footage shots. Partial transcript chunks at edit cuts are omitted for review. */
export function draftCreatorSkillSrt(
  document: EditDocument,
  sourceMediaId: string,
  speech: SpeechSegment[],
): { content: string; omitted: number } {
  const cues: Array<{ start: number; end: number; text: string }> = [];
  let offset = 0;
  let omitted = 0;
  for (const shot of document.shots) {
    if (shot.mediaId === sourceMediaId && !shot.scene && shot.speed > 0) {
      const sourceEnd = shot.sourceIn + shot.duration * shot.speed;
      for (const segment of speech) {
        if (segment.end <= shot.sourceIn || segment.start >= sourceEnd) continue;
        if (segment.start < shot.sourceIn - 0.001 || segment.end > sourceEnd + 0.001) {
          omitted++;
          continue;
        }
        cues.push({
          start: offset + (segment.start - shot.sourceIn) / shot.speed,
          end: offset + (segment.end - shot.sourceIn) / shot.speed,
          text: maskCaptionProfanity(segment.text.replace(/\s+/g, ' ').trim()),
        });
      }
    }
    offset += shot.duration;
  }
  cues.sort((a, b) => a.start - b.start);
  return {
    content: cues.map((cue, index) => `${index + 1}\n${timestamp(cue.start)} --> ${timestamp(cue.end)}\n${cue.text}\n`).join('\n'),
    omitted,
  };
}
