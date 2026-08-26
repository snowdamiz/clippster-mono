/**
 * Client-side image normalize to exact canvas dimensions (letterbox or cover-crop).
 * Used for AI thumbnail Accept and library ingest when the model returns non-exact sizes.
 */

export type ResizeFit = "contain" | "cover";

export async function resizeImageBlobToCanvas(
	source: Blob | string,
	width: number,
	height: number,
	opts: { fit?: ResizeFit; mime?: string; quality?: number; background?: string } = {},
): Promise<Blob> {
	const fit = opts.fit ?? "cover";
	const mime = opts.mime ?? "image/png";
	const quality = opts.quality ?? 0.92;
	const background = opts.background ?? "#000000";

	const bitmap = await loadImageBitmap(source);
	try {
		const canvas = document.createElement("canvas");
		canvas.width = width;
		canvas.height = height;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Canvas unavailable for image resize");

		ctx.fillStyle = background;
		ctx.fillRect(0, 0, width, height);

		const scale =
			fit === "contain"
				? Math.min(width / bitmap.width, height / bitmap.height)
				: Math.max(width / bitmap.width, height / bitmap.height);
		const drawW = bitmap.width * scale;
		const drawH = bitmap.height * scale;
		const dx = (width - drawW) / 2;
		const dy = (height - drawH) / 2;
		ctx.drawImage(bitmap, dx, dy, drawW, drawH);

		return await new Promise<Blob>((resolve, reject) => {
			canvas.toBlob(
				(b) => (b ? resolve(b) : reject(new Error("Failed to encode resized image"))),
				mime,
				mime === "image/png" ? undefined : quality,
			);
		});
	} finally {
		bitmap.close();
	}
}

async function loadImageBitmap(source: Blob | string): Promise<ImageBitmap> {
	if (typeof source === "string") {
		const res = await fetch(source);
		const blob = await res.blob();
		return createImageBitmap(blob);
	}
	return createImageBitmap(source);
}

/** Build a feed-stamp (~200px wide) data URL for postage-stamp preview. */
export async function buildFeedPreviewDataUrl(
	source: Blob | string,
	feedWidth = 200,
): Promise<string> {
	const bitmap = await loadImageBitmap(source);
	try {
		const ratio = bitmap.height / Math.max(1, bitmap.width);
		const w = feedWidth;
		const h = Math.max(1, Math.round(feedWidth * ratio));
		const canvas = document.createElement("canvas");
		canvas.width = w;
		canvas.height = h;
		const ctx = canvas.getContext("2d");
		if (!ctx) throw new Error("Canvas unavailable for feed preview");
		ctx.drawImage(bitmap, 0, 0, w, h);
		return canvas.toDataURL("image/jpeg", 0.85);
	} finally {
		bitmap.close();
	}
}
