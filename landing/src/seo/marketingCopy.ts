import { CAPTION_LANGUAGES_VERIFIED, PUBLISH_PLATFORMS, publishTargetsLabel } from './productFacts'

export const CLIPPING_TOOL_FAQS = [
  {
    q: 'What is an AI clipping tool?',
    a: 'An AI clipping tool watches a livestream or VOD, finds highlight-worthy moments, and turns them into short clips you can caption and post to TikTok, Reels, or Shorts. Clippster does this in real time on desktop, not only from a finished VOD queue.',
  },
  {
    q: 'Is Clippster better than Opus Clip?',
    a: `It depends on the workflow. Opus Clip is a web app built around queued VOD clipping. Clippster is a desktop clipping tool with live clipping, a full timeline editor, captions in ${CAPTION_LANGUAGES_VERIFIED} languages, and organization campaigns for clipper teams. If you clip during a stream or run a clipping org, Clippster covers more of that job.`,
  },
  {
    q: 'Which platforms does Clippster clip from?',
    a: `You can watch Kick, Twitch, X, YouTube, Rumble, and Pump.fun streams live on desktop, download VODs from supported sources, or upload local files. Exports and schedules target ${publishTargetsLabel(PUBLISH_PLATFORMS)} — not Kick, Twitch, Rumble, or Pump.fun as publish destinations.`,
  },
  {
    q: 'Does Clippster work without uploading my whole VOD to the cloud?',
    a: 'Yes. Clippster is a desktop app. Video stays on your machine until you choose to export or schedule a post.',
  },
  {
    q: 'Can clipping teams use Clippster?',
    a: 'Yes. Organizations can run campaigns, recruit clippers, share assets, review submissions, and post from connected social accounts.',
  },
]

export const CLIPPING_TOOL_COMPARISON = [
  { feature: 'Real-time live clipping', clippster: 'Yes (desktop)', opus: 'No' },
  { feature: 'AI highlight detection', clippster: 'Live + VOD', opus: 'VOD queue' },
  { feature: 'Download VODs', clippster: 'Yes (desktop & mobile)', opus: 'Upload / queue focused' },
  { feature: 'Desktop timeline editor', clippster: 'Multi-track', opus: 'Basic web editor' },
  {
    feature: 'Custom framing & aspect ratios',
    clippster: 'Yes (included)',
    opus: 'Pro-gated (vendor)',
  },
  {
    feature: 'Social posting & scheduling',
    clippster: `Included on paid plans (${publishTargetsLabel()})`,
    opus: 'Available; check plan gates',
  },
  {
    feature: 'Auto-captions',
    clippster: `${CAPTION_LANGUAGES_VERIFIED} languages (verified)`,
    opus: '20+ languages (vendor claim)',
  },
  { feature: 'Picture-in-Picture stream view', clippster: 'Yes', opus: 'No' },
  { feature: 'Clipper campaigns & hiring', clippster: 'Yes', opus: 'No' },
  { feature: 'Local processing', clippster: 'Yes', opus: 'Cloud upload' },
  { feature: 'Starting paid plan', clippster: '$12.99/mo', opus: 'From $15/mo' },
]

export type ComparisonRow = {
  feature: string
  clippster: string
  competitor: string
}

/** Honest comparison matrices keyed by competitor slug (path segment after /vs/). */
export const COMPARISON_MATRICES: Record<string, ComparisonRow[]> = {
  'opus-clip': CLIPPING_TOOL_COMPARISON.map((row) => ({
    feature: row.feature,
    clippster: row.clippster,
    competitor: row.opus,
  })),
  eklipse: [
    { feature: 'Real-time live clipping (desktop)', clippster: 'Yes', competitor: 'Limited / product-dependent' },
    { feature: 'Multi-track timeline editor', clippster: 'Yes', competitor: 'Varies by plan' },
    { feature: 'Clipper campaigns & CPM payouts', clippster: 'Yes', competitor: 'Not a core focus' },
    { feature: 'Publish targets', clippster: publishTargetsLabel(), competitor: 'Check current Eklipse integrations' },
    { feature: 'Local desktop processing', clippster: 'Yes', competitor: 'Primarily web/cloud' },
    { feature: 'Best fit', clippster: 'Live studio + org clipping', competitor: 'Web-first auto clipping' },
  ],
  streamladder: [
    { feature: 'Primary job', clippster: 'Clip, edit, post, campaigns', competitor: 'Clip pages & stream clip tools' },
    { feature: 'Live desktop clipping', clippster: 'Yes', competitor: 'Not the same live-studio model' },
    { feature: 'Multi-track editor', clippster: 'Yes', competitor: 'Lighter clip editing' },
    { feature: 'Org campaign stack', clippster: 'Yes', competitor: 'No equivalent org CPM system' },
    { feature: 'Choose if you need', clippster: 'Production + team ops', competitor: 'Public clip-page workflows' },
  ],
  medal: [
    { feature: 'Primary capture context', clippster: 'Livestreams & VODs', competitor: 'In-game / gameplay clips' },
    { feature: 'AI highlight on streams', clippster: 'Yes', competitor: 'Game-clip oriented' },
    { feature: 'Clipper org campaigns', clippster: 'Yes', competitor: 'No' },
    { feature: 'Social scheduling', clippster: publishTargetsLabel(), competitor: 'Sharing-focused' },
    { feature: 'Overlap', clippster: 'Stream ecosystems', competitor: 'Gameplay clip communities' },
  ],
  powder: [
    { feature: 'AI short-form clipping', clippster: 'Yes', competitor: 'Yes' },
    { feature: 'Desktop live clipping', clippster: 'Yes', competitor: 'Typically VOD/upload focused' },
    { feature: 'Timeline editor depth', clippster: 'Multi-track desktop', competitor: 'Product-dependent' },
    { feature: 'Campaigns / hiring', clippster: 'Built-in', competitor: 'Not equivalent' },
    { feature: 'Honest takeaway', clippster: 'Studio + teams', competitor: 'Compare current Powder plans directly' },
  ],
}

export type GuideStep = { title: string; body: string }

/** Lightweight step stubs for guide templates. */
export const GUIDE_STEPS: Record<string, GuideStep[]> = {
  '/guides/how-to-clip-twitch-streams': [
    { title: 'Open the Twitch source', body: 'Search the channel or paste a Twitch URL in Clippster desktop.' },
    { title: 'Clip live or download the VOD', body: 'Use live watch with hotkeys/AI detect, or download the VOD on desktop or mobile.' },
    { title: 'Edit and export vertical', body: 'Trim, caption, and frame to 9:16 on the timeline.' },
    { title: 'Schedule to short-form', body: `Publish to ${publishTargetsLabel()} — not back to Twitch.` },
  ],
  '/guides/how-to-clip-kick-streams': [
    { title: 'Open the Kick channel', body: 'Paste a Kick URL or channel slug on desktop.' },
    { title: 'Clip during the live or from VOD', body: 'Live clipping is desktop; VOD works on desktop and mobile.' },
    { title: 'Edit the highlight', body: 'Use the timeline for cuts, captions, and vertical framing.' },
    { title: 'Post elsewhere', body: 'Kick is source-only. Schedule to Instagram, TikTok, X, or YouTube.' },
  ],
  '/guides/clip-pumpfun-livestreams': [
    { title: 'Use desktop only', body: 'Pump.fun ingest is not on mobile — open Clippster desktop.' },
    { title: 'Connect the mint / stream', body: 'Paste a Pump.fun URL or mint ID and start live or VOD ingest.' },
    { title: 'Clip and edit locally', body: 'Create highlights, caption, and export vertical clips.' },
    { title: 'Publish to supported networks', body: 'There is no publish-to-Pump.fun path.' },
  ],
  '/guides/clip-during-live-stream': [
    { title: 'Start live watch on desktop', body: `Open Kick, Twitch, X, YouTube, Rumble, or Pump.fun live with PiP if you need the stream on top.` },
    { title: 'Use DVR and hotkeys', body: 'Scrub the buffer and clip instantly without waiting for the VOD.' },
    { title: 'Optional realtime AI detect', body: 'Let desktop AI flag highlight moments while the stream runs.' },
    { title: 'Finish in the editor', body: 'Polish, caption, and schedule the export.' },
  ],
  '/guides/twitch-to-tiktok-workflow': [
    { title: 'Clip the Twitch moment', body: 'Live or VOD ingest in Clippster.' },
    { title: 'Vertical crop', body: 'Reframe to 9:16 for TikTok safe areas.' },
    { title: 'Caption', body: `Add auto-captions (${CAPTION_LANGUAGES_VERIFIED} verified languages).` },
    { title: 'Schedule to TikTok', body: 'Connect TikTok via PostForMe and publish or schedule.' },
  ],
  '/guides/stream-to-youtube-shorts': [
    { title: 'Ingest the stream or VOD', body: 'YouTube live/VOD or another supported source.' },
    { title: 'Build a Shorts-length cut', body: 'Keep it vertical and concise in the editor.' },
    { title: 'Caption and review', body: 'Burn captions and check framing.' },
    { title: 'Publish Shorts', body: 'Connect YouTube and publish through PostForMe.' },
  ],
  '/guides/vertical-crop-for-tiktok-reels-shorts': [
    { title: 'Pick the clip', body: 'Open the highlight in the desktop editor or clip build flow.' },
    { title: 'Set 9:16 framing', body: 'Adjust POI/framing so faces and gameplay stay in frame.' },
    { title: 'Preview safe areas', body: 'Check UI overlays for TikTok, Reels, and Shorts.' },
    { title: 'Export', body: 'Render the vertical preset locally.' },
  ],
  '/guides/auto-captions-for-clips': [
    { title: 'Transcribe the clip', body: 'Run caption generation in the desktop editor.' },
    { title: 'Choose language', body: `Select among ${CAPTION_LANGUAGES_VERIFIED} verified languages.` },
    { title: 'Style timing', body: 'Adjust presets and fix any timing issues.' },
    { title: 'Burn in or export soft', body: 'Export with captions for short-form posting.' },
  ],
  '/guides/how-to-run-a-clipping-campaign': [
    { title: 'Create the campaign', body: 'Set budget, platforms, and creative rules in the org dashboard.' },
    { title: 'Invite clippers', body: 'Use hiring posts or direct invites.' },
    { title: 'Review submissions', body: 'Approve posts that match brand and tracking rules.' },
    { title: 'Pay on performance', body: 'Use CPM or configured payout rules for verified submissions.' },
  ],
  '/guides/how-to-hire-clippers': [
    { title: 'Publish a hiring post', body: 'Describe rates, niches, and expectations.' },
    { title: 'Browse the directory', body: 'Review public clipper profiles and specialties.' },
    { title: 'Onboard into a campaign', body: 'Invite accepted clippers and share assets.' },
  ],
  '/guides/make-money-clipping-streams': [
    { title: 'Create a clipper profile', body: 'Show portfolio clips and platforms you cover.' },
    { title: 'Join campaigns', body: 'Apply to org campaigns that match your niche.' },
    { title: 'Submit tracked posts', body: 'Post clips and submit links for review.' },
    { title: 'Get paid per terms', body: 'Earnings follow campaign CPM/rules — never guaranteed.' },
  ],
  '/guides/clipper-payouts-cpm': [
    { title: 'Org sets CPM rules', body: 'Campaign defines how views convert to pay.' },
    { title: 'Clipper submits posts', body: 'Submissions carry platform and view metadata.' },
    { title: 'Views get verified', body: 'Org reviews and verifies performance.' },
    { title: 'Payouts calculate', body: 'Payment math runs on verified submissions.' },
  ],
  '/guides/track-clip-views-across-platforms': [
    { title: 'Connect publish accounts', body: `Link ${publishTargetsLabel()} via PostForMe.` },
    { title: 'Publish or schedule clips', body: 'Posts must go through connected accounts for sync.' },
    { title: 'Review post metrics', body: 'Check views and engagement on synced posts.' },
    { title: 'Use campaign views for teams', body: 'Orgs track submission performance inside campaigns.' },
  ],
}
