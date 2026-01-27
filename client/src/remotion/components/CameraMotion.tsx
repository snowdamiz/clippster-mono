import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AIVideoTrack } from '../../types/ai-video';

interface CameraMotionProps {
  track: AIVideoTrack;
  children: React.ReactNode;
}

export const CameraMotion: React.FC<CameraMotionProps> = ({ track, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const currentTime = frame / fps;
  const effects = (track.properties as any).effects || [];
  
  // Find active effects at current time
  const activeEffects = effects.filter((effect: any) => 
    currentTime >= effect.startTime && currentTime <= effect.endTime
  );
  
  // Calculate cumulative transform
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  
  activeEffects.forEach((effect: any) => {
    const effectProgress = (currentTime - effect.startTime) / (effect.endTime - effect.startTime);
    const intensity = effect.intensity || 0.3;
    
    switch (effect.type) {
      case 'slowZoom': {
        const zoomAmount = interpolate(
          effectProgress,
          [0, 1],
          [1, 1 + intensity],
          { extrapolateRight: 'clamp' }
        );
        scale *= zoomAmount;
        break;
      }
      
      case 'punchIn': {
        // Spring-like punch effect
        const punchScale = effect.easing === 'spring'
          ? interpolate(
              effectProgress,
              [0, 0.3, 0.6, 1],
              [1, 1 + intensity * 1.2, 1 + intensity * 0.9, 1 + intensity],
              { extrapolateRight: 'clamp' }
            )
          : interpolate(
              effectProgress,
              [0, 1],
              [1, 1 + intensity],
              { extrapolateRight: 'clamp' }
            );
        scale *= punchScale;
        break;
      }
      
      case 'punchOut': {
        const punchScale = interpolate(
          effectProgress,
          [0, 1],
          [1 + intensity, 1],
          { extrapolateRight: 'clamp' }
        );
        scale *= punchScale;
        break;
      }
      
      case 'microJitter': {
        // Subtle random shake
        const seed = Math.floor(currentTime * 30);
        const jitterX = (Math.sin(seed * 12.9898) * 43758.5453 % 1) * intensity * 10;
        const jitterY = (Math.sin(seed * 78.233) * 43758.5453 % 1) * intensity * 10;
        translateX += jitterX;
        translateY += jitterY;
        break;
      }
    }
  });
  
  const transform = `scale(${scale}) translate(${translateX}px, ${translateY}px)`;
  
  return (
    <AbsoluteFill style={{ transform, transformOrigin: 'center center' }}>
      {children}
    </AbsoluteFill>
  );
};
