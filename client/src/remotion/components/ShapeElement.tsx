import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
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
  
  const shapeProps = track.properties.shape;
  if (!shapeProps) return null;
  
  const x = typeof track.properties.x === 'number' ? track.properties.x : 50;
  const y = typeof track.properties.y === 'number' ? track.properties.y : 50;
  const width = typeof track.properties.width === 'number' ? track.properties.width : 100;
  const height = typeof track.properties.height === 'number' ? track.properties.height : 100;
  const scale = typeof track.properties.scale === 'number' ? track.properties.scale : 1;
  const rotation = typeof track.properties.rotation === 'number' ? track.properties.rotation : 0;
  const opacity = typeof track.properties.opacity === 'number' ? track.properties.opacity : 1;
  
  const containerStyle: React.CSSProperties = {
    position: 'absolute',
    left: `${x}%`,
    top: `${y}%`,
    transform: `translate(-50%, -50%) scale(${scale}) rotate(${rotation}deg)`,
    opacity,
  };
  
  const shapeStyle: React.CSSProperties = {
    width: `${width}px`,
    height: `${height}px`,
    backgroundColor: shapeProps.fill,
    border: shapeProps.stroke ? `${shapeProps.strokeWidth || 1}px solid ${shapeProps.stroke}` : undefined,
  };
  
  let shapeElement: JSX.Element;
  
  switch (shapeProps.type) {
    case 'rectangle':
      shapeElement = (
        <div style={{
          ...shapeStyle,
          borderRadius: shapeProps.cornerRadius ? `${shapeProps.cornerRadius}px` : undefined,
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
          height: `${shapeProps.strokeWidth || 2}px`,
          backgroundColor: shapeProps.stroke || shapeProps.fill,
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
