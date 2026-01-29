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
  
  // Debug logging
  if (activeEffects.length > 0 && frame % 30 === 0) {
    console.log('[ImpactEffects] Active effects:', activeEffects.map(e => e.type), 'at time:', currentTime.toFixed(2));
  }
  
  // Calculate all effect values
  let shakeX = 0;
  let shakeY = 0;
  let flashOpacity = 0;
  let flashColor = '#ffffff';
  let glowIntensity = 0;
  let glowColor = '#ffffff';
  let rgbSplitAmount = 0;
  let chromaticAmount = 0;
  let lensFlareOpacity = 0;
  let lightRaysOpacity = 0;
  let vignetteIntensity = 0;
  let distortionAmount = 0;
  const particles: any[] = [];
  const impactLines: any[] = [];
  const filters: string[] = [];
  let splitScreenConfig: any = null;
  let kaleidoscopeConfig: any = null;
  let prismConfig: any = null;
  let shatterConfig: any = null;
  let zoomTrailsConfig: any = null;
  let holographicConfig: any = null;
  
  activeEffects.forEach((effect: any) => {
    const effectProgress = (currentTime - effect.time) / effect.duration;
    const intensity = effect.intensity || 0.5;
    
    switch (effect.type) {
      case 'shake':
      case 'screenShake': {
        const decay = 1 - effectProgress;
        const frequency = 30;
        const seed = Math.floor(currentTime * frequency);
        const axis = effect.axis || 'both';
        
        if (axis === 'both' || axis === 'horizontal') {
          shakeX += (Math.sin(seed * 12.9898) * 43758.5453 % 1) * intensity * 20 * decay;
        }
        if (axis === 'both' || axis === 'vertical') {
          shakeY += (Math.sin(seed * 78.233) * 43758.5453 % 1) * intensity * 20 * decay;
        }
        break;
      }
      
      case 'flash': {
        flashOpacity = Math.max(flashOpacity, interpolate(
          effectProgress,
          [0, 0.3, 1],
          [intensity, intensity * 0.5, 0],
          { extrapolateRight: 'clamp' }
        ));
        flashColor = effect.color || '#ffffff';
        break;
      }
      
      case 'colorFlash': {
        flashOpacity = Math.max(flashOpacity, interpolate(
          effectProgress,
          [0, 0.2, 1],
          [intensity, intensity * 0.6, 0],
          { extrapolateRight: 'clamp' }
        ));
        flashColor = effect.color || '#ffffff';
        break;
      }
      
      case 'glow': {
        glowIntensity = Math.max(glowIntensity, interpolate(
          effectProgress,
          [0, 0.5, 1],
          [0, intensity, 0],
          { extrapolateRight: 'clamp' }
        ));
        break;
      }
      
      case 'radialGlow': {
        glowIntensity = Math.max(glowIntensity, interpolate(
          effectProgress,
          [0, 0.3, 0.7, 1],
          [0, intensity * 1.2, intensity, 0],
          { extrapolateRight: 'clamp' }
        ));
        glowColor = effect.color || '#FFD700';
        break;
      }
      
      case 'glitch': {
        const glitchAmount = intensity * 10 * (1 - effectProgress);
        shakeX += (Math.random() - 0.5) * glitchAmount;
        shakeY += (Math.random() - 0.5) * glitchAmount;
        break;
      }
      
      case 'rgbSplit': {
        rgbSplitAmount = Math.max(rgbSplitAmount, interpolate(
          effectProgress,
          [0, 0.5, 1],
          [0, (effect.offset || 10) * intensity, 0],
          { extrapolateRight: 'clamp' }
        ));
        break;
      }
      
      case 'chromaticAberration': {
        chromaticAmount = Math.max(chromaticAmount, interpolate(
          effectProgress,
          [0, 0.5, 1],
          [0, intensity * 5, 0],
          { extrapolateRight: 'clamp' }
        ));
        break;
      }
      
      case 'lensFlare': {
        lensFlareOpacity = Math.max(lensFlareOpacity, interpolate(
          effectProgress,
          [0, 0.3, 0.7, 1],
          [0, intensity * 0.8, intensity * 0.6, 0],
          { extrapolateRight: 'clamp' }
        ));
        break;
      }
      
      case 'lightRays': {
        lightRaysOpacity = Math.max(lightRaysOpacity, interpolate(
          effectProgress,
          [0, 0.5, 1],
          [0, intensity * 0.6, intensity * 0.3],
          { extrapolateRight: 'clamp' }
        ));
        break;
      }
      
      case 'vignettePulse': {
        vignetteIntensity = Math.max(vignetteIntensity, interpolate(
          effectProgress,
          [0, 0.5, 1],
          [0, intensity, 0],
          { extrapolateRight: 'clamp' }
        ));
        break;
      }
      
      case 'distortionWave': {
        distortionAmount = Math.max(distortionAmount, interpolate(
          effectProgress,
          [0, 0.5, 1],
          [0, intensity * 20, 0],
          { extrapolateRight: 'clamp' }
        ));
        break;
      }
      
      case 'particleBurst': {
        const particleCount = effect.count || 100;
        const particleType = effect.particleType || 'sparkles';
        
        for (let i = 0; i < particleCount; i++) {
          const angle = (i / particleCount) * Math.PI * 2;
          const speed = 50 + Math.random() * 100;
          const distance = effectProgress * speed;
          const x = 50 + Math.cos(angle) * distance * 0.1;
          const y = 50 + Math.sin(angle) * distance * 0.1;
          const opacity = interpolate(effectProgress, [0, 0.3, 1], [0, 1, 0], { extrapolateRight: 'clamp' });
          const size = 2 + Math.random() * 3;
          
          particles.push({ x, y, opacity, size, type: particleType });
        }
        break;
      }
      
      case 'impactLines': {
        const lineCount = 12;
        const pattern = effect.pattern || 'radial';
        
        for (let i = 0; i < lineCount; i++) {
          const angle = (i / lineCount) * Math.PI * 2;
          const length = interpolate(effectProgress, [0, 0.5, 1], [0, 40, 0], { extrapolateRight: 'clamp' });
          const opacity = interpolate(effectProgress, [0, 0.3, 1], [0, 0.8, 0], { extrapolateRight: 'clamp' });
          
          impactLines.push({ angle, length, opacity });
        }
        break;
      }
      
      case 'motionBlur': {
        // Simulate motion blur with directional blur
        const blurAmount = interpolate(
          effectProgress,
          [0, 0.5, 1],
          [0, intensity * 15, 0],
          { extrapolateRight: 'clamp' }
        );
        filters.push(`blur(${blurAmount}px)`);
        break;
      }
      
      case 'speedRamp': {
        // Visual feedback for speed changes with motion blur
        const blurAmount = interpolate(
          effectProgress,
          [0, 0.5, 1],
          [0, intensity * 8, 0],
          { extrapolateRight: 'clamp' }
        );
        filters.push(`blur(${blurAmount}px)`);
        break;
      }
      
      case 'freezeFrame': {
        // Flash effect to indicate freeze
        if (effectProgress < 0.1) {
          flashOpacity = Math.max(flashOpacity, 0.3);
          flashColor = '#ffffff';
        }
        break;
      }
      
      case 'splitScreen':
      case 'slice': {
        // Create layered angled segments like the screenshot
        const segments = effect.segments || 3;
        const angle = effect.angle || -15; // Degrees
        const offset = interpolate(
          effectProgress,
          [0, 0.3, 1],
          [0, intensity * 30, 0],
          { extrapolateRight: 'clamp' }
        );
        const opacity = interpolate(
          effectProgress,
          [0, 0.2, 0.8, 1],
          [0, 1, 1, 0],
          { extrapolateRight: 'clamp' }
        );
        
        splitScreenConfig = {
          segments,
          angle,
          offset,
          opacity,
          color: effect.color || 'rgba(0, 0, 0, 0.3)',
        };
        break;
      }
      
      case 'kaleidoscope': {
        // Mirrored segments radiating from center
        const segments = effect.segments || 6;
        const rotation = interpolate(
          effectProgress,
          [0, 1],
          [0, 360],
          { extrapolateRight: 'clamp' }
        );
        const scale = interpolate(
          effectProgress,
          [0, 0.5, 1],
          [1, 1.2, 1],
          { extrapolateRight: 'clamp' }
        );
        const opacity = interpolate(
          effectProgress,
          [0, 0.2, 0.8, 1],
          [0, intensity, intensity, 0],
          { extrapolateRight: 'clamp' }
        );
        
        kaleidoscopeConfig = { segments, rotation, scale, opacity };
        break;
      }
      
      case 'prism':
      case 'rainbowSplit': {
        // Rainbow refraction effect
        const spread = interpolate(
          effectProgress,
          [0, 0.5, 1],
          [0, intensity * 40, 0],
          { extrapolateRight: 'clamp' }
        );
        const opacity = interpolate(
          effectProgress,
          [0, 0.3, 0.7, 1],
          [0, 0.8, 0.8, 0],
          { extrapolateRight: 'clamp' }
        );
        
        prismConfig = { spread, opacity };
        break;
      }
      
      case 'shatter':
      case 'brokenGlass': {
        // Shattered glass effect
        const pieces = effect.pieces || 20;
        const spread = interpolate(
          effectProgress,
          [0, 1],
          [0, 100],
          { extrapolateRight: 'clamp' }
        );
        const opacity = interpolate(
          effectProgress,
          [0, 0.1, 0.9, 1],
          [0, 1, 1, 0],
          { extrapolateRight: 'clamp' }
        );
        
        shatterConfig = { pieces, spread, opacity, intensity };
        break;
      }
      
      case 'zoomTrails':
      case 'echoZoom': {
        // Motion echo/trail effect
        const trailCount = effect.trails || 5;
        const maxScale = 1 + (intensity * 0.5);
        const opacity = interpolate(
          effectProgress,
          [0, 0.2, 0.8, 1],
          [0, 0.6, 0.6, 0],
          { extrapolateRight: 'clamp' }
        );
        
        zoomTrailsConfig = { trailCount, maxScale, opacity, effectProgress };
        break;
      }
      
      case 'holographic':
      case 'iridescent': {
        // Holographic/iridescent overlay
        const hue = interpolate(
          effectProgress,
          [0, 1],
          [0, 360],
          { extrapolateRight: 'clamp' }
        );
        const opacity = interpolate(
          effectProgress,
          [0, 0.3, 0.7, 1],
          [0, intensity * 0.5, intensity * 0.5, 0],
          { extrapolateRight: 'clamp' }
        );
        
        holographicConfig = { hue, opacity };
        break;
      }
    }
  });
  
  // Build filter string
  if (glowIntensity > 0) {
    filters.push(`brightness(${1 + glowIntensity})`);
    filters.push(`saturate(${1 + glowIntensity * 0.5})`);
  }
  if (chromaticAmount > 0) {
    filters.push(`blur(${chromaticAmount * 0.5}px)`);
  }
  
  const containerStyle: React.CSSProperties = {
    transform: `translate(${shakeX}px, ${shakeY}px)`,
    filter: filters.length > 0 ? filters.join(' ') : undefined,
  };
  
  return (
    <>
      <AbsoluteFill style={containerStyle}>
        {children}
      </AbsoluteFill>
      
      {/* RGB Split Effect */}
      {rgbSplitAmount > 0 && (
        <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen', opacity: 0.5 }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle, rgba(255,0,0,${rgbSplitAmount * 0.1}) 0%, transparent 70%)`,
            transform: `translate(${rgbSplitAmount}px, 0)`,
          }} />
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle, rgba(0,0,255,${rgbSplitAmount * 0.1}) 0%, transparent 70%)`,
            transform: `translate(-${rgbSplitAmount}px, 0)`,
          }} />
        </AbsoluteFill>
      )}
      
      {/* Flash Effect */}
      {flashOpacity > 0 && (
        <AbsoluteFill
          style={{
            backgroundColor: flashColor,
            opacity: flashOpacity,
            pointerEvents: 'none',
          }}
        />
      )}
      
      {/* Radial Glow */}
      {glowIntensity > 0 && glowColor !== '#ffffff' && (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle at center, ${glowColor}${Math.floor(glowIntensity * 100).toString(16).padStart(2, '0')} 0%, transparent 60%)`,
            mixBlendMode: 'screen',
          }} />
        </AbsoluteFill>
      )}
      
      {/* Lens Flare */}
      {lensFlareOpacity > 0 && (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute',
            top: '20%',
            right: '20%',
            width: '40%',
            height: '40%',
            background: 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, rgba(255,200,100,0.4) 30%, transparent 70%)',
            opacity: lensFlareOpacity,
            mixBlendMode: 'screen',
          }} />
        </AbsoluteFill>
      )}
      
      {/* Light Rays */}
      {lightRaysOpacity > 0 && (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `
              linear-gradient(45deg, transparent 48%, rgba(255,255,255,${lightRaysOpacity * 0.3}) 49%, rgba(255,255,255,${lightRaysOpacity * 0.3}) 51%, transparent 52%),
              linear-gradient(135deg, transparent 48%, rgba(255,255,255,${lightRaysOpacity * 0.2}) 49%, rgba(255,255,255,${lightRaysOpacity * 0.2}) 51%, transparent 52%)
            `,
            mixBlendMode: 'screen',
          }} />
        </AbsoluteFill>
      )}
      
      {/* Vignette Pulse */}
      {vignetteIntensity > 0 && (
        <AbsoluteFill style={{ pointerEvents: 'none' }}>
          <div style={{
            position: 'absolute',
            inset: 0,
            background: `radial-gradient(circle, transparent 40%, rgba(0,0,0,${vignetteIntensity}) 100%)`,
          }} />
        </AbsoluteFill>
      )}
      
      {/* Particles */}
      {particles.map((particle, i) => (
        <div
          key={`particle-${i}`}
          style={{
            position: 'absolute',
            left: `${particle.x}%`,
            top: `${particle.y}%`,
            width: particle.size,
            height: particle.size,
            borderRadius: '50%',
            backgroundColor: particle.type === 'sparkles' ? '#FFD700' : '#ffffff',
            opacity: particle.opacity,
            pointerEvents: 'none',
            boxShadow: `0 0 ${particle.size * 2}px ${particle.type === 'sparkles' ? '#FFD700' : '#ffffff'}`,
          }}
        />
      ))}
      
      {/* Impact Lines */}
      {impactLines.map((line, i) => (
        <div
          key={`line-${i}`}
          style={{
            position: 'absolute',
            left: '50%',
            top: '50%',
            width: 4,
            height: `${line.length}%`,
            backgroundColor: '#ffffff',
            opacity: line.opacity,
            transform: `rotate(${line.angle}rad) translateY(-50%)`,
            transformOrigin: 'top center',
            pointerEvents: 'none',
            boxShadow: '0 0 10px #ffffff',
          }}
        />
      ))}
      
      {/* Split Screen / Slice Effect */}
      {splitScreenConfig && (
        <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
          {Array.from({ length: splitScreenConfig.segments }).map((_, i) => {
            const segmentWidth = 100 / splitScreenConfig.segments;
            const xOffset = i * segmentWidth;
            const layerOffset = (i - Math.floor(splitScreenConfig.segments / 2)) * splitScreenConfig.offset;
            
            return (
              <div
                key={`split-${i}`}
                style={{
                  position: 'absolute',
                  left: `${xOffset}%`,
                  top: 0,
                  width: `${segmentWidth}%`,
                  height: '100%',
                  transform: `skewY(${splitScreenConfig.angle}deg) translateX(${layerOffset}px)`,
                  opacity: splitScreenConfig.opacity,
                  clipPath: `polygon(0 0, 100% 0, 100% 100%, 0 100%)`,
                  backgroundColor: splitScreenConfig.color,
                  borderLeft: i > 0 ? '2px solid rgba(255, 255, 255, 0.3)' : 'none',
                  borderRight: i < splitScreenConfig.segments - 1 ? '2px solid rgba(255, 255, 255, 0.3)' : 'none',
                  boxShadow: '0 0 20px rgba(0, 0, 0, 0.5)',
                }}
              />
            );
          })}
        </AbsoluteFill>
      )}
      
      {/* Kaleidoscope Effect */}
      {kaleidoscopeConfig && (
        <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden', mixBlendMode: 'screen' }}>
          {Array.from({ length: kaleidoscopeConfig.segments }).map((_, i) => {
            const angle = (360 / kaleidoscopeConfig.segments) * i + kaleidoscopeConfig.rotation;
            return (
              <div
                key={`kaleidoscope-${i}`}
                style={{
                  position: 'absolute',
                  left: '50%',
                  top: '50%',
                  width: '100%',
                  height: '100%',
                  transform: `translate(-50%, -50%) rotate(${angle}deg) scale(${kaleidoscopeConfig.scale})`,
                  opacity: kaleidoscopeConfig.opacity * 0.3,
                  background: `linear-gradient(90deg, transparent 48%, rgba(255,255,255,0.2) 50%, transparent 52%)`,
                  transformOrigin: 'center center',
                }}
              />
            );
          })}
        </AbsoluteFill>
      )}
      
      {/* Prism / Rainbow Split Effect */}
      {prismConfig && (
        <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen' }}>
          {['#FF0000', '#FF7F00', '#FFFF00', '#00FF00', '#0000FF', '#4B0082', '#9400D3'].map((color, i) => (
            <div
              key={`prism-${i}`}
              style={{
                position: 'absolute',
                inset: 0,
                background: `radial-gradient(circle, ${color}40 0%, transparent 70%)`,
                transform: `translateX(${(i - 3) * prismConfig.spread * 0.3}px)`,
                opacity: prismConfig.opacity * 0.4,
              }}
            />
          ))}
        </AbsoluteFill>
      )}
      
      {/* Shatter / Broken Glass Effect */}
      {shatterConfig && (
        <AbsoluteFill style={{ pointerEvents: 'none', overflow: 'hidden' }}>
          {Array.from({ length: shatterConfig.pieces }).map((_, i) => {
            const angle = Math.random() * 360;
            const distance = shatterConfig.spread * (0.5 + Math.random() * 0.5);
            const size = 10 + Math.random() * 20;
            const rotation = Math.random() * 360;
            const x = 50 + Math.cos(angle * Math.PI / 180) * distance * 0.5;
            const y = 50 + Math.sin(angle * Math.PI / 180) * distance * 0.5;
            
            return (
              <div
                key={`shatter-${i}`}
                style={{
                  position: 'absolute',
                  left: `${x}%`,
                  top: `${y}%`,
                  width: size,
                  height: size,
                  transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                  opacity: shatterConfig.opacity * 0.6,
                  background: 'linear-gradient(135deg, rgba(255,255,255,0.8) 0%, rgba(200,200,255,0.4) 100%)',
                  border: '1px solid rgba(255,255,255,0.5)',
                  boxShadow: '0 0 10px rgba(255,255,255,0.3)',
                  clipPath: 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)',
                }}
              />
            );
          })}
        </AbsoluteFill>
      )}
      
      {/* Zoom Trails / Echo Effect */}
      {zoomTrailsConfig && (
        <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen' }}>
          {Array.from({ length: zoomTrailsConfig.trailCount }).map((_, i) => {
            const delay = i / zoomTrailsConfig.trailCount;
            const trailProgress = Math.max(0, zoomTrailsConfig.effectProgress - delay * 0.2);
            const scale = interpolate(
              trailProgress,
              [0, 1],
              [1, zoomTrailsConfig.maxScale],
              { extrapolateRight: 'clamp' }
            );
            const opacity = zoomTrailsConfig.opacity * (1 - i / zoomTrailsConfig.trailCount) * 0.3;
            
            return (
              <div
                key={`trail-${i}`}
                style={{
                  position: 'absolute',
                  inset: 0,
                  transform: `scale(${scale})`,
                  opacity: opacity,
                  border: '2px solid rgba(255,255,255,0.5)',
                  borderRadius: '8px',
                }}
              />
            );
          })}
        </AbsoluteFill>
      )}
      
      {/* Holographic / Iridescent Overlay */}
      {holographicConfig && (
        <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen' }}>
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: `
                linear-gradient(45deg, 
                  hsl(${holographicConfig.hue}, 100%, 50%) 0%,
                  hsl(${holographicConfig.hue + 60}, 100%, 50%) 25%,
                  hsl(${holographicConfig.hue + 120}, 100%, 50%) 50%,
                  hsl(${holographicConfig.hue + 180}, 100%, 50%) 75%,
                  hsl(${holographicConfig.hue + 240}, 100%, 50%) 100%
                )
              `,
              opacity: holographicConfig.opacity,
              mixBlendMode: 'color-dodge',
            }}
          />
        </AbsoluteFill>
      )}
    </>
  );
};
