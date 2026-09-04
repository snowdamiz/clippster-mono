import type { EditorTick } from '../model/schema';
import { EDITOR_TICKS_PER_SECOND } from '../model/schema';

export const MIN_PIXELS_PER_SECOND = 12;
export const MAX_PIXELS_PER_SECOND = 120;

export function pixelsForTicks(ticks: EditorTick, pixelsPerSecond: number): number {
  return (ticks / EDITOR_TICKS_PER_SECOND) * pixelsPerSecond;
}

export function ticksForPixels(pixels: number, pixelsPerSecond: number): EditorTick {
  return Math.round((pixels / pixelsPerSecond) * EDITOR_TICKS_PER_SECOND);
}

export function scrollOffsetForTick(tick: EditorTick, pixelsPerSecond: number): number {
  return Math.max(0, pixelsForTicks(tick, pixelsPerSecond));
}

export function tickForScrollOffset(offset: number, pixelsPerSecond: number): EditorTick {
  return Math.max(0, ticksForPixels(offset, pixelsPerSecond));
}

export function clampZoom(pixelsPerSecond: number): number {
  return Math.max(MIN_PIXELS_PER_SECOND, Math.min(MAX_PIXELS_PER_SECOND, pixelsPerSecond));
}

export function focalTimeForPinch(
  scrollOffset: number,
  focalX: number,
  viewportWidth: number,
  pixelsPerSecond: number,
): EditorTick {
  return ticksForPixels(
    scrollOffset + focalX - viewportWidth / 2,
    pixelsPerSecond,
  );
}

export function offsetPreservingFocalTime(
  focalTick: EditorTick,
  focalX: number,
  viewportWidth: number,
  pixelsPerSecond: number,
): number {
  return Math.max(
    0,
    pixelsForTicks(focalTick, pixelsPerSecond) - focalX + viewportWidth / 2,
  );
}

export interface SnapResult {
  tick: EditorTick;
  snapped: boolean;
}

export function snapTimelineTick(
  tick: EditorTick,
  boundaries: EditorTick[],
  thresholdPixels: number,
  pixelsPerSecond: number,
): SnapResult {
  const thresholdTicks = Math.abs(ticksForPixels(thresholdPixels, pixelsPerSecond));
  let nearest = tick;
  let distance = Number.MAX_SAFE_INTEGER;
  for (const boundary of boundaries) {
    const candidateDistance = Math.abs(boundary - tick);
    if (candidateDistance < distance) {
      distance = candidateDistance;
      nearest = boundary;
    }
  }
  return distance <= thresholdTicks
    ? { tick: nearest, snapped: true }
    : { tick, snapped: false };
}

/** Vertical layout for FixedPlayheadTimeline track rows. */
export const TIMELINE_RULER_HEIGHT = 28;
export const TIMELINE_VIDEO_TRACK_TOP = TIMELINE_RULER_HEIGHT;
export const TIMELINE_VIDEO_TRACK_HEIGHT = 64;
export const TIMELINE_SECONDARY_TRACK_TOP =
  TIMELINE_VIDEO_TRACK_TOP + TIMELINE_VIDEO_TRACK_HEIGHT + 6;
export const TIMELINE_SECONDARY_TRACK_HEIGHT = 44;
export const TIMELINE_SECONDARY_TRACK_STRIDE = 50;
export const TIMELINE_BOTTOM_PADDING = 8;

/**
 * Timeline chrome height for the video row plus `secondarySlots` lower tracks.
 * Always reserves at least one secondary slot (Add sound / empty audio lane).
 */
export function timelineViewportHeight(secondaryTrackCount: number): number {
  const slots = Math.max(1, secondaryTrackCount);
  return (
    TIMELINE_SECONDARY_TRACK_TOP +
    slots * TIMELINE_SECONDARY_TRACK_STRIDE -
    (TIMELINE_SECONDARY_TRACK_STRIDE - TIMELINE_SECONDARY_TRACK_HEIGHT) +
    TIMELINE_BOTTOM_PADDING
  );
}
