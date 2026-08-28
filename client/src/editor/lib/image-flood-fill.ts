/**
 * 4-connected flood fill / wand select with color tolerance.
 * Fill mutates ImageData in place. Select writes a 0/1 mask.
 */
export function colorDistanceSq(
	r1: number,
	g1: number,
	b1: number,
	a1: number,
	r2: number,
	g2: number,
	b2: number,
	a2: number,
): number {
	const dr = r1 - r2;
	const dg = g1 - g2;
	const db = b1 - b2;
	const da = a1 - a2;
	return dr * dr + dg * dg + db * db + da * da;
}

export function visitMatchingPixels({
	image,
	x,
	y,
	tolerance = 32,
	mask,
	contiguous = true,
	visit,
}: {
	image: ImageData;
	x: number;
	y: number;
	tolerance?: number;
	mask?: Uint8ClampedArray | null;
	contiguous?: boolean;
	visit: (pixelIndex: number) => void;
}): number {
	const { width, height, data } = image;
	const sx = Math.floor(x);
	const sy = Math.floor(y);
	if (sx < 0 || sy < 0 || sx >= width || sy >= height) return 0;

	const start = (sy * width + sx) * 4;
	const tr = data[start];
	const tg = data[start + 1];
	const tb = data[start + 2];
	const ta = data[start + 3];
	const maxDist = Math.max(0, tolerance) ** 2;

	const matches = (i: number) =>
		colorDistanceSq(data[i], data[i + 1], data[i + 2], data[i + 3], tr, tg, tb, ta) <= maxDist;

	if (!contiguous) {
		let count = 0;
		for (let idx = 0; idx < width * height; idx++) {
			if (mask && mask[idx * 4 + 3] === 0) continue;
			if (!matches(idx * 4)) continue;
			visit(idx);
			count++;
		}
		return count;
	}

	const seen = new Uint8Array(width * height);
	const stack: number[] = [sx, sy];
	let filled = 0;

	while (stack.length > 0) {
		const cy = stack.pop()!;
		const cx = stack.pop()!;
		if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
		const idx = cy * width + cx;
		if (seen[idx]) continue;
		if (mask && mask[idx * 4 + 3] === 0) continue;
		const pi = idx * 4;
		if (!matches(pi)) continue;

		let xLeft = cx;
		while (xLeft > 0) {
			const left = cy * width + (xLeft - 1);
			if (seen[left] || (mask && mask[left * 4 + 3] === 0) || !matches(left * 4)) break;
			xLeft--;
		}
		let xRight = cx;
		while (xRight < width - 1) {
			const right = cy * width + (xRight + 1);
			if (seen[right] || (mask && mask[right * 4 + 3] === 0) || !matches(right * 4)) break;
			xRight++;
		}

		for (let px = xLeft; px <= xRight; px++) {
			const pidx = cy * width + px;
			seen[pidx] = 1;
			visit(pidx);
			filled++;
			if (cy > 0) stack.push(px, cy - 1);
			if (cy < height - 1) stack.push(px, cy + 1);
		}
	}

	return filled;
}

export function floodFillImageData({
	image,
	x,
	y,
	fill,
	tolerance = 32,
	mask,
}: {
	image: ImageData;
	x: number;
	y: number;
	fill: { r: number; g: number; b: number; a?: number };
	tolerance?: number;
	mask?: Uint8ClampedArray | null;
}): number {
	const { width, data } = image;
	const sx = Math.floor(x);
	const sy = Math.floor(y);
	if (sx < 0 || sy < 0 || sx >= image.width || sy >= image.height) return 0;

	const start = (sy * width + sx) * 4;
	const fr = fill.r;
	const fg = fill.g;
	const fb = fill.b;
	const fa = fill.a ?? 255;
	if (data[start] === fr && data[start + 1] === fg && data[start + 2] === fb && data[start + 3] === fa) {
		return 0;
	}

	return visitMatchingPixels({
		image,
		x,
		y,
		tolerance,
		mask,
		contiguous: true,
		visit: (idx) => {
			const p = idx * 4;
			data[p] = fr;
			data[p + 1] = fg;
			data[p + 2] = fb;
			data[p + 3] = fa;
		},
	});
}

export function floodSelectMask({
	image,
	x,
	y,
	tolerance = 32,
	mask,
	contiguous = true,
}: {
	image: ImageData;
	x: number;
	y: number;
	tolerance?: number;
	mask?: Uint8ClampedArray | null;
	contiguous?: boolean;
}): { selected: Uint8Array; count: number; minX: number; minY: number; maxX: number; maxY: number } {
	const selected = new Uint8Array(image.width * image.height);
	let minX = image.width;
	let minY = image.height;
	let maxX = -1;
	let maxY = -1;
	const count = visitMatchingPixels({
		image,
		x,
		y,
		tolerance,
		mask,
		contiguous,
		visit: (idx) => {
			selected[idx] = 1;
			const px = idx % image.width;
			const py = Math.floor(idx / image.width);
			minX = Math.min(minX, px);
			minY = Math.min(minY, py);
			maxX = Math.max(maxX, px);
			maxY = Math.max(maxY, py);
		},
	});
	return { selected, count, minX, minY, maxX, maxY };
}
