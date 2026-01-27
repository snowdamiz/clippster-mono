import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AIVideoTrack } from '../../types/ai-video';

interface ShapeElementProps {
  track: AIVideoTrack;
}

export const ShapeElement: React.FC<ShapeElementProps> = ({ track }) => {
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
  
  const shapeProps = track.properties.shape;
  
  const x = typeof track.properties.x === 'number' ? track.properties.x : 50;
  const y = typeof track.properties.y === 'number' ? track.properties.y : 50;
  const width = typeof track.properties.width === 'number' ? track.properties.width : 100;
  const height = typeof track.properties.height === 'number' ? track.properties.height : 100;
  const scale = typeof track.properties.scale === 'number' ? track.properties.scale : 1;
  const rotation = typeof track.properties.rotation === 'number' ? track.properties.rotation : 0;
  
  // Handle animated opacity
  let opacity = 1;
  if (typeof track.properties.opacity === 'number') {
    opacity = track.properties.opacity;
  } else if (track.properties.opacity && typeof track.properties.opacity === 'object') {
    const opacityAnim = track.properties.opacity as any;
    if (opacityAnim.keyframes) {
      opacity = getAnimatedValue(opacityAnim.keyframes, progress);
    }
  }
  
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${x}%`,
    top: `${y}%`,
    transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`,
    opacity,
  };
  
  // Handle color from either shape.fill or direct color property
  const color = (track.properties as any).color || shapeProps?.fill;
  const gradient = (track.properties as any).gradient;
  
  const shapeStyle: React.CSSProperties = {
    width: `${width}%`,
    height: `${height}%`,
    backgroundColor: gradient ? undefined : color,
    background: gradient ? createGradient(gradient) : undefined,
    border: shapeProps?.stroke ? `${shapeProps.strokeWidth || 1}px solid ${shapeProps.stroke}` : undefined,
  };
  
  let shapeElement: JSX.Element;
  
  // If no shape type specified, default to rectangle
  const shapeType = shapeProps?.type || 'rectangle';
  
  switch (shapeType) {
    case 'rectangle':
      shapeElement = (
        <div style={{
          ...shapeStyle,
          borderRadius: shapeProps?.cornerRadius ? `${shapeProps.cornerRadius}px` : undefined,
        }} />
      );
      break;
      
    case 'circle':
      shapeElement = (
        <div style={{
          ...shapeStyle,
          borderRadius: '50%',
        }} />
      );
      break;
      
    case 'ellipse':
      shapeElement = (
        <div style={{
          ...shapeStyle,
          borderRadius: '50%',
        }} />
      );
      break;
      
    case 'line':
      shapeElement = (
        <div style={{
          width: `${width}px`,
          height: `${shapeProps?.strokeWidth || 2}px`,
          backgroundColor: shapeProps?.stroke || shapeProps?.fill || color,
        }} />
      );
      break;
      
    default:
      return null;
  }
  
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={containerStyle}>
        {shapeElement}
      </div>
    </AbsoluteFill>
  );
};

function getAnimatedValue(keyframes: Array<{ time: number; value: number }>, progress: number): number {
  if (!keyframes || keyframes.length === 0) return 1;
  if (keyframes.length === 1) return keyframes[0].value;
  
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
  
  const segmentProgress = (progress - prevKeyframe.time) / (nextKeyframe.time - prevKeyframe.time);
  return interpolate(segmentProgress, [0, 1], [prevKeyframe.value, nextKeyframe.value]);
}

function createGradient(gradient: { type: string; colors: string[] }): string {
  if (gradient.type === 'radial') {
    return `radial-gradient(circle, ${gradient.colors.join(', ')})`;
  }
  return `linear-gradient(${gradient.colors.join(', ')})`;
}
