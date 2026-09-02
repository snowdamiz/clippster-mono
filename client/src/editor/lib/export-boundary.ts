import type { FrameRenderPolicy } from "../renderer/frame-policy";

/** One display frame — covers frame-quantization error at segment cuts during export. */
export function getExportBoundarySlackSec(
	fps: number,
	framePolicy: FrameRenderPolicy,
): number {
	if (framePolicy !== "exact-export") return 0;
	return 1 / Math.max(1, fps);
}
