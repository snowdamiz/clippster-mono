/**
 * Composable for image-mode editor functionality.
 * Provides reactive access to the imageMode flag and image-specific
 * export capabilities (PNG/SVG/WebP via canvas.toBlob).
 */
import { computed, inject, type Ref } from "vue";
import { useEditor } from "./useEditor";

export type ImageExportFormat = "png" | "svg" | "webp";

export function useImageMode() {
	const { editor, version } = useEditor();

	const isImageMode = computed(() => {
		void version.value;
		return editor.imageMode;
	});

	// Injected from ImageEditor.vue when opened via "Design Cover" action
	const coverForClipId = inject<Ref<string | null>>("coverForClipId", undefined as any);

	/**
	 * Export the current canvas as an image file.
	 * Returns the blob data for saving.
	 */
	async function exportAsImage(format: ImageExportFormat = "png"): Promise<Blob | null> {
		const canvas = editor.getPreviewCanvas();
		if (!canvas) return null;

		const mimeType = format === "svg" ? "image/svg+xml"
			: format === "webp" ? "image/webp"
			: "image/png";

		// For SVG we'd need a different approach (serialize DOM), but for now
		// canvas export covers PNG and WebP
		if (format === "svg") {
			// SVG export: serialize the canvas content as an SVG wrapper
			const dataUrl = canvas.toDataURL("image/png");
			const width = canvas.width;
			const height = canvas.height;
			const svgString = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
	<image href="${dataUrl}" width="${width}" height="${height}" />
</svg>`;
			return new Blob([svgString], { type: "image/svg+xml" });
		}

		return new Promise<Blob | null>((resolve) => {
			canvas.toBlob(
				(blob) => resolve(blob),
				mimeType,
				format === "webp" ? 0.95 : undefined,
			);
		});
	}

	/**
	 * Export and save the image to disk via Tauri.
	 */
	async function exportAndSave(
		format: ImageExportFormat = "png",
		filename?: string,
	): Promise<string | null> {
		const blob = await exportAsImage(format);
		if (!blob) return null;

		const ext = format === "svg" ? "svg" : format === "webp" ? "webp" : "png";
		const defaultName = filename || `design-${Date.now()}.${ext}`;

		try {
			const { save } = await import("@tauri-apps/plugin-dialog");
			const { writeFile } = await import("@tauri-apps/plugin-fs");

			const filePath = await save({
				defaultPath: defaultName,
				filters: [
					{
						name: `${ext.toUpperCase()} Image`,
						extensions: [ext],
					},
				],
			});

			if (!filePath) return null;

			const arrayBuffer = await blob.arrayBuffer();
			await writeFile(filePath, new Uint8Array(arrayBuffer));
			return filePath;
		} catch (error) {
			console.error("[useImageMode] Failed to save image:", error);
			return null;
		}
	}

	const isCoverMode = computed(() => !!coverForClipId?.value);

	/**
	 * Export the image and set it as a clip's cover image.
	 * Used when the editor was opened via "Design Cover" from a clip.
	 */
	async function exportAndSaveAsCover(format: ImageExportFormat = "png"): Promise<string | null> {
		const clipId = coverForClipId?.value;
		if (!clipId) return null;

		const blob = await exportAsImage(format);
		if (!blob) return null;

		try {
			const { appDataDir } = await import("@tauri-apps/api/path");
			const { writeFile, mkdir, exists } = await import("@tauri-apps/plugin-fs");

			const appData = await appDataDir();
			const coverDir = `${appData}/covers`;
			if (!(await exists(coverDir))) {
				await mkdir(coverDir, { recursive: true });
			}

			const ext = format === "svg" ? "svg" : format === "webp" ? "webp" : "png";
			const filePath = `${coverDir}/cover_${clipId}_${Date.now()}.${ext}`;

			const arrayBuffer = await blob.arrayBuffer();
			await writeFile(filePath, new Uint8Array(arrayBuffer));

			// Update the clip's cover image
			const { updateClip } = await import("@/services/database/clips");
			const { createImageAsset } = await import("@/services/database/image-assets");

			const canvas = editor.getPreviewCanvas();
			const assetId = await createImageAsset({
				name: `Cover for clip ${clipId}`,
				filePath,
				width: canvas?.width || undefined,
				height: canvas?.height || undefined,
				imageType: "cover",
				sourceType: "editor",
				sourceClipId: clipId,
			});

			await updateClip(clipId, {
				cover_image_id: assetId,
				cover_image_path: filePath,
			});

			return filePath;
		} catch (error) {
			console.error("[useImageMode] Failed to save cover image:", error);
			return null;
		}
	}

	return {
		isImageMode,
		isCoverMode,
		coverForClipId: coverForClipId ?? computed(() => null),
		exportAsImage,
		exportAndSave,
		exportAndSaveAsCover,
	};
}
