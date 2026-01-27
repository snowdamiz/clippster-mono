import React from 'react';
import { Audio, interpolate, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AIVideoTrack } from '../../types/ai-video';

interface AudioTrackProps {
  track: AIVideoTrack;
  videoServerPort: number;
}

export const AudioTrack: React.FC<AudioTrackProps> = ({ track, videoServerPort }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  
  const trackStartFrame = track.startTime * fps;
  const trackEndFrame = track.endTime * fps;
  
  if (frame < trackStartFrame || frame > trackEndFrame) {
    return null;
  }
  
  if (!track.source) return null;
  
  const audioSrc = getAudioUrl(track.source.path, videoServerPort);
  const startFrom = (track.properties.trimStart || 0) * fps;
  const playbackRate = track.properties.playbackRate || 1;
  
  // Calculate volume with keyframe support
  const localFrame = frame - trackStartFrame;
  const trackDurationFrames = trackEndFrame - trackStartFrame;
  const progress = localFrame / (trackDurationFrames || 1);
  
  let volume = 1;
  if (typeof track.properties.volume === 'number') {
    volume = track.properties.volume;
  } else if (track.properties.volume && 'keyframes' in track.properties.volume) {
    volume = getAnimatedVolume(track.properties.volume.keyframes, progress);
  }
  
  return (
    <Audio
      src={audioSrc}
      startFrom={Math.floor(startFrom)}
      endAt={Math.floor((track.endTime - track.startTime) * fps)}
      playbackRate={playbackRate}
      volume={volume}
    />
  );
};

function getAnimatedVolume(
  keyframes: Array<{ time: number; value: number; easing?: string }>,
  progress: number
): number {
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

function getAudioUrl(path: string, videoServerPort: number): string {
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  if (path.startsWith('asset://')) {
    return path;
  }
  if (videoServerPort > 0) {
    return `http://localhost:${videoServerPort}/video?path=${encodeURIComponent(path)}`;
  }
  return `asset://localhost/${path}`;
}
