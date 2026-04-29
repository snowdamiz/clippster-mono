<script setup lang="ts">
import { utf8ToBase64Url } from "@/utils/encoding";
import { ref, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { CAPTION_PRESETS, getPresetById } from "../../../constants/caption-constants";
import type { CaptionPreset } from "../../../constants/caption-constants";
import type { CaptionPresetId } from "../../../types/timeline";
import { buildCaptionElement } from "../../../lib/timeline/element-utils";
import type { CaptionLine, CaptionWord, VideoElement, UploadAudioElement } from "../../../types/timeline";
import { Button } from "@/components/ui/button";
import { Loader2, Captions } from "lucide-vue-next";
import PanelSearchBar from "./PanelSearchBar.vue";

const { editor } = useEditor();

const selectedPresetId = ref<CaptionPresetId>("karaoke");
const isProcessing = ref(false);
const processingStep = ref("");
const error = ref<string | null>(null);
const searchQuery = ref("");

const selectedPreset = computed(() => getPresetById(selectedPresetId.value));

const filteredPresets = computed(() => {
	const q = searchQuery.value.trim().toLowerCase();
	if (!q) return CAPTION_PRESETS;
	return CAPTION_PRESETS.filter((p) => p.name.toLowerCase().includes(q));
});

const hasCaptionTrack = computed(() => {
	return editor.timeline.getTracks().some((t) => t.type === "caption");
});

const hasTranscriptWords = computed(() => {
	return editor.transcript.getWords().length > 0;
});

function getPreviewStyle(preset: CaptionPreset): Record<string, string> {
	const style: Record<string, string> = {
		color: preset.color === "transparent" ? (preset.stroke?.color || "#FFFFFF") : preset.color,
		fontFamily: preset.fontFamily,
		fontWeight: String(preset.fontWeight),
		fontStyle: preset.fontStyle || "normal",
		letterSpacing: preset.letterSpacing + "px",
		fontSize: "12px",
		lineHeight: "1.2",
	};

	if (preset.backgroundColor && preset.backgroundColor !== "transparent") {
		style.backgroundColor = preset.backgroundColor;
		style.padding = "1px 5px";
		style.borderRadius = "3px";
	}

	const shadows: string[] = [];
	if (preset.stroke) {
		shadows.push(
			`-1px -1px 0 ${preset.stroke.color}`,
			`1px -1px 0 ${preset.stroke.color}`,
			`-1px 1px 0 ${preset.stroke.color}`,
			`1px 1px 0 ${preset.stroke.color}`,
		);
	}
	if (preset.shadow) {
		shadows.push(`${preset.shadow.offsetX}px ${preset.shadow.offsetY}px ${preset.shadow.blur}px ${preset.shadow.color}`);
	}
	if (preset.glow) {
		shadows.push(`0 0 ${preset.glow.intensity}px ${preset.glow.color}`);
	}
	if (shadows.length) style.textShadow = shadows.join(", ");

	if (preset.gradient?.enabled && preset.gradient.colors) {
		style.background = `linear-gradient(${preset.gradient.angle || 135}deg, ${preset.gradient.colors[0]}, ${preset.gradient.colors[1]})`;
		style.webkitBackgroundClip = "text";
		style.webkitTextFillColor = "transparent";
		style.backgroundClip = "text";
		delete style.color;
	}

	return style;
}

function getHighlightStyle(preset: CaptionPreset): Record<string, string> {
	if (preset.highlightStyle === "none") return getPreviewStyle(preset);
	return { ...getPreviewStyle(preset), color: preset.highlightColor };
}

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

	const tracks = editor.timeline.getTracks();
	for (const track of tracks) {
		if (track.type !== "caption") continue;
		for (const el of track.elements) {
			if (el.type !== "caption") continue;
			const captionEl = el as import("../../../types/timeline").CaptionElement;

			if (captionEl.maxWordsPerLine !== preset.maxWordsPerLine) {
				const allWords = captionEl.lines.flatMap((l) => l.words);
				if (allWords.length === 0) {
					editor.timeline.updateCaptionElement({ trackId: track.id, elementId: el.id, updates: styleUpdates });
					continue;
				}
				const newLines: CaptionLine[] = [];
				for (let i = 0; i < allWords.length; i += preset.maxWordsPerLine) {
					const chunk = allWords.slice(i, i + preset.maxWordsPerLine);
					newLines.push({
						text: chunk.map((w) => w.word).join(" "),
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

const SILENCE_GAP_THRESHOLD = 0.6;

function groupWordsIntoLines(words: CaptionWord[], maxPerLine: number): CaptionLine[] {
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
	const speechSegments = splitWordsBySilence(words);
	const allElements: { lines: CaptionLine[]; start: number; end: number }[] = [];

	for (const segWords of speechSegments) {
		const lines = groupWordsIntoLines(segWords, preset.maxWordsPerLine);
		for (const line of lines) {
			allElements.push({ lines: [line], start: line.startTime, end: line.endTime });
		}
	}

	const existingTracks = editor.timeline.getTracks();
	for (const track of existingTracks) {
		if (track.type === "caption") editor.timeline.removeTrack({ trackId: track.id });
	}

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
		editor.timeline.insertElement({ element: captionEl, placement: { mode: "auto" } });
	}

	error.value = null;
}

async function handleGenerateSubtitles() {
	try {
		isProcessing.value = true;
		error.value = null;
		processingStep.value = "Collecting audio from timeline...";

		const activeProject = editor.project.getActive();
		if (!activeProject) { error.value = "No active project."; return; }
		const projectId = activeProject.metadata.id;

		const tracks = editor.timeline.getTracks();
		const mediaAssets = editor.media.getAssets();

		const speechElements: Array<{ filePath: string; timelineStart: number; trimStart: number; duration: number }> = [];

		for (const track of tracks) {
			if (track.type === "video") {
				for (const el of track.elements) {
					const videoEl = el as VideoElement;
					const asset = mediaAssets.find((a) => a.id === videoEl.mediaId);
					if (asset?.filePath) {
						speechElements.push({ filePath: asset.filePath, timelineStart: videoEl.startTime, trimStart: videoEl.trimStart, duration: videoEl.duration });
					} else if (asset?.url) {
						speechElements.push({ filePath: asset.url, timelineStart: videoEl.startTime, trimStart: videoEl.trimStart, duration: videoEl.duration });
					}
				}
			} else if (track.type === "audio") {
				for (const el of track.elements) {
					if (el.type === "audio" && (el as UploadAudioElement).sourceType === "upload") {
						const uploadEl = el as UploadAudioElement;
						const asset = mediaAssets.find((a) => a.id === uploadEl.mediaId);
						if (asset?.filePath) {
							speechElements.push({ filePath: asset.filePath, timelineStart: uploadEl.startTime, trimStart: uploadEl.trimStart, duration: uploadEl.duration });
						}
					}
				}
			}
		}

		if (speechElements.length === 0) { error.value = "No video or audio tracks found on the timeline."; return; }

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
					const { invoke } = await import("@tauri-apps/api/core");
					let port: number;
					try { port = await invoke<number>("get_video_server_port"); } catch { port = 8642; }
					const serverUrl = `http://localhost:${port}/video/${utf8ToBase64Url(elem.filePath)}`;
					const resp = await fetch(serverUrl);
					if (!resp.ok) throw new Error(`Video server returned ${resp.status} for ${elem.filePath}`);
					const blob = await resp.blob();
					file = new File([blob], "audio.mp4", { type: blob.type || "video/mp4" });
				}

				const formData = new FormData();
				formData.append("audio", file);
				formData.append("project_id", projectId);
				formData.append("duration", (elem.trimStart + elem.duration).toString());

				const response = await api.post("/clips/transcribe", formData, { headers: { "Content-Type": undefined }, timeout: 120000 });

				if (response.data.success && response.data.transcript) {
					const rawJson = JSON.stringify(response.data.transcript);
					const words = parseTranscriptToWords(rawJson);
					const trimEnd = elem.trimStart + elem.duration;
					for (const w of words) {
						if (w.start >= elem.trimStart && w.start < trimEnd) {
							allWords.push({ word: w.word, start: w.start - elem.trimStart + elem.timelineStart, end: w.end - elem.trimStart + elem.timelineStart, confidence: w.confidence });
						}
					}
				}
			} catch (err: any) {
				console.warn("[CaptionsView] Failed to transcribe element:", err?.message || err);
			}
		}

		if (allWords.length === 0) { error.value = "Transcription returned no words. Check that the video has speech audio."; return; }

		allWords.sort((a, b) => a.start - b.start);
		allWords = allWords.filter((w, i, arr) => {
			if (i === 0) return true;
			return !(Math.abs(w.start - arr[i - 1].start) < 0.01 && w.word === arr[i - 1].word);
		});

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

function handleAddFromTranscript() {
	const words = editor.transcript.getWords();
	const captionWords: CaptionWord[] = words.map((w) => ({
		word: w.word,
		start: w.start,
		end: w.end,
		confidence: w.confidence,
	}));
	generateCaptionElements(captionWords);
}

function handleRemoveCaptions() {
	const tracks = editor.timeline.getTracks();
	for (const track of tracks) {
		if (track.type === "caption") editor.timeline.removeTrack({ trackId: track.id });
	}
}
</script>

<template>
	<div class="flex h-full flex-col overflow-hidden">
		<PanelSearchBar v-model="searchQuery" placeholder="Search presets..." />

		<!-- Scrollable preset grid -->
		<div class="min-h-0 flex-1 overflow-y-auto">
			<div class="p-2">
				<div class="grid grid-cols-2 gap-1.5">
					<button
						v-for="preset in filteredPresets"
						:key="preset.id"
						class="group relative overflow-hidden rounded-lg border transition-all active:scale-[0.97]"
						:class="selectedPresetId === preset.id
							? 'border-white/20 bg-white/[0.06]'
							: 'border-white/[0.06] bg-zinc-950 hover:border-white/15'"
						@click="applyPreset(preset)"
					>
						<!-- Preview area -->
						<div class="flex aspect-[4/3] w-full items-center justify-center bg-zinc-950 px-2">
							<div class="flex items-center gap-1">
								<span :style="getHighlightStyle(preset)" class="select-none whitespace-nowrap leading-tight">
									{{ preset.maxWordsPerLine === 1 ? "Word" : "Hello" }}
								</span>
								<span v-if="preset.maxWordsPerLine > 1" :style="getPreviewStyle(preset)" class="select-none whitespace-nowrap leading-tight">
									World
								</span>
							</div>
						</div>
						<!-- Label overlay -->
						<div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-2 pb-1.5 pt-4">
							<p class="truncate text-[10px] font-medium leading-tight group-hover:text-white"
								:class="selectedPresetId === preset.id ? 'text-white' : 'text-zinc-200'">
								{{ preset.name }}
							</p>
						</div>
					</button>
				</div>
			</div>
		</div>

		<!-- Pinned bottom bar: Generate / Add / Remove -->
		<div class="shrink-0 border-t border-white/10">
			<!-- Error -->
			<div v-if="error" class="mx-3 mt-3 rounded-md border border-red-500/20 bg-red-500/10 p-3">
				<p class="text-xs leading-relaxed text-red-400">{{ error }}</p>
			</div>

			<!-- Add from existing transcript -->
			<div v-if="hasTranscriptWords && !hasCaptionTrack" class="p-3">
				<button
					class="flex w-full items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20"
					@click="handleAddFromTranscript"
				>
					<Captions class="size-4 shrink-0" />
					<span class="truncate">Add Subtitles</span>
				</button>
			</div>

			<!-- Generate section (fresh transcription) -->
			<div v-if="!hasTranscriptWords && !hasCaptionTrack" class="p-3">
				<button
					class="flex w-full items-center justify-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2.5 text-sm font-medium text-primary transition-colors hover:bg-primary/20 disabled:opacity-50"
					:disabled="isProcessing"
					@click="handleGenerateSubtitles"
				>
					<Loader2 v-if="isProcessing" class="size-4 shrink-0 animate-spin" />
					<Captions v-else class="size-4 shrink-0" />
					<span class="truncate">{{ isProcessing ? processingStep : "Generate Subtitles" }}</span>
				</button>
				<p class="mt-1.5 text-[10px] leading-relaxed text-zinc-500">
					Transcribes speech from video and audio tracks.
				</p>
			</div>

			<!-- Remove captions -->
			<div v-if="hasCaptionTrack" class="p-3">
				<Button class="w-full" variant="destructive" size="sm" @click="handleRemoveCaptions">
					Remove all captions
				</Button>
			</div>
		</div>
	</div>
</template>
