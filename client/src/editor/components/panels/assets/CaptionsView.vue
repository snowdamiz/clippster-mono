<script setup lang="ts">
import { ref, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { CAPTION_PRESETS, getPresetById } from "../../../constants/caption-constants";
import type { CaptionPreset } from "../../../constants/caption-constants";
import { buildCaptionElement } from "../../../lib/timeline/element-utils";
import type { CaptionLine, CaptionWord, CaptionPresetId } from "../../../types/timeline";
import { Button } from "@/components/ui/button";
import { Loader2, Captions, Sparkles, Upload } from "lucide-vue-next";

const { editor } = useEditor();

const selectedPresetId = ref<CaptionPresetId>("karaoke");
const isProcessing = ref(false);
const processingStep = ref("");
const error = ref<string | null>(null);
const transcriptSource = ref<"project" | "upload" | null>(null);
const importedWords = ref<CaptionWord[]>([]);

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

async function handleLoadFromProject() {
	try {
		isProcessing.value = true;
		error.value = null;
		processingStep.value = "Loading transcript from project...";
		transcriptSource.value = "project";

		// Get the active project metadata to find the source project ID
		const activeProject = editor.project.getActive();
		if (!activeProject) {
			error.value = "No active project. Open a project first.";
			return;
		}

		// Try to load transcript data from the project's clip source
		const projectId = activeProject.metadata.id;

		// Import database functions dynamically
		const { getTranscriptByProjectId } = await import(
			"@/services/database/transcripts"
		);
		const { getVideoEditorSourcesByProjectId } = await import(
			"@/services/database/video-editor-projects"
		);

		// Get sources to find the original clip and its parent project
		const sources = await getVideoEditorSourcesByProjectId(projectId);
		const firstSource = sources[0];

		if (!firstSource) {
			error.value = "No video sources found in this project.";
			return;
		}

		// Find the source project ID through the clip chain
		let sourceProjectId: string | null = null;

		if (firstSource.source_type === "clip" && firstSource.source_id) {
			// Source is a clip — get the clip's parent project
			const { getClip } = await import("@/services/database");
			const clip = await getClip(firstSource.source_id);
			if (clip?.project_id) {
				sourceProjectId = clip.project_id;
			}
		} else if (firstSource.source_type === "raw_video" && firstSource.source_id) {
			// Source is a raw video — get its parent project
			const { getRawVideo } = await import("@/services/database");
			const rawVideo = await getRawVideo(firstSource.source_id);
			if (rawVideo?.project_id) {
				sourceProjectId = rawVideo.project_id;
			}
		}

		if (!sourceProjectId) {
			error.value =
				"No source project linked. Use 'Transcribe' to generate captions for uploaded videos.";
			return;
		}

		processingStep.value = "Extracting word timings...";

		const transcript = await getTranscriptByProjectId(sourceProjectId);
		if (!transcript || !transcript.raw_json) {
			error.value =
				"No transcript found for the source project. Transcribe the video first in the Project Workspace.";
			return;
		}

		// Parse words from transcript
		const { parseTranscriptToWords } = await import(
			"@/utils/timelineUtils"
		);
		const words = parseTranscriptToWords(transcript.raw_json);

		if (words.length === 0) {
			error.value = "Transcript has no word-level timing data.";
			return;
		}

		// Convert to CaptionWord format — adjust times relative to clip start
		// The clip was extracted starting at some offset in the VOD
		const clipOffset = firstSource.trim_start || 0;

		const captionWords: CaptionWord[] = words
			.filter((w) => {
				// Only include words that fall within the clip's time range
				const adjustedStart = w.start - clipOffset;
				const clipDuration = firstSource.end_time - firstSource.start_time;
				return adjustedStart >= 0 && adjustedStart < clipDuration;
			})
			.map((w) => ({
				word: w.word,
				start: w.start - clipOffset,
				end: w.end - clipOffset,
				confidence: w.confidence,
			}));

		importedWords.value = captionWords;
		processingStep.value = `Found ${captionWords.length} words. Generating captions...`;

		generateCaptionElements(captionWords);
		processingStep.value = "";
	} catch (err) {
		console.error("[CaptionsView] Failed to load transcript:", err);
		error.value =
			err instanceof Error ? err.message : "An unexpected error occurred";
	} finally {
		isProcessing.value = false;
		processingStep.value = "";
	}
}

async function handleTranscribeUpload() {
	error.value =
		"Upload transcription costs $0.30/minute. This will be connected to the transcription API. For now, use clips from projects that already have transcripts.";
	transcriptSource.value = "upload";
}

function handleRemoveCaptions() {
	const tracks = editor.timeline.getTracks();
	for (const track of tracks) {
		if (track.type === "caption") {
			editor.timeline.removeTrack({ trackId: track.id });
		}
	}
	importedWords.value = [];
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

		<!-- Generate Captions -->
		<div class="space-y-3">
			<h3 class="text-xs font-medium text-zinc-400 uppercase tracking-wider">Generate Captions</h3>

			<Button
				class="w-full justify-start gap-2"
				variant="outline"
				:disabled="isProcessing"
				@click="handleLoadFromProject"
			>
				<Sparkles class="size-4 shrink-0" />
				<span class="truncate">{{ isProcessing && transcriptSource === 'project' ? processingStep : 'From project transcript' }}</span>
				<Loader2 v-if="isProcessing && transcriptSource === 'project'" class="ml-auto size-4 animate-spin shrink-0" />
			</Button>

			<Button
				class="w-full justify-start gap-2"
				variant="outline"
				:disabled="isProcessing"
				@click="handleTranscribeUpload"
			>
				<Upload class="size-4 shrink-0" />
				<span class="truncate">Transcribe video ($0.30/min)</span>
			</Button>
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
