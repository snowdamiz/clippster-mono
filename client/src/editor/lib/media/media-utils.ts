import type { MediaAsset, MediaType } from "../../types/assets";

export const SUPPORTS_AUDIO: readonly MediaType[] = ["audio", "video"];

export function mediaSupportsAudio({
	media,
}: {
	media: MediaAsset | null | undefined;
}): boolean {
	if (!media) return false;
	return SUPPORTS_AUDIO.includes(media.type);
}

export const getMediaTypeFromFile = ({
	file,
}: {
	file: File;
}): MediaType | null => {
	const { type, name } = file;
	const extension = name.toLowerCase().split('.').pop() || '';

	// Check MIME type first
	if (type.startsWith("image/")) {
		return "image";
	}
	if (type.startsWith("video/")) {
		return "video";
	}
	if (type.startsWith("audio/")) {
		return "audio";
	}

	// Fallback to extension-based detection for files with generic MIME types
	const videoExtensions = ['mp4', 'webm', 'ogg', 'mov', 'avi', 'mkv', 'flv', 'wmv', 'm4v'];
	const audioExtensions = ['mp3', 'wav', 'ogg', 'aac', 'm4a', 'flac', 'wma'];
	const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'];

	if (videoExtensions.includes(extension)) {
		console.log(`[MediaUtils] Detected video by extension: ${name} (MIME: ${type})`);
		return "video";
	}
	if (audioExtensions.includes(extension)) {
		console.log(`[MediaUtils] Detected audio by extension: ${name} (MIME: ${type})`);
		return "audio";
	}
	if (imageExtensions.includes(extension)) {
		console.log(`[MediaUtils] Detected image by extension: ${name} (MIME: ${type})`);
		return "image";
	}

	console.warn(`[MediaUtils] Could not determine media type for: ${name} (MIME: ${type})`);
	return null;
};
