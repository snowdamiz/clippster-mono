/** Container stream timing catches mux offsets; it cannot prove lip sync within the footage. */
export function auditCreatorSkillStreamTiming(hasAudio: boolean, durationDeltaMs: number | null, startDeltaMs: number | null): string[] {
  if (!hasAudio) return [];
  return [
    ...(durationDeltaMs === null || !Number.isFinite(durationDeltaMs)
      ? ['Could not compare exported audio and video stream lengths; inspect synchronization.']
      : durationDeltaMs > 20 ? [`Export audio and video stream lengths differ by ${Math.round(durationDeltaMs)} ms; inspect synchronization.`] : []),
    ...(startDeltaMs === null || !Number.isFinite(startDeltaMs)
      ? ['Could not compare exported audio and video stream start times; inspect synchronization against the source.']
      : startDeltaMs > 20 ? [`Export audio and video stream start times differ by ${Math.round(startDeltaMs)} ms; inspect synchronization against the source.`] : []),
  ];
}
