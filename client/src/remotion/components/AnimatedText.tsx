import React, { CSSProperties } from 'react';
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AIVideoTrack } from '../../types/ai-video';
import { getAnimatedValue } from '../utils/animations';

interface Props {
  track: AIVideoTrack;
  trackTime: number;
  trackDuration: number;
}

export const AnimatedText: React.FC<Props> = ({ track, trackTime, trackDuration }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const props = track.properties;
  const textProps = props.text;

  if (!textProps) return null;

  const x = getAnimatedValue(props.x, trackTime, trackDuration, fps) || 0;
  const y = getAnimatedValue(props.y, trackTime, trackDuration, fps) || 0;
  const scale = getAnimatedValue(props.scale, trackTime, trackDuration, fps) || 1;
  const rotation = getAnimatedValue(props.rotation, trackTime, trackDuration, fps) || 0;
  let opacity = getAnimatedValue(props.opacity, trackTime, trackDuration, fps) ?? 1;

  let transform = `scale(${scale}) rotate(${rotation}deg)`;
  let textTransform = '';
  let filter = '';

  if (textProps.animation) {
    const animDuration = 'duration' in textProps.animation ? textProps.animation.duration : 1;
    const animProgress = Math.min(trackTime / animDuration, 1);

    switch (textProps.animation.type) {
      case 'fade':
        opacity *= interpolate(animProgress, [0, 1], [0, 1]);
        break;
      
      case 'slide-up':
        const distance = 'distance' in textProps.animation ? textProps.animation.distance || 50 : 50;
        const slideY = interpolate(animProgress, [0, 1], [distance, 0]);
        textTransform = `translateY(${slideY}px)`;
        opacity *= interpolate(animProgress, [0, 1], [0, 1]);
        break;
      
      case 'slide-down':
        const distanceDown = 'distance' in textProps.animation ? textProps.animation.distance || 50 : 50;
        const slideYDown = interpolate(animProgress, [0, 1], [-distanceDown, 0]);
        textTransform = `translateY(${slideYDown}px)`;
        opacity *= interpolate(animProgress, [0, 1], [0, 1]);
        break;
      
      case 'scale-in':
        const scaleAnim = interpolate(animProgress, [0, 1], [0, 1]);
        textTransform = `scale(${scaleAnim})`;
        break;
      
      case 'bounce':
        const bounceScale = spring({
          frame: frame - (track.startTime * fps),
          fps,
          config: { damping: 10, stiffness: 200 },
        });
        textTransform = `scale(${bounceScale})`;
        break;
      
      case 'blur-in':
        const blur = interpolate(animProgress, [0, 1], [10, 0]);
        filter = `blur(${blur}px)`;
        opacity *= interpolate(animProgress, [0, 1], [0, 1]);
        break;
      
      case 'typewriter':
        const speed = 'speed' in textProps.animation ? textProps.animation.speed : 0.05;
        const charsToShow = Math.floor(trackTime / speed);
        const displayText = textProps.content.substring(0, charsToShow);
        textProps.content = displayText;
        break;
    }
  }

  const containerStyle: CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    transform,
    opacity,
  };

  const textStyle: CSSProperties = {
    fontFamily: textProps.fontFamily,
    fontSize: textProps.fontSize,
    fontWeight: textProps.fontWeight,
    color: textProps.color,
    backgroundColor: textProps.backgroundColor,
    padding: textProps.padding,
    borderRadius: textProps.borderRadius,
    textAlign: textProps.textAlign,
    lineHeight: textProps.lineHeight,
    letterSpacing: textProps.letterSpacing,
    textShadow: textProps.textShadow,
    transform: textTransform,
    filter,
    whiteSpace: 'pre-wrap',
  };

  if (textProps.stroke) {
    textStyle.WebkitTextStroke = `${textProps.stroke.width}px ${textProps.stroke.color}`;
  }

  return (
    <AbsoluteFill style={containerStyle}>
      <div style={textStyle}>
        {textProps.content}
      </div>
    </AbsoluteFill>
  );
};
