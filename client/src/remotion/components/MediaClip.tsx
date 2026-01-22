import React, { CSSProperties } from 'react';
import { AbsoluteFill, Video, interpolate, spring } from 'remotion';
import type { AIVideoTrack } from '../../types/ai-video';
import { getAnimatedValue } from '../utils/animations';
import { applyEffects } from '../utils/effects';

function utf8ToBase64(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

interface Props {
  track: AIVideoTrack;
  trackTime: number;
  trackDuration: number;
  videoServerPort: number;
  fps: number;
}

export const MediaClip: React.FC<Props> = ({ track, trackTime, trackDuration, videoServerPort, fps }) => {
  const props = track.properties;
  
  const x = getAnimatedValue(props.x, trackTime, trackDuration, fps) || 0;
  const y = getAnimatedValue(props.y, trackTime, trackDuration, fps) || 0;
  const width = getAnimatedValue(props.width, trackTime, trackDuration, fps) || (typeof props.width === 'number' ? props.width : 1920);
  const height = getAnimatedValue(props.height, trackTime, trackDuration, fps) || (typeof props.height === 'number' ? props.height : 1080);
  const scale = getAnimatedValue(props.scale, trackTime, trackDuration, fps) || 1;
  const rotation = getAnimatedValue(props.rotation, trackTime, trackDuration, fps) || 0;
  const opacity = getAnimatedValue(props.opacity, trackTime, trackDuration, fps) ?? 1;

  let enterOpacity = 1;
  let exitOpacity = 1;

  if (props.enterTransition) {
    const enterProgress = Math.min(trackTime / props.enterTransition.duration, 1);
    enterOpacity = interpolate(enterProgress, [0, 1], [0, 1]);
  }

  if (props.exitTransition) {
    const exitStart = trackDuration - props.exitTransition.duration;
    if (trackTime >= exitStart) {
      const exitProgress = (trackTime - exitStart) / props.exitTransition.duration;
      exitOpacity = interpolate(exitProgress, [0, 1], [1, 0]);
    }
  }

  const finalOpacity = opacity * enterOpacity * exitOpacity;

  const style: CSSProperties = {
    position: 'absolute',
    left: x,
    top: y,
    width,
    height,
    transform: `scale(${scale}) rotate(${rotation}deg)`,
    opacity: finalOpacity,
  };

  const effectStyle = applyEffects(props.effects || [], trackTime, trackDuration, fps);

  if (!track.source) return null;

  const encodedPath = utf8ToBase64(track.source.path);
  const videoUrl = `http://localhost:${videoServerPort}/video/${encodedPath}`;
  const startFrom = (props.trimStart || 0) * fps;

  return (
    <AbsoluteFill style={style}>
      <div style={{ width: '100%', height: '100%', ...effectStyle }}>
        <Video
          src={videoUrl}
          startFrom={startFrom}
          volume={getAnimatedValue(props.volume, trackTime, trackDuration, fps) ?? 1}
          playbackRate={props.playbackRate || 1}
          style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        />
      </div>
    </AbsoluteFill>
  );
};
