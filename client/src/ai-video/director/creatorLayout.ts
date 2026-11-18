import type { EditDocument } from '../types';

/** Structural requirement for automatic vertical VOD edits; visual crop quality still needs frame review. */
export function creatorLayoutIssues(document: EditDocument, sourceId: string): string[] {
  if (document.format.width >= document.format.height) return [];
  const footage = document.shots.filter(shot => shot.mediaId === sourceId && !shot.scene);
  if (!footage.length) return ['Keep the VOD source footage and its speech in the edit.'];
  return footage.flatMap(shot => !shot.creatorLayout
    ? [`Shot ${shot.id}: inspect source frames and provide a measured creatorLayout.speaker rectangle. Add creatorLayout.top only for relevant visual evidence. A blindly center-cropped VOD is not a reviewed layout.`]
    : []);
}
