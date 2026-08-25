/**
 * Placeholder hooks for static layer / effect-stack precomposition caches.
 * Invalidated alongside preview scene cache when timeline or media changes.
 */

const caches = new Set<{ clear: () => void }>();

export function registerPrecompCache(cache: { clear: () => void }): void {
	caches.add(cache);
}

export function unregisterPrecompCache(cache: { clear: () => void }): void {
	caches.delete(cache);
}

export function invalidateAllLayerPrecomps(): void {
	for (const c of caches) {
		try {
			c.clear();
		} catch {
			/* ignore */
		}
	}
}
