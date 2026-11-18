import type { CreatorSkillPackage } from '@clippster/shared-types';
import type { EditDocument, SpeechSegment } from '../ai-video/types';
import { creatorSkillCardComposition } from './creatorSkillCardComposition';
import { creatorSkillQrSvg } from './creatorSkillQr';
import { escapeHtml } from '../ai-video/compiler/compile';

const PATH = 'compositions/creator-skill-sponsor-disclosure.html';
const ID = 'creator-skill-sponsor-disclosure';
const escapePattern = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const containsDiscountPercent = (text: string) => /(?:\b(?:save|get|discount|bonus|off)\b.{0,15}\d+(?:\.\d+)?\s*%|\d+(?:\.\d+)?\s*%\s*(?:off|discount|bonus))/i.test(text);

function isAdRead(name: string, speech: string): boolean {
  const brand = escapePattern(name.toLowerCase());
  return new RegExp(`(?:sponsored by|partnered with|partnering with|ad for)\\s+${brand}\\b|\\b${brand}\\b.{0,80}\\b(?:sponsor|my code|my link|link below|referral)\\b`, 'i').test(speech);
}

function spokenOutputTime(document: EditDocument, speech: SpeechSegment[], name: string, sourceMediaId?: string): number | null {
  const mention = speech.find(segment => isAdRead(name, segment.text))
    ?? speech.find(segment => new RegExp(`\\b${escapePattern(name)}\\b`, 'i').test(segment.text));
  if (!mention || !sourceMediaId) return null;
  let outputStart = 0;
  for (const shot of document.shots) {
    if (shot.mediaId === sourceMediaId && mention.start >= shot.sourceIn && mention.start < shot.sourceIn + shot.duration * shot.speed)
      return outputStart + (mention.start - shot.sourceIn) / shot.speed;
    outputStart += shot.duration;
  }
  return null;
}

/** Label the whole clip when the saved sponsor is explicitly read; never infer a deal from a brand mention. */
export function addCreatorSkillSponsorDisclosure(
  document: EditDocument,
  files: Record<string, string>,
  speech: SpeechSegment[],
  item?: CreatorSkillPackage,
  sourceMediaId?: string,
): { document: EditDocument; files: Record<string, string>; added: boolean; reviewItems: string[] } {
  const confirmed = item?.sponsors.filter(sponsor => sponsor.confirmed) ?? [];
  if (!confirmed.length) return { document, files, added: false, reviewItems: [] };
  const transcript = speech.map(segment => segment.text).join(' ').toLowerCase();
  const reads = confirmed.filter(sponsor => isAdRead(sponsor.name, transcript));
  const reviewItems = confirmed.filter(sponsor => !reads.includes(sponsor)).map(sponsor => `${sponsor.name} has saved sponsor terms, but no explicit ad read was located in the timed transcript; confirm the disclosure timing manually.`);
  if (!reads.length) return { document, files, added: false, reviewItems };
  const duration = document.shots.reduce((total, shot) => total + shot.duration, 0);
  const existing = document.overlays.find(overlay => overlay.id === ID);
  if (existing) return { document, files, added: false, reviewItems: [
    ...reviewItems,
    ...(existing.start > .001 || existing.start + existing.duration < duration - .001
      ? ['The saved sponsor disclosure does not cover the whole read from frame 1; correct its timing before publishing.'] : []),
  ] };
  if (PATH in files) return { document, files, added: false, reviewItems: [...reviewItems, 'The sponsor disclosure composition path is already used without its timeline overlay; review the saved edit.'] };
  if (duration < 0.5 || document.overlays.some(overlay => overlay.lane === 'sponsor')) return { document, files, added: false, reviewItems: [...reviewItems, 'Could not place the sponsor disclosure; review the whole clip before publishing.'] };
  const names = reads.map(sponsor => sponsor.name.replace(/\d+\s*%/g, '').trim()).filter(Boolean);
  const genericLabel = `Ad · ${names.join(', ')} ${names.length === 1 ? 'is a sponsor' : 'are sponsors'}`;
  const savedDisclosure = reads.length === 1 ? reads[0].disclosure?.replace(/^(?:ad|sponsored)\s*[:·-]\s*/i, '').trim() : undefined;
  if (/\b(?:i hold|i own|my positions?|my shares|my trades)\b/i.test(transcript) && !/\b(?:hold|own|position|shares|trades)\b/i.test(savedDisclosure ?? ''))
    reviewItems.push('The creator discusses their own position, but the saved sponsor disclosure does not state the holding; add the required holdings wording before publishing.');
  const proposedLabel = savedDisclosure ? `Ad · ${savedDisclosure}` : genericLabel;
  const label = proposedLabel.length <= 160 && !containsDiscountPercent(proposedLabel) && !proposedLabel.includes('—') ? proposedLabel : 'Ad · Sponsor disclosure';
  if (label !== proposedLabel) reviewItems.push('The saved sponsor disclosure is too long or contains an on-screen discount percentage or em dash; add compliant disclosure wording before publishing.');
  if (!savedDisclosure) reviewItems.push('No single saved sponsor disclosure wording was available; confirm the generic Ad chip meets the sponsor terms.');
  const linked = reads.find(sponsor => sponsor.referralUrl);
  let qr = '';
  if (linked?.referralUrl) {
    try { qr = creatorSkillQrSvg(linked.referralUrl); }
    catch { reviewItems.push(`Could not encode and decode ${linked.name}'s saved referral link; add the QR card manually.`); }
  } else reviewItems.push('No saved referral link is available for the sponsor QR card.');
  if (reads.filter(sponsor => sponsor.referralUrl).length > 1) reviewItems.push('Multiple sponsor referral links were detected; only the first is shown on the end card. Review the others manually.');
  let riskLine = linked?.riskLine;
  if (riskLine && (containsDiscountPercent(riskLine) || riskLine.includes('—'))) {
    reviewItems.push(`The ${linked!.name} risk line contains an on-screen discount percentage or em dash; add a compliant risk line before publishing.`);
    riskLine = undefined;
  }
  const ctaSeconds = Math.min(3, duration);
  const mentionTime = linked ? spokenOutputTime(document, speech, linked.name, sourceMediaId) : null;
  if (linked?.referralUrl && mentionTime === null) reviewItems.push(`Could not map the ${linked.name} mention onto the edited timeline; check referral-pill timing manually.`);
  if (mentionTime !== null && duration - mentionTime < 2.5) reviewItems.push(`${linked!.name} is mentioned less than 2.5 seconds before the ending; check the referral-pill hold time.`);
  const pillStart = mentionTime === null ? 0 : Math.floor(mentionTime * document.format.fps) / document.format.fps;
  const pillEnd = Math.min(duration, Math.max(pillStart + 2.5, duration - ctaSeconds));
  const referral = qr && linked?.referralUrl ? {
    style: `#referral-pill{position:absolute;left:4%;bottom:5%;max-width:90%;padding:.45em .8em;border:2px solid #facc15;background:rgba(5,9,17,.94);color:#fff;font-size:${Math.max(22, Math.round(document.format.width * .027))}px;font-weight:800;visibility:hidden;overflow-wrap:anywhere}#referral{position:absolute;left:4%;right:4%;bottom:4%;padding:1.2em;background:rgba(5,9,17,.96);border:3px solid #facc15;display:grid;grid-template-columns:1fr auto;gap:1em;align-items:center;visibility:hidden;font-size:${Math.max(20, Math.round(document.format.width * .025))}px;box-sizing:border-box}#referral strong{display:block;font-size:1.4em}#referral p{margin:.35em 0;overflow-wrap:anywhere}#referral svg{width:${Math.round(document.format.width * .35)}px;height:${Math.round(document.format.width * .35)}px;max-width:100%;background:#fff}#referral .risk{font-size:.75em;color:#ddd}`,
    markup: `${mentionTime === null ? '' : `<div id="referral-pill">${escapeHtml(linked.referralUrl)} · Link in description</div>`}<div id="referral"><div><strong>Try ${escapeHtml(linked.name)}</strong><p>${escapeHtml(linked.referralUrl)}</p>${linked.code ? `<p>Code: ${escapeHtml(linked.code)}</p>` : ''}${riskLine ? `<p class="risk">${escapeHtml(riskLine)}</p>` : ''}<p>Link in the description</p></div>${qr}</div>`,
    timeline: `${mentionTime === null ? '' : `tl.set('#referral-pill',{visibility:'visible'},${pillStart.toFixed(3)});tl.set('#referral-pill',{visibility:'hidden'},${pillEnd.toFixed(3)});`}tl.set('#referral',{visibility:'visible'},${Math.max(0, duration - ctaSeconds).toFixed(3)});`,
  } : undefined;
  return {
    document: { ...document, overlays: [...document.overlays, { id: ID, lane: 'sponsor', start: 0, duration, label, composition: PATH, variables: { text: label } }] },
    files: { ...files, [PATH]: creatorSkillCardComposition(ID, label, document.format, 'top-right', referral) },
    added: true,
    reviewItems: [...reviewItems, 'Check the sponsor read boundaries, saved disclosure wording, final QR scan, risk line, and platform rules before publishing.'],
  };
}
