import type { CanvasRenderer } from "../canvas-renderer";
import { BaseNode } from "./base-node";
import { BlurBackgroundNode } from "./blur-background-node";

export type RootNodeParams = {
	duration: number;
};

export class RootNode extends BaseNode<RootNodeParams> {
	get duration() {
		return this.params.duration ?? 0;
	}

	async render({
		renderer,
		time,
	}: {
		renderer: CanvasRenderer;
		time: number;
	}): Promise<void> {
		const children = this.children;
		if (children.length === 0) return;

		if (children.length > 1) {
			await this.prefetch({ renderer, time });
		}

		for (let i = 0; i < children.length; i++) {
			const child = children[i];
			await child.render({ renderer, time });

			if (i === 0 && child instanceof BlurBackgroundNode && children.length > i + 1) {
				const rest = [...new Set(children.slice(i + 1))];
				await Promise.all(rest.map((c) => c.prefetch({ renderer, time })));
			}
		}
	}
}
