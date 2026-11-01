import type { FramingSample } from '../../../client/src/services/auto-framing/planner';

// Do not bundle the desktop model or inference runtime in the web app.
export async function analyzeLocalFaces(_url: string, _start: number, _end: number, _signal: AbortSignal, _progress: (value: number) => void, _cuts?: number[]): Promise<{ samples: FramingSample[]; width: number; height: number }> {
  throw new Error('Auto framing is coming soon to web and mobile.');
}
