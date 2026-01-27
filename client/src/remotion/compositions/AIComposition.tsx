import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import type { AIVideoComposition } from '../../types/ai-video';
import { MediaClip } from '../components/MediaClip';
import { AnimatedText } from '../components/AnimatedText';
import { AudioTrack } from '../components/AudioTrack';
import { ShapeElement } from '../components/ShapeElement';

interface AICompositionProps {
  composition: AIVideoComposition | null;
  videoServerPort: number;
}

export const AIComposition: React.FC<AICompositionProps> = ({ composition, videoServerPort }) => {
  if (!composition) {
    return (
      <AbsoluteFill
        style={{
          backgroundColor: '#0a0a0b',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#64748b',
          fontSize: '1.5rem',
        }}
      >
        <div>No composition loaded</div>
      </AbsoluteFill>
    );
  }

  // Sort tracks by layer (lower layers render first, higher layers on top)
  const sortedTracks = useMemo(() => {
    return [...composition.tracks].sort((a, b) => a.layer - b.layer);
  }, [composition.tracks]);

  // Separate audio tracks from visual tracks
  const audioTracks = sortedTracks.filter(track => track.type === 'audio');
  const visualTracks = sortedTracks.filter(track => track.type !== 'audio');

  return (
    <AbsoluteFill
      style={{
        backgroundColor: composition.backgroundColor || '#000000',
      }}
    >
      {/* Render visual tracks in layer order */}
      {visualTracks.map((track) => {
        switch (track.type) {
          case 'video':
          case 'image':
            return (
              <MediaClip
                key={track.id}
                track={track}
                videoServerPort={videoServerPort}
              />
            );
            
          case 'text':
            return (
              <AnimatedText
                key={track.id}
                track={track}
              />
            );
            
          case 'shape':
            return (
              <ShapeElement
                key={track.id}
                track={track}
              />
            );
            
          default:
            return null;
        }
      })}

      {/* Render audio tracks */}
      {audioTracks.map((track) => (
        <AudioTrack
          key={track.id}
          track={track}
          videoServerPort={videoServerPort}
        />
      ))}
    </AbsoluteFill>
  );
};
