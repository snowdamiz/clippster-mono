import { invoke } from '@tauri-apps/api/core';
import type { CreatorSkillClipEdit, CreatorSkillPackage } from '@clippster/shared-types';
import { creatorSkillSourceTargets } from './creatorSkillSourceTargets';
import { hyperframesRequest } from '@/ai-video/runtime/hyperframesClient';
import { readTextFile } from '@tauri-apps/plugin-fs';
import { creatorSkillClaimEvidence } from './creatorSkillClaimEvidence';
import { creatorSkillCaptureDateIssues } from './creatorSkillPageDate';

type CapturedPage = {
  path: string;
  text: string;
  screenshotPath?: string;
  screenshotHighlighted: boolean;
  linkedLogoUrl?: string | null;
  pagePublishedAt?: string | null;
  fetchedAt: string;
};

export type CreatorSkillSourceCache = Map<string, Promise<CapturedPage>>;

export async function captureCreatorSkillDesktopSources(
  clipId: string,
  item: CreatorSkillPackage,
  cache?: CreatorSkillSourceCache,
): Promise<{ captures: NonNullable<CreatorSkillClipEdit['sourceCaptures']>; claimEvidence: NonNullable<CreatorSkillClipEdit['claimEvidence']>; reviewItems: string[] }> {
  const { targets, omitted } = creatorSkillSourceTargets(item);
  const captures: NonNullable<CreatorSkillClipEdit['sourceCaptures']> = [];
  const claimEvidence: NonNullable<CreatorSkillClipEdit['claimEvidence']> = [];
  const reviewItems: string[] = [];
  for (let offset = 0; offset < targets.length; offset += 3) {
    const results = await Promise.allSettled(targets.slice(offset, offset + 3).map(async target => {
      const reused = cache?.has(target.url) ?? false;
      let page = cache?.get(target.url);
      if (!page) {
        page = (async (): Promise<CapturedPage> => {
          const fetchedAt = new Date().toISOString();
          const capture = await invoke<{ path: string; linkedLogoUrl?: string | null; screenshotHtml: string; pagePublishedAt?: string | null }>('capture_creator_skill_page', { url: target.url, clipId, index: target.index, title: target.title, kind: target.kind, fetchedAt, logoUrl: target.logoUrl });
          const text = await readTextFile(capture.path);
          const firstEvidence = creatorSkillClaimEvidence(item, [{ index: target.index, url: target.url, text }]);
          const screenshotPath = capture.path.replace(/\.txt$/i, '.png');
          const screenshot = await hyperframesRequest<{ highlighted: boolean }>('capturePageScreenshot', { html: capture.screenshotHtml, destination: screenshotPath, highlightText: firstEvidence[0]?.excerpt, sourceUrl: target.url, capturedAt: fetchedAt }).catch(() => null);
          return { path: capture.path, text, fetchedAt, linkedLogoUrl: capture.linkedLogoUrl, pagePublishedAt: capture.pagePublishedAt, screenshotPath: screenshot ? screenshotPath : undefined, screenshotHighlighted: screenshot?.highlighted ?? false };
        })();
        cache?.set(target.url, page);
        void page.catch(() => cache?.delete(target.url));
      }
      const captured = await page;
      const evidence = creatorSkillClaimEvidence(item, [{ index: target.index, url: target.url, text: captured.text }]);
      return {
        capture: { ...target, fetchedAt: captured.fetchedAt, path: captured.path,
          ...(captured.linkedLogoUrl && { linkedLogoUrl: captured.linkedLogoUrl }),
          ...(captured.pagePublishedAt && { pagePublishedAt: captured.pagePublishedAt }),
          ...(captured.screenshotPath && { screenshotPath: captured.screenshotPath }) },
        evidence, screenshotHighlighted: captured.screenshotHighlighted && !reused, reused,
        dateIssues: creatorSkillCaptureDateIssues(item, target.url, captured.pagePublishedAt ?? undefined),
      };
    }));
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        captures.push(result.value.capture);
        claimEvidence.push(...result.value.evidence);
        reviewItems.push(...result.value.dateIssues);
        if (!result.value.capture.screenshotPath) reviewItems.push(`Could not render a static screenshot of ${result.value.capture.url}; use the saved text capture and inspect the live page.`);
        else if (result.value.evidence.length && !result.value.screenshotHighlighted) reviewItems.push(`${result.value.reused ? 'The shared source screenshot may not highlight this clip\'s claim passage' : 'Could not highlight the candidate claim passage'} at ${result.value.capture.url}; inspect the saved text and live page.`);
      }
      else {
        const target = targets[offset + index];
        reviewItems.push(`Could not capture ${target.kind} page ${target.url}; open it directly before using its claims or assets.`);
      }
    });
  }
  if (omitted) reviewItems.push(`${omitted} proposed source pages exceeded the automatic capture limit; inspect them directly.`);
  return { captures, claimEvidence, reviewItems };
}
