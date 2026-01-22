import React, { useCallback, useEffect, useRef } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { AIComposition } from '../compositions/AIComposition';
import type { AIVideoComposition } from '../../types/ai-video';

interface Props {
  composition: AIVideoComposition | null;
  currentFrame: number;
  isPlaying: boolean;
  videoServerPort: number;
  containerWidth: number;
  containerHeight: number;
  onFrameUpdate?: (frame: number) => void;
  onDurationChange?: (duration: number) => void;
  onPlayingChange?: (playing: boolean) => void;
}

export const RemotionPlayerWrapper: React.FC<Props> = ({
  composition,
  currentFrame,
  isPlaying,
  videoServerPort,
  containerWidth,
  containerHeight,
  onFrameUpdate,
  onDurationChange,
  onPlayingChange,
}) => {
  const playerRef = useRef<PlayerRef>(null);
  
  const fps = composition?.fps || 30;
  const durationInFrames = composition 
    ? Math.ceil(composition.duration * fps) 
    : 150;

  useEffect(() => {
    onDurationChange?.(durationInFrames / fps);
  }, [durationInFrames, fps, onDurationChange]);

  useEffect(() => {
    if (!playerRef.current) return;
    if (isPlaying) {
      playerRef.current.play();
    } else {
      playerRef.current.pause();
    }
  }, [isPlaying]);

  useEffect(() => {
    if (playerRef.current && !isPlaying) {
      playerRef.current.seekTo(currentFrame);
    }
  }, [currentFrame, isPlaying]);

  if (!composition) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#888',
        fontSize: '16px',
      }}>
        <p>Add media and generate a composition to preview</p>
      </div>
    );
  }

  const handleTimeUpdate = useCallback((frame: number) => {
    onFrameUpdate?.(frame);
  }, [onFrameUpdate]);

  // Calculate scaled dimensions to fit in container while maintaining aspect ratio
  const compositionAspect = composition.width / composition.height;
  const containerAspect = containerWidth / containerHeight;
  
  let playerWidth: number;
  let playerHeight: number;
  
  if (containerAspect > compositionAspect) {
    // Container is wider - fit to height
    playerHeight = containerHeight;
    playerWidth = playerHeight * compositionAspect;
  } else {
    // Container is taller - fit to width
    playerWidth = containerWidth;
    playerHeight = playerWidth / compositionAspect;
  }
  
  // Calculate scale to fit composition in container
  const scale = Math.min(
    containerWidth / composition.width,
    containerHeight / composition.height
  );
  
  // Player will render at playerWidth x playerHeight

  return (
    <div style={{
        position: 'absolute',
        inset: 0,
        backgroundColor: '#000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{
        width: playerWidth,
        height: playerHeight,
        overflow: 'hidden',
        position: 'relative',
      }}>
        <Player
          ref={playerRef}
          component={AIComposition}
          inputProps={{ 
            composition,
            videoServerPort,
          }}
          durationInFrames={durationInFrames}
          fps={fps}
          compositionWidth={composition.width}
          compositionHeight={composition.height}
          style={{ 
            width: composition.width,
            height: composition.height,
            zoom: scale,
            transformOrigin: 'top left',
          }}
          controls={false}
          loop={false}
          clickToPlay={false}
          acknowledgeRemotionLicense
          errorFallback={({ error }) => (
          <div style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
            backgroundColor: '#1a1a1a',
            color: '#999',
            padding: '2rem',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '48px', marginBottom: '1rem' }}>⚠️</div>
            <div style={{ fontSize: '18px', fontWeight: 600, marginBottom: '0.5rem' }}>
              Composition Error
            </div>
            <div style={{ fontSize: '14px', maxWidth: '600px' }}>
              {error.message.includes('image') 
                ? 'One or more images in this composition are corrupted or invalid. Please use valid image files.'
                : error.message}
            </div>
          </div>
        )}
        />
      </div>
    </div>
  );
};
