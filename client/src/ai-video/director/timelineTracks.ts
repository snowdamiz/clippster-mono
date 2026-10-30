import { Film, Layers, Music, Type, Image, Shapes, Sparkles, Blend, Smile } from 'lucide-vue-next';
export const TIMELINE_TRACKS = [
  { key: 'graphics', label: 'Graphics', icon: Layers, type: 'sticker' },
  { key: 'text', label: 'Text', icon: Type, type: 'text' },
  { key: 'icons', label: 'Icons', icon: Smile, type: 'sticker' },
  { key: 'images', label: 'Images', icon: Image, type: 'sticker' },
  { key: 'shapes', label: 'Shapes & elements', icon: Shapes, type: 'sticker' },
  { key: 'animation', label: 'Animations', icon: Sparkles, type: 'text' },
  { key: 'transitions', label: 'Transitions', icon: Blend, type: 'sticker' },
  { key: 'video', label: 'Video', icon: Film, type: 'video' },
  { key: 'music', label: 'Audio', icon: Music, type: 'audio' },
] as const;
export type TimelineLane = (typeof TIMELINE_TRACKS)[number]['key'];
