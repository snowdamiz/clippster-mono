import React from 'react';
import { Composition } from 'remotion';
import { AIComposition } from './compositions/AIComposition';
import type { AIVideoComposition } from '../types/ai-video';

export const Root: React.FC = () => {
  return (
    <>
      <Composition
        id="AIVideo"
        component={AIComposition}
        durationInFrames={150}
        fps={30}
        width={1920}
        height={1080}
        defaultProps={{
          composition: null as AIVideoComposition | null,
          videoServerPort: 0,
        }}
      />
    </>
  );
};
