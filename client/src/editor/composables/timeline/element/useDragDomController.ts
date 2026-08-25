/**
 * Imperative DOM controller for the drag visual.
 *
 * Why imperative? During a drag we update positions ~60 times per second.
 * If those updates flowed through Vue reactive `:style` bindings, every
 * `TimelineElement` reading the drag state would re-render each frame —
 * tens of components × 60 fps = thousands of updates a second.
 *
 * Instead, the drag controller:
 * - Walks the DOM once at drag start to find the affected elements via
 *   `[data-element-id]` selectors.
 * - On each rAF tick, sets two CSS custom properties (`--drag-x`, `--drag-y`)
 *   and toggles `data-drag-active="1"` on each node.
 * - A CSS rule (in Timeline.vue's global stylesheet) applies
 *   `transform: translate3d(var(--drag-x), var(--drag-y), 0)` to those
 *   elements. The browser composites the transform on the GPU.
 *
 * On drag end the controller clears the CSS vars and the data attribute,
 * and Vue's reactivity takes over rendering the element at its new
 * committed `startTime`.
 */

export interface DragDomController {
	/**
	 * @param root Search only under this node (timeline scroll viewport).
	 *        Avoids matching unrelated `[data-element-id]` elsewhere in the app.
	 */
	begin: (elementIds: Iterable<string>, root: ParentNode | null) => void;
	update: (offsetX: number, offsetY: number) => void;
	end: () => void;
}

function escapeAttrForCssSelector(value: string): string {
	if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
		return CSS.escape(value);
	}
	// Minimal fallback — timeline ids are UUIDs; still escape quotes/backslashes.
	return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

/** Finds timeline clip roots for the given element ids under `root`. */
function collectNodes(scope: ParentNode, elementIds: Iterable<string>): HTMLElement[] {
	const nodes: HTMLElement[] = [];
	for (const id of elementIds) {
		const escaped = escapeAttrForCssSelector(id);
		// Single selector: the positioned `.timeline-element` wrapper carries both attrs.
		const node = scope.querySelector<HTMLElement>(`.timeline-element[data-element-id="${escaped}"]`);
		if (node) nodes.push(node);
	}
	return nodes;
}

export function createDragDomController(): DragDomController {
	let activeNodes: HTMLElement[] = [];

	function begin(elementIds: Iterable<string>, root: ParentNode | null) {
		end();
		const scope = root ?? document;
		activeNodes = collectNodes(scope, elementIds);
		for (const node of activeNodes) {
			node.dataset.dragActive = "1";
			node.style.setProperty("--drag-x", "0px");
			node.style.setProperty("--drag-y", "0px");
		}
	}

	function update(offsetX: number, offsetY: number) {
		const x = `${offsetX}px`;
		const y = `${offsetY}px`;
		for (const node of activeNodes) {
			node.style.setProperty("--drag-x", x);
			node.style.setProperty("--drag-y", y);
		}
	}

	function end() {
		for (const node of activeNodes) {
			delete node.dataset.dragActive;
			node.style.removeProperty("--drag-x");
			node.style.removeProperty("--drag-y");
		}
		activeNodes = [];
	}

	return { begin, update, end };
}
