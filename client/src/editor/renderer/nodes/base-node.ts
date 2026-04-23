import type { CanvasRenderer } from "../canvas-renderer";

export type BaseNodeParams = object | undefined;

export class BaseNode<Params extends BaseNodeParams = BaseNodeParams> {
	params: Params;

	constructor(params?: Params) {
		this.params = params ?? ({} as Params);
	}

	children: BaseNode[] = [];

	add(child: BaseNode) {
		this.children.push(child);
		return this;
	}

	remove(child: BaseNode) {
		this.children = this.children.filter((c) => c !== child);
		return this;
	}

	/**
	 * Pre-decode phase: kick off async work (e.g. video frame decoding)
	 * in parallel across all children. Subclasses (e.g. VideoNode) override
	 * to pre-decode their frame and store it for render().
	 */
	async prefetch({
		renderer,
		time,
	}: {
		renderer: CanvasRenderer;
		time: number;
	}): Promise<void> {
		if (this.children.length > 0) {
			const unique = [...new Set(this.children)];
			await Promise.all(unique.map((child) => child.prefetch({ renderer, time })));
		}
	}

	async render({
		renderer,
		time,
	}: {
		renderer: CanvasRenderer;
		time: number;
	}): Promise<void> {
		// Prefetch immediately before each child renders so a later sibling cannot overwrite a
		// shared VideoNode prefetched frame (chained transitions reuse the middle clip).
		for (const child of this.children) {
			await child.prefetch({ renderer, time });
			await child.render({ renderer, time });
		}
	}
}
