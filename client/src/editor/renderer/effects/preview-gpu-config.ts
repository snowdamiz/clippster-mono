/** Toggle GPU-accelerated preview passes (blur / simple filters) when WebGL2 is available. */

let gpuPreviewEffectsEnabled = true;

export function setGpuPreviewEffectsEnabled(on: boolean): void {
	gpuPreviewEffectsEnabled = on;
}

export function isGpuPreviewEffectsEnabled(): boolean {
	return gpuPreviewEffectsEnabled;
}
