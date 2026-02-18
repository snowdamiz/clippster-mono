import { ref, computed } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import { BUILT_IN_FONTS, type FontCategory } from "../constants/text-constants";

export interface LoadedFont {
	family: string;
	label: string;
	category: FontCategory;
	filePath?: string; // absolute path for custom fonts
	loaded: boolean;
}

const customFonts = ref<LoadedFont[]>([]);
const loadedFontFamilies = new Set<string>();
const fontLoadPromises = new Map<string, Promise<void>>();

/**
 * Load a font into the browser via FontFace API so canvas can use it.
 * For bundled fonts, reads from Tauri resource path.
 * For custom fonts, reads from the user-provided file path.
 */
async function loadFontFace(family: string, filePath?: string): Promise<void> {
	if (loadedFontFamilies.has(family)) return;

	// Check if there's already a loading promise for this font
	const existing = fontLoadPromises.get(family);
	if (existing) return existing;

	const promise = (async () => {
		try {
			if (filePath) {
				// Custom font: read file bytes via Tauri and load directly from ArrayBuffer
				// (avoids CSP font-src blob: restriction)
				const bytes = await invoke<number[]>("read_font_file", { path: filePath });
				const uint8 = new Uint8Array(bytes);
				const fontFace = new FontFace(family, uint8.buffer as ArrayBuffer);
				await fontFace.load();
				document.fonts.add(fontFace);
				loadedFontFamilies.add(family);
				return;
			}

			// Built-in font: try to use system font first, then bundled
			const systemFonts = [
				"Arial", "Helvetica", "Georgia", "Times New Roman",
				"Courier New", "Verdana", "Impact", "Comic Sans MS",
			];
			if (systemFonts.includes(family)) {
				loadedFontFamilies.add(family);
				return;
			}

			// For bundled fonts (Roboto, Montserrat, etc.), load from Tauri resource
			const fontFileName = getFontFileName(family);
			if (!fontFileName) {
				loadedFontFamilies.add(family);
				return;
			}

			try {
				const bytes = await invoke<number[]>("read_bundled_font", { fontName: fontFileName });
				const uint8 = new Uint8Array(bytes);
				const fontFace = new FontFace(family, uint8.buffer as ArrayBuffer);
				await fontFace.load();
				document.fonts.add(fontFace);
				loadedFontFamilies.add(family);
			} catch {
				// Font not bundled, assume system font
				loadedFontFamilies.add(family);
			}
		} catch (err) {
			console.warn(`Failed to load font "${family}":`, err);
			loadedFontFamilies.add(family);
		}
	})();

	fontLoadPromises.set(family, promise);
	await promise;
	fontLoadPromises.delete(family);
}

function getFontFileName(family: string): string | null {
	const map: Record<string, string> = {
		"Inter": "Inter-Regular.ttf",
		"Roboto": "Roboto-Regular.ttf",
		"Roboto Condensed": "Roboto_Condensed-Bold.ttf",
		"Montserrat": "Montserrat-Regular.ttf",
		"Bebas Neue": "BebasNeue-Regular.ttf",
	};
	return map[family] ?? null;
}

export function useFontManager() {
	const allFonts = computed<LoadedFont[]>(() => {
		const builtIn: LoadedFont[] = BUILT_IN_FONTS.map((f) => ({
			family: f.family,
			label: f.label,
			category: f.category,
			loaded: loadedFontFamilies.has(f.family),
		}));
		return [...builtIn, ...customFonts.value];
	});

	async function ensureFontLoaded(family: string, filePath?: string): Promise<void> {
		await loadFontFace(family, filePath);
	}

	async function uploadCustomFont(): Promise<LoadedFont | null> {
		try {
			const selected = await open({
				multiple: false,
				filters: [
					{
						name: "Font Files",
						extensions: ["ttf", "otf", "woff", "woff2"],
					},
				],
			});

			if (!selected) return null;

			const filePath = typeof selected === "string" ? selected : (selected as { path: string }).path;
			if (!filePath) return null;

			// Extract family name from file name
			const fileName = filePath.split(/[/\\]/).pop() || "Custom Font";
			const familyName = fileName
				.replace(/\.(ttf|otf|woff2?)$/i, "")
				.replace(/[-_]/g, " ")
				.replace(/\b\w/g, (c: string) => c.toUpperCase());

			// Copy font to app data directory for persistence
			const destPath = await invoke<string>("copy_font_to_app_data", {
				sourcePath: filePath,
				fileName,
			});

			// Load the font
			await loadFontFace(familyName, destPath);

			const font: LoadedFont = {
				family: familyName,
				label: familyName,
				category: "custom",
				filePath: destPath,
				loaded: true,
			};

			// Avoid duplicates
			const existingIdx = customFonts.value.findIndex((f) => f.family === familyName);
			if (existingIdx >= 0) {
				customFonts.value[existingIdx] = font;
			} else {
				customFonts.value.push(font);
			}

			return font;
		} catch (err) {
			console.error("Failed to upload custom font:", err);
			return null;
		}
	}

	function getCustomFonts(): LoadedFont[] {
		return customFonts.value;
	}

	function isFontLoaded(family: string): boolean {
		return loadedFontFamilies.has(family);
	}

	return {
		allFonts,
		customFonts,
		ensureFontLoaded,
		uploadCustomFont,
		getCustomFonts,
		isFontLoaded,
	};
}
