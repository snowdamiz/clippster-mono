export type ImageStillFormat = "png" | "jpg" | "webp";

export function mimeForImageStill(format: ImageStillFormat): string {
	if (format === "jpg") return "image/jpeg";
	if (format === "webp") return "image/webp";
	return "image/png";
}
