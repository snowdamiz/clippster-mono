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
			await Promise.all(
				this.children.map((child) => child.prefetch({ renderer, time })),
			);
		}
	}

	async render({
		renderer,
		time,
	}: {
		renderer: CanvasRenderer;
		time: number;
	}): Promise<void> {
		// Phase 1: prefetch all children in parallel (video frame decoding)
		if (this.children.length > 1) {
			await this.prefetch({ renderer, time });
		}

		// Phase 2: render children sequentially (compositing order matters)
		if (this.children.length > 1) {
			const t0 = performance.now();
			for (let i = 0; i < this.children.length; i++) {
				const ct0 = performance.now();
				await this.children[i].render({ renderer, time });
				const childMs = performance.now() - ct0;
				if (childMs > 5) {
					console.log(`[BaseNode] child[${i}/${this.children.length}] took=${childMs.toFixed(1)}ms t=${time.toFixed(3)}`);
				}
			}
			const totalMs = performance.now() - t0;
			if (totalMs > 10) {
				console.log(`[BaseNode] ${this.children.length} children total=${totalMs.toFixed(1)}ms t=${time.toFixed(3)}`);
			}
		} else {
			for (const child of this.children) {
				await child.render({ renderer, time });
			}
		}
	}
}
