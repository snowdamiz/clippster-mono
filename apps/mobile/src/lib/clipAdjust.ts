export const CLIP_ADJUST_CONTEXT_SECONDS = 15;
export const CLIP_ADJUST_MIN_DURATION = 0.5;

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function initialAdjustWindow(input: {
  selectStart: number;
  selectEnd: number;
  mediaDuration: number;
  contextSeconds?: number;
}): { bufferStart: number; bufferEnd: number; selectStart: number; selectEnd: number } {
  const context = input.contextSeconds ?? CLIP_ADJUST_CONTEXT_SECONDS;
  const mediaDuration = Math.max(0, input.mediaDuration);
  const selectStart = clamp(input.selectStart, 0, mediaDuration);
  const selectEnd = clamp(
    Math.max(selectStart + CLIP_ADJUST_MIN_DURATION, input.selectEnd),
    selectStart + CLIP_ADJUST_MIN_DURATION,
    Math.max(selectStart + CLIP_ADJUST_MIN_DURATION, mediaDuration),
  );
  return {
    selectStart,
    selectEnd,
    bufferStart: Math.max(0, selectStart - context),
    bufferEnd: Math.min(mediaDuration, selectEnd + context),
  };
}

export function extendBuffer(
  edge: 'start' | 'end',
  bufferStart: number,
  bufferEnd: number,
  mediaDuration: number,
  contextSeconds = CLIP_ADJUST_CONTEXT_SECONDS,
): { bufferStart: number; bufferEnd: number; extended: boolean } {
  if (edge === 'start') {
    if (bufferStart <= 0) return { bufferStart, bufferEnd, extended: false };
    const next = Math.max(0, bufferStart - contextSeconds);
    return { bufferStart: next, bufferEnd, extended: next < bufferStart };
  }
  if (bufferEnd >= mediaDuration) return { bufferStart, bufferEnd, extended: false };
  const next = Math.min(mediaDuration, bufferEnd + contextSeconds);
  return { bufferStart, bufferEnd: next, extended: next > bufferEnd };
}

export function canExtendBuffer(
  edge: 'start' | 'end',
  bufferStart: number,
  bufferEnd: number,
  mediaDuration: number,
): boolean {
  if (edge === 'start') return bufferStart > 0.05;
  return bufferEnd < mediaDuration - 0.05;
}

export function trimSelection(input: {
  edge: 'start' | 'end';
  deltaSeconds: number;
  selectStart: number;
  selectEnd: number;
  bufferStart: number;
  bufferEnd: number;
}): { selectStart: number; selectEnd: number } {
  const { edge, deltaSeconds, bufferStart, bufferEnd } = input;
  let selectStart = input.selectStart;
  let selectEnd = input.selectEnd;

  if (edge === 'start') {
    selectStart = clamp(
      selectStart + deltaSeconds,
      bufferStart,
      selectEnd - CLIP_ADJUST_MIN_DURATION,
    );
  } else {
    selectEnd = clamp(
      selectEnd + deltaSeconds,
      selectStart + CLIP_ADJUST_MIN_DURATION,
      bufferEnd,
    );
  }

  return { selectStart, selectEnd };
}

export function selectionIsDirty(
  selectStart: number,
  selectEnd: number,
  originalStart: number,
  originalEnd: number,
  epsilon = 0.05,
): boolean {
  return (
    Math.abs(selectStart - originalStart) > epsilon || Math.abs(selectEnd - originalEnd) > epsilon
  );
}
