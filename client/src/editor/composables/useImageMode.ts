/**
 * Composable for image-mode editor functionality.
 * Provides reactive access to the imageMode flag and image-specific
 * export capabilities (PNG/JPG/WebP via canvas.toBlob) with Image Library ingest.
 */
import { computed, inject, type Ref } from "vue";
import { useEditor } from "./useEditor";
import { flushAndSerializeActiveImageProject } from "../bridge/image-project-document";
import { mimeForImageStill } from "../lib/image-export-format";
import { renderActiveProjectToImageBlob } from "../lib/image-export";

export type ImageExportFormat = "png" | "jpg" | "webp";

export function useImageMode() {
	const { editor, version } = useEditor();

	const isImageMode = computed(() => {
		void version.value;
		return editor.imageMode;
	});

	// Injected from ImageEditor.vue when opened via "Design Cover" action
	const coverForClipId = inject<Ref<string | null>>("coverForClipId", undefined as any);
	const backendProjectId = inject<Ref<number | null> | { value: number | null }>(
		"imageEditorBackendProjectId",
		computed(() => null) as any,
	);

	function mimeForFormat(format: ImageExportFormat): string {
		return mimeForImageStill(format);
	}

	/**
	 * Export the current composition at full canvas resolution.
	 * Uses the same scene renderer as preview/video WYSIWYG — not the display snapshot.
	 */
	async function exportAsImage(format: ImageExportFormat = "png"): Promise<Blob | null> {
		return renderActiveProjectToImageBlob(format);
	}

	async function writeBlobToAppImages(
		blob: Blob,
		filename: string,
	): Promise<{ filePath: string; fileSize: number }> {
		const { invoke } = await import("@tauri-apps/api/core");
		const { writeFile, mkdir, exists } = await import("@tauri-apps/plugin-fs");

		// Use Clippster storage root (%LOCALAPPDATA%\Clippster), not Tauri's Roaming appDataDir.
		const appData = await invoke<string>("get_app_data_dir");
		const imagesDir = `${appData}/image-library`;
		if (!(await exists(imagesDir))) {
			await mkdir(imagesDir, { recursive: true });
		}

		const filePath = `${imagesDir}/${filename}`;
		const arrayBuffer = await blob.arrayBuffer();
		const bytes = new Uint8Array(arrayBuffer);
		await writeFile(filePath, bytes);
		return { filePath, fileSize: bytes.byteLength };
	}

	/**
	 * Export still image to disk and/or Image library based on destination.
	 * - library: Image gallery only
	 * - library_and_disk: gallery + local Save dialog
	 * - disk: local Save dialog only
	 */
	async function exportAndSave(
		format: ImageExportFormat = "png",
		filename?: string,
		opts: {
			destination?: "library" | "library_and_disk" | "disk";
			alsoSaveToDisk?: boolean;
			preferDiskDialog?: boolean;
			imageType?: string;
		} = {},
	): Promise<string | null> {
		const blob = await exportAsImage(format);
		if (!blob) throw new Error("Failed to render image");

		const ext = format === "jpg" ? "jpg" : format;
		const project = editor.project.getActiveOrNull();
		const baseName = (filename || project?.metadata.name || `design-${Date.now()}`).replace(
			/\.(png|jpg|jpeg|webp)$/i,
			"",
		);
		const safeBase = baseName.replace(/[^\w\-]+/g, "_") || "design";
		const downloadName = `${safeBase}.${ext}`;

		const destination =
			opts.destination ??
			(opts.alsoSaveToDisk === false ? "library" : "library_and_disk");
		const saveToLibrary = destination === "library" || destination === "library_and_disk";
		const saveToDisk = destination === "disk" || destination === "library_and_disk";

		let savedPath: string | null = null;

		if (saveToDisk) {
			savedPath = await saveBlobLocally(blob, downloadName, format);
			// null means user cancelled the dialog — don't treat as failure
			if (savedPath === null && (opts.preferDiskDialog || destination !== "library")) {
				return null;
			}
		}

		if (!saveToLibrary) {
			return savedPath;
		}

		const libraryFilename = `${safeBase}_${Date.now()}.${ext}`;
		try {
			const { filePath, fileSize } = await writeBlobToAppImages(blob, libraryFilename);
			const serialized = await flushAndSerializeActiveImageProject();
			const { createImageAsset } = await import("@/services/database/image-assets");
			const backendId =
				backendProjectId && "value" in backendProjectId ? backendProjectId.value : null;

			await createImageAsset({
				name: baseName,
				filePath,
				width: project?.settings.canvasSize.width,
				height: project?.settings.canvasSize.height,
				fileSize,
				mimeType: mimeForFormat(format),
				imageType: (opts.imageType as any) || "custom",
				sourceType: "editor",
				sourceProjectId: backendId != null ? String(backendId) : project?.metadata.id,
				canvasWidth: project?.settings.canvasSize.width,
				canvasHeight: project?.settings.canvasSize.height,
				exportFormat: format as any,
				editorProjectJson: serialized
					? JSON.stringify({
							...serialized,
							backendProjectId: backendId,
						})
					: undefined,
			});

			return savedPath ?? filePath;
		} catch (error) {
			console.warn("[useImageMode] Image library save failed:", error);
			if (savedPath) return savedPath;
			throw error instanceof Error ? error : new Error("Failed to save image");
		}
	}

	async function saveBlobLocally(
		blob: Blob,
		downloadName: string,
		format: ImageExportFormat,
	): Promise<string | null> {
		const ext = format === "jpg" ? "jpg" : format;
		const isTauri =
			typeof window !== "undefined" &&
			("__TAURI__" in window || "__TAURI_INTERNALS__" in window);

		if (isTauri) {
			const { save } = await import("@tauri-apps/plugin-dialog");
			const { writeFile } = await import("@tauri-apps/plugin-fs");
			const diskPath = await save({
				defaultPath: downloadName,
				filters: [
					{ name: `${ext.toUpperCase()} Image`, extensions: [ext] },
					{ name: "All Images", extensions: ["png", "jpg", "jpeg", "webp"] },
				],
			});
			if (!diskPath) return null;
			await writeFile(diskPath, new Uint8Array(await blob.arrayBuffer()));
			return diskPath;
		}

		const url = URL.createObjectURL(blob);
		try {
			const a = document.createElement("a");
			a.href = url;
			a.download = downloadName;
			a.rel = "noopener";
			document.body.appendChild(a);
			a.click();
			a.remove();
			return downloadName;
		} finally {
			URL.revokeObjectURL(url);
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
			const { invoke } = await import("@tauri-apps/api/core");
			const { writeFile, mkdir, exists } = await import("@tauri-apps/plugin-fs");

			const appData = await invoke<string>("get_app_data_dir");
			const coverDir = `${appData}/covers`;
			if (!(await exists(coverDir))) {
				await mkdir(coverDir, { recursive: true });
			}

			const ext = format === "jpg" ? "jpg" : format;
			const filePath = `${coverDir}/cover_${clipId}_${Date.now()}.${ext}`;

			const arrayBuffer = await blob.arrayBuffer();
			await writeFile(filePath, new Uint8Array(arrayBuffer));

			const { updateClip } = await import("@/services/database/clips");
			const { createImageAsset } = await import("@/services/database/image-assets");
			const serialized = await flushAndSerializeActiveImageProject();

			const project = editor.project.getActiveOrNull();
			const backendId =
				backendProjectId && "value" in backendProjectId ? backendProjectId.value : null;
			const assetId = await createImageAsset({
				name: `Cover for clip ${clipId}`,
				filePath,
				width: project?.settings.canvasSize.width,
				height: project?.settings.canvasSize.height,
				mimeType: mimeForFormat(format),
				imageType: "cover",
				sourceType: "editor",
				sourceClipId: clipId,
				sourceProjectId: backendId != null ? String(backendId) : project?.metadata.id,
				canvasWidth: project?.settings.canvasSize.width,
				canvasHeight: project?.settings.canvasSize.height,
				exportFormat: format === "jpg" ? ("jpg" as any) : (format as any),
				editorProjectJson: serialized
					? JSON.stringify({
							...serialized,
							backendProjectId: backendId,
							coverForClipId: clipId,
						})
					: undefined,
			});

			await updateClip(clipId, {
				cover_image_id: assetId,
				cover_image_path: filePath,
			});

			if (backendId != null && project) {
				await editor.project.updateSettings({
					settings: {
						sourceClipId: clipId,
						coverForClipId: clipId,
					},
				});
			}

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
