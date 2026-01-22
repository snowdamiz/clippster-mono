import React from 'react';
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from 'remotion';
import type { AIVideoComposition } from '../../types/ai-video';
import { MediaClip } from '../components/MediaClip';
import { AnimatedText } from '../components/AnimatedText';
import { ImageElement } from '../components/ImageElement';
import { ShapeElement } from '../components/ShapeElement';
import { AudioTrack } from '../components/AudioTrack';

interface Props {
  composition: AIVideoComposition | null;
  videoServerPort: number;
}

export const AIComposition: React.FC<Props> = ({ composition, videoServerPort }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTime = frame / fps;

  if (!composition) {
    return (
      <AbsoluteFill style={{ backgroundColor: '#000', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#888', fontSize: 24 }}>No composition loaded</div>
      </AbsoluteFill>
    );
  }

  const sortedTracks = [...composition.tracks].sort((a, b) => a.layer - b.layer);

  return (
    <AbsoluteFill style={{ backgroundColor: composition.backgroundColor || '#000' }}>
      {sortedTracks.map((track) => {
        const isVisible = currentTime >= track.startTime && currentTime <= track.endTime;
        if (!isVisible) return null;

        const trackTime = currentTime - track.startTime;
        const trackDuration = track.endTime - track.startTime;

        switch (track.type) {
          case 'video':
            return (
              <MediaClip
                key={track.id}
                track={track}
                trackTime={trackTime}
                trackDuration={trackDuration}
                videoServerPort={videoServerPort}
                fps={fps}
              />
            );
          
          case 'image':
            return (
              <ImageElement
                key={track.id}
                track={track}
                trackTime={trackTime}
                trackDuration={trackDuration}
                videoServerPort={videoServerPort}
              />
            );
          
          case 'text':
            return (
              <AnimatedText
                key={track.id}
                track={track}
                trackTime={trackTime}
                trackDuration={trackDuration}
              />
            );
          
          case 'shape':
            return (
              <ShapeElement
                key={track.id}
                track={track}
                trackTime={trackTime}
                trackDuration={trackDuration}
              />
            );
          
          case 'audio':
            return (
              <AudioTrack
                key={track.id}
                track={track}
                trackTime={trackTime}
                videoServerPort={videoServerPort}
              />
            );
          
          default:
            return null;
        }
      })}
    </AbsoluteFill>
  );
};
