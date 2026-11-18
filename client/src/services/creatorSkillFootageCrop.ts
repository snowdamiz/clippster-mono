import type { CreatorSkillPackage } from '@clippster/shared-types';
import type { EditDocument } from '../ai-video/types';

/** Apply only crop proposals that cover a whole footage shot without changing its audio or timing. */
export function applyCreatorSkillFootageCrops(document: EditDocument, sourceMedia: { id: string; width: number; height: number }, item?: CreatorSkillPackage): { document: EditDocument; applied: number; reviewItems: string[] } {
  if (!item?.footageReview?.length) return { document, applied: 0, reviewItems: [] };
  const reviewItems: string[] = [];
  let applied = 0;
  const sourceAspect = sourceMedia.width / sourceMedia.height;
  const outputAspect = document.format.width / document.format.height;
  const visibleWidth = Math.min(1, outputAspect / sourceAspect);
  const visibleHeight = Math.min(1, sourceAspect / outputAspect);
  const visibleX = (1 - visibleWidth) / 2;
  const visibleY = (1 - visibleHeight) / 2;
  const shots = document.shots.map(shot => {
    if (shot.mediaId !== sourceMedia.id || shot.scene || shot.creatorLayout || shot.speed <= 0) return shot;
    const sourceEnd = shot.sourceIn + shot.duration * shot.speed;
    const touching = item.footageReview!.filter(range => range.start < sourceEnd - 0.001 && range.end > shot.sourceIn + 0.001);
    if (!touching.length) return shot;
    const covered = touching.filter(range => range.start <= shot.sourceIn + 0.001 && range.end >= sourceEnd - 0.001 && range.crop);
    if (covered.length !== 1 || touching.length !== 1) {
      reviewItems.push(`Source shot ${shot.id} (${shot.sourceIn.toFixed(2)}–${sourceEnd.toFixed(2)}s) intersects a proposed privacy range without one whole-shot crop; split or crop it manually before publishing.`);
      return shot;
    }
    const crop = covered[0].crop!;
    if (!Number.isFinite(visibleWidth) || !Number.isFinite(visibleHeight) || visibleWidth <= 0 || visibleHeight <= 0 || crop.x < visibleX - 0.001 || crop.y < visibleY - 0.001 || crop.x + crop.width > visibleX + visibleWidth + 0.001 || crop.y + crop.height > visibleY + visibleHeight + 0.001) {
      reviewItems.push(`Source shot ${shot.id} has a proposed crop outside the renderer's default visible source area; reframe it manually and inspect the full-resolution result.`);
      return shot;
    }
    const mapped = { x: (crop.x - visibleX) / visibleWidth, y: (crop.y - visibleY) / visibleHeight, width: crop.width / visibleWidth, height: crop.height / visibleHeight };
    const zoom = Math.max(1 / mapped.width, 1 / mapped.height);
    if (!Number.isFinite(zoom) || zoom > 4) {
      reviewItems.push(`Source shot ${shot.id} needs a crop tighter than the editor's 4× limit; replace or reframe that footage manually.`);
      return shot;
    }
    if (zoom <= 1.001 && covered[0].hide.length) reviewItems.push(`Source shot ${shot.id} has a privacy hide instruction but its proposed crop leaves the visible frame unchanged; inspect or reframe it manually.`);
    applied++;
    return { ...shot, framing: { x: mapped.x + mapped.width / 2, y: mapped.y + mapped.height / 2, zoom } };
  });
  return { document: applied ? { ...document, shots } : document, applied, reviewItems };
}
