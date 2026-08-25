import type { StylePackId, StylePackRecipe } from '@/types/ai-video';

export const AI_VIDEO_STYLE_PACKS: readonly StylePackRecipe[] = [
  {
    schemaVersion: 1,
    id: 'sports-highlights',
    name: 'Sports Highlights',
    category: 'Highlights',
    description: 'Fast, high-contrast edits with bold captions and peak-moment punch.',
    pacing: {
      targetShotSeconds: [0.8, 2.5],
      cutsPerMinute: [30, 55],
      peakBehavior: 'Cut or punch zoom on reactions and audio peaks.',
    },
    captions: {
      style: 'bold condensed',
      placement: 'lower center',
      animation: 'scale-in emphasis',
      font: 'Impact, Anton, sans-serif',
      weight: 900,
      colors: ['#FFFFFF', '#FACC15'],
      stroke: '#000000',
    },
    typography: {
      title: 'Condensed all-caps score-card title',
      lowerThird: 'Name and score bar without league branding',
    },
    colorGrade: {
      palette: ['#FFFFFF', '#FACC15', '#111827'],
      contrast: 1.18,
      saturation: 1.12,
      temperature: 'neutral',
      treatment: ['subtle vignette'],
    },
    transitions: {
      families: ['zoom', 'wipe', 'white-flash'],
      durationSeconds: [0.12, 0.35],
      frequency: 'at peaks only',
    },
    motion: {
      camera: ['punch-zoom', 'push-in', 'shake'],
      intensity: 0.75,
      imageBehavior: 'Quick push-in toward the subject.',
    },
    effects: { families: ['white-flash', 'vignette'], frequency: 'medium' },
    layout: {
      overlays: ['score lower third', 'peak title'],
      safeZones: 'Keep text inside broadcast and social safe zones.',
      titlePlacement: 'upper third',
    },
    aspectRatios: {
      '16:9': {
        layout: 'Wide score bar and subject-centered framing.',
        captionPlacement: 'bottom 12%',
      },
      '9:16': {
        layout: 'Compact score card above the lower social UI zone.',
        captionPlacement: 'bottom 24%',
      },
    },
    rendererFallbacks: {
      speedRamp: 'Use a short punch zoom and hard cut.',
      motionBlurWipe: 'Use the supported directional wipe.',
    },
  },
  {
    schemaVersion: 1,
    id: 'wedding-film',
    name: 'Wedding Film',
    category: 'Lifestyle',
    description: 'Warm, restrained storytelling with elegant type and soft movement.',
    pacing: {
      targetShotSeconds: [3.5, 7],
      cutsPerMinute: [8, 18],
      peakBehavior: 'Hold emotional reactions and dissolve on musical phrases.',
    },
    captions: {
      style: 'quiet subtitle',
      placement: 'lower center',
      animation: 'soft fade',
      font: 'Inter, sans-serif',
      weight: 500,
      colors: ['#FFF8ED'],
      background: 'rgba(30,20,15,0.25)',
    },
    typography: {
      title: 'Elegant serif title with generous spacing',
      lowerThird: 'Minimal serif name and date',
    },
    colorGrade: {
      palette: ['#FFF8ED', '#D6A77A', '#6B4F3A'],
      contrast: 0.92,
      saturation: 0.9,
      temperature: 'warm',
      treatment: ['soft highlights', 'restrained grain'],
    },
    transitions: {
      families: ['dissolve', 'dip-to-white'],
      durationSeconds: [0.6, 1.3],
      frequency: 'low',
    },
    motion: {
      camera: ['slow-push-in', 'gentle-pan'],
      intensity: 0.25,
      imageBehavior: 'Slow Ken Burns movement.',
    },
    effects: { families: ['film-grain', 'soft-vignette'], frequency: 'low' },
    layout: {
      overlays: ['minimal title', 'date lower third'],
      safeZones: 'Keep type away from faces.',
      titlePlacement: 'center',
    },
    aspectRatios: {
      '16:9': {
        layout: 'Optional subtle letterbox with centered titles.',
        captionPlacement: 'bottom 10%',
      },
      '9:16': {
        layout: 'No letterbox; crop around faces and hands.',
        captionPlacement: 'bottom 20%',
      },
    },
    rendererFallbacks: {
      opticalFlowSlowMotion: 'Use a slow push-in at native speed.',
      filmEmulation: 'Use warm grade, subtle grain, and vignette.',
    },
  },
  {
    schemaVersion: 1,
    id: 'cinematic',
    name: 'Cinematic',
    category: 'Film',
    description: 'Deliberate pacing, sparse titles, dramatic grade, and controlled motion.',
    pacing: {
      targetShotSeconds: [2.5, 6],
      cutsPerMinute: [10, 24],
      peakBehavior: 'Use longer holds before decisive cuts.',
    },
    captions: {
      style: 'minimal',
      placement: 'lower center',
      animation: 'fade and blur-in',
      font: 'Inter, sans-serif',
      weight: 500,
      colors: ['#F5F1E8'],
    },
    typography: {
      title: 'Sparse uppercase title with wide tracking',
      lowerThird: 'Small restrained sans-serif lower third',
    },
    colorGrade: {
      palette: ['#0F3940', '#D9824B', '#111111'],
      contrast: 1.12,
      saturation: 0.82,
      temperature: 'teal shadows and warm highlights',
      treatment: ['grain', 'vignette', 'optional letterbox'],
    },
    transitions: {
      families: ['cut', 'dip-to-black', 'dissolve'],
      durationSeconds: [0.4, 1],
      frequency: 'low',
    },
    motion: {
      camera: ['slow-push-in', 'slow-pan'],
      intensity: 0.35,
      imageBehavior: 'Controlled push-in with no abrupt movement.',
    },
    effects: { families: ['grain', 'vignette', 'letterbox'], frequency: 'restrained' },
    layout: {
      overlays: ['title card'],
      safeZones: 'Sparse overlays with generous margins.',
      titlePlacement: 'center',
    },
    aspectRatios: {
      '16:9': { layout: 'Wide framing with optional letterbox.', captionPlacement: 'bottom 10%' },
      '9:16': { layout: 'Subject-first crop; remove letterbox.', captionPlacement: 'bottom 22%' },
    },
    rendererFallbacks: {
      anamorphicFlare: 'Use a brief supported light flash.',
      depthMapParallax: 'Use a slow scale and pan.',
    },
  },
  {
    schemaVersion: 1,
    id: 'gaming-stream',
    name: 'Gaming / Stream',
    category: 'Gaming',
    description: 'Energetic outlined captions, zoom pulses, and sparse glitch accents.',
    pacing: {
      targetShotSeconds: [0.7, 2.2],
      cutsPerMinute: [32, 65],
      peakBehavior: 'Jump cut and zoom pulse on reactions.',
    },
    captions: {
      style: 'thick outlined emphasis',
      placement: 'lower center',
      animation: 'bounce and scale-in',
      font: 'Inter, sans-serif',
      weight: 900,
      colors: ['#FFFFFF', '#22D3EE', '#F472B6'],
      stroke: '#09090B',
    },
    typography: {
      title: 'Bold angular gaming title',
      lowerThird: 'Streamer name bar and optional CTA',
    },
    colorGrade: {
      palette: ['#22D3EE', '#A855F7', '#F472B6'],
      contrast: 1.18,
      saturation: 1.22,
      temperature: 'cool neon',
      treatment: ['high contrast'],
    },
    transitions: {
      families: ['glitch', 'zoom', 'cut'],
      durationSeconds: [0.1, 0.3],
      frequency: 'sparingly at peaks',
    },
    motion: {
      camera: ['zoom-pulse', 'punch-zoom', 'shake'],
      intensity: 0.8,
      imageBehavior: 'Fast scale pulse.',
    },
    effects: { families: ['rgb-split', 'glitch', 'flash'], frequency: 'medium' },
    layout: {
      overlays: ['gaming lower third', 'subscribe CTA'],
      safeZones: 'Do not cover gameplay HUD or face camera.',
      titlePlacement: 'top or side',
    },
    aspectRatios: {
      '16:9': { layout: 'Preserve gameplay HUD; side-align CTAs.', captionPlacement: 'bottom 12%' },
      '9:16': {
        layout: 'Stack face camera and gameplay when present.',
        captionPlacement: 'bottom 24%',
      },
    },
    rendererFallbacks: {
      rgbSplit: 'Use a short supported glitch title or hue accent.',
      stingerTransition: 'Use a fast zoom transition.',
    },
  },
  {
    schemaVersion: 1,
    id: 'news-breakdown',
    name: 'News / Breakdown',
    category: 'Editorial',
    description: 'Readable documentary captions and structured information overlays.',
    pacing: {
      targetShotSeconds: [2, 5],
      cutsPerMinute: [14, 30],
      peakBehavior: 'Cut on topic changes and supporting evidence.',
    },
    captions: {
      style: 'documentary subtitle',
      placement: 'lower center',
      animation: 'short fade',
      font: 'Inter, sans-serif',
      weight: 700,
      colors: ['#FFFFFF'],
      background: 'rgba(0,0,0,0.72)',
    },
    typography: { title: 'Clean headline bar', lowerThird: 'Name and role lower third' },
    colorGrade: {
      palette: ['#F8FAFC', '#2563EB', '#111827'],
      contrast: 1.04,
      saturation: 0.96,
      temperature: 'neutral',
      treatment: ['clean neutral grade'],
    },
    transitions: {
      families: ['cut', 'crossfade', 'dip-to-black'],
      durationSeconds: [0.2, 0.65],
      frequency: 'low',
    },
    motion: {
      camera: ['subtle-push-in', 'static'],
      intensity: 0.2,
      imageBehavior: 'Slow move for still evidence.',
    },
    effects: { families: ['subtle-vignette'], frequency: 'rare' },
    layout: {
      overlays: ['headline bar', 'name lower third', 'evidence callout'],
      safeZones: 'Keep facts readable and clear of faces.',
      titlePlacement: 'upper third',
    },
    aspectRatios: {
      '16:9': { layout: 'Wide headline and evidence panel.', captionPlacement: 'bottom 11%' },
      '9:16': { layout: 'Stack headline, subject, and evidence.', captionPlacement: 'bottom 23%' },
    },
    rendererFallbacks: {
      liveTicker: 'Use a static supported headline bar.',
      trackedCallout: 'Use a fixed callout box near the subject.',
    },
  },
  {
    schemaVersion: 1,
    id: 'viral-social',
    name: 'Viral Social',
    category: 'Social',
    description: '9:16-first jump-cut energy with large karaoke captions and punch zooms.',
    pacing: {
      targetShotSeconds: [0.6, 1.8],
      cutsPerMinute: [38, 75],
      peakBehavior: 'Punch zoom or pop text on emphasized words.',
    },
    captions: {
      style: 'large karaoke emphasis',
      placement: 'center-lower',
      animation: 'pop-in by phrase',
      font: 'Inter, sans-serif',
      weight: 900,
      colors: ['#FFFFFF', '#FDE047', '#4ADE80'],
      stroke: '#000000',
    },
    typography: { title: 'Large direct hook', lowerThird: 'Compact creator or CTA badge' },
    colorGrade: {
      palette: ['#FFFFFF', '#FDE047', '#111827'],
      contrast: 1.16,
      saturation: 1.18,
      temperature: 'neutral-bright',
      treatment: ['bright highlights'],
    },
    transitions: {
      families: ['cut', 'zoom', 'wipe'],
      durationSeconds: [0.08, 0.25],
      frequency: 'only between valid adjacent shots',
    },
    motion: {
      camera: ['punch-zoom', 'quick-reframe'],
      intensity: 0.85,
      imageBehavior: 'Quick push-in with a short hold.',
    },
    effects: { families: ['pop-text', 'white-flash'], frequency: 'medium-high' },
    layout: {
      overlays: ['hook title', 'CTA badge'],
      safeZones: 'Keep critical content clear of social app chrome.',
      titlePlacement: 'upper center',
    },
    aspectRatios: {
      '16:9': {
        layout: 'Center the social identity in a wide frame.',
        captionPlacement: 'bottom 12%',
      },
      '9:16': {
        layout: 'Primary layout; reserve top and bottom UI zones.',
        captionPlacement: 'bottom 25%',
      },
    },
    rendererFallbacks: {
      wordTrackedCaptions: 'Animate supported phrase-level caption groups.',
      autoReframe: 'Use a centered crop with explicit keyframed position.',
    },
  },
] as const;

export function getAIStylePack(id: StylePackId | null | undefined): StylePackRecipe | null {
  return AI_VIDEO_STYLE_PACKS.find((pack) => pack.id === id) ?? null;
}
