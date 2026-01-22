import React from 'react';
import { Audio } from 'remotion';
import type { AIVideoTrack } from '../../types/ai-video';

function utf8ToBase64(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}
import { getAnimatedValue } from '../utils/animations';

interface Props {
  track: AIVideoTrack;
  trackTime: number;
  videoServerPort: number;
}

export const AudioTrack: React.FC<Props> = ({ track, trackTime, videoServerPort }) => {
  const props = track.properties;
  
  if (!track.source) return null;

  const encodedPath = utf8ToBase64(track.source.path);
  const audioUrl = `http://localhost:${videoServerPort}/video/${encodedPath}`;
  const volume = getAnimatedValue(props.volume, trackTime, track.endTime - track.startTime, 30) ?? 1;
  const startFrom = (props.trimStart || 0) * 30;

  return (
    <Audio
      src={audioUrl}
      startFrom={startFrom}
      volume={volume}
      playbackRate={props.playbackRate || 1}
    />
  );
};
