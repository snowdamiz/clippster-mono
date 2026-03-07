<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { useEditor } from "../../../composables/useEditor";
import type { VideoElement } from "../../../types/timeline";
import { DeleteTranscriptWordsCommand, UpdateTranscriptWordCommand, ReorderTranscriptWordsCommand, SyncTimelineToTranscriptCommand } from "../../../lib/commands/transcript";
import ConfirmDialog from "../../dialogs/ConfirmDialog.vue";
import {
	FileText,
	Loader2,
	ChevronUp,
	ChevronDown,
	X as XIcon,
	Scissors,
	Strikethrough,
	Trash2,
	SplitSquareHorizontal,
	GripVertical,
	Check,
	Undo2,
	RefreshCw,
} from "lucide-vue-next";
import PanelSearchBar from "./PanelSearchBar.vue";

// ── Types ──
interface TranscriptWord {
	word: string;
	start: number;
	end: number;
	confidence?: number;
}

interface Paragraph {
	id: string;
	words: TranscriptWord[];
	startTime: number;
	endTime: number;
}

// ── Editor integration ──
const { editor, version } = useEditor();

// ── State ──
const words = ref<TranscriptWord[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const isGenerating = ref(false);
const generatingStep = ref("");

// Subscribe to transcript manager changes
let unsubscribe: (() => void) | null = null;

// Current playback time from editor
const currentTime = computed(() => {
	void version.value;
	return editor.playback.getCurrentTime();
});

// Word tracking
const currentWordIndex = ref(-1);
const wordElements = ref<Map<number, HTMLElement>>(new Map());
const transcriptContent = ref<HTMLElement>();
const preventAutoscroll = ref(false);
let autoscrollTimeout: ReturnType<typeof setTimeout> | null = null;

// Editing modes
const editingWordIndex = ref(-1);
const editingWordText = ref("");

// Selection state
const isSelecting = ref(false);
const selectionAnchorIndex = ref(-1);
const selectionStartIndex = ref(-1);
const selectionEndIndex = ref(-1);

// Strikethrough mode
const strikethroughMode = ref(false);
const strikethroughIndices = ref<Set<number>>(new Set());

// Search
const searchQuery = ref("");
const debouncedSearchQuery = ref("");
const currentMatchIndex = ref(0);
let searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

// Drag reorder state
const draggingParagraphId = ref<string | null>(null);
const dragOverParagraphId = ref<string | null>(null);

// Confirmation dialog state
const showDeleteConfirm = ref(false);
const pendingDeleteAction = ref<(() => void) | null>(null);

// Timeline highlight state
const hoveredParagraphId = ref<string | null>(null);

// ── Computed ──

// Group words into paragraphs (split on gaps > 2s)
const paragraphs = computed((): Paragraph[] => {
	if (words.value.length === 0) return [];
	const PARAGRAPH_GAP = 2.0;
	const result: Paragraph[] = [];
	let current: TranscriptWord[] = [words.value[0]];
	let pIdx = 0;

	for (let i = 1; i < words.value.length; i++) {
		const gap = words.value[i].start - words.value[i - 1].end;
		if (gap > PARAGRAPH_GAP) {
			result.push({
				id: `p-${pIdx}`,
				words: current,
				startTime: current[0].start,
				endTime: current[current.length - 1].end,
			});
			pIdx++;
			current = [];
		}
		current.push(words.value[i]);
	}
	if (current.length > 0) {
		result.push({
			id: `p-${pIdx}`,
			words: current,
			startTime: current[0].start,
			endTime: current[current.length - 1].end,
		});
	}
	return result;
});

// Map word global index for each paragraph
const paragraphWordOffsets = computed(() => {
	const offsets: number[] = [];
	let offset = 0;
	for (const p of paragraphs.value) {
		offsets.push(offset);
		offset += p.words.length;
	}
	return offsets;
});

// Search matches
const matchedPhraseIndices = computed((): number[] => {
	if (!debouncedSearchQuery.value.trim() || words.value.length === 0) return [];
	const query = debouncedSearchQuery.value.toLowerCase().trim();
	const queryWords = query.split(/\s+/).filter((w) => w.length > 0);
	if (queryWords.length === 0) return [];

	const matched: number[] = [];
	for (let i = 0; i <= words.value.length - queryWords.length; i++) {
		let isMatch = true;
		for (let j = 0; j < queryWords.length; j++) {
			const wordText = words.value[i + j].word.toLowerCase().replace(/[^\w\s]/g, "");
			const queryWord = queryWords[j].replace(/[^\w\s]/g, "");
			if (!wordText.includes(queryWord)) {
				isMatch = false;
				break;
			}
		}
		if (isMatch) {
			for (let j = 0; j < queryWords.length; j++) matched.push(i + j);
		}
	}
	return matched;
});

const matchOccurrences = computed((): number[] => {
	if (!debouncedSearchQuery.value.trim() || words.value.length === 0) return [];
	const query = debouncedSearchQuery.value.toLowerCase().trim();
	const queryWords = query.split(/\s+/).filter((w) => w.length > 0);
	if (queryWords.length === 0) return [];

	const occurrences: number[] = [];
	for (let i = 0; i <= words.value.length - queryWords.length; i++) {
		let isMatch = true;
		for (let j = 0; j < queryWords.length; j++) {
			const wordText = words.value[i + j].word.toLowerCase().replace(/[^\w\s]/g, "");
			const queryWord = queryWords[j].replace(/[^\w\s]/g, "");
			if (!wordText.includes(queryWord)) {
				isMatch = false;
				break;
			}
		}
		if (isMatch) occurrences.push(i);
	}
	return occurrences;
});

const activeMatchWordIndex = computed((): number => {
	if (matchOccurrences.value.length === 0) return -1;
	return matchOccurrences.value[currentMatchIndex.value] ?? -1;
});

const strikethroughCount = computed(() => strikethroughIndices.value.size);

// Selection time range
const selectionTimeRange = computed(() => {
	if (selectionStartIndex.value === -1 || selectionEndIndex.value === -1) return null;
	const startWord = words.value[selectionStartIndex.value];
	const endWord = words.value[selectionEndIndex.value];
	if (!startWord || !endWord) return null;
	return { startTime: startWord.start, endTime: endWord.end };
});

const selectionText = computed(() => {
	if (selectionStartIndex.value === -1 || selectionEndIndex.value === -1) return "";
	return words.value
		.slice(selectionStartIndex.value, selectionEndIndex.value + 1)
		.map((w) => w.word)
		.join(" ");
});

// ── Methods ──

function formatTime(seconds: number): string {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function setWordRef(el: any, index: number) {
	if (el && el instanceof HTMLElement) {
		wordElements.value.set(index, el);
	} else {
		wordElements.value.delete(index);
	}
}

// Load transcript from editor's timeline video elements
async function loadTranscript() {
	loading.value = true;
	error.value = null;
	words.value = [];

	try {
		const activeProject = editor.project.getActive();
		if (!activeProject) {
			error.value = "No active project.";
			return;
		}

		// Use the original Clippster project ID for transcript lookup.
		// The transcript is stored against the source project (the one with the VOD),
		// not the video editor project ID.
		const transcriptProjectId = activeProject.settings?.sourceProjectId ?? activeProject.metadata.id;

		// Try loading from the project's existing transcript (SQLite)
		const { useTranscriptData } = await import("@/composables/useTranscriptData");
		const { loadTranscriptData, transcriptData } = useTranscriptData(ref(transcriptProjectId));
		await loadTranscriptData(transcriptProjectId);

		if (transcriptData.value && transcriptData.value.words.length > 0) {
			const loadedWords = transcriptData.value.words.map((w: any) => ({
				word: w.word || w.text || w.content || String(w),
				start: w.start || w.begin || w.startTime || 0,
				end: w.end || w.finish || w.endTime || 0,
				confidence: w.confidence,
			}));
			// Set words in transcript manager
			editor.transcript.setWords(loadedWords);
			words.value = loadedWords;
			return;
		}

		// Fallback: check if caption elements exist on timeline (they have word-level data)
		const tracks = editor.timeline.getTracks();
		const captionWords: TranscriptWord[] = [];
		for (const track of tracks) {
			if (track.type !== "caption") continue;
			for (const el of track.elements) {
				if (el.type !== "caption") continue;
				const captionEl = el as any;
				if (captionEl.lines) {
					for (const line of captionEl.lines) {
						if (line.words) {
							for (const w of line.words) {
								captionWords.push({
									word: w.word,
									start: w.start,
									end: w.end,
									confidence: w.confidence,
								});
							}
						}
					}
				}
			}
		}

		if (captionWords.length > 0) {
			captionWords.sort((a, b) => a.start - b.start);
			// Set words in transcript manager
			editor.transcript.setWords(captionWords);
			words.value = captionWords;
			return;
		}

		error.value = "No transcript available. Click 'Generate Transcript' to create one.";
	} catch (err) {
		console.error("[TranscriptView] Failed to load transcript:", err);
		error.value = "Failed to load transcript data.";
	} finally {
		loading.value = false;
	}
}

// Save transcript to database for persistence
async function saveTranscriptToDatabase(transcriptWords: TranscriptWord[]) {
	try {
		const activeProject = editor.project.getActive();
		if (!activeProject) return;

		const sourceProjectId = activeProject.settings?.sourceProjectId ?? activeProject.metadata.id;

		// Import database functions
		const { getRawVideosByProjectId } = await import("@/services/database/raw-videos");
		const { createTranscript, getTranscriptByRawVideoId } = await import("@/services/database/transcripts");

		// Get the raw video for this project
		const rawVideos = await getRawVideosByProjectId(sourceProjectId);
		if (rawVideos.length === 0) {
			console.warn("[TranscriptView] No raw video found for project, cannot save transcript");
			return;
		}

		const rawVideo = rawVideos[0];

		// Check if transcript already exists
		const existingTranscript = await getTranscriptByRawVideoId(rawVideo.id);
		if (existingTranscript) {
			console.log("[TranscriptView] Transcript already exists, skipping save");
			return;
		}

		// Build Whisper-compatible JSON format
		const whisperJson = {
			segments: [{
				id: 0,
				start: transcriptWords[0]?.start ?? 0,
				end: transcriptWords[transcriptWords.length - 1]?.end ?? 0,
				text: transcriptWords.map(w => w.word).join(" "),
				words: transcriptWords.map((w, idx) => ({
					word: w.word,
					start: w.start,
					end: w.end,
					confidence: w.confidence ?? 1.0,
				})),
			}],
		};

		const rawJson = JSON.stringify(whisperJson);
		const text = transcriptWords.map(w => w.word).join(" ");
		const duration = transcriptWords[transcriptWords.length - 1]?.end ?? 0;

		// Save to database
		await createTranscript(rawVideo.id, rawJson, text, "en", duration);
		console.log("[TranscriptView] Transcript saved to database");
	} catch (err) {
		console.error("[TranscriptView] Failed to save transcript to database:", err);
		// Non-fatal - transcript is still in memory
	}
}

// Generate transcript from video audio (same as CaptionsView but stores words only)
async function handleGenerateTranscript() {
	try {
		isGenerating.value = true;
		error.value = null;
		generatingStep.value = "Collecting audio from timeline...";

		const activeProject = editor.project.getActive();
		if (!activeProject) {
			error.value = "No active project.";
			return;
		}
		const projectId = activeProject.metadata.id;

		const tracks = editor.timeline.getTracks();
		const mediaAssets = editor.media.getAssets();

		// Collect video elements that contain speech
		const speechElements: Array<{
			filePath: string;
			timelineStart: number;
			trimStart: number;
			duration: number;
		}> = [];

		for (const track of tracks) {
			if (track.type === "video") {
				for (const el of track.elements) {
					const videoEl = el as any;
					const asset = mediaAssets.find((a) => a.id === videoEl.mediaId);
					if (asset?.filePath) {
						speechElements.push({
							filePath: asset.filePath,
							timelineStart: videoEl.startTime,
							trimStart: videoEl.trimStart,
							duration: videoEl.duration,
						});
					} else if (asset?.url) {
						speechElements.push({
							filePath: asset.url,
							timelineStart: videoEl.startTime,
							trimStart: videoEl.trimStart,
							duration: videoEl.duration,
						});
					}
				}
			}
		}

		if (speechElements.length === 0) {
			error.value = "No video tracks found on the timeline.";
			return;
		}

		const { parseTranscriptToWords } = await import("@/utils/timelineUtils");
		const api = (await import("@/services/api")).default;

		let allWords: TranscriptWord[] = [];

		for (let i = 0; i < speechElements.length; i++) {
			const elem = speechElements[i];
			generatingStep.value = `Transcribing ${i + 1}/${speechElements.length}...`;

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
					const serverUrl = `http://localhost:${port}/video/${btoa(elem.filePath)}`;
					const resp = await fetch(serverUrl);
					if (!resp.ok) throw new Error(`Video server returned ${resp.status}`);
					const blob = await resp.blob();
					file = new File([blob], "audio.mp4", { type: blob.type || "video/mp4" });
				}

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
				console.warn("[TranscriptView] Failed to transcribe element:", err?.message || err);
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

		// Set words in transcript manager
		editor.transcript.setWords(allWords);
		words.value = allWords;

		// Save transcript to database for persistence
		generatingStep.value = "Saving transcript...";
		await saveTranscriptToDatabase(allWords);

		generatingStep.value = "";
		error.value = null;
	} catch (err) {
		console.error("[TranscriptView] Failed to generate transcript:", err);
		error.value = err instanceof Error ? err.message : "An unexpected error occurred";
	} finally {
		isGenerating.value = false;
		generatingStep.value = "";
	}
}

// Update current word based on playback time
function updateCurrentWordIndex() {
	if (words.value.length === 0) {
		currentWordIndex.value = -1;
		return;
	}
	const time = currentTime.value;
	let newIndex = -1;
	for (let i = 0; i < words.value.length; i++) {
		if (time >= words.value[i].start && time <= words.value[i].end) {
			newIndex = i;
			break;
		}
	}
	if (newIndex === -1) {
		let closest = 0;
		let closestDist = Infinity;
		for (let i = 0; i < words.value.length; i++) {
			const d = Math.abs(words.value[i].start - time);
			if (d < closestDist) {
				closestDist = d;
				closest = i;
			}
		}
		if (closestDist < 2.0) newIndex = closest;
	}

	if (newIndex !== currentWordIndex.value) {
		const oldIndex = currentWordIndex.value;
		currentWordIndex.value = newIndex;
		const isSignificantJump = Math.abs(newIndex - oldIndex) > 20;
		scrollToCurrentWord(isSignificantJump);
	}
}

function scrollToCurrentWord(force = false) {
	if (currentWordIndex.value === -1 || !transcriptContent.value || preventAutoscroll.value) return;
	const el = wordElements.value.get(currentWordIndex.value);
	if (!el) return;
	nextTick(() => {
		if (!transcriptContent.value || !el) return;
		const container = transcriptContent.value;
		const safeTop = container.scrollTop + 40;
		const safeBottom = container.scrollTop + container.clientHeight - 40;
		const wordTop = el.offsetTop;
		if (!force && wordTop >= safeTop && wordTop + el.offsetHeight <= safeBottom) return;
		const target = force
			? Math.max(0, wordTop - 10)
			: wordTop < safeTop
				? Math.max(0, wordTop - 60)
				: wordTop + el.offsetHeight - container.clientHeight + 60;
		container.scrollTo({ top: target, behavior: "smooth" });
	});
}

// Word click → select word (shows delete/split actions)
function onWordClick(word: TranscriptWord, index: number) {
	if (editingWordIndex.value !== -1) return;

	// Strikethrough mode: toggle word strikethrough
	if (strikethroughMode.value) {
		if (strikethroughIndices.value.has(index)) {
			strikethroughIndices.value.delete(index);
		} else {
			strikethroughIndices.value.add(index);
		}
		// Force reactivity
		strikethroughIndices.value = new Set(strikethroughIndices.value);
		return;
	}

	// Single click selects the word
	selectionStartIndex.value = index;
	selectionEndIndex.value = index;
	selectionAnchorIndex.value = index;

	// Also seek playhead to word
	preventAutoscroll.value = true;
	if (autoscrollTimeout) clearTimeout(autoscrollTimeout);
	autoscrollTimeout = setTimeout(() => {
		preventAutoscroll.value = false;
	}, 5000);

	const mid = word.start + (word.end - word.start) / 2;
	editor.playback.seek({ time: mid });
}

// Double-click → edit word text
function onWordDoubleClick(word: TranscriptWord, index: number) {
	if (strikethroughMode.value) return;
	editingWordIndex.value = index;
	editingWordText.value = word.word;
	nextTick(() => {
		const input = document.querySelector(`input[data-word-edit-index="${index}"]`) as HTMLInputElement;
		if (input) {
			input.focus();
			input.select();
		}
	});
}

function saveWordEdit() {
	if (editingWordIndex.value === -1) return;
	const idx = editingWordIndex.value;
	const newText = editingWordText.value.trim();

	if (!newText && words.value[idx]) {
		// Empty text = delete this word using command for undo/redo
		const command = new DeleteTranscriptWordsCommand(idx, idx);
		editor.command.execute({ command });
	} else if (newText && words.value[idx]) {
		// Update word text using command for undo/redo
		const command = new UpdateTranscriptWordCommand(idx, newText);
		editor.command.execute({ command });
	}

	editingWordIndex.value = -1;
	editingWordText.value = "";
}

function cancelWordEdit() {
	editingWordIndex.value = -1;
	editingWordText.value = "";
}

function onWordKeydown(event: KeyboardEvent) {
	if (event.key === "Enter") {
		event.preventDefault();
		saveWordEdit();
	} else if (event.key === "Escape") {
		event.preventDefault();
		cancelWordEdit();
	}
}

// ── Selection ──
function onWordMouseDown(event: MouseEvent, index: number) {
	if (event.button !== 0 || editingWordIndex.value !== -1 || strikethroughMode.value) return;
	event.preventDefault();
	isSelecting.value = true;
	selectionAnchorIndex.value = index;
	selectionStartIndex.value = index;
	selectionEndIndex.value = index;
}

function onWordMouseEnter(index: number) {
	if (!isSelecting.value || selectionAnchorIndex.value === -1) return;
	selectionStartIndex.value = Math.min(selectionAnchorIndex.value, index);
	selectionEndIndex.value = Math.max(selectionAnchorIndex.value, index);
}

function onWordMouseUp() {
	if (!isSelecting.value) return;
	isSelecting.value = false;
	if (selectionStartIndex.value === selectionEndIndex.value) {
		clearSelection();
	}
}

function clearSelection() {
	selectionStartIndex.value = -1;
	selectionEndIndex.value = -1;
	selectionAnchorIndex.value = -1;
}

function isWordInSelection(index: number): boolean {
	if (selectionStartIndex.value === -1 || selectionEndIndex.value === -1) return false;
	return index >= selectionStartIndex.value && index <= selectionEndIndex.value;
}

// ── Split at cursor ──
function splitAtWord(index: number) {
	if (index <= 0 || index >= words.value.length) return;
	const splitTime = words.value[index].start;

	// Find the video element on the timeline that contains this time
	const tracks = editor.timeline.getTracks();
	for (const track of tracks) {
		if (track.type !== "video") continue;
		for (const el of track.elements) {
			const videoEl = el as VideoElement;
			const elEnd = videoEl.startTime + videoEl.duration;
			if (splitTime >= videoEl.startTime && splitTime < elEnd) {
				editor.timeline.splitElements({
					elements: [{ trackId: track.id, elementId: el.id }],
					splitTime,
				});
				return;
			}
		}
	}
}

// ── Delete words → ripple-delete ──
function deleteSelectedWords() {
	if (selectionStartIndex.value === -1 || selectionEndIndex.value === -1) return;
	const startWord = words.value[selectionStartIndex.value];
	const endWord = words.value[selectionEndIndex.value];
	if (!startWord || !endWord) return;

	// Show confirmation dialog
	pendingDeleteAction.value = () => {
		const command = new DeleteTranscriptWordsCommand(selectionStartIndex.value, selectionEndIndex.value);
		editor.command.execute({ command });
		clearSelection();
	};
	showDeleteConfirm.value = true;
}

function commitStrikethrough() {
	if (strikethroughIndices.value.size === 0) return;

	// Show confirmation dialog
	pendingDeleteAction.value = () => {
		// Collect contiguous ranges of strikethrough words
		const sorted = Array.from(strikethroughIndices.value).sort((a, b) => a - b);
		const ranges: { start: number; end: number }[] = [];
		let rangeStart = sorted[0];
		let rangeEnd = sorted[0];

		for (let i = 1; i < sorted.length; i++) {
			if (sorted[i] === rangeEnd + 1) {
				rangeEnd = sorted[i];
			} else {
				ranges.push({ start: rangeStart, end: rangeEnd });
				rangeStart = sorted[i];
				rangeEnd = sorted[i];
			}
		}
		ranges.push({ start: rangeStart, end: rangeEnd });

		// Process ranges in reverse order to maintain word indices
		for (let i = ranges.length - 1; i >= 0; i--) {
			const range = ranges[i];
			const startWord = words.value[range.start];
			const endWord = words.value[range.end];
			if (!startWord || !endWord) continue;

			// Delete using command for undo/redo
			const command = new DeleteTranscriptWordsCommand(range.start, range.end);
			editor.command.execute({ command });
		}

		strikethroughIndices.value = new Set();
		strikethroughMode.value = false;
	};
	showDeleteConfirm.value = true;
}

function handleDeleteConfirm() {
	if (pendingDeleteAction.value) {
		pendingDeleteAction.value();
		pendingDeleteAction.value = null;
	}
	showDeleteConfirm.value = false;
}

function handleDeleteCancel() {
	pendingDeleteAction.value = null;
	showDeleteConfirm.value = false;
}

function clearStrikethrough() {
	strikethroughIndices.value = new Set();
}


// ── Paragraph drag reorder ──
function onParagraphDragStart(event: DragEvent, paragraphId: string) {
	draggingParagraphId.value = paragraphId;
	if (event.dataTransfer) {
		event.dataTransfer.effectAllowed = "move";
		event.dataTransfer.setData("text/plain", paragraphId);
	}
}

function onParagraphDragOver(event: DragEvent, paragraphId: string) {
	event.preventDefault();
	if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
	dragOverParagraphId.value = paragraphId;
}

function onParagraphDragLeave() {
	dragOverParagraphId.value = null;
}

function onParagraphDrop(event: DragEvent, targetParagraphId: string) {
	event.preventDefault();
	dragOverParagraphId.value = null;

	if (!draggingParagraphId.value || draggingParagraphId.value === targetParagraphId) {
		draggingParagraphId.value = null;
		return;
	}

	const sourceIdx = paragraphs.value.findIndex((p) => p.id === draggingParagraphId.value);
	const targetIdx = paragraphs.value.findIndex((p) => p.id === targetParagraphId);
	if (sourceIdx === -1 || targetIdx === -1) {
		draggingParagraphId.value = null;
		return;
	}

	// Reorder using command for undo/redo
	const sourceOffset = paragraphWordOffsets.value[sourceIdx];
	const sourceCount = paragraphs.value[sourceIdx].words.length;
	
	// Calculate target offset after removal
	const newTargetOffset = targetIdx > sourceIdx
		? paragraphWordOffsets.value[targetIdx] - sourceCount + paragraphs.value[targetIdx].words.length
		: paragraphWordOffsets.value[targetIdx];

	const command = new ReorderTranscriptWordsCommand(sourceOffset, sourceCount, newTargetOffset);
	editor.command.execute({ command });

	draggingParagraphId.value = null;
}

function onParagraphDragEnd() {
	draggingParagraphId.value = null;
	dragOverParagraphId.value = null;
}

// ── Timeline highlighting ──
function onParagraphMouseEnter(paragraphId: string) {
	hoveredParagraphId.value = paragraphId;
}

function onParagraphMouseLeave() {
	hoveredParagraphId.value = null;
}

// ── Sync timeline to transcript ──
function syncTimelineToTranscript() {
	const command = new SyncTimelineToTranscriptCommand();
	editor.command.execute({ command });
}

function recalculateTimestamps() {
	// Reassign timestamps sequentially, preserving word durations
	let currentStart = 0;
	for (const word of words.value) {
		const duration = word.end - word.start;
		word.start = currentStart;
		word.end = currentStart + duration;
		currentStart = word.end;
	}
}

function reorderVideoSegments() {
	// Reorder video elements on the timeline to match paragraph order
	const tracks = editor.timeline.getTracks();
	for (const track of tracks) {
		if (track.type !== "video") continue;
		const elements = [...track.elements].sort((a, b) => a.startTime - b.startTime);
		let currentStart = 0;
		for (const el of elements) {
			if (el.startTime !== currentStart) {
				editor.timeline.updateElementStartTime({
					elements: [{ trackId: track.id, elementId: el.id }],
					startTime: currentStart,
				});
			}
			currentStart += el.duration;
		}
	}
}

// ── Search ──
watch(searchQuery, (val) => {
	if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);
	searchDebounceTimeout = setTimeout(() => {
		debouncedSearchQuery.value = val;
		currentMatchIndex.value = 0;
	}, 300);
});

function navigateMatch(direction: number) {
	if (matchOccurrences.value.length === 0) return;
	let newIdx = currentMatchIndex.value + direction;
	if (newIdx < 0) newIdx = matchOccurrences.value.length - 1;
	if (newIdx >= matchOccurrences.value.length) newIdx = 0;
	currentMatchIndex.value = newIdx;

	const wordIdx = matchOccurrences.value[newIdx];
	const word = words.value[wordIdx];
	if (word) editor.playback.seek({ time: word.start });

	nextTick(() => {
		const el = wordElements.value.get(wordIdx);
		if (el && transcriptContent.value) {
			el.scrollIntoView({ behavior: "smooth", block: "center" });
		}
	});
}

function clearSearch() {
	searchQuery.value = "";
	debouncedSearchQuery.value = "";
	currentMatchIndex.value = 0;
}

// ── Word classes ──
function getWordClasses(index: number): string {
	// Strikethrough
	if (strikethroughIndices.value.has(index)) {
		return "line-through text-red-400/60 bg-red-500/10 border border-red-500/20";
	}

	// Selection
	if (isWordInSelection(index)) {
		return "bg-blue-500/30 text-blue-200 border border-blue-400/40";
	}

	// Active search match
	if (activeMatchWordIndex.value !== -1) {
		const query = debouncedSearchQuery.value.toLowerCase().trim();
		const queryWords = query.split(/\s+/).filter((w) => w.length > 0);
		if (index >= activeMatchWordIndex.value && index < activeMatchWordIndex.value + queryWords.length) {
			return "bg-orange-500/40 text-orange-200 border border-orange-400/50 ring-1 ring-orange-400/30";
		}
	}

	// Search match
	if (matchedPhraseIndices.value.includes(index)) {
		return "bg-yellow-500/20 text-yellow-300 border border-yellow-500/30";
	}

	// Current word
	if (index === currentWordIndex.value) {
		return "bg-primary text-primary-foreground";
	}

	// Spoken
	if (currentWordIndex.value >= 0 && index < currentWordIndex.value) {
		return "text-foreground font-medium";
	}

	// Future
	return "text-muted-foreground/70";
}

// ── Lifecycle ──
// Poll playback time to update current word
let rafId: number | null = null;
function tick() {
	updateCurrentWordIndex();
	rafId = requestAnimationFrame(tick);
}

onMounted(() => {
	loadTranscript();
	rafId = requestAnimationFrame(tick);

	// Listen for transcript updates
	document.addEventListener("transcript-updated", handleTranscriptUpdate);

	// Subscribe to transcript manager changes
	unsubscribe = editor.transcript.subscribe(() => {
		words.value = editor.transcript.getWords();
	});
});

onUnmounted(() => {
	if (rafId !== null) cancelAnimationFrame(rafId);
	if (autoscrollTimeout) clearTimeout(autoscrollTimeout);
	if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout);
	document.removeEventListener("transcript-updated", handleTranscriptUpdate);
	wordElements.value.clear();
	
	// Unsubscribe from transcript manager
	if (unsubscribe) unsubscribe();
});

function handleTranscriptUpdate() {
	loadTranscript();
}

// Reload when project changes
watch(
	() => {
		void version.value;
		return editor.project.getActiveOrNull()?.metadata.id;
	},
	() => {
		loadTranscript();
	}
);
</script>

<template>
	<div class="flex h-full flex-col overflow-hidden">
		<!-- Toolbar -->
		<PanelSearchBar
			v-model="searchQuery"
			placeholder="Search..."
			@keydown.enter.prevent="navigateMatch(1)"
			@keydown.shift.enter.prevent="navigateMatch(-1)"
		>
			<template v-if="searchQuery.trim() && matchOccurrences.length > 0">
				<span class="text-[9px] tabular-nums text-zinc-500 whitespace-nowrap">
					{{ currentMatchIndex + 1 }}/{{ matchOccurrences.length }}
				</span>
				<button @click="navigateMatch(-1)" class="p-0.5 text-zinc-500 hover:text-zinc-300 rounded" title="Previous">
					<ChevronUp class="size-3" />
				</button>
				<button @click="navigateMatch(1)" class="p-0.5 text-zinc-500 hover:text-zinc-300 rounded" title="Next">
					<ChevronDown class="size-3" />
				</button>
			</template>
			<button v-if="searchQuery.trim()" @click="clearSearch" class="p-0.5 text-zinc-500 hover:text-zinc-300 rounded">
				<XIcon class="size-3" />
			</button>

			<!-- Divider -->
			<div class="w-px h-4 bg-white/10 mx-1" />

			<!-- Sync Timeline button -->
			<button
				v-if="words.length > 0"
				@click="syncTimelineToTranscript"
				class="p-1 rounded transition-colors text-zinc-500 hover:text-zinc-300 hover:bg-white/5"
				title="Sync timeline to match transcript order"
			>
				<RefreshCw class="size-3.5" />
			</button>

			<!-- Strikethrough toggle -->
			<button
				@click="strikethroughMode = !strikethroughMode"
				:class="[
					'p-1 rounded transition-colors',
					strikethroughMode
						? 'bg-red-500/20 text-red-400 border border-red-500/30'
						: 'text-zinc-500 hover:text-zinc-300 hover:bg-white/5',
				]"
				:title="strikethroughMode ? 'Exit strikethrough mode' : 'Strikethrough mode — click words to mark for removal'"
			>
				<Strikethrough class="size-3.5" />
			</button>
		</PanelSearchBar>

		<!-- Strikethrough action bar -->
		<div
			v-if="strikethroughMode && strikethroughCount > 0"
			class="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border-b border-red-500/20"
		>
			<span class="text-[10px] text-red-400 font-medium">
				{{ strikethroughCount }} word{{ strikethroughCount !== 1 ? 's' : '' }} marked
			</span>
			<div class="flex-1" />
			<button
				@click="clearStrikethrough"
				class="flex items-center gap-1 px-2 py-0.5 text-[10px] text-zinc-400 hover:text-zinc-200 bg-white/5 rounded transition-colors"
			>
				<Undo2 class="size-3" />
				Clear
			</button>
			<button
				@click="commitStrikethrough"
				class="flex items-center gap-1 px-2 py-0.5 text-[10px] text-red-400 hover:text-red-300 bg-red-500/20 rounded transition-colors border border-red-500/30"
			>
				<Trash2 class="size-3" />
				Delete Marked
			</button>
		</div>

		<!-- Selection action bar -->
		<div
			v-if="selectionStartIndex !== -1 && selectionEndIndex !== -1"
			class="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border-b border-blue-500/20"
		>
			<span class="text-[10px] text-blue-400 font-mono tabular-nums">
				{{ formatTime(selectionTimeRange?.startTime ?? 0) }} – {{ formatTime(selectionTimeRange?.endTime ?? 0) }}
			</span>
			<div class="flex-1" />
			<button
				@click="splitAtWord(selectionStartIndex)"
				class="flex items-center gap-1 px-2 py-0.5 text-[10px] text-zinc-300 hover:text-white bg-white/5 rounded transition-colors"
				title="Split video at selection start"
			>
				<SplitSquareHorizontal class="size-3" />
				Split
			</button>
			<button
				@click="deleteSelectedWords"
				class="flex items-center gap-1 px-2 py-0.5 text-[10px] text-red-400 hover:text-red-300 bg-red-500/20 rounded transition-colors border border-red-500/30"
				title="Delete selected words and ripple-delete from timeline"
			>
				<Trash2 class="size-3" />
				Delete
			</button>
			<button
				@click="clearSelection"
				class="p-0.5 text-zinc-500 hover:text-zinc-300 rounded"
			>
				<XIcon class="size-3" />
			</button>
		</div>

		<!-- Loading -->
		<div v-if="loading" class="flex-1 flex items-center justify-center">
			<div class="text-center">
				<Loader2 class="animate-spin size-6 mx-auto mb-2 text-blue-400" />
				<p class="text-xs text-zinc-500">Loading transcript...</p>
			</div>
		</div>

		<!-- Error -->
		<div v-else-if="error" class="flex-1 flex items-center justify-center px-4">
			<div class="text-center max-w-[240px]">
				<FileText class="size-8 text-zinc-600 mx-auto mb-3" />
				<p class="text-xs text-zinc-400 leading-relaxed mb-3">{{ error }}</p>
				<div class="flex items-center justify-center gap-2">
					<button
						@click="loadTranscript"
						class="px-3 py-1.5 text-[10px] font-medium text-zinc-300 bg-white/5 rounded-md border border-white/10 hover:bg-white/10 transition-colors"
					>
						Retry
					</button>
					<button
						@click="handleGenerateTranscript"
						:disabled="isGenerating"
						class="px-3 py-1.5 text-[10px] font-medium text-blue-400 bg-blue-500/10 rounded-md border border-blue-500/20 hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
					>
						<Loader2 v-if="isGenerating" class="inline-block animate-spin size-3 mr-1" />
						{{ isGenerating ? 'Generating...' : 'Generate Transcript' }}
					</button>
				</div>
				<p v-if="generatingStep" class="text-[10px] text-zinc-500 mt-2">{{ generatingStep }}</p>
			</div>
		</div>

		<!-- Empty -->
		<div v-else-if="words.length === 0" class="flex-1 flex items-center justify-center px-4">
			<div class="text-center max-w-[200px]">
				<FileText class="size-8 text-zinc-600 mx-auto mb-3" />
				<h4 class="text-xs font-medium text-zinc-300 mb-1">No Transcript</h4>
				<p class="text-[10px] text-zinc-500 leading-relaxed mb-3">
					Generate a transcript from the video audio to enable text-based editing.
				</p>
				<button
					@click="handleGenerateTranscript"
					:disabled="isGenerating"
					class="px-3 py-1.5 text-[10px] font-medium text-blue-400 bg-blue-500/10 rounded-md border border-blue-500/20 hover:bg-blue-500/20 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
				>
					<Loader2 v-if="isGenerating" class="inline-block animate-spin size-3 mr-1" />
					{{ isGenerating ? 'Generating...' : 'Generate Transcript' }}
				</button>
			</div>
		</div>

		<!-- Transcript content -->
		<div
			v-else
			ref="transcriptContent"
			class="flex-1 overflow-y-auto p-3"
			@mouseup="onWordMouseUp"
		>
			<div
				v-for="(paragraph, pIdx) in paragraphs"
				:key="paragraph.id"
				class="mb-3 rounded-md transition-all"
				:class="{
					'bg-blue-500/5 border border-blue-500/20': dragOverParagraphId === paragraph.id,
					'opacity-50': draggingParagraphId === paragraph.id,
					'bg-blue-500/10 border border-blue-500/30': hoveredParagraphId === paragraph.id,
				}"
				draggable="true"
				@dragstart="onParagraphDragStart($event, paragraph.id)"
				@dragover="onParagraphDragOver($event, paragraph.id)"
				@dragleave="onParagraphDragLeave"
				@drop="onParagraphDrop($event, paragraph.id)"
				@dragend="onParagraphDragEnd"
				@mouseenter="onParagraphMouseEnter(paragraph.id)"
				@mouseleave="onParagraphMouseLeave"
			>
				<!-- Paragraph header -->
				<div class="flex items-center gap-1 mb-1">
					<GripVertical class="size-3 text-zinc-600 cursor-grab shrink-0" />
					<span class="text-[9px] font-mono text-zinc-600 tabular-nums">
						{{ formatTime(paragraph.startTime) }}
					</span>
					<button
						@click="splitAtWord(paragraphWordOffsets[pIdx])"
						v-if="pIdx > 0"
						class="p-0.5 text-zinc-600 hover:text-zinc-400 rounded transition-colors"
						title="Split video at paragraph boundary"
					>
						<Scissors class="size-2.5" />
					</button>
				</div>

				<!-- Words -->
				<div class="text-[11px] leading-relaxed break-words select-none">
					<span
						v-for="(word, wIdx) in paragraph.words"
						:key="`${paragraph.id}-${wIdx}`"
						:ref="(el) => setWordRef(el, paragraphWordOffsets[pIdx] + wIdx)"
						:class="[
							'inline-block px-0.5 py-px mx-px rounded cursor-pointer whitespace-normal transition-colors',
							getWordClasses(paragraphWordOffsets[pIdx] + wIdx),
							strikethroughMode && 'hover:bg-red-500/20 hover:text-red-300',
						]"
						@click="onWordClick(word, paragraphWordOffsets[pIdx] + wIdx)"
						@dblclick="onWordDoubleClick(word, paragraphWordOffsets[pIdx] + wIdx)"
						@mousedown="onWordMouseDown($event, paragraphWordOffsets[pIdx] + wIdx)"
						@mouseenter="onWordMouseEnter(paragraphWordOffsets[pIdx] + wIdx)"
						:title="strikethroughMode ? 'Click to mark for removal' : `${formatTime(word.start)} — double-click to edit`"
					>
						<input
							v-if="editingWordIndex === paragraphWordOffsets[pIdx] + wIdx"
							:data-word-edit-index="paragraphWordOffsets[pIdx] + wIdx"
							v-model="editingWordText"
							@blur="saveWordEdit()"
							@keydown="onWordKeydown($event)"
							class="bg-transparent border-b border-blue-400 outline-none text-inherit min-w-[20px] px-0"
							style="font: inherit"
						/>
						<span v-else>{{ word.word }}{{ wIdx < paragraph.words.length - 1 ? ' ' : '' }}</span>
					</span>
				</div>
			</div>
		</div>

		<!-- Confirmation Dialog -->
		<ConfirmDialog
			:open="showDeleteConfirm"
			title="Delete Transcript Words"
			message="This will delete the selected words from the transcript and remove the corresponding video segments from the timeline. This action can be undone."
			confirm-text="Delete"
			cancel-text="Cancel"
			variant="danger"
			@confirm="handleDeleteConfirm"
			@cancel="handleDeleteCancel"
			@update:open="(val) => showDeleteConfirm = val"
		/>
	</div>
</template>
