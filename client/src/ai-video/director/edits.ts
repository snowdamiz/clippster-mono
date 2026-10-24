import { placeShots } from '../compiler/compile';
import type { Blueprint, EditDocument, MediaItem } from '../types';
import { documentDuration, fitsSource, sourceSpan } from './validate';

const round3 = (value: number) => Math.round(value * 1000) / 1000;

/** Put an alternate in the shot's place; the replaced footage becomes an alternate, so swapping back works. */
export function swapShot(document: EditDocument, shotId: string, alternateIndex: number, media: MediaItem[]): EditDocument {
  const items = new Map(media.map((item) => [item.id, item]));
  return {
    ...document,
    shots: document.shots.map((shot) => {
      const alternate = shot.id === shotId ? shot.alternates[alternateIndex] : undefined;
      if (!alternate) return shot;
      const item = items.get(alternate.mediaId);
      const speed = item?.kind === 'photo' ? 1 : shot.speed;
      if (!fitsSource(item, alternate.sourceIn, sourceSpan({ duration: shot.duration, speed }, item))) return shot;
      const previous = { mediaId: shot.mediaId, sourceIn: shot.sourceIn, description: shot.description };
      return {
        ...shot,
        mediaId: alternate.mediaId,
        sourceIn: item?.kind === 'photo' ? 0 : alternate.sourceIn,
        speed,
        description: alternate.description,
        alternates: shot.alternates.map((entry, index) => (index === alternateIndex ? previous : entry)),
      };
    }),
  };
}

/**
 * Remove a shot. The previous shot extends into the gap as far as its source allows; whatever it
 * can't cover shortens the video, and overlays past the new end are trimmed or dropped.
 */
export function removeShot(document: EditDocument, shotId: string, media: MediaItem[]): EditDocument {
  const index = document.shots.findIndex((shot) => shot.id === shotId);
  if (index < 0 || document.shots.length <= 1) return document;
  const items = new Map(media.map((item) => [item.id, item]));
  const removed = document.shots[index];
  const shots = document.shots.filter((shot) => shot.id !== shotId);

  if (index > 0) {
    const previous = shots[index - 1];
    const item = items.get(previous.mediaId);
    const available = item?.kind === 'photo' || !item ? removed.duration : (item.duration - previous.sourceIn) / previous.speed - previous.duration;
    const extension = Math.max(0, Math.min(removed.duration, Math.floor(available * document.format.fps) / document.format.fps));
    shots[index - 1] = { ...previous, duration: round3(previous.duration + extension) };
  }
  if (index === 0) shots[0] = { ...shots[0], transitionIn: 'cut' };

  const total = documentDuration({ shots });
  const minimum = 1 / document.format.fps;
  const overlays = document.overlays
    .filter((overlay) => overlay.start < total - minimum)
    .map((overlay) => (overlay.start + overlay.duration > total ? { ...overlay, duration: round3(total - overlay.start) } : overlay));
  return { ...document, shots, overlays };
}

export function setOverlayText(document: EditDocument, overlayId: string, text: string): EditDocument {
  return {
    ...document,
    overlays: document.overlays.map((overlay) =>
      overlay.id === overlayId ? { ...overlay, label: text, variables: { ...overlay.variables, text } } : overlay
    ),
  };
}

export function removeOverlay(document: EditDocument, overlayId: string): EditDocument {
  return { ...document, overlays: document.overlays.filter((overlay) => overlay.id !== overlayId) };
}

/** The moment in the example that answers output time `t`: the same offset into the matched example shot. */
export function exampleTimeAt(document: EditDocument, blueprint: Pick<Blueprint, 'shots'> | null, t: number): number | null {
  if (!blueprint) return null;
  const placed = placeShots(document);
  const index = placed.findIndex((shot) => t >= shot.start && t < shot.end);
  const ref = document.shots[index]?.refShot;
  const example = ref != null ? blueprint.shots[ref] : undefined;
  if (!example) return null;
  return round3(example.start + Math.min(t - placed[index].start, example.duration));
}

/**
 * Where the example's cuts fall on the output timeline. Each run of shots answering consecutive
 * example shots is anchored at its first shot; the example's own shot lengths then place the cuts,
 * so the dashed lines show how closely the edit follows the example's rhythm.
 */
export function exampleCutTimes(document: EditDocument, blueprint: Pick<Blueprint, 'shots'> | null): number[] {
  if (!blueprint) return [];
  const placed = placeShots(document);
  const total = placed[placed.length - 1]?.end ?? 0;
  const cuts: number[] = [];
  let anchor: { time: number; ref: number } | null = null;

  document.shots.forEach((shot, index) => {
    const ref = shot.refShot;
    if (ref == null || !blueprint.shots[ref]) {
      anchor = null;
      return;
    }
    const continues = anchor && ref > anchor.ref && index > 0 && document.shots[index - 1].refShot === ref - 1;
    if (!continues) anchor = { time: placed[index].start, ref };
    const current = anchor as { time: number; ref: number };
    const offset = blueprint.shots.slice(current.ref, ref).reduce((sum, entry) => sum + entry.duration, 0);
    const time = round3(current.time + offset);
    if (index > 0 && time > 0 && time < total) cuts.push(time);
  });
  return cuts;
}
