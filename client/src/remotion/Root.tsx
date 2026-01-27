import React from 'react';
import { Composition } from 'remotion';
import { AIComposition } from './compositions/AIComposition';
import type { AIVideoComposition } from '../types/ai-video';

interface AICompositionProps {
  composition: AIVideoComposition | null;
  videoServerPort: number;
}

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="AIVideo"
        component={AIComposition as any}
        durationInFrames={300}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          composition: null,
          videoServerPort: 0,
        }}
      />
    </>
  );
};
