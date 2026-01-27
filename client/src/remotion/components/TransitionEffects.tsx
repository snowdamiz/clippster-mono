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
      opacity = interpolate(transitionProgress, [0, 1], [1, 0], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'slideLeft': {
      translateX = interpolate(transitionProgress, [0, 1], [0, -width], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'slideRight': {
      translateX = interpolate(transitionProgress, [0, 1], [0, width], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'slideUp': {
      translateY = interpolate(transitionProgress, [0, 1], [0, -height], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'slideDown': {
      translateY = interpolate(transitionProgress, [0, 1], [0, height], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'wipeLeft':
    case 'wipeRight':
    case 'wipeUp':
    case 'wipeDown': {
      const progress = interpolate(transitionProgress, [0, 1], [0, 100], { extrapolateRight: 'clamp' });
      
      switch (type) {
        case 'wipeLeft':
          clipPath = `inset(0 ${100 - progress}% 0 0)`;
          break;
        case 'wipeRight':
          clipPath = `inset(0 0 0 ${progress}%)`;
          break;
        case 'wipeUp':
          clipPath = `inset(${progress}% 0 0 0)`;
          break;
        case 'wipeDown':
          clipPath = `inset(0 0 ${100 - progress}% 0)`;
          break;
      }
      break;
    }
    
    case 'diagonalWipe': {
      const progress = interpolate(transitionProgress, [0, 1], [0, 150], { extrapolateRight: 'clamp' });
      clipPath = `polygon(0 0, ${progress}% 0, 0 ${progress}%)`;
      break;
    }
    
    case 'spin':
    case 'rotate180':
    case 'rotate360': {
      const maxRotation = type === 'spin' ? 180 : type === 'rotate180' ? 180 : 360;
      rotateZ = interpolate(transitionProgress, [0, 1], [0, maxRotation], { extrapolateRight: 'clamp' });
      if (direction === 'counterClockwise') rotateZ = -rotateZ;
      opacity = interpolate(transitionProgress, [0, 0.5, 1], [1, 0.5, 0], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'spiralIn':
    case 'spiralOut': {
      const spiralRotation = interpolate(transitionProgress, [0, 1], [0, 720], { extrapolateRight: 'clamp' });
      rotateZ = type === 'spiralIn' ? spiralRotation : -spiralRotation;
      scale = type === 'spiralIn'
        ? interpolate(transitionProgress, [0, 1], [1, 0], { extrapolateRight: 'clamp' })
        : interpolate(transitionProgress, [0, 1], [0, 1], { extrapolateRight: 'clamp' });
      opacity = interpolate(transitionProgress, [0, 0.8, 1], [1, 0.5, 0], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'zoomIn': {
      scale = interpolate(transitionProgress, [0, 1], [1, 2], { extrapolateRight: 'clamp' });
      opacity = interpolate(transitionProgress, [0, 0.7, 1], [1, 0.5, 0], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'zoomOut': {
      scale = interpolate(transitionProgress, [0, 1], [1, 0], { extrapolateRight: 'clamp' });
      opacity = interpolate(transitionProgress, [0, 0.7, 1], [1, 0.5, 0], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'flipHorizontal': {
      rotateY = interpolate(transitionProgress, [0, 1], [0, 180], { extrapolateRight: 'clamp' });
      opacity = interpolate(transitionProgress, [0, 0.5, 1], [1, 0, 0], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'flipVertical': {
      const rotateX = interpolate(transitionProgress, [0, 1], [0, 180], { extrapolateRight: 'clamp' });
      opacity = interpolate(transitionProgress, [0, 0.5, 1], [1, 0, 0], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'clockWipe': {
      const angle = interpolate(transitionProgress, [0, 1], [0, 360], { extrapolateRight: 'clamp' });
      clipPath = `polygon(50% 50%, 50% 0%, ${50 + 50 * Math.sin((angle - 90) * Math.PI / 180)}% ${50 - 50 * Math.cos((angle - 90) * Math.PI / 180)}%)`;
      break;
    }
    
    case 'irisIn':
    case 'irisOut': {
      const radius = type === 'irisIn'
        ? interpolate(transitionProgress, [0, 1], [100, 0], { extrapolateRight: 'clamp' })
        : interpolate(transitionProgress, [0, 1], [0, 100], { extrapolateRight: 'clamp' });
      clipPath = `circle(${radius}% at 50% 50%)`;
      break;
    }
    
    case 'pixelate': {
      const pixelSize = interpolate(transitionProgress, [0, 0.5, 1], [1, 50, 1], { extrapolateRight: 'clamp' });
      opacity = interpolate(transitionProgress, [0, 0.5, 1], [1, 0.3, 0], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'glitchTransition': {
      const glitchIntensity = interpolate(transitionProgress, [0, 0.5, 1], [0, 1, 0], { extrapolateRight: 'clamp' });
      const seed = Math.floor(currentTime * 60);
      translateX = (Math.sin(seed * 12.9898) * 43758.5453 % 1) * glitchIntensity * 50;
      translateY = (Math.sin(seed * 78.233) * 43758.5453 % 1) * glitchIntensity * 30;
      opacity = interpolate(transitionProgress, [0, 0.3, 0.7, 1], [1, 0.7, 0.7, 0], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'burn': {
      opacity = interpolate(transitionProgress, [0, 0.7, 1], [1, 0.5, 0], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'liquidStreaks':
    case 'liquidDrops': {
      opacity = interpolate(transitionProgress, [0, 0.8, 1], [1, 0.3, 0], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'pageTurn': {
      const turnProgress = interpolate(transitionProgress, [0, 1], [0, 180], { extrapolateRight: 'clamp' });
      rotateY = turnProgress;
      opacity = interpolate(transitionProgress, [0, 0.5, 1], [1, 0.5, 0], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'blinds': {
      const blindCount = 10;
      const blindProgress = interpolate(transitionProgress, [0, 1], [0, 100], { extrapolateRight: 'clamp' });
      break;
    }
    
    case 'cube3D': {
      rotateY = interpolate(transitionProgress, [0, 1], [0, 90], { extrapolateRight: 'clamp' });
      opacity = interpolate(transitionProgress, [0, 0.5, 1], [1, 0.7, 0], { extrapolateRight: 'clamp' });
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
      }}
    >
      {children}
    </AbsoluteFill>
  );
};
