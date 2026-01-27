import React, { useMemo } from 'react';
import { AbsoluteFill } from 'remotion';
import type { AIVideoComposition } from '../../types/ai-video';
import { MediaClip } from '../components/MediaClip';
import { AnimatedText } from '../components/AnimatedText';
import { AudioTrack } from '../components/AudioTrack';
import { ShapeElement } from '../components/ShapeElement';
import { CameraMotion } from '../components/CameraMotion';
import { ImpactEffects } from '../components/ImpactEffects';
import { TransitionEffects } from '../components/TransitionEffects';

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

  // Separate tracks by type
  const audioTracks = sortedTracks.filter(track => track.type === 'audio');
  const cameraMotionTrack = sortedTracks.find(track => track.type === 'cameraMotion');
  const impactFXTrack = sortedTracks.find(track => track.type === 'impactFX');
  const transitionTrack = sortedTracks.find(track => track.type === 'transition');
  const visualTracks = sortedTracks.filter(track => 
    track.type !== 'audio' && track.type !== 'cameraMotion' && track.type !== 'impactFX' && track.type !== 'transition'
  );

  // Render visual content
  const visualContent = (
    <>
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
    </>
  );

  // Wrap with camera motion if present
  let wrappedContent = visualContent;
  if (cameraMotionTrack) {
    wrappedContent = (
      <CameraMotion track={cameraMotionTrack}>
        {wrappedContent}
      </CameraMotion>
    );
  }

  // Wrap with impact effects if present
  if (impactFXTrack) {
    wrappedContent = (
      <ImpactEffects track={impactFXTrack}>
        {wrappedContent}
      </ImpactEffects>
    );
  }
  
  // Wrap with transitions if present
  if (transitionTrack) {
    wrappedContent = (
      <TransitionEffects track={transitionTrack}>
        {wrappedContent}
      </TransitionEffects>
    );
  }

  return (
    <AbsoluteFill
      style={{
        backgroundColor: composition.backgroundColor || '#000000',
      }}
    >
      {wrappedContent}

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
