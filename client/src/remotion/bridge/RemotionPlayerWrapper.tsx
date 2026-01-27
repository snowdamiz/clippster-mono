import React, { useCallback, useEffect, useRef } from 'react';
import { Player, PlayerRef } from '@remotion/player';
import { AIComposition } from '../compositions/AIComposition';
import type { AIVideoComposition } from '../../types/ai-video';

interface Props {
  composition: AIVideoComposition | null;
  currentFrame: number;
  isPlaying: boolean;
  videoServerPort: number;
  onFrameUpdate?: (frame: number) => void;
  onDurationChange?: (duration: number) => void;
  onPlayingChange?: (playing: boolean) => void;
}

export const RemotionPlayerWrapper: React.FC<Props> = ({
  composition,
  currentFrame,
  isPlaying,
  videoServerPort,
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

  // Note: Frame updates will be handled via polling or useCurrentFrame hook in parent
  // The Player component doesn't expose onFrameUpdate in the current API

  if (!composition) {
    return (
      <div style={{ 
        width: '100%', 
        height: '100%', 
        display: 'flex', 
        flexDirection: 'column',
        alignItems: 'center', 
        justifyContent: 'center',
        background: '#0a0a0b',
        color: '#64748b',
        gap: '1rem',
      }}>
        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor">
          <path d="M12 2L2 7l10 5 10-5-10-5z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 17l10 5 10-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M2 12l10 5 10-5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <p style={{ fontSize: '0.875rem' }}>Add media and generate a composition to preview</p>
      </div>
    );
  }

  return (
    <Player
      ref={playerRef}
      component={AIComposition as any}
      inputProps={{ 
        composition,
        videoServerPort,
      }}
      durationInFrames={durationInFrames}
      fps={fps}
      compositionWidth={composition.width}
      compositionHeight={composition.height}
      style={{ width: '100%', height: '100%' }}
      controls={false}
      loop={false}
    />
  );
};
