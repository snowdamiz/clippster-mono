import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AIVideoTrack } from '../../types/ai-video';

interface TransitionEffectsProps {
  track: AIVideoTrack;
  children: React.ReactNode;
}

export const TransitionEffects: React.FC<TransitionEffectsProps> = ({ track, children }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  
  const currentTime = frame / fps;
  const transitions = (track.properties as any).transitions || [];
  
  // Find active transition at current time
  const activeTransition = transitions.find((transition: any) => {
    const transitionEnd = transition.time + transition.duration;
    return currentTime >= transition.time && currentTime <= transitionEnd;
  });
  
  // Debug logging
  if (activeTransition && frame % 30 === 0) {
    console.log('[TransitionEffects] Active transition:', activeTransition.type, 'at time:', currentTime.toFixed(2));
  }
  
  if (!activeTransition) {
    return <>{children}</>;
  }
  
  const transitionProgress = (currentTime - activeTransition.time) / activeTransition.duration;
  const type = activeTransition.type;
  const direction = activeTransition.direction || 'left';
  
  // Calculate transition effect
  let opacity = 1;
  let translateX = 0;
  let translateY = 0;
  let scale = 1;
  let rotateZ = 0;
  let rotateY = 0;
  let clipPath = '';
  
  switch (type) {
    case 'fade': {
      // Fade should crossfade between scenes, not fade to black
      // Keep opacity at 1 for single-scene compositions
      opacity = 1;
      break;
    }
    
    case 'slideLeft': {
      // DISABLED - causes black screen on single-clip compositions
      // Use a subtle scale/shake effect instead
      scale = interpolate(transitionProgress, [0, 0.5, 1], [1, 1.02, 1], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'slideRight': {
      // DISABLED - causes black screen on single-clip compositions
      scale = interpolate(transitionProgress, [0, 0.5, 1], [1, 1.02, 1], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'slideUp': {
      // DISABLED - causes black screen on single-clip compositions
      scale = interpolate(transitionProgress, [0, 0.5, 1], [1, 1.02, 1], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'slideDown': {
      // DISABLED - causes black screen on single-clip compositions
      scale = interpolate(transitionProgress, [0, 0.5, 1], [1, 1.02, 1], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'wipeLeft':
    case 'wipeRight':
    case 'wipeUp':
    case 'wipeDown': {
      // DISABLED - wipe transitions clip content away causing black screen
      // Use a subtle zoom pulse instead
      scale = interpolate(transitionProgress, [0, 0.5, 1], [1, 1.03, 1], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'diagonalWipe': {
      // DISABLED - clips content causing black screen
      scale = interpolate(transitionProgress, [0, 0.5, 1], [1, 1.03, 1], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'spin':
    case 'rotate180':
    case 'rotate360': {
      // DISABLED - was causing black screens
      // Just do a subtle scale pulse instead
      scale = interpolate(transitionProgress, [0, 0.5, 1], [1, 1.05, 1], { extrapolateRight: 'clamp' });
      opacity = 1;
      break;
    }
    
    case 'spiralIn':
    case 'spiralOut': {
      const spiralRotation = interpolate(transitionProgress, [0, 1], [0, 720], { extrapolateRight: 'clamp' });
      rotateZ = type === 'spiralIn' ? spiralRotation : -spiralRotation;
      scale = type === 'spiralIn'
        ? interpolate(transitionProgress, [0, 1], [1, 0.3], { extrapolateRight: 'clamp' })
        : interpolate(transitionProgress, [0, 1], [0.3, 1], { extrapolateRight: 'clamp' });
      // Keep visible during spiral
      opacity = 1;
      break;
    }
    
    case 'zoomIn': {
      // Reduced zoom to prevent content from going off screen
      scale = interpolate(transitionProgress, [0, 0.5, 1], [1, 1.15, 1], { extrapolateRight: 'clamp' });
      opacity = 1;
      break;
    }
    
    case 'zoomOut': {
      scale = interpolate(transitionProgress, [0, 1], [1, 0.3], { extrapolateRight: 'clamp' });
      // Keep visible during zoom
      opacity = 1;
      break;
    }
    
    case 'flipHorizontal': {
      rotateY = interpolate(transitionProgress, [0, 1], [0, 180], { extrapolateRight: 'clamp' });
      // Keep visible during flip
      opacity = 1;
      break;
    }
    
    case 'flipVertical': {
      const rotateX = interpolate(transitionProgress, [0, 1], [0, 180], { extrapolateRight: 'clamp' });
      // Keep visible during flip
      opacity = 1;
      break;
    }
    
    case 'clockWipe': {
      // DISABLED - clips content causing black screen
      scale = interpolate(transitionProgress, [0, 0.5, 1], [1, 1.04, 1], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'irisIn':
    case 'irisOut': {
      // DISABLED - clips content to circle causing black screen
      scale = interpolate(transitionProgress, [0, 0.5, 1], [1, 1.05, 1], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'pixelate': {
      const pixelSize = interpolate(transitionProgress, [0, 0.5, 1], [1, 50, 1], { extrapolateRight: 'clamp' });
      // Keep visible - pixelate effect is visual only
      opacity = 1;
      break;
    }
    
    case 'glitchTransition': {
      const glitchIntensity = interpolate(transitionProgress, [0, 0.5, 1], [0, 1, 0], { extrapolateRight: 'clamp' });
      const seed = Math.floor(currentTime * 60);
      translateX = (Math.sin(seed * 12.9898) * 43758.5453 % 1) * glitchIntensity * 50;
      translateY = (Math.sin(seed * 78.233) * 43758.5453 % 1) * glitchIntensity * 30;
      // Keep visible - glitch is a visual distortion, not a fade out
      opacity = 1;
      break;
    }
    
    case 'burn': {
      // Burn effect should be visual distortion, not fade to black
      opacity = 1;
      break;
    }
    
    case 'liquidStreaks':
    case 'liquidDrops': {
      // Liquid effect should be visual distortion, not fade
      opacity = 1;
      break;
    }
    
    case 'pageTurn': {
      const turnProgress = interpolate(transitionProgress, [0, 1], [0, 180], { extrapolateRight: 'clamp' });
      rotateY = turnProgress;
      // Keep visible during page turn
      opacity = 1;
      break;
    }
    
    case 'blinds': {
      const blindCount = 10;
      const blindProgress = interpolate(transitionProgress, [0, 1], [0, 100], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'cube3D': {
      rotateY = interpolate(transitionProgress, [0, 1], [0, 90], { extrapolateRight: 'clamp' });
      // Keep visible during cube rotation
      opacity = 1;
      break;
    }
  }
  
  const transform = `
    translate(${translateX}px, ${translateY}px)
    scale(${scale})
    rotateZ(${rotateZ}deg)
    rotateY(${rotateY}deg)
  `.trim();
  
  return (
    <AbsoluteFill
      style={{
        transform,
        opacity,
        clipPath: clipPath || undefined,
        transformOrigin: 'center center',
        perspective: '1000px',
        backfaceVisibility: 'visible',
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
