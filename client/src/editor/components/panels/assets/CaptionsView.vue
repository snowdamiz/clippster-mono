<script setup lang="ts">
import { ref, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useCaptionGeneration } from "../../../composables/useCaptionGeneration";
import { CAPTION_PRESETS, getPresetById } from "../../../constants/caption-constants";
import type { CaptionPreset } from "../../../constants/caption-constants";
import type { CaptionPresetId } from "../../../types/timeline";
import { buildCaptionElement } from "../../../lib/timeline/element-utils";
import type { CaptionLine, CaptionWord } from "../../../types/timeline";
import {
	collectTimelineSpeechElements,
	transcribeTimelineSpeechElements,
} from "../../../lib/transcribe-timeline-audio";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Captions, SearchX, Trash2 } from "lucide-vue-next";
import AssetGrid from "../shared/AssetGrid.vue";
import AssetTile from "../shared/AssetTile.vue";
import PanelSearchBar from "./PanelSearchBar.vue";

const { editor } = useEditor({ subscribe: false });
const { isProcessing, processingStep, error } = useCaptionGeneration();

const selectedPresetId = ref<CaptionPresetId>("karaoke");
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

	// Keep every generated caption on a single track. Auto-placement would
	// otherwise open extra caption lanes whenever word timings slightly overlap.
	const captionTrackId = editor.timeline.addTrack({ type: "caption" });

	for (const elem of allElements) {
		const captionEl = buildCaptionElement({
			lines: elem.lines,
			startTime: elem.start,
			duration: Math.max(0.05, elem.end - elem.start),
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
			placement: { mode: "explicit", trackId: captionTrackId },
		});
	}

	error.value = null;
}

async function handleGenerateSubtitles() {
	if (isProcessing.value) return;

	try {
		isProcessing.value = true;
		error.value = null;

		const activeProject = editor.project.getActive();
		if (!activeProject) {
			error.value = "No active project.";
			return;
		}
		const projectId = activeProject.metadata.id;

		// Reuse transcript already loaded in the editor (Transcript tab / project import)
		const existingWords = editor.transcript.getWords();
		if (existingWords.length > 0) {
			processingStep.value = "Using existing transcript…";
			const captionWords: CaptionWord[] = existingWords.map((w) => ({
				word: w.word,
				start: w.start,
				end: w.end,
				confidence: w.confidence,
			}));
			generateCaptionElements(captionWords);
			return;
		}

		processingStep.value = "Collecting audio from timeline…";
		const speechElements = collectTimelineSpeechElements(editor);
		if (speechElements.length === 0) {
			error.value = "No video or audio tracks found on the timeline.";
			return;
		}

		const allWords = await transcribeTimelineSpeechElements(
			speechElements,
			projectId,
			(step) => {
				processingStep.value = step;
			},
		);

		if (allWords.length === 0) {
			error.value = "Transcription returned no words. Check that the video has speech audio.";
			return;
		}

		processingStep.value = `Found ${allWords.length} words. Generating captions…`;
		generateCaptionElements(allWords);
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
		<PanelSearchBar v-model="searchQuery" placeholder="Search caption styles…" />

		<!-- Scrollable preset grid -->
		<div class="min-h-0 flex-1 overflow-y-auto p-3">
			<EmptyState
				v-if="filteredPresets.length === 0"
				size="sm"
				:icon="SearchX"
				title="No styles found"
				description="Try a different search term."
			/>

			<AssetGrid v-else :min="88">
				<AssetTile
					v-for="preset in filteredPresets"
					:key="preset.id"
					:label="preset.name"
					:selected="selectedPresetId === preset.id"
					aspect="16/10"
					class="active:scale-[0.98]"
					@click="applyPreset(preset)"
				>
					<!-- Preview (user-content rendering of the preset) -->
					<div class="flex size-full items-center justify-center px-2">
						<div class="flex items-center gap-1">
							<span :style="getHighlightStyle(preset)" class="select-none whitespace-nowrap leading-tight">
								{{ preset.maxWordsPerLine === 1 ? "Word" : "Hello" }}
							</span>
							<span v-if="preset.maxWordsPerLine > 1" :style="getPreviewStyle(preset)" class="select-none whitespace-nowrap leading-tight">
								World
							</span>
						</div>
					</div>
				</AssetTile>
			</AssetGrid>
		</div>

		<!-- Pinned bottom bar: Generate / Add / Remove -->
		<div class="shrink-0 space-y-2 border-t border-line-subtle p-3">
			<!-- Error -->
			<p
				v-if="error"
				class="rounded-md border border-[var(--danger-line)] bg-danger-soft px-2.5 py-2 text-xs leading-relaxed text-danger"
			>
				{{ error }}
			</p>

			<!-- Add from existing transcript -->
			<Button
				v-if="hasTranscriptWords && !hasCaptionTrack"
				variant="primary"
				size="sm"
				block
				@click="handleAddFromTranscript"
			>
				<Captions />
				<span class="min-w-0 truncate">Add subtitles</span>
			</Button>

			<!-- Generate section (fresh transcription) — keep visible while generating across tab switches -->
			<template v-if="isProcessing || (!hasTranscriptWords && !hasCaptionTrack)">
				<Button
					variant="primary"
					size="sm"
					block
					:loading="isProcessing"
					@click="handleGenerateSubtitles"
				>
					<Captions v-if="!isProcessing" />
					<span class="min-w-0 truncate">{{ isProcessing ? (processingStep || "Generating…") : "Generate subtitles" }}</span>
				</Button>
				<p v-if="!isProcessing" class="text-2xs leading-relaxed text-fg-subtle">
					Transcribes speech from the timeline audio.
				</p>
			</template>

			<!-- Remove captions -->
			<Button
				v-if="hasCaptionTrack"
				variant="destructive-soft"
				size="sm"
				block
				@click="handleRemoveCaptions"
			>
				<Trash2 />
				Remove all captions
			</Button>
		</div>
	</div>
</template>
