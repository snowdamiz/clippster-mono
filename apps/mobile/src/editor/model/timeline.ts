import {
  EDITOR_MAX_TICKS,
  type EditorTick,
  type MobileEditProjectV3,
  type TransitionItem,
  type VideoItem,
  type VideoTrack,
} from './schema';

export const MIN_ITEM_TICKS = 30_000;

export function videoItemDuration(item: VideoItem): EditorTick {
  return Math.round((item.sourceEnd - item.sourceStart) / item.speed);
}

export function getVideoTrack(document: MobileEditProjectV3): VideoTrack {
  const track = document.tracks.find((candidate) => candidate.kind === 'video');
  if (!track) throw new Error('Document has no main video track');
  return track;
}

export function transitionBefore(
  track: VideoTrack,
  itemId: string,
): TransitionItem | undefined {
  return track.transitions.find((transition) => transition.toItemId === itemId);
}

export function reflowVideoTrack(track: VideoTrack): VideoTrack {
  let cursor = 0;
  const items = track.items.map((item, index) => {
    const transition = index === 0 ? undefined : transitionBefore(track, item.id);
    const overlap = transition?.transition === 'cut' ? 0 : transition?.durationTicks ?? 0;
    const timelineStart = Math.max(0, cursor - overlap);
    const timelineEnd = timelineStart + videoItemDuration(item);
    cursor = timelineEnd;
    return { ...item, timelineStart, timelineEnd };
  });
  if (cursor > EDITOR_MAX_TICKS) throw new Error('Edit exceeds the 120 second mobile policy');
  return { ...track, items };
}

export function replaceVideoTrack(
  document: MobileEditProjectV3,
  track: VideoTrack,
  updatedAt: number,
): MobileEditProjectV3 {
  return {
    ...document,
    tracks: document.tracks.map((candidate) => (candidate.kind === 'video' ? track : candidate)),
    updatedAt,
  };
}

export function resolveVideoAtTick(
  document: MobileEditProjectV3,
  timelineTick: EditorTick,
): VideoItem | null {
  const track = getVideoTrack(document);
  const clamped = Math.max(0, timelineTick);
  const matches = track.items.filter(
    (item) => clamped >= item.timelineStart && clamped < item.timelineEnd,
  );
  return matches[matches.length - 1] ?? track.items[track.items.length - 1] ?? null;
}
