<script setup lang="ts">
import { ref, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { CAPTION_PRESETS, getPresetById } from "../../../constants/caption-constants";
import type { CaptionPreset, CaptionPresetCategory } from "../../../constants/caption-constants";
import { buildCaptionElement } from "../../../lib/timeline/element-utils";
import type { CaptionLine, CaptionWord, CaptionPresetId, VideoElement, UploadAudioElement } from "../../../types/timeline";
import { Button } from "@/components/ui/button";
import { Loader2, Captions } from "lucide-vue-next";

const { editor } = useEditor();

const selectedPresetId = ref<CaptionPresetId>("karaoke");
const isProcessing = ref(false);
const processingStep = ref("");
const error = ref<string | null>(null);

const selectedPreset = computed(() => getPresetById(selectedPresetId.value));

// ── Category filter for preset grid ──
const CATEGORY_LABELS: Record<CaptionPresetCategory, string> = {
	"single-word": "Single Word",
	classic: "Classic",
	creator: "Creator",
	colorful: "Colorful",
	effects: "Effects",
};
const CATEGORY_ORDER: CaptionPresetCategory[] = ["single-word", "classic", "creator", "colorful", "effects"];
const activeCategory = ref<CaptionPresetCategory | "all">("all");

const groupedPresets = computed(() => {
	if (activeCategory.value !== "all") {
		const cat = activeCategory.value as CaptionPresetCategory;
		return [{ category: cat, label: CATEGORY_LABELS[cat], presets: CAPTION_PRESETS.filter(p => p.category === cat) }];
	}
	return CATEGORY_ORDER.map(cat => ({
		category: cat,
		label: CATEGORY_LABELS[cat],
		presets: CAPTION_PRESETS.filter(p => p.category === cat),
	})).filter(g => g.presets.length > 0);
});

const hasCaptionTrack = computed(() => {
	return editor.timeline.getTracks().some((t) => t.type === "caption");
});

function applyPreset(preset: CaptionPreset) {
	selectedPresetId.value = preset.id;

	const styleUpdates = {
		presetId: preset.id,
		highlightStyle: preset.highlightStyle,
		highlightColor: preset.highlightColor,
		color: preset.color,
		backgroundColor: preset.backgroundColor,
		fontSize: preset.fontSize,
		fontFamily: preset.fontFamily,
		fontWeight: preset.fontWeight,
		fontStyle: preset.fontStyle,
		letterSpacing: preset.letterSpacing,
		lineHeight: preset.lineHeight,
		stroke: preset.stroke,
		shadow: preset.shadow,
		glow: preset.glow,
		gradient: preset.gradient,
		maxWordsPerLine: preset.maxWordsPerLine,
	};

	// If captions already exist, update their style (and re-group lines if maxWordsPerLine changed)
	const tracks = editor.timeline.getTracks();
	for (const track of tracks) {
		if (track.type !== "caption") continue;
		for (const el of track.elements) {
			if (el.type !== "caption") continue;
			const captionEl = el as import("../../../types/timeline").CaptionElement;

			if (captionEl.maxWordsPerLine !== preset.maxWordsPerLine) {
				// Re-group words into new lines with the new maxWordsPerLine
				const allWords = captionEl.lines.flatMap(l => l.words);
				if (allWords.length === 0) {
					editor.timeline.updateCaptionElement({ trackId: track.id, elementId: el.id, updates: styleUpdates });
					continue;
				}
				const newMaxPerLine = preset.maxWordsPerLine;
				const newLines: CaptionLine[] = [];
				for (let i = 0; i < allWords.length; i += newMaxPerLine) {
					const chunk = allWords.slice(i, i + newMaxPerLine);
					newLines.push({
						text: chunk.map(w => w.word).join(" "),
						words: chunk,
						startTime: chunk[0].start,
						endTime: chunk[chunk.length - 1].end,
					});
				}
				editor.timeline.updateCaptionElement({
					trackId: track.id,
					elementId: el.id,
					updates: { ...styleUpdates, lines: newLines } as any,
				});
			} else {
				editor.timeline.updateCaptionElement({ trackId: track.id, elementId: el.id, updates: styleUpdates });
			}
		}
	}
}

// Silence gap threshold in seconds — if the gap between two consecutive words
// exceeds this, we split into separate caption elements so the timeline shows
// a visible gap and no captions appear on screen during silence.
const SILENCE_GAP_THRESHOLD = 0.6;

function groupWordsIntoLines(
	words: CaptionWord[],
	maxPerLine: number,
): CaptionLine[] {
	const lines: CaptionLine[] = [];
	for (let i = 0; i < words.length; i += maxPerLine) {
		const chunk = words.slice(i, i + maxPerLine);
		if (chunk.length === 0) continue;
		lines.push({
			text: chunk.map((w) => w.word).join(" "),
			words: chunk,
			startTime: chunk[0].start,
			endTime: chunk[chunk.length - 1].end,
		});
	}
	return lines;
}

// Split a flat word array into "speech segments" separated by silence gaps.
// Each segment is a contiguous run of words with no inter-word gap exceeding
// the threshold. This ensures the timeline has gaps where nobody is talking.
function splitWordsBySilence(words: CaptionWord[]): CaptionWord[][] {
	if (words.length === 0) return [];
	const segments: CaptionWord[][] = [];
	let current: CaptionWord[] = [words[0]];

	for (let i = 1; i < words.length; i++) {
		const gap = words[i].start - words[i - 1].end;
		if (gap > SILENCE_GAP_THRESHOLD) {
			segments.push(current);
			current = [];
		}
		current.push(words[i]);
	}
	if (current.length > 0) segments.push(current);
	return segments;
}

function generateCaptionElements(words: CaptionWord[]) {
	if (words.length === 0) {
		error.value = "No words found in transcript data.";
		return;
	}

	const preset = selectedPreset.value;
	const maxPerLine = preset.maxWordsPerLine;

	// 1. Split words into speech segments separated by silence gaps
	const speechSegments = splitWordsBySilence(words);

	// 2. For each speech segment, group words → lines → elements
	// IMPORTANT: Each element contains ONE line only, so captions only show when speech is active
	const allElements: { lines: CaptionLine[]; start: number; end: number }[] = [];

	for (const segWords of speechSegments) {
		const lines = groupWordsIntoLines(segWords, maxPerLine);
		if (lines.length === 0) continue;

		// Create one element per line (not multiple lines per element)
		for (const line of lines) {
			allElements.push({
				lines: [line],
				start: line.startTime,
				end: line.endTime,
			});
		}
	}

	// 3. Remove existing caption tracks first
	const existingTracks = editor.timeline.getTracks();
	for (const track of existingTracks) {
		if (track.type === "caption") {
			editor.timeline.removeTrack({ trackId: track.id });
		}
	}

	// 4. Insert each caption element — gaps between elements will be visible
	//    on the timeline and no captions will render during those gaps.
	for (const elem of allElements) {
		const captionEl = buildCaptionElement({
			lines: elem.lines,
			startTime: elem.start,
			duration: elem.end - elem.start,
			raw: {
				presetId: preset.id,
				highlightStyle: preset.highlightStyle,
				highlightColor: preset.highlightColor,
				color: preset.color,
				backgroundColor: preset.backgroundColor,
				fontSize: preset.fontSize,
				fontFamily: preset.fontFamily,
				fontWeight: preset.fontWeight,
				fontStyle: preset.fontStyle,
				letterSpacing: preset.letterSpacing,
				lineHeight: preset.lineHeight,
				stroke: preset.stroke,
				shadow: preset.shadow,
				glow: preset.glow,
				gradient: preset.gradient,
				maxWordsPerLine: preset.maxWordsPerLine,
			},
		});

		editor.timeline.insertElement({
			element: captionEl,
			placement: { mode: "auto" },
		});
	}

	error.value = null;
}

async function handleGenerateSubtitles() {
	try {
		isProcessing.value = true;
		error.value = null;
		processingStep.value = "Collecting audio from timeline...";

		const activeProject = editor.project.getActive();
		if (!activeProject) {
			error.value = "No active project.";
			return;
		}
		const projectId = activeProject.metadata.id;

		const tracks = editor.timeline.getTracks();
		const mediaAssets = editor.media.getAssets();

		console.log("[CaptionsView] Tracks:", tracks.map(t => ({ type: t.type, elements: t.elements.length })));
		console.log("[CaptionsView] Media assets:", mediaAssets.map(a => ({ id: a.id, name: a.name, type: a.type, filePath: a.filePath, url: a.url?.substring(0, 60) })));

		// Collect elements that contain speech:
		// - Video elements (always have speech)
		// - Upload audio elements (user-extracted audio, likely speech)
		// - NOT library audio (music/sfx)
		const speechElements: Array<{
			filePath: string;
			timelineStart: number;
			trimStart: number;
			duration: number;
		}> = [];

		for (const track of tracks) {
			if (track.type === "video") {
				for (const el of track.elements) {
					const videoEl = el as VideoElement;
					const asset = mediaAssets.find((a) => a.id === videoEl.mediaId);
					console.log("[CaptionsView] Video element:", videoEl.mediaId, "asset:", asset?.name, "filePath:", asset?.filePath);
					if (asset?.filePath) {
						speechElements.push({
							filePath: asset.filePath,
							timelineStart: videoEl.startTime,
							trimStart: videoEl.trimStart,
							duration: videoEl.duration,
						});
					} else if (asset?.url) {
						// filePath may not be set — try to get it from the video editor source
						speechElements.push({
							filePath: asset.url,
							timelineStart: videoEl.startTime,
							trimStart: videoEl.trimStart,
							duration: videoEl.duration,
						});
						console.log("[CaptionsView] Using asset.url as fallback:", asset.url.substring(0, 80));
					}
				}
			} else if (track.type === "audio") {
				for (const el of track.elements) {
					if (el.type === "audio" && (el as UploadAudioElement).sourceType === "upload") {
						const uploadEl = el as UploadAudioElement;
						const asset = mediaAssets.find((a) => a.id === uploadEl.mediaId);
						if (asset?.filePath) {
							speechElements.push({
								filePath: asset.filePath,
								timelineStart: uploadEl.startTime,
								trimStart: uploadEl.trimStart,
								duration: uploadEl.duration,
							});
						}
					}
				}
			}
		}

		if (speechElements.length === 0) {
			error.value = "No video or audio tracks found on the timeline.";
			return;
		}

		console.log("[CaptionsView] Found", speechElements.length, "speech elements to transcribe");

		const { parseTranscriptToWords } = await import("@/utils/timelineUtils");
		const api = (await import("@/services/api")).default;

		let allWords: CaptionWord[] = [];

		for (let i = 0; i < speechElements.length; i++) {
			const elem = speechElements[i];
			processingStep.value = `Transcribing ${i + 1}/${speechElements.length}...`;

			try {
				let file: File;
				if (elem.filePath.startsWith("blob:") || elem.filePath.startsWith("http")) {
					const resp = await fetch(elem.filePath);
					const blob = await resp.blob();
					file = new File([blob], "audio.mp4", { type: blob.type || "video/mp4" });
				} else {
					// Filesystem path — read via Tauri video server (same as tauri-storage-adapter)
					const { invoke } = await import("@tauri-apps/api/core");
					let port: number;
					try { port = await invoke<number>("get_video_server_port"); } catch { port = 8642; }
					const serverUrl = `http://localhost:${port}/video/${btoa(elem.filePath)}`;
					const resp = await fetch(serverUrl);
					if (!resp.ok) throw new Error(`Video server returned ${resp.status} for ${elem.filePath}`);
					const blob = await resp.blob();
					file = new File([blob], "audio.mp4", { type: blob.type || "video/mp4" });
				}
				console.log("[CaptionsView] Read file:", elem.filePath.substring(0, 80), "size:", file.size);

				const formData = new FormData();
				formData.append("audio", file);
				formData.append("project_id", projectId);
				formData.append("duration", (elem.trimStart + elem.duration).toString());

				const response = await api.post("/clips/transcribe", formData, {
					headers: { "Content-Type": undefined },
					timeout: 120000,
				});

				if (response.data.success && response.data.transcript) {
					const rawJson = JSON.stringify(response.data.transcript);
					const words = parseTranscriptToWords(rawJson);

					// Whisper returns 0-based times relative to file start.
					// Filter to the trimmed region and offset to timeline position.
					const trimEnd = elem.trimStart + elem.duration;
					for (const w of words) {
						if (w.start >= elem.trimStart && w.start < trimEnd) {
							allWords.push({
								word: w.word,
								start: w.start - elem.trimStart + elem.timelineStart,
								end: w.end - elem.trimStart + elem.timelineStart,
								confidence: w.confidence,
							});
						}
					}
				}
			} catch (err: any) {
				console.warn("[CaptionsView] Failed to transcribe element:", err?.message || err);
			}
		}

		if (allWords.length === 0) {
			error.value = "Transcription returned no words. Check that the video has speech audio.";
			return;
		}

		// Sort by timeline time and deduplicate
		allWords.sort((a, b) => a.start - b.start);
		allWords = allWords.filter((w, i, arr) => {
			if (i === 0) return true;
			return !(Math.abs(w.start - arr[i - 1].start) < 0.01 && w.word === arr[i - 1].word);
		});

		console.log("[CaptionsView] Total words:", allWords.length);
		console.log("[CaptionsView] First 5:", allWords.slice(0, 5).map(w => `"${w.word}" ${w.start.toFixed(2)}-${w.end.toFixed(2)}`));
		console.log("[CaptionsView] Last 5:", allWords.slice(-5).map(w => `"${w.word}" ${w.start.toFixed(2)}-${w.end.toFixed(2)}`));

		processingStep.value = `Found ${allWords.length} words. Generating captions...`;
		generateCaptionElements(allWords);
		processingStep.value = "";
	} catch (err) {
		console.error("[CaptionsView] Failed to generate subtitles:", err);
		error.value = err instanceof Error ? err.message : "An unexpected error occurred";
	} finally {
		isProcessing.value = false;
		processingStep.value = "";
	}
}

function handleRemoveCaptions() {
	const tracks = editor.timeline.getTracks();
	for (const track of tracks) {
		if (track.type === "caption") {
			editor.timeline.removeTrack({ trackId: track.id });
		}
	}
}
</script>

<template>
	<div class="flex h-full flex-col gap-4 overflow-y-auto p-4">
		<!-- Preset Grid -->
		<div class="space-y-2">
			<h3 class="text-xs font-medium text-zinc-400 uppercase tracking-wider">Style Presets</h3>

			<!-- Category filter pills -->
			<div class="flex flex-wrap gap-1">
				<button
					class="rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors"
					:class="activeCategory === 'all' ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-white/5 text-zinc-400 border border-white/10 hover:text-zinc-200'"
					@click="activeCategory = 'all'"
				>All</button>
				<button
					v-for="cat in CATEGORY_ORDER"
					:key="cat"
					class="rounded-full px-2.5 py-1 text-[10px] font-medium transition-colors"
					:class="activeCategory === cat ? 'bg-primary/20 text-primary border border-primary/40' : 'bg-white/5 text-zinc-400 border border-white/10 hover:text-zinc-200'"
					@click="activeCategory = cat"
				>{{ CATEGORY_LABELS[cat] }}</button>
			</div>

			<!-- Grouped preset sections -->
			<div v-for="group in groupedPresets" :key="group.category" class="space-y-1.5">
				<span class="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{{ group.label }}</span>
				<div class="grid grid-cols-2 gap-2">
					<button
						v-for="preset in group.presets"
						:key="preset.id"
						class="group relative flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all hover:border-white/20 hover:bg-white/5"
						:class="selectedPresetId === preset.id ? 'border-primary/50 bg-primary/10' : 'border-white/10 bg-white/[0.02]'"
						@click="applyPreset(preset)"
					>
						<div
							class="flex h-10 w-full items-center justify-center rounded-md font-bold"
							:class="preset.maxWordsPerLine === 1 ? 'text-base' : 'text-sm'"
							:style="{
								color: preset.color === 'transparent' ? (preset.stroke?.color || '#FFFFFF') : preset.color,
								fontFamily: preset.fontFamily,
								fontWeight: preset.fontWeight,
								fontStyle: preset.fontStyle,
								letterSpacing: preset.letterSpacing + 'px',
								textShadow: preset.stroke
									? `0 0 0 transparent, -1px -1px 0 ${preset.stroke.color}, 1px -1px 0 ${preset.stroke.color}, -1px 1px 0 ${preset.stroke.color}, 1px 1px 0 ${preset.stroke.color}`
									: preset.shadow
										? `${preset.shadow.offsetX}px ${preset.shadow.offsetY}px ${preset.shadow.blur}px ${preset.shadow.color}`
										: preset.glow
											? `0 0 ${preset.glow.intensity}px ${preset.glow.color}`
											: 'none',
								backgroundColor: preset.backgroundColor !== 'transparent' ? preset.backgroundColor : undefined,
							}"
						>
							<span :style="{ color: preset.highlightStyle !== 'none' ? preset.highlightColor : (preset.color === 'transparent' ? (preset.stroke?.color || '#FFFFFF') : preset.color) }">{{ preset.maxWordsPerLine === 1 ? 'Word' : 'Hello' }}</span>
							<span v-if="preset.maxWordsPerLine > 1" class="ml-1">World</span>
						</div>
						<span class="text-[10px] text-zinc-400 group-hover:text-zinc-300 truncate w-full">{{ preset.name }}</span>
					</button>
				</div>
			</div>
		</div>

		<!-- Divider -->
		<div class="border-t border-white/10" />

		<!-- Generate Subtitles -->
		<div class="space-y-3">
			<h3 class="text-xs font-medium text-zinc-400 uppercase tracking-wider">Generate</h3>

			<button
				class="flex w-full items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary hover:bg-primary/20 disabled:opacity-50 transition-colors"
				:disabled="isProcessing"
				@click="handleGenerateSubtitles"
			>
				<Loader2 v-if="isProcessing" class="size-4 animate-spin shrink-0" />
				<Captions v-else class="size-4 shrink-0" />
				<span class="truncate">{{ isProcessing ? processingStep : 'Generate Subtitles' }}</span>
			</button>
			<p class="text-[10px] text-zinc-500 leading-relaxed">
				Transcribes speech from video and audio tracks on the timeline. Music tracks are excluded.
			</p>
		</div>

		<!-- Error -->
		<div
			v-if="error"
			class="rounded-md border border-red-500/20 bg-red-500/10 p-3"
		>
			<p class="text-red-400 text-xs leading-relaxed">{{ error }}</p>
		</div>

		<!-- Remove captions -->
		<div v-if="hasCaptionTrack" class="mt-auto pt-2">
			<Button
				class="w-full"
				variant="destructive"
				size="sm"
				@click="handleRemoveCaptions"
			>
				Remove all captions
			</Button>
		</div>
	</div>
</template>
