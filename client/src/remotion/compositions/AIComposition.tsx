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
import { MotionGraphicElement } from '../components/MotionGraphicElement';

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
  const cameraMotionTracks = sortedTracks.filter(track => track.type === 'cameraMotion');
  const impactFXTracks = sortedTracks.filter(track => track.type === 'impactFX');
  const transitionTracks = sortedTracks.filter(track => track.type === 'transition');
  const visualTracks = sortedTracks.filter(track => 
    track.type !== 'audio' && track.type !== 'cameraMotion' && track.type !== 'impactFX' && track.type !== 'transition' && track.type !== 'motionGraphic'
  );
  const motionGraphicTracks = sortedTracks.filter(track => track.type === 'motionGraphic');

  // Debug: log full track details once
  React.useEffect(() => {
    console.log('[AIComposition] ═══ COMPOSITION LOADED ═══');
    console.log('[AIComposition] Duration:', composition.duration, 'FPS:', composition.fps, 'Size:', composition.width, 'x', composition.height);
    console.log('[AIComposition] Total tracks:', composition.tracks.length);
    console.log('[AIComposition] Visual tracks:', visualTracks.length);
    console.log('[AIComposition] Motion graphic tracks:', motionGraphicTracks.length);
    console.log('[AIComposition] Camera tracks:', cameraMotionTracks.length);
    console.log('[AIComposition] Impact tracks:', impactFXTracks.length);
    console.log('[AIComposition] Transition tracks:', transitionTracks.length);
    console.log('[AIComposition] Audio tracks:', audioTracks.length);
    
    // Log each text track to check if properties.text exists
    visualTracks.filter(t => t.type === 'text').forEach(t => {
      console.log(`[AIComposition] TEXT TRACK "${t.name}": hasTextProp=${!!t.properties.text}, props=`, JSON.stringify(t.properties).slice(0, 200));
    });
    
    // Log each motion graphic track
    motionGraphicTracks.forEach(t => {
      console.log(`[AIComposition] MG TRACK "${t.name}": templateId=${t.properties.motionGraphic?.templateId}, time=${t.startTime}-${t.endTime}, layer=${t.layer}`);
    });
    
    // Log each image track
    visualTracks.filter(t => t.type === 'image').forEach(t => {
      console.log(`[AIComposition] IMAGE TRACK "${t.name}": source=${t.source?.path}, time=${t.startTime}-${t.endTime}, layer=${t.layer}`);
    });
  }, [composition]);

  // Merge multiple effect tracks into single combined tracks
  const cameraMotionTrack = useMemo(() => {
    if (cameraMotionTracks.length === 0) return null;
    if (cameraMotionTracks.length === 1) return cameraMotionTracks[0];
    const mergedEffects = cameraMotionTracks.flatMap(t => (t.properties as any).effects || []);
    return { ...cameraMotionTracks[0], properties: { ...cameraMotionTracks[0].properties, effects: mergedEffects } };
  }, [cameraMotionTracks]);

  const impactFXTrack = useMemo(() => {
    if (impactFXTracks.length === 0) return null;
    if (impactFXTracks.length === 1) return impactFXTracks[0];
    const mergedEffects = impactFXTracks.flatMap(t => (t.properties as any).effects || []);
    return { ...impactFXTracks[0], properties: { ...impactFXTracks[0].properties, effects: mergedEffects } };
  }, [impactFXTracks]);

  const transitionTrack = useMemo(() => {
    if (transitionTracks.length === 0) return null;
    if (transitionTracks.length === 1) return transitionTracks[0];
    const mergedTransitions = transitionTracks.flatMap(t => (t.properties as any).transitions || []);
    return { ...transitionTracks[0], properties: { ...transitionTracks[0].properties, transitions: mergedTransitions } };
  }, [transitionTracks]);

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
      {motionGraphicTracks.map((track) => (
        <MotionGraphicElement
          key={track.id}
          track={track}
        />
      ))}
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
      {/* Render audio tracks FIRST - outside of visual effects to prevent audio cutouts */}
      {audioTracks.map((track) => (
        <AudioTrack
          key={track.id}
          track={track}
          videoServerPort={videoServerPort}
        />
      ))}
      
      {wrappedContent}
    </AbsoluteFill>
  );
};
