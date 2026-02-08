<template>
  <div class="motion-graphics-panel">
    <div class="mg-grid">
      <button
        v-for="template in templates"
        :key="template.id"
        class="mg-card"
        @click="addMotionGraphic(template)"
      >
        <div class="mg-preview" :style="{ background: template.previewBg }">
          <span class="mg-preview-icon">{{ template.icon }}</span>
        </div>
        <span class="mg-label">{{ template.name }}</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AIVideoTrack, MotionGraphicTemplate } from '@/types/ai-video';

const emit = defineEmits<{
  (e: 'add', track: AIVideoTrack): void;
}>();

const props = defineProps<{
  currentTime: number;
  compositionDuration: number;
}>();

interface MGTemplate {
  id: MotionGraphicTemplate;
  name: string;
  icon: string;
  previewBg: string;
  defaultDuration: number;
  defaultText: string;
  defaultColors: string[];
  defaultLayer: number;
}

const templates: MGTemplate[] = [
  {
    id: 'lowerThird',
    name: 'Lower Third',
    icon: '📋',
    previewBg: 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    defaultDuration: 4,
    defaultText: 'Name Here|Title or Role',
    defaultColors: ['#6366f1', '#ffffff'],
    defaultLayer: 12,
  },
  {
    id: 'subscribeCTA',
    name: 'Subscribe',
    icon: '🔔',
    previewBg: 'linear-gradient(135deg, #ef4444 0%, #f97316 100%)',
    defaultDuration: 3,
    defaultText: 'SUBSCRIBE',
    defaultColors: ['#ef4444', '#ffffff'],
    defaultLayer: 13,
  },
  {
    id: 'titleCard',
    name: 'Title Card',
    icon: '🎬',
    previewBg: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)',
    defaultDuration: 3,
    defaultText: 'Your Title|Subtitle text here',
    defaultColors: ['rgba(0,0,0,0.85)', '#ffffff'],
    defaultLayer: 14,
  },
  {
    id: 'endScreen',
    name: 'End Screen',
    icon: '🏁',
    previewBg: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    defaultDuration: 5,
    defaultText: 'Thanks for watching!|Subscribe for more',
    defaultColors: ['rgba(0,0,0,0.9)', '#ffffff', '#6366f1'],
    defaultLayer: 14,
  },
  {
    id: 'numberCounter',
    name: 'Counter',
    icon: '🔢',
    previewBg: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    defaultDuration: 3,
    defaultText: '10000',
    defaultColors: ['#fbbf24', '#ffffff'],
    defaultLayer: 12,
  },
  {
    id: 'neonFrame',
    name: 'Neon Frame',
    icon: '💠',
    previewBg: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    defaultDuration: 5,
    defaultText: '',
    defaultColors: ['#00ffff'],
    defaultLayer: 16,
  },
  {
    id: 'logoReveal',
    name: 'Logo Reveal',
    icon: '✨',
    previewBg: 'linear-gradient(135deg, #8b5cf6 0%, #a855f7 100%)',
    defaultDuration: 3,
    defaultText: 'LOGO',
    defaultColors: ['#ffffff', '#6366f1'],
    defaultLayer: 14,
  },
  {
    id: 'particleBackground',
    name: 'Particles',
    icon: '🌟',
    previewBg: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
    defaultDuration: 10,
    defaultText: '',
    defaultColors: ['rgba(255,255,255,0.6)'],
    defaultLayer: 1,
  },
  {
    id: 'progressBar',
    name: 'Progress Bar',
    icon: '📊',
    previewBg: 'linear-gradient(135deg, #6366f1 0%, #4f46e5 100%)',
    defaultDuration: 5,
    defaultText: '',
    defaultColors: ['#6366f1', 'rgba(255,255,255,0.2)'],
    defaultLayer: 15,
  },
  {
    id: 'timerCountdown',
    name: 'Countdown',
    icon: '⏱️',
    previewBg: 'linear-gradient(135deg, #dc2626 0%, #ef4444 100%)',
    defaultDuration: 10,
    defaultText: '10',
    defaultColors: ['#ffffff', '#ef4444'],
    defaultLayer: 12,
  },
  {
    id: 'kineticText',
    name: 'Kinetic Text',
    icon: '💫',
    previewBg: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
    defaultDuration: 4,
    defaultText: 'Your Kinetic Text Here',
    defaultColors: ['#ffffff', '#6366f1'],
    defaultLayer: 13,
  },
  {
    id: 'animatedInfoCard',
    name: 'Info Card',
    icon: '🃏',
    previewBg: 'linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)',
    defaultDuration: 4,
    defaultText: 'FEATURE|Description goes here|$99',
    defaultColors: ['#1e1e2e', '#ffffff', '#6366f1'],
    defaultLayer: 13,
  },
  {
    id: 'dataCounter',
    name: 'Data Ring',
    icon: '🎯',
    previewBg: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 100%)',
    defaultDuration: 3,
    defaultText: '95|Completion|%',
    defaultColors: ['#22d3ee', '#ffffff'],
    defaultLayer: 13,
  },
  {
    id: 'calloutBox',
    name: 'Callout',
    icon: '💬',
    previewBg: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%)',
    defaultDuration: 3,
    defaultText: 'Did you know?|Tap to learn more',
    defaultColors: ['#fbbf24', '#000000'],
    defaultLayer: 13,
  },
  {
    id: 'splitReveal',
    name: 'Split Reveal',
    icon: '🔀',
    previewBg: 'linear-gradient(135deg, #6366f1 0%, #ec4899 100%)',
    defaultDuration: 2,
    defaultText: '',
    defaultColors: ['#6366f1', '#ec4899'],
    defaultLayer: 16,
  },
  {
    id: 'glitchTitle',
    name: 'Glitch Title',
    icon: '⚡',
    previewBg: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
    defaultDuration: 3,
    defaultText: 'GLITCH',
    defaultColors: ['#ffffff', '#00ffff', '#ff00ff'],
    defaultLayer: 14,
  },
  {
    id: 'gradientWave',
    name: 'Gradient BG',
    icon: '🌊',
    previewBg: 'linear-gradient(135deg, #6366f1 0%, #ec4899 50%, #f59e0b 100%)',
    defaultDuration: 8,
    defaultText: '',
    defaultColors: ['#6366f1', '#ec4899', '#f59e0b'],
    defaultLayer: 1,
  },
  {
    id: 'floatingBadge',
    name: 'Badge',
    icon: '🏷️',
    previewBg: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
    defaultDuration: 4,
    defaultText: 'NEW',
    defaultColors: ['#ef4444', '#ffffff'],
    defaultLayer: 15,
  },
  {
    id: 'animatedDivider',
    name: 'Divider',
    icon: '➖',
    previewBg: 'linear-gradient(135deg, #6366f1 0%, #818cf8 100%)',
    defaultDuration: 2,
    defaultText: '',
    defaultColors: ['#6366f1'],
    defaultLayer: 15,
  },
  {
    id: 'spotlightReveal',
    name: 'Spotlight',
    icon: '🔦',
    previewBg: 'linear-gradient(135deg, #000000 0%, #1a1a2e 100%)',
    defaultDuration: 3,
    defaultText: '',
    defaultColors: [],
    defaultLayer: 17,
  },
];

function addMotionGraphic(template: MGTemplate) {
  const startTime = props.currentTime;
  const endTime = Math.min(startTime + template.defaultDuration, props.compositionDuration);

  const track: AIVideoTrack = {
    id: `mg-${template.id}-${Date.now()}`,
    type: 'motionGraphic',
    name: template.name,
    startTime,
    endTime,
    layer: template.defaultLayer,
    properties: {
      x: 50,
      y: 50,
      opacity: 1,
      motionGraphic: {
        templateId: template.id,
        customText: template.defaultText,
        customColors: template.defaultColors,
        animationSpeed: 1,
      },
    },
  };

  emit('add', track);
}
</script>

<style scoped>
.motion-graphics-panel {
  padding: 0;
}

.mg-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 6px;
}

.mg-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 6px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--card);
  cursor: pointer;
  transition: all 0.15s ease;
}

.mg-card:hover {
  border-color: var(--primary);
  background: color-mix(in srgb, var(--primary) 8%, var(--card));
  transform: translateY(-1px);
}

.mg-preview {
  width: 100%;
  aspect-ratio: 16/9;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.mg-preview-icon {
  font-size: 20px;
  filter: drop-shadow(0 1px 3px rgba(0,0,0,0.3));
}

.mg-label {
  font-size: 10px;
  font-weight: 500;
  color: var(--muted-foreground);
  text-align: center;
}

.mg-card:hover .mg-label {
  color: var(--primary);
}
</style>
