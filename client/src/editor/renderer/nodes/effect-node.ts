import type { CanvasRenderer } from "../canvas-renderer";
import type { VideoEffectType } from "../../types/effects";
import { BaseNode } from "./base-node";
import { applyCanvasEffects, buildFilterString, hasPostDrawEffects } from "../effects/canvas-effects";
import type { VideoEffect } from "../../types/effects";

export type EffectNodeParams = {
	effectType: VideoEffectType;
	enabled: boolean;
	intensity: number;
	params: Record<string, number | string>;
	duration: number;
	timeOffset: number;
	trimStart: number;
	trimEnd: number;
};

export class EffectNode extends BaseNode<EffectNodeParams> {
	async render({
		renderer,
		time,
	}: {
		renderer: CanvasRenderer;
		time: number;
	}): Promise<void> {
		if (!this.params.enabled) return;

		const startTime = this.params.timeOffset;
		const endTime = startTime + this.params.duration;
		if (time < startTime || time >= endTime) return;

		const effect = this.toVideoEffect();
		const effects = [effect];

		const filterStr = buildFilterString(effects);
		if (filterStr) {
			const imageData = renderer.context.getImageData(0, 0, renderer.width, renderer.height);
			renderer.context.filter = filterStr;
			renderer.context.putImageData(imageData, 0, 0);
			renderer.context.drawImage(renderer.context.canvas, 0, 0);
			renderer.context.filter = "none";
		}

		if (hasPostDrawEffects(effects)) {
			applyCanvasEffects(
				renderer.context,
				renderer.width,
				renderer.height,
				effects,
				time,
				startTime,
			);
		}
	}

	private toVideoEffect(): VideoEffect {
		const base = {
			id: "effect-node",
			type: this.params.effectType,
			enabled: this.params.enabled,
			intensity: this.params.intensity,
		};

		return { ...base, ...this.params.params } as unknown as VideoEffect;
	}
}
