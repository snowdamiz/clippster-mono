import React, { useMemo } from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AIVideoTrack } from '../../types/ai-video';

interface AnimatedTextProps {
  track: AIVideoTrack;
}

export const AnimatedText: React.FC<AnimatedTextProps> = ({ track }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const trackStartFrame = track.startTime * fps;
  const trackEndFrame = track.endTime * fps;
  
  if (frame < trackStartFrame || frame > trackEndFrame) {
    return null;
  }
  
  const localFrame = frame - trackStartFrame;
  const trackDurationFrames = trackEndFrame - trackStartFrame;
  const progress = localFrame / (trackDurationFrames || 1);
  
  const textProps = track.properties.text;
  if (!textProps) return null;
  
  // Get animated position
  const x = typeof track.properties.x === 'number' ? track.properties.x : 50;
  const y = typeof track.properties.y === 'number' ? track.properties.y : 50;
  const scale = typeof track.properties.scale === 'number' ? track.properties.scale : 1;
  const rotation = typeof track.properties.rotation === 'number' ? track.properties.rotation : 0;
  const opacity = typeof track.properties.opacity === 'number' ? track.properties.opacity : 1;
  
  // Apply text animation
  const animation = textProps.animation;
  let animatedStyle: React.CSSProperties = {};
  let animatedOpacity = opacity;
  let displayText = textProps.content;
  
  if (animation) {
    const animDuration = 'duration' in animation ? animation.duration : 0.5;
    const animFrames = animDuration * fps;
    const animProgress = Math.min(localFrame / animFrames, 1);
    
    switch (animation.type) {
      case 'fade':
        animatedOpacity = interpolate(animProgress, [0, 1], [0, opacity]);
        break;
        
      case 'slide-up': {
        const distance = animation.distance || 50;
        const translateY = interpolate(animProgress, [0, 1], [distance, 0]);
        animatedStyle.transform = `translateY(${translateY}px)`;
        animatedOpacity = interpolate(animProgress, [0, 1], [0, opacity]);
        break;
      }
        
      case 'slide-down': {
        const distance = animation.distance || 50;
        const translateY = interpolate(animProgress, [0, 1], [-distance, 0]);
        animatedStyle.transform = `translateY(${translateY}px)`;
        animatedOpacity = interpolate(animProgress, [0, 1], [0, opacity]);
        break;
      }
        
      case 'typewriter': {
        const speed = animation.speed || 0.05;
        const charsToShow = Math.floor(localFrame * speed);
        displayText = textProps.content.substring(0, charsToShow);
        break;
      }
        
      case 'bounce': {
        const bounceHeight = 20;
        const bounces = 3;
        const bounceY = animProgress < 1
          ? Math.abs(Math.sin(animProgress * Math.PI * bounces)) * bounceHeight * (1 - animProgress)
          : 0;
        animatedStyle.transform = `translateY(-${bounceY}px)`;
        break;
      }
        
      case 'scale-in': {
        const scaleValue = interpolate(animProgress, [0, 1], [0, 1]);
        animatedStyle.transform = `scale(${scaleValue})`;
        animatedOpacity = interpolate(animProgress, [0, 1], [0, opacity]);
        break;
      }
        
      case 'blur-in': {
        const blurAmount = interpolate(animProgress, [0, 1], [10, 0]);
        animatedStyle.filter = `blur(${blurAmount}px)`;
        animatedOpacity = interpolate(animProgress, [0, 1], [0, opacity]);
        break;
      }
    }
  }
  
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${x}%`,
    top: `${y}%`,
    transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`,
    opacity: animatedOpacity,
  };
  
  // Build stroke shadow — use multi-layer text-shadow for clean outlines instead of WebkitTextStroke
  const strokeWidth = textProps.stroke?.width ?? (textProps as any).strokeWidth ?? 0;
  const strokeColor = textProps.stroke?.color ?? (textProps as any).strokeColor ?? '#000000';
  
  let strokeShadow = '';
  if (strokeWidth > 0) {
    // Generate 8-direction text-shadow for a clean outline that doesn't eat into the fill
    const offsets = [
      [strokeWidth, 0], [-strokeWidth, 0], [0, strokeWidth], [0, -strokeWidth],
      [strokeWidth, strokeWidth], [-strokeWidth, strokeWidth],
      [strokeWidth, -strokeWidth], [-strokeWidth, -strokeWidth],
    ];
    strokeShadow = offsets.map(([ox, oy]) => `${ox}px ${oy}px 0px ${strokeColor}`).join(', ');
  }

  const combinedShadow = [strokeShadow, textProps.textShadow].filter(Boolean).join(', ');

  const textStyle: React.CSSProperties = {
    fontFamily: textProps.fontFamily || '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    fontSize: `${textProps.fontSize || 48}px`,
    fontWeight: textProps.fontWeight || 700,
    color: textProps.color || '#ffffff',
    textAlign: textProps.textAlign || 'center',
    lineHeight: textProps.lineHeight || 1.2,
    letterSpacing: textProps.letterSpacing ? `${textProps.letterSpacing}px` : undefined,
    textShadow: combinedShadow || undefined,
    backgroundColor: textProps.backgroundColor,
    padding: textProps.padding ? `${textProps.padding}px` : undefined,
    borderRadius: textProps.borderRadius ? `${textProps.borderRadius}px` : undefined,
    whiteSpace: 'pre-wrap',
    maxWidth: '80%',
    ...animatedStyle,
  };
  
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={containerStyle}>
        <div style={textStyle}>
          {displayText}
        </div>
      </div>
    </AbsoluteFill>
  );
};
