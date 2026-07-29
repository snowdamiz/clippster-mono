import { frameToTime, getLastFrameTime } from "../lib/time";

export type FrameRenderPolicy = "realtime" | "exact-preview" | "exact-export";

export function getRenderFrame({
	time,
	fps,
	duration,
}: {
	time: number;
	fps: number;
	duration: number;
}): { frameIndex: number; time: number } {
	const safeFps = Math.max(1, fps);
	const lastFrameTime = getLastFrameTime({ duration, fps: safeFps });
	const clampedTime = Math.max(0, Math.min(time, lastFrameTime));
	const frameIndex = Math.max(0, Math.floor(clampedTime * safeFps));
	return {
		frameIndex,
		time: frameToTime({ frame: frameIndex, fps: safeFps }),
	};
}
