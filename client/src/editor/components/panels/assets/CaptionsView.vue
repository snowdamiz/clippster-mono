<script setup lang="ts">
import { ref, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { CAPTION_PRESETS, getPresetById } from "../../../constants/caption-constants";
import type { CaptionPreset } from "../../../constants/caption-constants";
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

const hasCaptionTrack = computed(() => {
	return editor.timeline.getTracks().some((t) => t.type === "caption");
});

function applyPreset(preset: CaptionPreset) {
	selectedPresetId.value = preset.id;

	// If captions already exist, update their style
	const tracks = editor.timeline.getTracks();
	for (const track of tracks) {
		if (track.type !== "caption") continue;
		for (const el of track.elements) {
			if (el.type !== "caption") continue;
			editor.timeline.updateCaptionElement({
				trackId: track.id,
				elementId: el.id,
				updates: {
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
		}
	}
}

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

function generateCaptionElements(words: CaptionWord[]) {
	if (words.length === 0) {
		error.value = "No words found in transcript data.";
		return;
	}

	const preset = selectedPreset.value;
	const maxPerLine = preset.maxWordsPerLine;

	// Group words into caption lines
	const lines = groupWordsIntoLines(words, maxPerLine);
	if (lines.length === 0) return;

	// Group lines into caption elements (each element = one screen of text)
	// Each element shows one or two lines at a time
	const linesPerElement = 2;
	const elements: { lines: CaptionLine[]; start: number; end: number }[] = [];

	for (let i = 0; i < lines.length; i += linesPerElement) {
		const group = lines.slice(i, i + linesPerElement);
		elements.push({
			lines: group,
			start: group[0].startTime,
			end: group[group.length - 1].endTime,
		});
	}

	// Remove existing caption tracks first
	const existingTracks = editor.timeline.getTracks();
	for (const track of existingTracks) {
		if (track.type === "caption") {
			editor.timeline.removeTrack({ trackId: track.id });
		}
	}

	// Insert each caption element
	for (const elem of elements) {
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
					headers: { "Content-Type": "multipart/form-data" },
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
			<div class="grid grid-cols-2 gap-2">
				<button
					v-for="preset in CAPTION_PRESETS"
					:key="preset.id"
					class="group relative flex flex-col items-center gap-1.5 rounded-lg border p-3 text-center transition-all hover:border-white/20 hover:bg-white/5"
					:class="
						selectedPresetId === preset.id
							? 'border-sky-500/50 bg-sky-500/10'
							: 'border-white/10 bg-white/[0.02]'
					"
					@click="applyPreset(preset)"
				>
					<!-- Preview text -->
					<div
						class="flex h-10 w-full items-center justify-center rounded-md text-sm font-bold"
						:style="{
							color: preset.color,
							fontFamily: preset.fontFamily,
							fontWeight: preset.fontWeight,
							textShadow:
								preset.stroke
									? `0 0 0 transparent, -1px -1px 0 ${preset.stroke.color}, 1px -1px 0 ${preset.stroke.color}, -1px 1px 0 ${preset.stroke.color}, 1px 1px 0 ${preset.stroke.color}`
									: preset.shadow
										? `${preset.shadow.offsetX}px ${preset.shadow.offsetY}px ${preset.shadow.blur}px ${preset.shadow.color}`
										: 'none',
							backgroundColor: preset.backgroundColor !== 'transparent' ? preset.backgroundColor : undefined,
						}"
					>
						<span
							:style="{
								color: preset.highlightStyle !== 'none' ? preset.highlightColor : preset.color,
							}"
						>Hello</span>
						<span class="ml-1">World</span>
					</div>
					<span class="text-[10px] text-zinc-400 group-hover:text-zinc-300">{{ preset.name }}</span>
				</button>
			</div>
		</div>

		<!-- Divider -->
		<div class="border-t border-white/5" />

		<!-- Generate Subtitles -->
		<div class="space-y-3">
			<h3 class="text-xs font-medium text-zinc-400 uppercase tracking-wider">Generate</h3>

			<button
				class="flex w-full items-center justify-center gap-2 rounded-md border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-sm font-medium text-sky-300 hover:bg-sky-500/20 disabled:opacity-50 transition-colors"
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
