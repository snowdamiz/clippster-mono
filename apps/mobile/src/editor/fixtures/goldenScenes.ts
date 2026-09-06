/**
 * Golden parity fixtures for graph evaluation (9:16 and 16:9).
 */
export const GOLDEN_SCENE_9x16 = {
  schemaVersion: 3,
  id: 'golden-9x16',
  canvas: {
    activeRatio: '9:16' as const,
    outputByRatio: {
      '9:16': { width: 1080, height: 1920, fps: 30 as const },
      '16:9': { width: 1920, height: 1080, fps: 30 as const },
    },
  },
  assets: {
    'asset-video': {
      id: 'asset-video',
      kind: 'video',
      sourceUri: 'file:///golden/video.mp4',
      durationTicks: 120000,
      width: 1080,
      height: 1920,
      hasAudio: true,
    },
    'asset-image': {
      id: 'asset-image',
      kind: 'image',
      sourceUri: 'file:///golden/overlay.png',
      durationTicks: 120000,
      width: 512,
      height: 512,
    },
  },
  tracks: [
    {
      id: 'video-track',
      kind: 'video' as const,
      items: [
        {
          id: 'clip-video',
          kind: 'video' as const,
          assetId: 'asset-video',
          timelineStart: 0,
          timelineEnd: 60000,
          sourceStart: 0,
          sourceEnd: 60000,
          speed: 1,
          volume: 1,
          transform: {
            base: {
              positionX: 0.5,
              positionY: 0.5,
              scaleX: 1,
              scaleY: 1,
              rotationDeg: 0,
              anchorX: 0.5,
              anchorY: 0.5,
              fit: 'cover' as const,
            },
          },
          effectStack: [{ type: 'blur' as const, intensity: 40 }],
          label: 'Golden A',
        },
      ],
      transitions: [],
    },
    {
      id: 'overlay-track',
      kind: 'overlay' as const,
      items: [
        {
          id: 'clip-overlay',
          kind: 'overlay' as const,
          assetId: 'asset-image',
          timelineStart: 15000,
          timelineEnd: 45000,
          sourceStart: 0,
          sourceEnd: 30000,
          speed: 1,
          volume: 0,
          opacity: 0.8,
          crop: { x: 0, y: 0, width: 1, height: 1 },
          transform: {
            base: {
              positionX: 0.75,
              positionY: 0.2,
              scaleX: 0.35,
              scaleY: 0.35,
              rotationDeg: 0,
              anchorX: 0.5,
              anchorY: 0.5,
              fit: 'contain' as const,
            },
          },
          effectStack: [{ type: 'vignette' as const, intensity: 55 }],
        },
      ],
    },
    {
      id: 'text-track',
      kind: 'text' as const,
      items: [
        {
          id: 'clip-text',
          kind: 'text' as const,
          content: 'GOLDEN',
          style: {
            fontFamily: 'System',
            fontSize: 64,
            color: '#FFFFFFFF',
            alignment: 'center' as const,
          },
          timelineStart: 10000,
          timelineEnd: 50000,
          animationIn: 'pop',
          animationOut: 'fade',
          transform: {
            base: {
              positionX: 0.5,
              positionY: 0.85,
              scaleX: 1,
              scaleY: 1,
              rotationDeg: 0,
              anchorX: 0.5,
              anchorY: 0.5,
              fit: 'contain' as const,
            },
          },
        },
      ],
    },
  ],
};

export const GOLDEN_SCENE_16x9 = {
  ...GOLDEN_SCENE_9x16,
  id: 'golden-16x9',
  canvas: {
    activeRatio: '16:9' as const,
    outputByRatio: GOLDEN_SCENE_9x16.canvas.outputByRatio,
  },
};

export const GOLDEN_LAYER_KINDS_AT_15K = ['video', 'overlay', 'text'] as const;
