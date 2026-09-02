export function formatClock(seconds: number | null | undefined): string {
  const total = Math.max(0, Math.floor(seconds ?? 0));
  const hours = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function formatDurationLabel(seconds: number | null | undefined): string {
  return formatClock(seconds);
}

/** OpenCut-style `M:SS.ss` playhead clock that keeps ticking through hundredths. */
export function formatPlaybackClock(seconds: number): string {
  'worklet';
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00.00';
  const mins = Math.floor(seconds / 60);
  const remainder = seconds - mins * 60;
  const [whole, hundredths] = remainder.toFixed(2).split('.');
  return `${mins}:${whole.padStart(2, '0')}.${hundredths}`;
}

export function toLocalImageUri(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('file://')) {
    return path;
  }
  return `file://${path}`;
}
