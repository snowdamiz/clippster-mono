import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AIVideoTrack } from '../../types/ai-video';

interface ImpactEffectsProps {
  track: AIVideoTrack;
  children: React.ReactNode;
}

export const ImpactEffects: React.FC<ImpactEffectsProps> = ({ track, children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const currentTime = frame / fps;
  const effects = (track.properties as any).effects || [];
  
  // Find active effects at current time
  const activeEffects = effects.filter((effect: any) => {
    const effectEnd = effect.time + effect.duration;
    return currentTime >= effect.time && currentTime <= effectEnd;
  });
  
  // Calculate shake offset
  let shakeX = 0;
  let shakeY = 0;
  let flashOpacity = 0;
  let glowIntensity = 0;
  
  activeEffects.forEach((effect: any) => {
    const effectProgress = (currentTime - effect.time) / effect.duration;
    const intensity = effect.intensity || 0.5;
    
    switch (effect.type) {
      case 'shake': {
        // Oscillating shake that decays
        const decay = 1 - effectProgress;
        const frequency = 30;
        const seed = Math.floor(currentTime * frequency);
        shakeX += (Math.sin(seed * 12.9898) * 43758.5453 % 1) * intensity * 20 * decay;
        shakeY += (Math.sin(seed * 78.233) * 43758.5453 % 1) * intensity * 20 * decay;
        break;
      }
      
      case 'flash': {
        // Quick flash that fades out
        flashOpacity = Math.max(flashOpacity, interpolate(
          effectProgress,
          [0, 0.3, 1],
          [intensity, intensity * 0.5, 0],
          { extrapolateRight: 'clamp' }
        ));
        break;
      }
      
      case 'glow': {
        // Pulsing glow effect
        glowIntensity = Math.max(glowIntensity, interpolate(
          effectProgress,
          [0, 0.5, 1],
          [0, intensity, 0],
          { extrapolateRight: 'clamp' }
        ));
        break;
      }
      
      case 'glitch': {
        // RGB split glitch effect
        const glitchAmount = intensity * 10 * (1 - effectProgress);
        shakeX += (Math.random() - 0.5) * glitchAmount;
        shakeY += (Math.random() - 0.5) * glitchAmount;
        break;
      }
    }
  });
  
  const containerStyle: React.CSSProperties = {
    transform: `translate(${shakeX}px, ${shakeY}px)`,
    filter: glowIntensity > 0 ? `brightness(${1 + glowIntensity}) saturate(${1 + glowIntensity * 0.5})` : undefined,
  };
  
  return (
    <>
      <AbsoluteFill style={containerStyle}>
        {children}
      </AbsoluteFill>
      {flashOpacity > 0 && (
        <AbsoluteFill
          style={{
            backgroundColor: '#ffffff',
            opacity: flashOpacity,
            pointerEvents: 'none',
          }}
        />
      )}
    </>
  );
};
