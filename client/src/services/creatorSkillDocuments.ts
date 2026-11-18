import type { CreatorSkillClaimEvidence, CreatorSkillDocumentName, CreatorSkillPackage, CreatorSkillPreferences, CreatorSkillSoundScan } from '@clippster/shared-types';
import { isCreatorSkillShortPlatform } from './creatorSkillEditorialAudit';
import { creatorSkillPublishBlockers, creatorSkillUnresolvedFixes } from './creatorSkillReview';

export interface CreatorSkillDelivery {
  selectedVersion?: 'raw' | 'edited';
  durationSeconds?: number;
  availableFiles?: string[];
  reviewItems?: string[];
  rawClipMd5?: string;
  masterMd5?: string;
  sourceCaptures?: Array<{ index: number; url: string; title: string; fetchedAt: string; pagePublishedAt?: string }>;
  speechDiff?: string;
  soundScan?: CreatorSkillSoundScan;
  creatorProfile?: { name: string; preferences: CreatorSkillPreferences };
  claimEvidence?: CreatorSkillClaimEvidence[];
}

/** Reproducible editorial files from the saved, reconciled playbook package. */
export function creatorSkillDocuments(item: CreatorSkillPackage, delivery: CreatorSkillDelivery = {}): Record<CreatorSkillDocumentName, string> {
  const line = (value: string | undefined) => (value || '').replace(/\r?\n/g, ' ').trim();
  const reviewerFixes = creatorSkillUnresolvedFixes(item, delivery.masterMd5);
  const sources = item.sources.map(source => `- ${line(source.title)} | ${line(source.publishedAt) || 'date unconfirmed'} | ${source.url} | AI-reported retrieval ${line(source.retrievedAt)}`);
  const claims = item.claims.map((claim, index) => {
    const review = item.claimReviews?.find(entry => entry.claimIndex === index);
    const evidence = delivery.claimEvidence?.find(entry => entry.claimIndex === index);
    const capturedDate = delivery.sourceCaptures?.find(capture => capture.url === claim.sourceUrl)?.pagePublishedAt;
    return [
    `## ${claim.time.toFixed(1)}s · ${line(claim.text)}`,
    `Verdict: ${claim.verdict.toUpperCase().replace('_', ' ')}`,
    `Source: ${claim.sourceUrl || 'none'}`,
    `Publication date: ${line(claim.publishedAt) || 'unconfirmed'}`,
    `Captured page advertises date: ${capturedDate || 'not found'}${capturedDate && claim.publishedAt && capturedDate !== claim.publishedAt.slice(0, 10) ? ' · DATE MISMATCH: review before publishing' : ''}`,
    `On-screen label: ${line(claim.onScreenLabel) || 'none'}`,
    ...(evidence ? [`Captured text candidate: source-captures/${evidence.captureIndex}.txt`, `Candidate excerpt (not verified): ${line(evidence.excerpt)}`] : ['Captured text candidate: none; inspect the cited page manually']),
    ...(review ? [
      `Human review: ${review.decision.replace('_', ' ')}`,
      `Review note: ${line(review.note)}`,
      `Reviewed at: ${review.reviewedAt}`,
    ] : ['Human review: pending']),
  ].join('\n');
  });
  const sponsorNotes = item.sponsors.map(sponsor => `- ${line(sponsor.name)}: ${sponsor.confirmed ? 'saved in creator profile; confirm this read is covered' : 'unconfirmed mention'}${sponsor.disclosure ? ` | disclosure: ${line(sponsor.disclosure)}` : ''}${sponsor.riskLine ? ` | risk line: ${line(sponsor.riskLine)}` : ''}${sponsor.platforms?.length ? ` | allowed platforms: ${sponsor.platforms.map(line).join(', ')}` : ''}${sponsor.discountInDescriptionAllowed !== undefined ? ` | discount wording in description: ${sponsor.discountInDescriptionAllowed ? 'allowed' : 'not allowed'}` : ''}${sponsor.review ? ` | review: ${line(sponsor.review)}` : ''}`);
  const uploadSettings = (platform: string): string[] => {
    const toggle = /youtube/i.test(platform) ? 'YouTube: Includes paid promotion'
      : /instagram|reels/i.test(platform) ? 'Instagram: Paid partnership'
      : /tiktok/i.test(platform) ? 'TikTok: Branded content'
      : 'Check this platform’s paid promotion setting';
    const confirmed = item.sponsors.filter(sponsor => sponsor.confirmed);
    const allowed = confirmed.filter(sponsor => !sponsor.platforms?.length || sponsor.platforms.some(name => platform.toLowerCase().includes(name.toLowerCase()) || name.toLowerCase().includes(platform.toLowerCase())));
    return [
      `- ${toggle}: ${confirmed.length ? 'review the finished clip and enable if a confirmed sponsor appears' : 'review the finished clip; no sponsor agreement was supplied'}.`,
      ...(confirmed.length && !allowed.length ? ['- No confirmed sponsor is marked as allowed on this platform. Review the platform cut before posting.'] : []),
      '- Upload the final captions SRT and check names and profanity against the finished audio.',
      ...(isCreatorSkillShortPlatform(platform) ? [] : ['- Select a reviewed thumbnail and run YouTube Test & Compare with three reviewed variants when available.']),
      '- Confirm every source date, image right, link, and disclosure against the finished clip.',
    ];
  };
  const copy = (draft: CreatorSkillPackage['platformCopy'][number]) => [
    `## ${line(draft.platform)}`,
    `Title: ${line(draft.title)}`,
    '',
    line(draft.description),
    '',
    `Tags: ${draft.tags.map(line).join(', ')}`,
    `Pinned comment: ${line(draft.pinnedComment)}`,
    '',
    '### Upload settings to review',
    ...uploadSettings(draft.platform),
  ].join('\n');
  const longCopy = item.platformCopy.filter(draft => !isCreatorSkillShortPlatform(draft.platform)).map(copy);
  const shortsCopy = item.platformCopy.filter(draft => isCreatorSkillShortPlatform(draft.platform)).map(copy);
  const funnelCopy = ['## Funnel job', `Stage: ${item.funnel.stage}`, `Reason: ${line(item.funnel.reason)}`, `Metric to track: ${line(item.funnel.metric)}`, `Bridge to next stage: ${line(item.funnel.bridge) || 'none planned'}`, ''];
  const footageEntries = item.footageReview?.map((entry, index) => {
    const review = item.footageReviews?.find(value => value.footageIndex === index);
    return `- Source ${entry.start.toFixed(2)}–${entry.end.toFixed(2)}s | Show: ${line(entry.show)} | Hide: ${entry.hide.map(line).join(', ') || 'none noted'} | Crop (normalized x,y,w,h): ${entry.crop ? [entry.crop.x, entry.crop.y, entry.crop.width, entry.crop.height].map(value => value.toFixed(3)).join(', ') : 'none proposed'} | ${line(entry.note)} | Human review: ${review ? `${review.decision.replace('_', ' ')} on ${review.reviewedAt}; ${line(review.note)}` : 'pending'}`;
  }) ?? [];
  const profile = delivery.creatorProfile;
  const preferences = profile?.preferences;
  const creatorRules = preferences?.editing?.rules ?? [];
  const documents = {
    'creator.md': ['# Creator edit profile', '', `Creator: ${line(profile?.name) || 'No creator profile selected'}`, 'This is the saved preference snapshot used for this clip. Missing fields are not inferred as sponsor agreements.', '', '## Brand', `Channel: ${line(preferences?.brand?.channelName) || 'not supplied'}`, `Colors: ${preferences?.brand?.colors?.map(line).join(', ') || 'not supplied'}`, `Fonts: ${preferences?.brand?.fonts?.map(line).join(', ') || 'not supplied'}`, `Company or product: ${line(preferences?.brand?.companyUrl) || 'not supplied'}`, '', '## Editing rules', `Preserve spoken words: ${preferences?.editing?.preserveEveryWord === false ? 'creator opted out' : 'yes'}`, `Music: ${preferences?.editing?.musicAllowed ? 'allowed' : 'not approved'}`, `Sound effects: ${preferences?.editing?.soundEffectsAllowed ? 'allowed' : 'not approved'}`, `Graphic density: ${preferences?.editing?.graphicDensity || 'standard'}`, ...(creatorRules.length ? creatorRules.map(rule => `- ${line(rule)}`) : ['- No extra rules supplied']), '', '## Publishing', `Audience: ${line(preferences?.publishing?.audience) || 'not supplied'}`, `Tone: ${line(preferences?.publishing?.tone) || 'not supplied'}`, `Call to action: ${line(preferences?.publishing?.callToAction) || 'not supplied'}`, `Platforms: ${preferences?.publishing?.platforms?.map(line).join(', ') || 'not supplied'}`, `Schedule: ${line(preferences?.publishing?.schedule) || 'not supplied'}`, '', '## Confirmed sponsor terms', ...(preferences?.sponsors?.length ? preferences.sponsors.map(sponsor => `- ${line(sponsor.name)} | Referral URL: ${line(sponsor.referralUrl) || 'not supplied'} | Code: ${line(sponsor.code) || 'not supplied'} | Disclosure: ${line(sponsor.disclosure) || 'not supplied'} | Risk line: ${line(sponsor.riskLine) || 'not supplied'} | Platforms: ${sponsor.platforms?.map(line).join(', ') || 'not supplied'} | Discount wording in description: ${sponsor.discountInDescriptionAllowed ? 'allowed' : 'not approved'}`) : ['- None saved; brand mentions are not sponsor agreements']), '', '## Delivery', `Destination: ${line(preferences?.delivery?.destination) || 'not supplied'}`, `Phone preview limit: ${preferences?.delivery?.previewMaxMb ? `${preferences.delivery.previewMaxMb} MB` : 'default'}`].join('\n'),
    'claims.md': ['# Claims and sources', '', 'Editorial draft. Open each cited page and confirm the claim, publication date, and visible label before publishing.', '', '## Labels first', ...item.claims.map(claim => `- ${claim.time.toFixed(1)}s: ${line(claim.onScreenLabel) || 'No label proposed'} — ${line(claim.text)}`), '', ...claims, '', '# Sources', ...sources, '', '# Captured public pages', ...(delivery.sourceCaptures?.length ? delivery.sourceCaptures.map(capture => `- source-captures/${capture.index}.txt | ${line(capture.title)} | ${capture.url} | fetched ${capture.fetchedAt} | Claim support still requires review`) : ['- No saved page captures'])].join('\n'),
    'speech-diff.md': delivery.speechDiff || '# Final audio word comparison\n\nRe-transcription was unavailable. Compare the edited master with Raw before publishing.\n',
    'sound-scan.md': ['# Finished audio sound scan', '', `Edited master MD5: ${delivery.masterMd5 ?? 'unavailable'}`, '', 'Local YAMNet AudioSet classifier, 16 kHz mono, with overlapping analysis chunks. These are listen points, not confirmed coughs or permission to remove speech.', '', ...(delivery.soundScan ? [
      `Scanned: ${delivery.soundScan.scannedSeconds.toFixed(1)}s across ${delivery.soundScan.analyzedWindows} model windows.`,
      `Coverage: ${delivery.soundScan.truncated ? 'first 30 minutes only; listen through the rest' : 'complete extracted audio'}.`,
      '', '## Possible coughs and throat clears',
      ...(delivery.soundScan.findings.length ? delivery.soundScan.findings.map(event => `- ${event.time.toFixed(2)}s | ${line(event.label)} | score ${event.score.toFixed(2)} | listen against Raw and preserve every word`) : ['- No candidates above the review threshold. Listen through the full master anyway.']),
    ] : ['Scan unavailable. Listen through the finished master and compare it with Raw before publishing.'])].join('\n'),
    'footage.md': ['# Footage privacy and crop review', '', 'Review the full-resolution source and edited master before publishing. Automated contact sheets and flash checks do not establish that a crop is safe.', '', '## Hide or exclude', '- Browser tabs, address bars, bookmarks, taskbars, and notifications', '- Private account panels, balances, cash, and positions unless the creator deliberately presents them as a receipt', '- Other people’s usernames, chats, referral links, and codes', '- Article ads, sidebars, and community notes outside the cited passage', '- Casino branding, profanity in graphics, and children as a focal point', '', '## Proposed crop log', ...(footageEntries.length ? footageEntries : ['- No clip-specific crop ranges were proposed; inspect the full source and edited master.']), '- Record each approved screen or article crop with source time range, rectangle, and reviewed frame.', '- Confirm the source date and label on every shown image or data card.', '- Confirm no private material appears in transitions or single frames.', '', `Review status: ${footageEntries.length && footageEntries.every((_, index) => item.footageReviews?.some(review => review.footageIndex === index && review.decision === 'frame_checked')) ? 'all proposed ranges checked; inspect remaining source and edit' : 'pending human inspection'}.`].join('\n'),
    'review-brief.md': ['# Independent review brief', '', 'A reviewer who did not build this edit must watch the edited master and compare it with Raw. This file is a brief and a finding log, not an automatic approval.', '', `Funnel stage: ${item.funnel.stage}`, `Reason: ${line(item.funnel.reason)}`, `Selected version: ${delivery.selectedVersion ?? 'not selected'}`, `Current master MD5: ${delivery.masterMd5 ?? 'unavailable'}`, '', '## Materials', '- Raw clip and edited master', '- speech-diff.md, sound-scan.md, and final captions SRT', '- claims.md, saved public page captures, and footage.md', '- Contact sheet, thumbnail drafts, and both posting copy files', '', '## Check at output time', '- Every spoken word survives; listen to every unmatched token and every cut.', '- No private account data, usernames, notifications, unsafe crop edges, or one-frame flashes.', '- Every graphic number, claim, face, source image, and date is supported by the cited source.', '- Sponsor terms, disclosure timing, referral URL, QR, platform restrictions, and licensed music.', '- Audio loudness, true peak, sync, final captions, names, and profanity masking.', '- Thumbnail face comes from this VOD; check expression, sharpness, rights, and phone-size readability.', '- Chapters, descriptions, links, tags, and titles match the finished edit.', '', '## Report format', 'For each finding, record FIX FIRST, SHOULD FIX, or OK; output time; evidence; and the specific correction. A builder must address FIX FIRST items, render again, and have the changed frames and audio checked in the new file.', '', '## Saved findings', ...(item.independentReview?.length ? item.independentReview.map(finding => `- ${finding.severity.toUpperCase().replace('_', ' ')} at ${finding.outputTime.toFixed(2)}s | ${line(finding.finding)} | Reviewer: ${line(finding.reviewer)} | Master MD5: ${finding.masterMd5} | ${finding.reviewedAt}${delivery.masterMd5 && finding.masterMd5 !== delivery.masterMd5 ? ' | STALE: master changed' : ''}`) : ['- No findings recorded.']), '', '## Signoff', ...(item.independentSignoff ? [`- ${line(item.independentSignoff.reviewer)} | ${line(item.independentSignoff.note)} | Master MD5: ${item.independentSignoff.masterMd5} | ${item.independentSignoff.reviewedAt}${delivery.masterMd5 && item.independentSignoff.masterMd5 !== delivery.masterMd5 ? ' | STALE: master changed' : ''}`] : ['- Pending']), '', '## Open items before independent review', ...[...new Set([...(delivery.reviewItems ?? []), ...item.reviewItems])].map(note => `- ${line(note)}`), '', `Independent review status: ${delivery.masterMd5 && item.independentSignoff?.masterMd5 === delivery.masterMd5 ? 'signed off by ' + line(item.independentSignoff.reviewer) + ' at ' + item.independentSignoff.reviewedAt : 'pending for current master'}.`].join('\n'),
    'long-copy.md': ['# Long-form posting copy', '', 'Editorial draft. Check chapters, platform rules, sponsor disclosures, links, and source dates before posting.', '', ...funnelCopy, ...(longCopy.length ? longCopy : ['No long-form copy drafted.']), '', '# Sponsor review', ...sponsorNotes].join('\n'),
    'shorts-copy.md': ['# Shorts posting copy', '', 'Editorial draft. Check platform rules, sponsor disclosures, links, and source dates before posting.', '', ...funnelCopy, ...(shortsCopy.length ? shortsCopy : ['No Shorts copy drafted.']), '', '# Sponsor review', ...sponsorNotes].join('\n'),
    'thumbnail-notes.md': ['# Thumbnail concepts', '', 'Draft frames come from this VOD. Local face detection favors large, roughly frontal faces; a local person mask may create a cutout. A reviewer must confirm the expression, open eyes, mouth, blur, cutout edges, rights, and phone-size readability. Check any factual number against a source-checked claim before using it.', '', ...item.thumbnailConcepts.map((concept, index) => `- ${String.fromCharCode(65 + index)}: ${line(concept)}`), '', '# Draft headlines', ...(item.thumbnailHeadlines ?? []).map((headline, index) => `- ${String.fromCharCode(65 + index)}: ${line(headline)}`), '', '# Public brand references', ...((item.brandReferences ?? []).map(brand => `- ${line(brand.name)} | ${brand.sourceUrl} | ${line(brand.notes)}`))].join('\n'),
    'delivery-summary.md': ['# Clip delivery summary', '', `Funnel stage: ${item.funnel.stage}`, `Reason: ${line(item.funnel.reason)}`, `Metric: ${line(item.funnel.metric)}`, `Bridge: ${line(item.funnel.bridge) || 'none'}`, ...(delivery.selectedVersion ? [`Selected workspace version: ${delivery.selectedVersion === 'raw' ? 'Raw' : 'Edited'}`] : []), ...(delivery.durationSeconds !== undefined ? [`Length: ${delivery.durationSeconds.toFixed(1)} seconds`] : []), '', '# Available files', ...(delivery.availableFiles?.map(name => `- ${line(name)}`) ?? ['- Confirm files in the workspace']), '', '# File integrity', ...(delivery.rawClipMd5 ? [`Raw extracted clip MD5: ${delivery.rawClipMd5}`] : []), ...(delivery.masterMd5 ? [`Edited master MD5: ${delivery.masterMd5}`] : []), ...(!delivery.rawClipMd5 && !delivery.masterMd5 ? ['Checksums unavailable'] : []), '', '# Reviewer fixes blocking Edited publishing', ...(reviewerFixes.length ? reviewerFixes.map(finding => `- ${finding.outputTime.toFixed(2)}s: ${line(finding.finding)} (${line(finding.reviewer)})`) : ['- None recorded for the current master']), '', '# Open review items', ...[...new Set([...(delivery.reviewItems ?? []), ...item.reviewItems])].map(note => `- ${line(note)}`)].join('\n'),
  };
  const blockers = creatorSkillPublishBlockers(item, delivery.masterMd5);
  documents['delivery-summary.md'] += ['','## Edited publishing status', ...(blockers.length ? blockers.map(blocker => `- BLOCKED: ${line(blocker)}`) : ['- Ready after final platform review'])].join('\n');
  documents['review-brief.md'] += ['','## Current automated QA', `Master MD5: ${item.automatedQa?.masterMd5 ?? 'not checked'}`, ...(item.automatedQa?.blockers.length ? item.automatedQa.blockers.map(blocker => `- ${line(blocker)}`) : ['- No automated blockers recorded'])].join('\n');
  return documents;
}
