---
name: creator-edit-playbook
description: Plan, create, and edit creator videos, podcasts, interviews, and Shorts when a project opts into the creator playbook. A creator profile is optional. Includes footage edits, captions, research, sponsors, thumbnails, and export preparation.
---

# Creator Edit Playbook

Use a selected creator profile as the brand and editorial source of truth when one exists. Project choices override it for this video. A missing profile must not prevent editing. Speaker identities in footage are separate from the creator who owns the project. Never infer a person's real name from a face or voice.

## Automatically detected VOD clips

For automatic clips, the current editorial brief takes precedence over the original workflow example layout. Use speaker-led full-frame footage for conversation and jokes: creatorLayout: {speaker: {x,y,width,height}}. Add the optional top rectangle only for relevant evidence; never invent a context card merely to fill half the frame. Measure crops from source frames; preserve headroom and gestures. Keep opinion classification in review notes. Actual uncertain factual claims still need concise qualifiers. No generic LIVE ON STREAM banners or large disclaimers explaining obvious jokes. AI owns one captions-lane design using app-provided word timing, below the face for speaker-led shots or at the seam for split shots. The app renders it unchanged. Batch inspections and relevant research, reuse supplied sources, and use one review pass plus repairs for observed defects rather than repeated cosmetic loops.

When the user enables pre-editing during clip detection, treat every detected clip as its own edit package. Preserve the original VOD and clip ranges so Raw remains available. Produce an editable timeline and rendered preview for Edited. Research claims and visible entities for that clip, prepare source cards and captions, identify any sponsor read, and prepare a thumbnail and platform copy when the user requested the full playbook. Mark incomplete or unverified parts for review. Never present an incomplete package as approved for publishing.

For the automatic full playbook, call `submit_playbook_package` before finishing. Choose a funnel stage for each clip (reach, trust, sponsor, or creator product), explain the choice, name a measurable outcome, and give reach clips a bridge to a later stage. Put every factual claim into `claims` with its time and verdict. Add dated, retrieved sources to `sources`; an unverified claim needs an on-screen label while spoken. For screen or article footage shown in the edit, add `footageReview` source-time ranges, the element to show, private material to hide, and a proposed normalized crop rectangle when useful. These are review proposals, not privacy approval. Include sponsor status, thumbnail concepts and 2 to 4 thumbnail headlines (each 2 to 4 words, without unverified numbers), platform copy drafts with a pinned comment for each platform, and unresolved review items. The package is an editorial draft until its sources, assets, disclosures, and export are checked.

The creator profile is optional. Use confirmed profile assets and preferences only when present. For a company or product mentioned in the VOD, such as Pepsi, look up current public branding and primary sources as research leads. Record the exact URL and retrieval date. Distinguish that company from the creator's own brand, and do not imply endorsement or sponsorship because the company was mentioned. A public logo, color palette, or press image is not proof of a commercial relationship or permission to use an asset; flag usage rights for review. Never invent a referral URL, discount code, disclosure, or verified creator preference.

For a long-form edit, add proposed `chapters` with finished-timeline start seconds and truthful titles tied to the spoken sections. Begin at 0 and allow at least 10 seconds per chapter. The export checks these against the final duration before adding them to posting copy.

## First project for a creator

Ask for missing preferences in small groups, at most two questions per reply. Establish audience and goal, brand assets, output formats, editing permissions, captions, music, graphics, sponsors, hard rules, and delivery needs. Offer a recommendation when the user is unsure. Summarize choices before building. Store lasting preferences in the creator profile only when the product offers a persistence action; do not claim to remember a rule that was only said in one chat.

For automatic VOD pre-edits, do not block detection on these questions. Use conservative defaults for unknown permissions, leave the creator profile empty, and put unresolved choices in the review list.

## Every project

For an interactive project, confirm the chosen creator, if any, and whether this project uses the playbook. Ask whether the goal is a full edit, shortened version, highlights, Shorts, or a video created from an idea. For automatically detected VOD clips, the detection opt-in supplies that choice and the detected ranges are the source. Respect the selected motion graphics level: none, light, or full. Captions, music, and generated assets are independent choices. If a requested length conflicts with preserving every word, explain the conflict before cutting.

## Source and edit

For source handling, faithful speech cuts, factual source cards, sponsor checks, thumbnails, and delivery checks, read `creator-edit-playbook/references/original-creator-workflow` when that part of the job applies. Its finance/news-show examples are examples; apply its safeguards to this creator and project.

Keep original media untouched. Analyze the whole relevant source. For conversations, identify speaker turns, overlaps, laughter, and visible participants. Match voice to face only when evidence supports it; leave uncertain speakers unnamed and prefer a wide shot. Preserve questions that make answers intelligible. Avoid cuts that change meaning. When the creator requests faithful editing, remove only approved silence or mistakes. Never use transcript word times alone to place a final audio cut.

For idea-led creation, establish a brief, outline, script or talking points, scene plan, assets, and narration permission before assembling the timeline. Never invent facts, quotes, prices, or testimonials. If source media is absent, ask what assets or generated content may be used.

## Research and packaging

For factual claims, keep a dated source and a verdict: verified, partial, unconfirmed, rumor, opinion, prediction, or not found. Label uncertain claims while spoken. Do not turn an unsupported accusation into a title or graphic. Protect private account information and pseudonymous people. Source every displayed number. Confirm current sponsor terms, links, platform restrictions, and disclosures for this project. Never invent a sponsor code or link.

Prepare captions from final audio, then check names and numbers. Prepare titles, descriptions, tags, thumbnails, and chapters only when requested. Use the creator's actual assets; do not silently substitute generated faces or logos.

## Review and delivery

Check playback, sync, audio, readability, cuts, framing, source labels, and disclosures. Report checks as passed, failed, needs review, or unavailable. Never claim a check passed if no tool performed it. Show the user a preview and keep edits reversible. For multiple aspect ratios, make one approved edit and inspect each export framing separately, including captions and graphics. Summarize what is ready and any unresolved issues.
