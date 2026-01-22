import React, { CSSProperties } from 'react';
import { AbsoluteFill } from 'remotion';
import type { AIVideoTrack } from '../../types/ai-video';
import { getAnimatedValue } from '../utils/animations';

interface Props {
  track: AIVideoTrack;
  trackTime: number;
  trackDuration: number;
}

export const ShapeElement: React.FC<Props> = ({ track, trackTime, trackDuration }) => {
  const props = track.properties;
  const shapeProps = props.shape;

  if (!shapeProps) return null;

  const x = getAnimatedValue(props.x, trackTime, trackDuration, 30) || 0;
  const y = getAnimatedValue(props.y, trackTime, trackDuration, 30) || 0;
  const width = getAnimatedValue(props.width, trackTime, trackDuration, 30) || 100;
  const height = getAnimatedValue(props.height, trackTime, trackDuration, 30) || 100;
  const scale = getAnimatedValue(props.scale, trackTime, trackDuration, 30) || 1;
  const rotation = getAnimatedValue(props.rotation, trackTime, trackDuration, 30) || 0;
  const opacity = getAnimatedValue(props.opacity, trackTime, trackDuration, 30) ?? 1;

  const containerStyle: CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    width,
    height,
    transform: `scale(${scale}) rotate(${rotation}deg)`,
    opacity,
  };

  const shapeStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    backgroundColor: shapeProps.fill,
    border: shapeProps.stroke ? `${shapeProps.strokeWidth || 1}px solid ${shapeProps.stroke}` : undefined,
  };

  switch (shapeProps.type) {
    case 'rectangle':
      shapeStyle.borderRadius = shapeProps.cornerRadius || 0;
      break;
    
    case 'circle':
      shapeStyle.borderRadius = '50%';
      break;
    
    case 'ellipse':
      shapeStyle.borderRadius = '50%';
      break;
  }

  return (
    <AbsoluteFill style={containerStyle}>
      <div style={shapeStyle} />
    </AbsoluteFill>
  );
};
