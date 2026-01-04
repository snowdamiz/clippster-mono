
// ==========================================
// Phase 1: Unified Multi-Track Data Model
// ==========================================

export type AnimationProperty = 
  | 'opacity' 
  | 'scale' 
  | 'rotation' 
  | 'position_x' 
  | 'position_y' 
  | 'anchor_x' 
  | 'anchor_y' 
  | 'volume'
  | 'blur'
  | 'brightness'
  | 'contrast'
  | 'saturation';

export type EasingType = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'bezier' | 'step';

export interface Keyframe {
  id: string;
  property: AnimationProperty;
  time: number; // Relative to item start time (seconds)
  value: number;
  easing: EasingType;
  // Bezier control points for custom easing (optional) - used when easing is 'bezier'
  controlPoints?: {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  };
}

export type TimelineItemType = 'video' | 'audio' | 'text' | 'sticker' | 'effect' | 'adjustment_layer' | 'transition' | 'watermark';

export type ItemType = 'trim' | 'audio' | 'text' | 'sticker' | 'watermark' | 'effect' | 'filter' | 'source';

export interface TimelineItem {
  id: string;
  // Polymorphic type discriminator
  type: TimelineItemType;
  
  // Timing
  startTime: number; // Absolute timeline start time (seconds)
  duration: number; // Duration on timeline (seconds)
  
  // Source Media properties (for video/audio/images)
  sourceId?: string; // Reference to source asset if applicable
  sourcePath?: string;
  trimStart?: number; // In-point in source file
  trimEnd?: number; // Out-point in source file (optional, implied by duration)
  
  // Metadata
  name: string;
  isLocked?: boolean;
  isHidden?: boolean;
  
  // Universal Transform Properties (for Compositor)
  // Base values (applied if no keyframes, or as offset)
  opacity?: number; // 0-1
  scale?: number; // 1 = 100%
  rotation?: number; // degrees
  positionX?: number; // Normalized 0-1 or pixels? Standardizing on normalized 0-1 (center 0.5) usually better for responsive
  positionY?: number; // Normalized 0-1
  anchorX?: number; // Normalized 0-1 (default 0.5)
  anchorY?: number; // Normalized 0-1 (default 0.5)
  
  // Blending
  blendMode?: 'normal' | 'screen' | 'multiply' | 'overlay' | 'add';
  
  // Audio properties (if applicable)
  volume?: number; // 0-1
  isMuted?: boolean;
  
  // Animation
  keyframes?: Keyframe[];
  
  // Original data reference (transition during migration)
  originalData?: any;
}

export interface Track {
  id: string;
  type: 'video' | 'audio'; // 'video' tracks are visual and can hold video, text, stickers. 'audio' is audio-only.
  name: string;
  orderIndex: number; // Stack order. For video: 0 is bottom (background), higher is top (foreground).
  isMuted: boolean;
  isLocked: boolean;
  isVisible: boolean;
  height?: number; // Custom track height in UI pixels
  items: TimelineItem[];
}

// Global Timeline Model
export interface TimelineModel {
  tracks: Track[];
  duration: number;
  fps?: number;
}
