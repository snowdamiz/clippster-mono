import type { ContentSection } from './contentSections'
import { COMPARISON_MATRICES, GUIDE_STEPS } from './marketingCopy'
import {
  CAPTION_LANGUAGES_VERIFIED,
  HONEST_LIMITATIONS,
  PLATFORMS,
  PUBLISH_PLATFORMS,
  liveWatchPlatformsLabel,
  publishTargetsLabel,
  type IngestPlatformId,
} from './productFacts'

const PUBLISH_LABEL = publishTargetsLabel(PUBLISH_PLATFORMS)
const LIVE_WATCH_LABEL = liveWatchPlatformsLabel()

function limitationsSection(extra: string[] = []): ContentSection[] {
  return [
    { type: 'heading', text: 'Limitations' },
    {
      type: 'bullets',
      items: [...extra, ...HONEST_LIMITATIONS.slice(0, 4)],
    },
  ]
}

function comparisonTable(slug: string, competitorLabel: string): ContentSection {
  const rows = COMPARISON_MATRICES[slug] ?? []
  return {
    type: 'table',
    headers: ['Feature', 'Clippster', competitorLabel],
    rows: rows.map((r) => [r.feature, r.clippster, r.competitor]),
  }
}

function platformSections(id: IngestPlatformId): ContentSection[] {
  const p = PLATFORMS[id]
  const publishLine =
    p.publish.length > 0
      ? `${p.label} is both an ingest source and a PostForMe publish target (${publishTargetsLabel(p.publish)}).`
      : `${p.label} is a clip source only. Publish finished clips to ${PUBLISH_LABEL} — not back to ${p.label}.`

  return [
    {
      type: 'paragraph',
      text: `Clippster clips from ${p.label} as an ingest source: ${p.notes} ${publishLine}`,
    },
    { type: 'heading', text: 'What you can do' },
    {
      type: 'bullets',
      items: [
        p.liveWatch
          ? `Live watch and clip on desktop (PiP, DVR, hotkeys, realtime AI detect).`
          : `No full Twitch-style live-watch claim for ${p.label} — focus is download and clip.`,
        p.vodDownload ? `VOD / broadcast download on desktop.` : `VOD download is not claimed for ${p.label}.`,
        p.mobileVod
          ? `VOD download on the mobile companion.`
          : `No mobile VOD path for ${p.label} (desktop-only ingest).`,
        p.publish.length > 0
          ? `Schedule or publish to ${publishTargetsLabel(p.publish)} via PostForMe.`
          : `No native publish-to-${p.label} path.`,
      ],
    },
    { type: 'heading', text: 'Typical workflow' },
    {
      type: 'steps',
      items: [
        {
          title: 'Open the source',
          body: p.desktop
            ? `Paste a ${p.label} URL or channel in Clippster desktop${p.mobileVod ? ' (VOD also on mobile)' : ''}.`
            : `Use Clippster where ${p.label} ingest is supported.`,
        },
        {
          title: 'Clip the moment',
          body: p.liveWatch
            ? 'Clip live with hotkeys or AI detect, or download the VOD and detect highlights after.'
            : 'Download the VOD or broadcast, then detect or cut the highlight.',
        },
        {
          title: 'Edit vertically',
          body: `Trim, caption (${CAPTION_LANGUAGES_VERIFIED} verified languages), and frame to 9:16.`,
        },
        {
          title: 'Export or schedule',
          body:
            p.publish.length > 0
              ? `Publish or schedule to ${publishTargetsLabel(p.publish)} on a paid plan with connected accounts.`
              : `Export or schedule to ${PUBLISH_LABEL} — not to ${p.label}.`,
        },
      ],
    },
    ...limitationsSection([p.notes]),
  ]
}

function guideSections(
  path: string,
  opening: string,
  howHeading: string,
  extraLimitations: string[] = [],
): ContentSection[] {
  const steps = GUIDE_STEPS[path]
  return [
    { type: 'paragraph', text: opening },
    { type: 'heading', text: howHeading },
    ...(steps ? [{ type: 'steps' as const, items: steps }] : []),
    ...limitationsSection(extraLimitations),
  ]
}

function comparisonSections(
  slug: string,
  competitorLabel: string,
  opening: string,
  chooseClippster: string,
): ContentSection[] {
  return [
    { type: 'paragraph', text: opening },
    { type: 'heading', text: 'Feature comparison' },
    comparisonTable(slug, competitorLabel),
    { type: 'heading', text: 'Why creators pick Clippster' },
    { type: 'paragraph', text: chooseClippster },
    ...limitationsSection([
      'Competitor features change — verify current plans on their site before switching.',
    ]),
  ]
}

export const PAGE_BODIES: Record<string, ContentSection[]> = {
  '/clipping-tool': [
    {
      type: 'paragraph',
      text: `Clippster is an AI clipping tool that turns livestreams and VODs into short-form clips on desktop. It detects highlights in real time while a stream is live, edits on a multi-track timeline, captions in ${CAPTION_LANGUAGES_VERIFIED} languages, and schedules posts to ${PUBLISH_LABEL}. Unlike queue-only web tools, video stays local until you export or publish.`,
    },
    { type: 'heading', text: 'What an AI clipping tool does' },
    {
      type: 'bullets',
      items: [
        'Watches a live stream or VOD for highlight-worthy moments',
        'Cuts those moments into short clips ready for TikTok, Reels, or Shorts',
        'Lets you caption, reframe, and schedule without a separate editor for most stream workflows',
      ],
    },
    { type: 'heading', text: 'How Clippster works' },
    {
      type: 'steps',
      items: [
        {
          title: 'Ingest',
          body: `Watch ${LIVE_WATCH_LABEL} live on desktop, download VODs from supported sources, or upload a local file.`,
        },
        {
          title: 'Detect and clip',
          body: 'Use realtime AI detect during live, or run detection on a VOD, plus hotkey clips with PiP and DVR.',
        },
        {
          title: 'Edit',
          body: `Polish on the desktop timeline: cuts, framing, captions (${CAPTION_LANGUAGES_VERIFIED} verified languages).`,
        },
        {
          title: 'Publish',
          body: `Schedule or post to ${PUBLISH_LABEL} via PostForMe on a paid plan. Kick, Twitch, Rumble, and Pump.fun are sources only.`,
        },
      ],
    },
    { type: 'heading', text: 'Who it is for' },
    {
      type: 'bullets',
      items: [
        'Streamers who clip during the broadcast, not only after the VOD',
        'Clippers who need vertical exports and social scheduling',
        'Organizations that run campaigns, hiring, and shared assets',
      ],
    },
    ...limitationsSection(),
  ],

  '/video-editor': [
    {
      type: 'paragraph',
      text: `Clippster’s desktop video editor is a full multi-track creator NLE—cuts, overlays, captions (${CAPTION_LANGUAGES_VERIFIED} languages), effects, color tools, branding, and local export. It pairs naturally with stream clipping and social publishing, but it is not limited to short-form-only projects. Mobile has a simpler trim/caption/framing flow; the full multi-track timeline is desktop-only.`,
    },
    { type: 'heading', text: 'Editor capabilities' },
    {
      type: 'bullets',
      items: [
        'Multi-track timeline for video, audio, text, stickers, effects, and captions',
        `Auto-captions with ${CAPTION_LANGUAGES_VERIFIED} verified languages`,
        'Effects, transitions, color adjust, and branding (watermarks, intros/outros)',
        'Social canvas presets (including 9:16) plus local MP4/WebM export',
        'Local processing on desktop until you choose to export or schedule',
      ],
    },
    { type: 'heading', text: 'Typical edit flow' },
    {
      type: 'steps',
      items: [
        { title: 'Open media', body: 'Bring in a live clip, VOD highlight, or local file.' },
        { title: 'Trim and arrange', body: 'Use the multi-track timeline to cut, layer, and assemble the edit.' },
        { title: 'Caption, style, and frame', body: 'Generate captions, apply look tools, and set framing for your destination.' },
        { title: 'Export or schedule', body: `Render locally or publish to ${PUBLISH_LABEL}.` },
      ],
    },
    ...limitationsSection([
      'Mobile editor is a companion trim/caption/framing flow — not the full desktop timeline.',
      'Not a Premiere/Resolve-class film finishing suite (pro delivery codecs, multicam interchange, broadcast audio/color pipelines).',
    ]),
  ],

  '/live-stream-clipping': [
    {
      type: 'paragraph',
      text: `Live stream clipping in Clippster means you watch ${LIVE_WATCH_LABEL} on desktop, clip with hotkeys or realtime AI detect, and scrub a DVR buffer—without waiting for the VOD. Picture-in-Picture keeps the stream visible while you work. Live DVR, PiP, and realtime detect are desktop features; mobile is VOD, edit, and posting.`,
    },
    { type: 'heading', text: 'Desktop live toolkit' },
    {
      type: 'bullets',
      items: [
        `Live watch for ${LIVE_WATCH_LABEL}`,
        'Picture-in-Picture stream view',
        'DVR scrubbing of the live buffer',
        'Hotkey clips and realtime AI highlight detection',
      ],
    },
    { type: 'heading', text: 'How to clip during a live' },
    {
      type: 'steps',
      items: [
        { title: 'Start live watch', body: `Open a supported channel on Clippster desktop (${LIVE_WATCH_LABEL}); enable PiP if you need the stream on top.` },
        { title: 'Clip the moment', body: 'Use hotkeys or let realtime AI flag highlights while the broadcast runs.' },
        { title: 'Scrub if you missed it', body: 'Use DVR to go back in the buffer without waiting for the VOD.' },
        { title: 'Finish and post', body: `Edit on the timeline, then schedule to ${PUBLISH_LABEL}.` },
      ],
    },
    ...limitationsSection([
      'Live DVR, PiP, and realtime detect are not available on mobile.',
    ]),
  ],

  '/clipping-campaigns': [
    {
      type: 'paragraph',
      text: 'A clipping campaign is a structured job for clippers: an organization sets goals, budgets, and payout rules; clippers submit posts; the org reviews and pays on performance. Clippster organizations manage campaigns, invites, submissions, and CPM-style payouts from one dashboard.',
    },
    { type: 'heading', text: 'Campaign building blocks' },
    {
      type: 'bullets',
      items: [
        'Budgets and CPM or campaign payout rules',
        'Clipper invites and hiring posts',
        'Submission review and approval',
        'Performance tracking for verified posts',
      ],
    },
    { type: 'heading', text: 'How to run a campaign' },
    {
      type: 'steps',
      items: [
        { title: 'Create the campaign', body: 'Define budget, platforms, and creative rules in the org dashboard.' },
        { title: 'Invite clippers', body: 'Use hiring posts, the directory, or direct invites.' },
        { title: 'Review submissions', body: 'Approve posts that match brand and tracking rules.' },
        { title: 'Pay on performance', body: 'Apply CPM or configured payout rules to verified submissions.' },
      ],
    },
    ...limitationsSection([
      'Earnings for clippers depend on campaign terms and approved performance — never guaranteed.',
    ]),
  ],

  '/for-organizations': [
    {
      type: 'paragraph',
      text: `Clippster for organizations is a workspace for clipping agencies, streamer teams, and brands that manage multiple clippers, streamers, and campaigns. Share assets, run hiring, review submissions, and publish to ${PUBLISH_LABEL} from connected social accounts. Public org profiles can appear in the organization directory when enabled.`,
    },
    { type: 'heading', text: 'Organization toolkit' },
    {
      type: 'bullets',
      items: [
        'Shared streamers and brand asset libraries',
        'Clipping campaigns with budgets and payouts',
        'Clipper hiring posts and directory discovery',
        `Scheduled posting from connected ${PUBLISH_LABEL} accounts`,
      ],
    },
    { type: 'heading', text: 'Getting started' },
    {
      type: 'steps',
      items: [
        { title: 'Create an organization', body: 'Set up the workspace and invite members with the right roles.' },
        { title: 'Connect streamers and assets', body: 'Add creators you clip for and share brand kits.' },
        { title: 'Launch campaigns or hiring', body: 'Post openings, invite clippers, and track submissions.' },
        { title: 'Publish from one place', body: `Schedule approved clips to ${PUBLISH_LABEL}.` },
      ],
    },
    ...limitationsSection(),
  ],

  '/social-posting': [
    {
      type: 'paragraph',
      text: `Clippster schedules and publishes finished clips to ${PUBLISH_LABEL} through PostForMe. Connect accounts on a paid plan, then post from desktop or mobile. Kick, Twitch, Rumble, and Pump.fun are clip sources—not native publish destinations.`,
    },
    { type: 'heading', text: 'Publish targets' },
    {
      type: 'bullets',
      items: [
        'Instagram (Reels and feed via connected accounts)',
        'TikTok',
        'X',
        'YouTube (including Shorts)',
      ],
    },
    { type: 'heading', text: 'How posting works' },
    {
      type: 'steps',
      items: [
        { title: 'Connect accounts', body: 'Link Instagram, TikTok, X, and/or YouTube via PostForMe on a paid plan.' },
        { title: 'Finish the clip', body: 'Edit, caption, and export a vertical-ready file.' },
        { title: 'Schedule or publish', body: 'Pick the network, caption, and time from Clippster.' },
        { title: 'Track what you posted', body: 'Use clip analytics for PostForMe-connected posts and campaign submissions.' },
      ],
    },
    ...limitationsSection([
      'Scheduling and publishing require a paid plan and connected social accounts.',
    ]),
  ],

  '/clip-analytics': [
    {
      type: 'paragraph',
      text: 'Clippster clip analytics sync post-level metrics for PostForMe-connected accounts and campaign submissions—views, likes, comments, and related engagement—so teams can see which clips earned attention. It is not a full social analytics suite or a competitor to dedicated analytics platforms.',
    },
    { type: 'heading', text: 'What you can track' },
    {
      type: 'bullets',
      items: [
        'Post-level views and engagement for connected publishers',
        'Campaign submission performance for organizations',
        `Metrics for posts published through ${PUBLISH_LABEL} via PostForMe`,
      ],
    },
    { type: 'heading', text: 'How to use analytics' },
    {
      type: 'steps',
      items: [
        { title: 'Connect publish accounts', body: `Link ${PUBLISH_LABEL} via PostForMe.` },
        { title: 'Publish through Clippster', body: 'Posts must go through connected accounts for sync.' },
        { title: 'Review metrics', body: 'Check views and engagement on synced posts.' },
        { title: 'Use campaign views for teams', body: 'Orgs track submission performance inside campaigns.' },
      ],
    },
    ...limitationsSection([
      'Analytics cover PostForMe-connected posts and campaign submissions — not every network on the internet.',
    ]),
  ],

  '/design-studio': [
    {
      type: 'paragraph',
      text: 'Design Studio is a desktop beta for stream thumbnails and social graphics with canvas presets inside the Clippster workspace. It is not a Photoshop alternative, not a mobile photo editor, and not positioned as a general image editor.',
    },
    { type: 'heading', text: 'What Design Studio is for' },
    {
      type: 'bullets',
      items: [
        'Stream thumbnails and social graphics',
        'Canvas presets alongside clipping tools',
        'Desktop-only beta workflow',
      ],
    },
    { type: 'heading', text: 'How to try it' },
    {
      type: 'steps',
      items: [
        { title: 'Open Design Studio on desktop', body: 'Access the beta workspace inside Clippster.' },
        { title: 'Pick a canvas preset', body: 'Start from thumbnail or social graphic sizes.' },
        { title: 'Build the graphic', body: 'Compose with tools available in the beta.' },
        { title: 'Export for use', body: 'Save the asset for streams or posts — not for print design workflows.' },
      ],
    },
    ...limitationsSection([
      'Design Studio is desktop beta — expect evolving features and no mobile version.',
    ]),
  ],

  '/platforms/twitch': platformSections('twitch'),
  '/platforms/kick': platformSections('kick'),
  '/platforms/youtube': platformSections('youtube'),
  '/platforms/pumpfun': platformSections('pumpfun'),
  '/platforms/x': platformSections('x'),
  '/platforms/rumble': platformSections('rumble'),

  '/vs/opus-clip': comparisonSections(
    'opus-clip',
    'Opus Clip',
    `Clippster is the desktop clipping studio built for the full job: watch livestreams live, download VODs, detect highlights in real time, finish on a multi-track video editor with custom framing, caption in ${CAPTION_LANGUAGES_VERIFIED} languages, and schedule posts to ${PUBLISH_LABEL} on paid plans with no separate social add-on. Opus Clip is a browser queue for finished VODs—Clippster covers live clipping, editing, posting, and clipper campaigns in one product.`,
    `You want one desktop studio that clips live with PiP, DVR, and hotkeys; downloads VODs; edits on a full multi-track timeline with custom aspect-ratio framing; posts to ${PUBLISH_LABEL} without paying for a separate social add-on; and scales with clipper campaigns, hiring, and CPM payouts when you run a team.`,
  ),

  '/vs/eklipse': comparisonSections(
    'eklipse',
    'Eklipse',
    `Clippster is a desktop clipping studio with live watch, a full multi-track video editor, social posting included on paid plans, and organization campaigns. Eklipse is a web-first clipping product—Clippster is built for creators who need live studio tools and team ops in one place.`,
    `You want desktop live clipping with PiP/DVR, a full multi-track editor, VOD downloads, custom framing, social posting included on paid plans, and clipper campaign operations without stitching together separate tools.`,
  ),

  '/vs/streamladder': comparisonSections(
    'streamladder',
    'StreamLadder',
    'Clippster is a clipping studio with live ingest, a multi-track video editor, social posting, and campaigns. StreamLadder is known for stream clip pages and related tools—different jobs, different depth.',
    'You want to clip live on desktop, download VODs, edit on a full timeline with custom framing, post to short-form networks without a separate social add-on, and run paid clipper campaigns from one workspace.',
  ),

  '/vs/medal': comparisonSections(
    'medal',
    'Medal',
    'Medal focuses on in-game / gameplay clip capture. Clippster is built for livestream and VOD workflows: live watch, AI highlights, multi-track editing, custom framing, social posting, and campaign tools for streamer ecosystems.',
    'You work in livestream and VOD ecosystems and want AI highlights, a full desktop video editor, custom aspect ratios, social posting included on paid plans, and clipper org campaigns—not just gameplay clip sharing.',
  ),

  '/vs/powder': comparisonSections(
    'powder',
    'Powder',
    'Both tools help turn long video into short clips. Clippster’s wedge is live desktop clipping, VOD downloads, a full multi-track editor with custom framing, social posting included on paid plans, and campaign infrastructure for clipper teams.',
    'You want live desktop clipping, VOD downloads, a multi-track editor with custom framing, social posting without a separate add-on, and built-in campaigns/hiring—not only an upload-and-cut pipeline.',
  ),

  '/guides/how-to-clip-twitch-streams': guideSections(
    '/guides/how-to-clip-twitch-streams',
    'To clip Twitch streams in Clippster: open the channel on desktop, clip live or download the VOD, edit vertically with captions, and schedule to short-form networks. Twitch is a source—not a publish target. You do not need a Twitch affiliate account to ingest.',
    'Steps',
    ['Finished clips go to Instagram, TikTok, X, or YouTube — not back to Twitch.'],
  ),

  '/guides/how-to-clip-kick-streams': guideSections(
    '/guides/how-to-clip-kick-streams',
    'Clipping Kick in Clippster matches the Twitch workflow: live desktop watch, VOD on desktop and mobile, edit, then publish to short-form networks. Kick is source-only—Clippster does not post clips to Kick.',
    'Steps',
    ['Kick is a clip source only; schedule to Instagram, TikTok, X, or YouTube.'],
  ),

  '/guides/clip-pumpfun-livestreams': guideSections(
    '/guides/clip-pumpfun-livestreams',
    'Pump.fun clipping is desktop-only via Clippster’s LiveKit ingest path. Open a mint or stream URL, clip live or from VOD, edit locally, and export to short-form publishers. There is no mobile VOD path and no publish-to-Pump.fun.',
    'Steps',
    ['Pump.fun ingest is desktop-only; no mobile VOD and no native publish path.'],
  ),

  '/guides/clip-during-live-stream': guideSections(
    '/guides/clip-during-live-stream',
    'You do not need the VOD to clip on desktop. Start live watch with PiP, scrub DVR, use hotkeys or realtime AI detect, then finish in the editor. Mobile does not include live DVR clipping.',
    'Steps',
    ['Live DVR, PiP, and realtime detect are desktop-only.'],
  ),

  '/guides/twitch-to-tiktok-workflow': guideSections(
    '/guides/twitch-to-tiktok-workflow',
    `A Twitch-to-TikTok workflow in Clippster is clip → vertical crop → caption → schedule. It is not an auto-repost bot. You clip from Twitch (live or VOD), reframe to 9:16, add captions (${CAPTION_LANGUAGES_VERIFIED} verified languages), then publish to TikTok with a connected PostForMe account.`,
    'Steps',
    ['Twitch is the ingest source; TikTok is the publish target via PostForMe.'],
  ),

  '/guides/stream-to-youtube-shorts': guideSections(
    '/guides/stream-to-youtube-shorts',
    'Turn stream highlights into YouTube Shorts inside Clippster: ingest a live or VOD source, build a vertical Shorts-length cut, caption, and publish through connected YouTube on a paid plan via PostForMe.',
    'Steps',
  ),

  '/guides/vertical-crop-for-tiktok-reels-shorts': guideSections(
    '/guides/vertical-crop-for-tiktok-reels-shorts',
    'Export 9:16 for TikTok, Reels, and Shorts. In Clippster, open the clip, set vertical framing so faces and gameplay stay in frame, preview safe areas, and render the vertical preset locally.',
    'Steps',
  ),

  '/guides/auto-captions-for-clips': guideSections(
    '/guides/auto-captions-for-clips',
    `Auto-captions in Clippster generate timed captions for clips in the desktop editor. Verified support covers ${CAPTION_LANGUAGES_VERIFIED} languages—do not rely on older inflated language-count claims. Style timing and burn in before export.`,
    'Steps',
    [`Caption languages are verified at ${CAPTION_LANGUAGES_VERIFIED} — not 40+.`],
  ),

  '/guides/how-to-run-a-clipping-campaign': guideSections(
    '/guides/how-to-run-a-clipping-campaign',
    'Organization accounts create campaigns; clippers join and submit posts. Set budget and CPM rules, invite clippers, review submissions, and pay on verified performance.',
    'Steps',
  ),

  '/guides/how-to-hire-clippers': guideSections(
    '/guides/how-to-hire-clippers',
    'Hire clippers on Clippster by publishing hiring posts, browsing the public clipper directory, and onboarding accepted talent into campaigns with shared assets.',
    'Steps',
  ),

  '/guides/make-money-clipping-streams': guideSections(
    '/guides/make-money-clipping-streams',
    'Clippers earn by joining campaigns, submitting tracked posts, and getting paid per campaign CPM or terms. Clippster does not guarantee income—pay depends on budgets, rules, and approved submissions.',
    'Steps',
    ['No guaranteed clipper income; earnings follow campaign terms and performance.'],
  ),

  '/guides/clipper-payouts-cpm': guideSections(
    '/guides/clipper-payouts-cpm',
    'CPM in clipping campaigns is a cost-per-thousand-views style payout rule organizations configure so clippers are paid on measured performance. Orgs set rates; clippers submit posts; views get verified; payouts calculate from approved submissions.',
    'Steps',
  ),

  '/guides/track-clip-views-across-platforms': guideSections(
    '/guides/track-clip-views-across-platforms',
    `Track clip views for posts published through connected PostForMe accounts (${PUBLISH_LABEL}) and for campaign submissions. This is honest scope—not a full analytics suite covering every network.`,
    'Steps',
    ['Metrics sync for PostForMe-connected posts and campaign submissions only.'],
  ),

  '/methodology': [
    {
      type: 'paragraph',
      text: `Clippster’s public marketing and SEO claims are checked against shipped desktop, mobile, and API code. Unverified model-accuracy percentages and inflated caption-language counts are excluded. Auto-captions are stated as ${CAPTION_LANGUAGES_VERIFIED} verified languages—not 40+.`,
    },
    { type: 'heading', text: 'How we verify claims' },
    {
      type: 'bullets',
      items: [
        'Capabilities must match shipped client, mobile, and server code paths',
        'Platform ingest and publish targets come from productFacts (source vs PostForMe destinations)',
        'Feature caveats (desktop-only live clipping, Pump.fun desktop-only, Design Studio beta) are documented explicitly',
        'Pages carry a reviewedAt date when claims were last checked',
        'Guides and comparisons cite the Clippster Editorial byline for accountable authorship',
      ],
    },
    { type: 'heading', text: 'First-party benchmarks (publish rules)' },
    {
      type: 'paragraph',
      text: 'We only publish numeric benchmarks when they come from reproducible first-party queries (for example anonymized time-to-first-clip, clips produced per stream, live-versus-VOD workflow timing, caption-language coverage tests, or campaign aggregates). Until a metric meets that bar, we document the methodology and withhold the number.',
    },
    {
      type: 'bullets',
      items: [
        'Candidate metrics: time-to-first-clip, clips per stream hour, live vs VOD turnaround, caption language coverage tests, campaign submission aggregates',
        'Requirement: query definition, date window, sample filters, and anonymization rules must be reproducible',
        'Status: public numeric scorecards are withheld until those queries ship — workflow case studies may still describe steps without invented KPIs',
      ],
    },
    { type: 'heading', text: 'What we do not claim' },
    {
      type: 'bullets',
      items: [
        'No “95% accuracy” or similar unverified AI performance percentages',
        `No inflated caption language counts beyond ${CAPTION_LANGUAGES_VERIFIED} verified`,
        'No native publish to Kick, Twitch, Rumble, or Pump.fun',
        'No mobile VOD for Pump.fun (desktop-only ingest)',
        'Design Studio is beta for thumbnails/graphics — not a full image-editor claim',
      ],
    },
    { type: 'heading', text: 'Standing limitations' },
    {
      type: 'bullets',
      items: [...HONEST_LIMITATIONS],
    },
  ],

  '/authors/clippster-editorial': [
    {
      type: 'paragraph',
      text: 'Clippster Editorial is the accountable byline for product guides, platform hubs, competitor comparisons, methodology, and workflow case studies on clippster.app. Content is written for operators and clippers, then checked against shipped desktop, mobile, and API capabilities before publish.',
    },
    { type: 'heading', text: 'What this byline owns' },
    {
      type: 'bullets',
      items: [
        'Pillar and platform pages grounded in productFacts',
        'Guides with answer-first sections and explicit limitations',
        'Competitor comparisons with “choose them if…” honesty',
        'Methodology and case studies that refuse fabricated KPIs',
      ],
    },
    { type: 'heading', text: 'Contact' },
    {
      type: 'paragraph',
      text: 'For corrections to a public claim, use the product contact channels listed on the site. Substantive claim changes update the page reviewedAt date.',
    },
  ],

  '/case-studies/live-clipping-vs-vod-queue': [
    {
      type: 'paragraph',
      text: 'Before: many teams wait for a finished VOD, upload it to a web queue, then wait for AI cuts. After with Clippster desktop: watch the live with PiP, scrub DVR, clip with hotkeys or realtime detect, edit on the timeline, and schedule to short-form networks—without inventing view or accuracy percentages.',
    },
    { type: 'heading', text: 'Before (VOD queue)' },
    {
      type: 'steps',
      items: [
        { title: 'Finish the stream', body: 'Wait until the broadcast ends and the VOD is available.' },
        { title: 'Upload or queue', body: 'Send the long file to a cloud clipping queue.' },
        { title: 'Wait for cuts', body: 'Review AI suggestions after processing completes.' },
        { title: 'Export elsewhere', body: 'Often move clips into another editor or publisher.' },
      ],
    },
    { type: 'heading', text: 'After (live desktop clipping)' },
    {
      type: 'steps',
      items: [
        { title: 'Watch live on desktop', body: `Open ${LIVE_WATCH_LABEL} live with PiP if needed.` },
        { title: 'Clip in the moment', body: 'Hotkeys, DVR scrub, or realtime AI detect during the stream.' },
        { title: 'Edit locally', body: `Trim, caption (${CAPTION_LANGUAGES_VERIFIED} languages), and frame on the timeline.` },
        { title: 'Schedule', body: `Publish to ${PUBLISH_LABEL} via PostForMe when ready.` },
      ],
    },
    ...limitationsSection([
      'This case study is a workflow comparison only — no fabricated time-saved or view-lift percentages.',
    ]),
  ],

  '/case-studies/org-campaign-clipper-workflow': [
    {
      type: 'paragraph',
      text: 'Before: agencies juggle Discord invites, shared Drive folders, and spreadsheet payouts. After with Clippster organizations: campaigns, hiring posts, shared assets, submission review, and CPM rules live in one workspace. Earnings still depend on budgets and approved performance—never guaranteed.',
    },
    { type: 'heading', text: 'Before (ad-hoc ops)' },
    {
      type: 'bullets',
      items: [
        'Clipper hiring scattered across DMs and forms',
        'Brand kits shared as loose file dumps',
        'Submission links tracked in spreadsheets',
        'Payouts negotiated case-by-case without a shared CPM rule set',
      ],
    },
    { type: 'heading', text: 'After (Clippster campaign stack)' },
    {
      type: 'steps',
      items: [
        { title: 'Create the campaign', body: 'Set budget, platforms, and creative rules in the org dashboard.' },
        { title: 'Hire and onboard', body: 'Publish hiring posts, invite clippers, and share assets.' },
        { title: 'Review submissions', body: 'Approve posts that match brand and tracking rules.' },
        { title: 'Pay on verified performance', body: 'Apply CPM or configured payout rules—no guaranteed income claims.' },
      ],
    },
    ...limitationsSection([
      'No invented ROI or clipper-income guarantees; pay follows campaign terms.',
    ]),
  ],
}
