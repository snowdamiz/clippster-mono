import React, { useMemo } from 'react';
import { AbsoluteFill, Img, Video, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AIVideoTrack } from '../../types/ai-video';
import { utf8ToBase64Url } from '../../utils/encoding';

interface MediaClipProps {
  track: AIVideoTrack;
  videoServerPort: number;
}

export const MediaClip: React.FC<MediaClipProps> = ({ track, videoServerPort }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const currentTime = frame / fps;
  const trackStartFrame = track.startTime * fps;
  const trackEndFrame = track.endTime * fps;
  const trackDuration = track.endTime - track.startTime;
  
  const localFrame = frame - trackStartFrame;
  const progress = localFrame / ((trackEndFrame - trackStartFrame) || 1);
  
  // Apply effects - MUST be called before any early returns (React Hooks rule)
  const filters = useMemo(() => {
    if (!track.properties.effects) return '';
    
    return track.properties.effects.map(effect => {
      const value = typeof effect.value === 'number' 
        ? effect.value 
        : getAnimatedValue(effect.value, progress, 0);
      
      switch (effect.type) {
        case 'blur': return `blur(${value}px)`;
        case 'brightness': return `brightness(${value}%)`;
        case 'contrast': return `contrast(${value}%)`;
        case 'saturation': return `saturate(${value}%)`;
        case 'hue-rotate': return `hue-rotate(${value}deg)`;
        case 'grayscale': return `grayscale(${value}%)`;
        case 'sepia': return `sepia(${value}%)`;
        default: return '';
      }
    }).join(' ');
  }, [track.properties.effects, progress]);
  
  // Only render if current frame is within track bounds
  if (frame < trackStartFrame || frame > trackEndFrame) {
    return null;
  }
  
  // Get transform properties with keyframe support
  const x = getAnimatedValue(track.properties.x, progress, 50);
  const y = getAnimatedValue(track.properties.y, progress, 50);
  const scale = getAnimatedValue(track.properties.scale, progress, 1);
  const rotation = getAnimatedValue(track.properties.rotation, progress, 0);
  const opacity = getAnimatedValue(track.properties.opacity, progress, 1);
  
  // Apply enter/exit transitions
  let transitionOpacity = opacity;
  if (track.properties.enterTransition) {
    const enterDuration = track.properties.enterTransition.duration;
    const enterProgress = Math.min(currentTime - track.startTime, enterDuration) / enterDuration;
    transitionOpacity *= applyTransition(track.properties.enterTransition.type, enterProgress);
  }
  if (track.properties.exitTransition) {
    const exitDuration = track.properties.exitTransition.duration;
    const timeUntilEnd = track.endTime - currentTime;
    const exitProgress = Math.min(exitDuration - timeUntilEnd, exitDuration) / exitDuration;
    if (timeUntilEnd < exitDuration) {
      transitionOpacity *= applyTransition(track.properties.exitTransition.type, 1 - exitProgress);
    }
  }
  
  const style: React.CSSProperties = {
    position: 'absolute',
    left: `${x}%`,
    top: `${y}%`,
    transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`,
    opacity: transitionOpacity,
    filter: filters || undefined,
  };
  
  // Handle video trimming
  const videoStartTime = track.properties.trimStart || 0;
  const playbackRate = track.properties.playbackRate || 1;
  
  if (track.type === 'video' && track.source) {
    const videoSrc = getMediaUrl(track.source.path, videoServerPort);
    
    return (
      <AbsoluteFill style={style}>
        <Video
          src={videoSrc}
          startFrom={Math.floor(videoStartTime * fps)}
          playbackRate={playbackRate}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </AbsoluteFill>
    );
  }
  
  if (track.type === 'image' && track.source) {
    const imageSrc = getMediaUrl(track.source.path, videoServerPort);
    
    return (
      <AbsoluteFill style={style}>
        <Img
          src={imageSrc}
          style={{ width: '100%', height: '100%', objectFit: 'contain' }}
        />
      </AbsoluteFill>
    );
  }
  
  return null;
};

function getAnimatedValue(
  value: number | { keyframes: Array<{ time: number; value: number; easing?: string }>; animated?: boolean } | undefined,
  progress: number,
  defaultValue: number
): number {
  if (value === undefined) return defaultValue;
  if (typeof value === 'number') return value;
  
  // Handle both {keyframes: [...]} and {animated: true, keyframes: [...]} formats
  const keyframes = value.keyframes;
  if (!keyframes || keyframes.length === 0) return defaultValue;
  if (keyframes.length === 1) return keyframes[0].value;
  
  // Find surrounding keyframes
  let prevKeyframe = keyframes[0];
  let nextKeyframe = keyframes[keyframes.length - 1];
  
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (progress >= keyframes[i].time && progress <= keyframes[i + 1].time) {
      prevKeyframe = keyframes[i];
      nextKeyframe = keyframes[i + 1];
      break;
    }
  }
  
  if (progress <= prevKeyframe.time) return prevKeyframe.value;
  if (progress >= nextKeyframe.time) return nextKeyframe.value;
  
  // Interpolate between keyframes
  const segmentProgress = (progress - prevKeyframe.time) / (nextKeyframe.time - prevKeyframe.time);
  const easing = nextKeyframe.easing || 'linear';
  const easedProgress = applyEasing(segmentProgress, easing);
  
  return interpolate(easedProgress, [0, 1], [prevKeyframe.value, nextKeyframe.value]);
}

function applyEasing(progress: number, easing: string): number {
  switch (easing) {
    case 'ease-in':
      return progress * progress;
    case 'ease-out':
      return 1 - Math.pow(1 - progress, 2);
    case 'ease-in-out':
      return progress < 0.5
        ? 2 * progress * progress
        : 1 - Math.pow(-2 * progress + 2, 2) / 2;
    case 'spring':
      return 1 - Math.cos(progress * Math.PI * 2) * Math.exp(-progress * 5);
    default:
      return progress;
  }
}

function applyTransition(type: string, progress: number): number {
  switch (type) {
    case 'fade':
      return progress;
    case 'zoom':
      return progress;
    default:
      return progress;
  }
}

function getMediaUrl(path: string, videoServerPort: number): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (path.startsWith('asset://')) {
    return path;
  }
  if (videoServerPort > 0) {
    // Video server expects base64-encoded path in URL path segment
    const base64Path = utf8ToBase64Url(path);
    return `http://localhost:${videoServerPort}/video/${base64Path}`;
  }
  return `asset://localhost/${path}`;
}
