/**
 * Magic-wand: binary mask → closed canvas-space path rings (even-odd).
 */
import type { PixelSelection } from "../types/image-document";
import {
	imagePixelToCanvasPoint,
	pointsBounds,
	type ImageDrawLayout,
} from "./image-layer-mapping";

export type WandPoint = { x: number; y: number };

const EDGE_PAIRS: Array<Array<[number, number]>> = [
	[],
	[[2, 1]],
	[[3, 2]],
	[[3, 1]],
	[[0, 1]],
	[[0, 2]],
	[[0, 3], [1, 2]],
	[[0, 3]],
	[[0, 3]],
	[[0, 1], [3, 2]],
	[[0, 2]],
	[[0, 1]],
	[[3, 1]],
	[[3, 2]],
	[[1, 2]],
	[],
];

function edgePoint(i: number, j: number, edge: number): WandPoint {
	switch (edge) {
		case 0:
			return { x: i + 0.5, y: j };
		case 1:
			return { x: i + 1, y: j + 0.5 };
		case 2:
			return { x: i + 0.5, y: j + 1 };
		default:
			return { x: i, y: j + 0.5 };
	}
}

function pointKey(p: WandPoint): string {
	return `${p.x.toFixed(3)},${p.y.toFixed(3)}`;
}

function parseKey(k: string): WandPoint {
	const [x, y] = k.split(",").map(Number);
	return { x, y };
}

export function maskToContours(mask: Uint8Array, width: number, height: number): WandPoint[][] {
	const get = (x: number, y: number) =>
		x >= 0 && y >= 0 && x < width && y < height && mask[y * width + x] ? 1 : 0;

	const adj = new Map<string, WandPoint[]>();
	const add = (a: WandPoint, b: WandPoint) => {
		const ka = pointKey(a);
		const kb = pointKey(b);
		const la = adj.get(ka);
		const lb = adj.get(kb);
		if (la) la.push(b);
		else adj.set(ka, [b]);
		if (lb) lb.push(a);
		else adj.set(kb, [a]);
	};

	for (let j = -1; j < height; j++) {
		for (let i = -1; i < width; i++) {
			const idx = (get(i, j) << 3) | (get(i + 1, j) << 2) | (get(i, j + 1) << 1) | get(i + 1, j + 1);
			for (const [e0, e1] of EDGE_PAIRS[idx]) {
				add(edgePoint(i, j, e0), edgePoint(i, j, e1));
			}
		}
	}

	const used = new Set<string>();
	const rings: WandPoint[][] = [];

	for (const startKey of adj.keys()) {
		if (used.has(startKey)) continue;
		const ring: WandPoint[] = [];
		let prev = "";
		let cur = startKey;
		for (let n = 0; n <= adj.size + 2; n++) {
			if (used.has(cur) && ring.length > 0) break;
			used.add(cur);
			ring.push(parseKey(cur));
			const neighbors = adj.get(cur) ?? [];
			const next = neighbors.find((p) => pointKey(p) !== prev && !used.has(pointKey(p)))
				?? neighbors.find((p) => pointKey(p) !== prev);
			if (!next) break;
			prev = cur;
			cur = pointKey(next);
			if (cur === startKey) break;
		}
		if (ring.length >= 3) rings.push(ring);
	}

	return rings;
}

function perpDist(p: WandPoint, a: WandPoint, b: WandPoint): number {
	const dx = b.x - a.x;
	const dy = b.y - a.y;
	const len = Math.hypot(dx, dy);
	if (len < 1e-9) return Math.hypot(p.x - a.x, p.y - a.y);
	return Math.abs(dy * p.x - dx * p.y + b.x * a.y - b.y * a.x) / len;
}

export function simplifyPolyline(points: WandPoint[], epsilon: number): WandPoint[] {
	if (points.length < 3) return points;
	let maxD = 0;
	let idx = 0;
	const a = points[0];
	const b = points[points.length - 1];
	for (let i = 1; i < points.length - 1; i++) {
		const d = perpDist(points[i], a, b);
		if (d > maxD) {
			maxD = d;
			idx = i;
		}
	}
	if (maxD > epsilon) {
		const left = simplifyPolyline(points.slice(0, idx + 1), epsilon);
		const right = simplifyPolyline(points.slice(idx), epsilon);
		return left.slice(0, -1).concat(right);
	}
	return [a, b];
}

export function selectionFromWandMask(
	layout: ImageDrawLayout,
	mask: Uint8Array,
	nativeW: number,
	nativeH: number,
): PixelSelection | null {
	const contours = maskToContours(mask, nativeW, nativeH);
	const rings = contours
		.map((ring) => {
			const closed = ring.length > 1 && pointKey(ring[0]) !== pointKey(ring[ring.length - 1])
				? [...ring, ring[0]]
				: ring;
			return simplifyPolyline(closed, 0.75).map((p) => {
				const c = imagePixelToCanvasPoint(layout, p.x, p.y);
				return {
					x: Math.min(1, Math.max(0, c.x / layout.canvasW)),
					y: Math.min(1, Math.max(0, c.y / layout.canvasH)),
				};
			});
		})
		.filter((ring) => ring.length >= 3)
		.sort((a, b) => b.length - a.length);
	if (rings.length === 0) return null;
	const box = pointsBounds(rings.flat());
	if (!box) return null;
	return {
		type: "path",
		points: rings[0],
		rings,
		...box,
	};
}
