import type { CreatorSkillFormat, CreatorSkillPackage, CreatorSkillPreferences } from '@clippster/shared-types';

export const CREATOR_SKILL_EDITORIAL_VERSION = 2;

export type CreatorSkillProfileContext = {
  name: string;
  description?: string | null;
  preferences: CreatorSkillPreferences;
  availableAssets?: Array<{ role: 'intro' | 'outro'; mediaId: string; name: string }>;
} | null;

/** Prompt only for a clip whose owner opted into the full creator playbook. */
export function creatorSkillRequest(
  profile: CreatorSkillProfileContext,
  format: CreatorSkillFormat = '9:16',
  shared?: Pick<CreatorSkillPackage, 'sources' | 'brandReferences'>,
): string {
  return [
    format === '9:16'
      ? 'VERTICAL EDITORIAL DIRECTION: Use 1080x1920. Choose the layout from what the viewer needs, not a mandatory card template. For conversation, reactions and jokes, prefer a speaker-led shot: creatorLayout: {speaker: {x,y,width,height}} measured from source frames. Keep headroom, shoulders and gestures; avoid extreme face crops. Add an optional top: {x,y,width,height} region only when a screen, receipt or visual materially helps explain the spoken moment. With top present, the renderer uses y=0..860 for it and y=860..1920 for the speaker; without top, the speaker fills the frame. Do not manufacture a fact/context card to fill unused space. No generic banners such as LIVE ON STREAM, abstract topic headings, or explanations that an obvious joke is not real policy. Keep opinion classifications in the package, not dominant graphics. Genuine uncertain factual claims still need a concise, timely qualifier; source/date labels accompany actual factual evidence. A short, concrete opening hook may appear briefly, then clear the frame. Never cover the face with captions or cards. You own one AI-designed caption track using the supplied word timing: 2–3-word cues, restrained emphasis, readable safe margins, at the seam for split shots or below the face for speaker-led shots. No duplicate captions. Inspect source frames at layout changes, set move:none, and omit framing with creatorLayout. Review the actual rendered hierarchy: speaker first, captions second, supporting evidence only when useful.'
      : '',
    `This is an automatically detected VOD clip opted into the full creator edit playbook. Create an editable ${format === '16:9' ? 'landscape long-form take with one topic, chapters, source inserts, and a creator end card when an approved asset exists' : 'vertical short-form timeline'} and preview. Submit the actual editable timeline with set_edit before calling finish; a research package alone is not an edit. Keep every spoken word unless the saved creator preferences explicitly allow a cut; only remove measured dead air. Do not color-grade the creator's face, use an old face photo, put em dashes in posting copy, or add casino branding. Choose a funnel stage and measurable goal; give reach clips a bridge to a later stage. Research checkable factual claims and assets actually needed for this edit; do not research every incidental name or brand in a joke or conversation; use only dated, attributable source cards. Put official public company branding references in brandReferences when relevant, including source URLs, colors, logo references, and usage-rights questions. A mentioned brand is not necessarily a sponsor or the creator brand. Never invent sponsor terms or creator preferences. Prepare captions, thumbnail concepts and 2 to 4 thumbnail headlines of 2 to 4 words without unverified numbers, platform copy and pinned comments${format === '16:9' ? ', including a YouTube long-form title, description with three or more accurate chapters, source links, sponsor disclosures, tags, and a pinned comment' : ''}; identify missing assets, rights, QA checks, and unverifiable claims for review. Call submit_playbook_package with the funnel, researched claims, sources, brand references, sponsor review, thumbnail concepts and headlines, platform copy, and review items before finishing.`,
    'Inspect source frames and add footageReview entries for any screen, article, chart, account panel, or other potentially private material shown in the edit. Use source times, normalized 0 to 1 crop rectangles when proposing a crop, the exact element to show, material to hide, and a note. Do not claim a crop has been privacy-approved; flag it for human frame review.',
    'Execution budget: batch related source-frame requests and independent research calls. Inspect one representative frame per source-layout change. Reuse relevant references already supplied. Do not search to verify subjective opinions or obvious jokes. Build the timeline and package in one coherent pass, then one check and a small set of snapshots covering the opening, changed layouts, and ending. Repair observed defects; avoid repeated cosmetic check/snapshot loops. Do not skip speech preservation, factual verification, or final export checks.',
    profile?.preferences.editing?.musicAllowed === true
      ? 'The creator profile explicitly allows added music. Keep speech intelligible and flag any music rights questions for review.'
      : 'Do not add music to this VOD edit. Preserve the source audio unless the creator profile explicitly allows changes.',
    format === '16:9' ? 'In the playbook package, add chapters with finished-timeline start seconds and concise truthful titles. Begin at 0 and propose at least three chapters, each at least 10 seconds. Match the actual spoken topic at each point; do not invent a chapter if the clip has no real section there.' : '',
    profile
      ? `Confirmed creator profile for this project: ${JSON.stringify(profile)}`
      : 'No creator profile is linked. Research public branding for relevant subjects, and flag missing creator-specific information for review.',
    profile?.availableAssets?.length
      ? `The listed creator intro and outro are uploaded media selected for ${format}. If an outro is selected, make it the final shot for at least 1.5 seconds after the creator's complete real sign-off; keep every source word. Use a selected intro only if it does not hide the opening hook. Do not add unapproved music or assume an uploaded asset is licensed for unrelated brands or sponsors. Flag any asset-audio or rights question for review.`
      : '',
    shared && (shared.sources.length || shared.brandReferences?.length)
      ? `Other clips from this VOD already identified these public reference candidates: ${JSON.stringify({ sources: shared.sources.slice(0, 12), brandReferences: shared.brandReferences?.slice(0, 8) ?? [] })}. Reuse a reference only when it applies to this clip. Check each claim, source date, brand identity, and rights question for this clip; do not copy another clip's conclusions or treat a mentioned brand as a sponsor.`
      : '',
  ].join('\n\n');
}
