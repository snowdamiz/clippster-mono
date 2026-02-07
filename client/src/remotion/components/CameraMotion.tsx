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
  const activeEffects = effects.filter((effect: any) => {
    return currentTime >= effect.startTime && currentTime <= effect.endTime;
  });
  
  // Debug logging
  if (activeEffects.length > 0 && frame % 30 === 0) {
    console.log('[CameraMotion] Active effects:', activeEffects.map(e => e.type), 'at time:', currentTime.toFixed(2));
  }
  
  // Calculate cumulative transform
  let scale = 1;
  let translateX = 0;
  let translateY = 0;
  let rotateZ = 0;
  
  activeEffects.forEach((effect: any) => {
    const effectProgress = (currentTime - effect.startTime) / (effect.endTime - effect.startTime);
    const intensity = effect.intensity || 0.3;
    const direction = effect.direction || 'in';
    
    switch (effect.type) {
      case 'handheldShake': {
        // Continuous subtle shake
        const seed = Math.floor(currentTime * 30);
        const shakeX = (Math.sin(seed * 12.9898) * 43758.5453 % 1) * intensity * 8;
        const shakeY = (Math.sin(seed * 78.233) * 43758.5453 % 1) * intensity * 8;
        translateX += shakeX;
        translateY += shakeY;
        break;
      }
      
      case 'slowZoom': {
        const zoomAmount = direction === 'in'
          ? interpolate(effectProgress, [0, 1], [1, 1 + intensity], { extrapolateRight: 'clamp' })
          : interpolate(effectProgress, [0, 1], [1 + intensity, 1], { extrapolateRight: 'clamp' });
        scale *= zoomAmount;
        break;
      }
      
      case 'punchZoom': {
        // Quick punch zoom
        const punchScale = direction === 'in'
          ? interpolate(effectProgress, [0, 0.3, 0.6, 1], [1, 1 + intensity * 1.2, 1 + intensity * 0.9, 1 + intensity], { extrapolateRight: 'clamp' })
          : interpolate(effectProgress, [0, 0.3, 0.6, 1], [1 + intensity, 1 + intensity * 0.9, 1 + intensity * 1.2, 1], { extrapolateRight: 'clamp' });
        scale *= punchScale;
        break;
      }
      
      case 'dollyPan': {
        // Smooth pan movement
        const panAmount = intensity * 100;
        const panProgress = interpolate(effectProgress, [0, 1], [0, panAmount], { extrapolateRight: 'clamp' });
        
        switch (direction) {
          case 'left': translateX -= panProgress; break;
          case 'right': translateX += panProgress; break;
          case 'up': translateY -= panProgress; break;
          case 'down': translateY += panProgress; break;
        }
        break;
      }
      
      case 'orbit': {
        // Circular camera motion
        const angle = direction === 'clockwise'
          ? effectProgress * Math.PI * 2
          : -effectProgress * Math.PI * 2;
        const radius = intensity * 50;
        translateX += Math.cos(angle) * radius;
        translateY += Math.sin(angle) * radius;
        break;
      }
      
      case 'dutchAngle': {
        // Tilted camera angle
        const angle = effect.angle || 10;
        rotateZ += interpolate(effectProgress, [0, 1], [0, angle], { extrapolateRight: 'clamp' });
        break;
      }
      
      case 'impactShake': {
        // Violent shake with decay
        const decay = 1 - effectProgress;
        const frequency = 60;
        const seed = Math.floor(currentTime * frequency);
        const shakeX = (Math.sin(seed * 12.9898) * 43758.5453 % 1) * intensity * 30 * decay;
        const shakeY = (Math.sin(seed * 78.233) * 43758.5453 % 1) * intensity * 30 * decay;
        translateX += shakeX;
        translateY += shakeY;
        break;
      }
      
      case 'parallax': {
        // Subtle depth effect
        const parallaxAmount = intensity * 20;
        const parallaxProgress = interpolate(effectProgress, [0, 1], [0, parallaxAmount], { extrapolateRight: 'clamp' });
        translateX += parallaxProgress;
        translateY += parallaxProgress * 0.5;
        break;
      }
      
      // Legacy support
      case 'punchIn': {
        const punchScale = interpolate(effectProgress, [0, 0.3, 0.6, 1], [1, 1 + intensity * 1.2, 1 + intensity * 0.9, 1 + intensity], { extrapolateRight: 'clamp' });
        scale *= punchScale;
        break;
      }
      
      case 'punchOut': {
        const punchScale = interpolate(effectProgress, [0, 1], [1 + intensity, 1], { extrapolateRight: 'clamp' });
        scale *= punchScale;
        break;
      }
      
      case 'microJitter': {
        const seed = Math.floor(currentTime * 30);
        const jitterX = (Math.sin(seed * 12.9898) * 43758.5453 % 1) * intensity * 10;
        const jitterY = (Math.sin(seed * 78.233) * 43758.5453 % 1) * intensity * 10;
        translateX += jitterX;
        translateY += jitterY;
        break;
      }
    }
  });
  
  const transform = `scale(${scale}) translate(${translateX}px, ${translateY}px) rotate(${rotateZ}deg)`;
  
  return (
    <AbsoluteFill style={{ transform, transformOrigin: 'center center' }}>
      {children}
    </AbsoluteFill>
  );
};
