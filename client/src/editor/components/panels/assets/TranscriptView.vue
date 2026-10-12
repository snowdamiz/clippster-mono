<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { usePlaybackClock } from "../../../composables/usePlaybackClock";
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
	RefreshCw,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import ToolbarButton from "../../chrome/ToolbarButton.vue";
import PanelSearchBar from "./PanelSearchBar.vue";
import {
	collectTimelineSpeechElements,
	transcribeTimelineSpeechElements,
} from "../../../lib/transcribe-timeline-audio";

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
const { editor, version } = useEditor({
	subscribe: {
		project: true,
		timeline: true,
		media: true,
		scenes: false,
		playback: false,
		selection: false,
	},
});

// ── State ──
const words = ref<TranscriptWord[]>([]);
const loading = ref(false);
const error = ref<string | null>(null);
const isGenerating = ref(false);
const generatingStep = ref("");

// Subscribe to transcript manager changes
let unsubscribe: (() => void) | null = null;
let loadTranscriptRequestId = 0;
let lastTimingGapLogKey: string | null = null;

// Current playback time from editor
const currentTime = usePlaybackClock();

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
	const requestId = ++loadTranscriptRequestId;
	loading.value = true;
	error.value = null;
	words.value = [];

	try {
		const syncManagerWords = (reason: string): boolean => {
			if (requestId !== loadTranscriptRequestId) {
				console.log("[TranscriptView] Aborting stale transcript load", {
					requestId,
					activeRequestId: loadTranscriptRequestId,
					reason,
				});
				return true;
			}

			const managerWords = editor.transcript.getWords();
			if (managerWords.length === 0) return false;

			console.log("[TranscriptView] Using transcript manager words", {
				requestId,
				reason,
				count: managerWords.length,
				firstWord: managerWords[0]?.word,
				lastWord: managerWords[managerWords.length - 1]?.word,
			});
			words.value = managerWords;
			return true;
		};

		// Check transcript manager first — project-loader may have already set words
		if (syncManagerWords("initial-check")) {
			return;
		}

		const activeProject = editor.project.getActive();
		if (!activeProject) {
			error.value = "No active project.";
			return;
		}

		// Use the original Clippster project ID for transcript lookup.
		// The transcript is stored against the source project (the one with the VOD),
		// not the video editor project ID.
		let transcriptProjectId = activeProject.settings?.sourceProjectId;
		let clipId = activeProject.settings?.sourceClipId;
		let clipStart = activeProject.settings?.sourceClipStartTime;
		let clipEnd = activeProject.settings?.sourceClipEndTime;
		let clipSegments: Array<{ start: number; end: number }> | null = null;

		console.log("[TranscriptView] Loading transcript", {
			requestId,
			projectId: activeProject.metadata.id,
			transcriptProjectId,
			clipId,
			clipStart,
			clipEnd,
		});

		// If no sourceProjectId in settings, try resolving from media asset file paths
		if (!transcriptProjectId) {
			const assets = editor.media.getAssets();
			for (const asset of assets) {
				const pathToCheck = (asset as any).filePath || asset.url || "";
				const match = pathToCheck.match(/clip_([0-9a-f-]{36})\./i);
				if (match) {
					try {
						const { getClip } = await import("@/services/database/clips");
						const clip = await getClip(match[1]);
						if (clip?.project_id) {
							transcriptProjectId = clip.project_id;
							clipId = clipId ?? clip.id;
							clipStart = clipStart ?? clip.start_time;
							clipEnd = clipEnd ?? clip.end_time;
							break;
						}
					} catch { /* not found */ }
				}
			}
		}

		if (!transcriptProjectId) {
			transcriptProjectId = activeProject.metadata.id;
		}

		const { parseTranscriptToWords } = await import("@/utils/timelineUtils");
		if (syncManagerWords("after-parser-import")) {
			return;
		}

		const filterAndRebase = (wordList: TranscriptWord[]): TranscriptWord[] => {
			if (clipStart == null || clipEnd == null) return wordList;

			if (clipSegments && clipSegments.length > 0) {
				const result: TranscriptWord[] = [];
				let outputOffset = 0;

				for (const seg of clipSegments) {
					const segWords = wordList
						.filter((w) => w.start >= seg.start && w.start < seg.end)
						.map((w) => ({
							...w,
							start: w.start - seg.start + outputOffset,
							end: w.end - seg.start + outputOffset,
						}));

					result.push(...segWords);
					outputOffset += seg.end - seg.start;
				}

				console.log("[TranscriptView] filterAndRebase using clip segments", {
					requestId,
					segments: clipSegments.map((seg) => `${seg.start.toFixed(1)}-${seg.end.toFixed(1)}`),
					matched: result.length,
				});
				return result;
			}

			const result = wordList
				.filter((w) => w.start >= clipStart && w.start < clipEnd)
				.map((w) => ({ ...w, start: w.start - clipStart, end: w.end - clipStart }));

			console.log("[TranscriptView] filterAndRebase using clip range", {
				requestId,
				clipStart,
				clipEnd,
				matched: result.length,
			});
			return result;
		};

		// Strategy 1: Try clip segments' transcript_raw_json (available for previously built clips)
		if (clipId) {
			try {
				const { getClipSegmentsByClipId } = await import("@/services/database/clip-segments");
				const segments = await getClipSegmentsByClipId(clipId);
				clipSegments = segments.map((seg) => ({
					start: seg.start_time,
					end: seg.end_time,
				}));
				const segmentWords: TranscriptWord[] = [];

				for (const seg of segments) {
					if (!seg.transcript_raw_json) continue;
					const parsed = parseTranscriptToWords(seg.transcript_raw_json);
					for (const w of parsed) {
						const wa = w as any;
						segmentWords.push({
							word: wa.word || wa.text || String(wa),
							start: wa.start || wa.begin || 0,
							end: wa.end || wa.finish || 0,
							confidence: wa.confidence,
						});
					}
				}

				if (syncManagerWords("after-segment-query")) {
					return;
				}

				if (segmentWords.length > 0) {
					segmentWords.sort((a, b) => a.start - b.start);
					if (syncManagerWords("before-strategy-1-commit")) {
						return;
					}
					console.log("[TranscriptView] Strategy 1 loaded segment transcript words", {
						requestId,
						clipId,
						segmentCount: segments.length,
						wordCount: segmentWords.length,
					});
					editor.transcript.setWords(segmentWords);
					words.value = segmentWords;
					return;
				}
			} catch {
				// Fall through to Strategy 2
			}
		}

		// Strategy 2: Load stitched VOD transcript and filter/rebase to clip time range
		const { getTranscriptWithSegmentsByProjectId } = await import("@/services/database/transcripts");
		const { transcript } = await getTranscriptWithSegmentsByProjectId(transcriptProjectId);
		if (syncManagerWords("after-stitched-transcript-query")) {
			return;
		}

		if (transcript && transcript.raw_json) {
			const parsed = parseTranscriptToWords(transcript.raw_json);
			if (parsed.length > 0) {
				let loadedWords: TranscriptWord[] = parsed.map((w: any) => ({
					word: w.word || w.text || w.content || String(w),
					start: w.start || w.begin || w.startTime || 0,
					end: w.end || w.finish || w.endTime || 0,
					confidence: w.confidence,
				}));

				loadedWords = filterAndRebase(loadedWords);

				if (loadedWords.length > 0) {
					if (syncManagerWords("before-strategy-2-commit")) {
						return;
					}
					console.log("[TranscriptView] Strategy 2 loaded stitched transcript words", {
						requestId,
						transcriptProjectId,
						parsedCount: parsed.length,
						loadedCount: loadedWords.length,
					});
					editor.transcript.setWords(loadedWords);
					words.value = loadedWords;
					return;
				}
			}
		}

		// Strategy 3: Fall back to chunked transcript chunks (when stitching failed or never ran)
		try {
			const { getRawVideosByProjectId } = await import("@/services/database/raw-videos");
			const { getChunkedTranscriptByRawVideoId, getTranscriptChunks } = await import("@/services/database/chunked-transcripts");

			const rawVideos = await getRawVideosByProjectId(transcriptProjectId);
			if (rawVideos.length > 0) {
				const chunkedTranscript = await getChunkedTranscriptByRawVideoId(rawVideos[0].id);
				if (chunkedTranscript) {
					const chunks = await getTranscriptChunks(chunkedTranscript.id);
					const chunkWords: TranscriptWord[] = [];

					for (const chunk of chunks) {
						try {
							const chunkData = JSON.parse(chunk.raw_json);
							if (chunkData.segments && Array.isArray(chunkData.segments)) {
								for (const seg of chunkData.segments) {
									if (seg.words && Array.isArray(seg.words)) {
										for (const w of seg.words) {
											const wordText = w.word || w.text;
											const start = w.start ?? w.startTime;
											const end = w.end ?? w.endTime;
											if (wordText && typeof start === "number" && typeof end === "number") {
												chunkWords.push({
													word: wordText,
													start: start + chunk.start_time,
													end: end + chunk.start_time,
													confidence: w.confidence ?? w.prob,
												});
											}
										}
									}
								}
							}
							if (chunkData.words && Array.isArray(chunkData.words)) {
								for (const w of chunkData.words) {
									const wordText = w.word || w.text;
									const start = w.start ?? w.startTime;
									const end = w.end ?? w.endTime;
									if (wordText && typeof start === "number" && typeof end === "number") {
										chunkWords.push({
											word: wordText,
											start: start + chunk.start_time,
											end: end + chunk.start_time,
											confidence: w.confidence ?? w.prob,
										});
									}
								}
							}
						} catch {
							// Skip unparseable chunks
						}
					}

					if (chunkWords.length > 0) {
						chunkWords.sort((a, b) => a.start - b.start);
						// Deduplicate
						const unique = chunkWords.filter((w, i, arr) =>
							i === 0 || !(Math.abs(w.start - arr[i - 1].start) < 0.01 && w.word === arr[i - 1].word)
						);
						const finalWords = filterAndRebase(unique);
						if (syncManagerWords("after-chunked-transcript-query")) {
							return;
						}

						if (finalWords.length > 0) {
							if (syncManagerWords("before-strategy-3-commit")) {
								return;
							}
							console.log("[TranscriptView] Strategy 3 loaded chunked transcript words", {
								requestId,
								chunkWordCount: chunkWords.length,
								uniqueCount: unique.length,
								finalCount: finalWords.length,
							});
							editor.transcript.setWords(finalWords);
							words.value = finalWords;
							return;
						}
					}
				}
			}
		} catch {
			// Fall through to caption fallback
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
			if (syncManagerWords("before-caption-fallback-commit")) {
				return;
			}
			// Set words in transcript manager
			editor.transcript.setWords(captionWords);
			words.value = captionWords;
			return;
		}

		error.value = "Generate one from the timeline audio to edit this clip by text.";
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

// Generate transcript from video audio
async function handleGenerateTranscript() {
	try {
		isGenerating.value = true;
		error.value = null;
		generatingStep.value = "Collecting audio from timeline…";

		const activeProject = editor.project.getActive();
		if (!activeProject) {
			error.value = "No active project.";
			return;
		}
		const projectId = activeProject.metadata.id;

		const speechElements = collectTimelineSpeechElements(editor);
		if (speechElements.length === 0) {
			error.value = "No video tracks found on the timeline.";
			return;
		}

		const allWords = await transcribeTimelineSpeechElements(
			speechElements,
			projectId,
			(step) => {
				generatingStep.value = step;
			},
		);

		if (allWords.length === 0) {
			error.value = "Transcription returned no words. Check that the video has speech audio.";
			return;
		}

		// Set words in transcript manager
		editor.transcript.setWords(allWords);
		words.value = allWords;

		// Persist to database when possible
		await saveTranscriptToDatabase(allWords);
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
		lastTimingGapLogKey = null;
		return;
	}

	const ACTIVE_WORD_GRACE_SECONDS = 0.08;
	const time = currentTime.value;
	let newIndex = -1;
	for (let i = 0; i < words.value.length; i++) {
		if (
			time >= words.value[i].start - ACTIVE_WORD_GRACE_SECONDS &&
			time <= words.value[i].end + ACTIVE_WORD_GRACE_SECONDS
		) {
			newIndex = i;
			break;
		}
	}

	if (newIndex === -1 && currentWordIndex.value !== -1) {
		const currentWord = words.value[currentWordIndex.value];
		if (
			currentWord &&
			time > currentWord.end &&
			time <= currentWord.end + ACTIVE_WORD_GRACE_SECONDS
		) {
			newIndex = currentWordIndex.value;
		}
	}

	if (newIndex === -1) {
		const nextWord = words.value.find((word) => word.start > time);
		if (nextWord) {
			const gapToNext = nextWord.start - time;
			if (gapToNext > 0.25 && gapToNext < 2.0) {
				const logKey = `${nextWord.word}:${nextWord.start.toFixed(2)}:${time.toFixed(2)}`;
				if (lastTimingGapLogKey !== logKey) {
					console.log("[TranscriptView] No active transcript word at playback time", {
						time,
						nextWord: nextWord.word,
						nextWordStart: nextWord.start,
						gapToNext,
					});
					lastTimingGapLogKey = logKey;
				}
			} else if (gapToNext <= 0.25) {
				lastTimingGapLogKey = null;
			}
		} else {
			lastTimingGapLogKey = null;
		}
	} else {
		lastTimingGapLogKey = null;
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


// ── Paragraph pointer-based reorder ──
const PARAGRAPH_DRAG_THRESHOLD = 5;

function onParagraphPointerDown(event: PointerEvent, paragraphId: string) {
	if (event.button !== 0) return;

	const startY = event.clientY;
	let started = false;

	function onMove(ev: PointerEvent) {
		if (!started) {
			if (Math.abs(ev.clientY - startY) < PARAGRAPH_DRAG_THRESHOLD) return;
			started = true;
			draggingParagraphId.value = paragraphId;
		}

		// Hit-test: find which paragraph the cursor is over
		const el = document.elementFromPoint(ev.clientX, ev.clientY);
		if (!el) return;
		const paragraphEl = (el as HTMLElement).closest('[data-paragraph-id]') as HTMLElement | null;
		if (paragraphEl) {
			const overId = paragraphEl.dataset.paragraphId!;
			if (overId !== paragraphId) {
				dragOverParagraphId.value = overId;
			} else {
				dragOverParagraphId.value = null;
			}
		}
	}

	function onUp() {
		document.removeEventListener('pointermove', onMove);
		document.removeEventListener('pointerup', onUp);

		if (started && draggingParagraphId.value && dragOverParagraphId.value) {
			const targetParagraphId = dragOverParagraphId.value;

			const sourceIdx = paragraphs.value.findIndex((p) => p.id === draggingParagraphId.value);
			const targetIdx = paragraphs.value.findIndex((p) => p.id === targetParagraphId);
			if (sourceIdx !== -1 && targetIdx !== -1) {
				const sourceOffset = paragraphWordOffsets.value[sourceIdx];
				const sourceCount = paragraphs.value[sourceIdx].words.length;

				const newTargetOffset = targetIdx > sourceIdx
					? paragraphWordOffsets.value[targetIdx] - sourceCount + paragraphs.value[targetIdx].words.length
					: paragraphWordOffsets.value[targetIdx];

				const command = new ReorderTranscriptWordsCommand(sourceOffset, sourceCount, newTargetOffset);
				editor.command.execute({ command });
			}
		}

		draggingParagraphId.value = null;
		dragOverParagraphId.value = null;
	}

	document.addEventListener('pointermove', onMove);
	document.addEventListener('pointerup', onUp);
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
// Every word keeps a 1px border (transparent by default) so state changes don't shift the text.
function getWordClasses(index: number): string {
	// Strikethrough
	if (strikethroughIndices.value.has(index)) {
		return "line-through decoration-danger text-danger bg-danger-soft border-[var(--danger-line)]";
	}

	// Selection
	if (isWordInSelection(index)) {
		return "bg-brand-soft text-brand border-brand-line";
	}

	// Active search match
	if (activeMatchWordIndex.value !== -1) {
		const query = debouncedSearchQuery.value.toLowerCase().trim();
		const queryWords = query.split(/\s+/).filter((w) => w.length > 0);
		if (index >= activeMatchWordIndex.value && index < activeMatchWordIndex.value + queryWords.length) {
			return "bg-warning text-[var(--fg-on-light)] border-warning";
		}
	}

	// Search match
	if (matchedPhraseIndices.value.includes(index)) {
		return "bg-warning-soft text-warning border-[var(--warning-line)]";
	}

	// Current word
	if (index === currentWordIndex.value) {
		return "bg-brand text-brand-fg border-brand";
	}

	// Spoken
	if (currentWordIndex.value >= 0 && index < currentWordIndex.value) {
		return "text-fg border-transparent";
	}

	// Future
	return "text-fg-muted border-transparent";
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
		const managerWords = editor.transcript.getWords();
		console.log("[TranscriptView] Transcript manager updated", {
			count: managerWords.length,
			firstWord: managerWords[0]?.word,
			lastWord: managerWords[managerWords.length - 1]?.word,
		});
		words.value = managerWords;
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
			placeholder="Search transcript…"
			:clearable="false"
			@keydown.enter.prevent="navigateMatch(1)"
			@keydown.shift.enter.prevent="navigateMatch(-1)"
		>
			<ToolbarButton
				v-if="words.length > 0"
				label="Sync timeline to transcript order"
				@click="syncTimelineToTranscript"
			>
				<RefreshCw />
			</ToolbarButton>
			<ToolbarButton
				:label="strikethroughMode ? 'Exit strikethrough mode' : 'Strikethrough mode — click words to mark for removal'"
				:active="strikethroughMode"
				toggle
				@click="strikethroughMode = !strikethroughMode"
			>
				<Strikethrough />
			</ToolbarButton>
		</PanelSearchBar>

		<!-- Search match bar -->
		<div
			v-if="searchQuery.trim()"
			class="flex h-8 shrink-0 items-center gap-0.5 border-b border-line-subtle pl-3 pr-1.5"
		>
			<span class="tabular min-w-0 flex-1 truncate text-xs text-fg-muted">
				<template v-if="matchOccurrences.length > 0">
					<span class="text-fg">{{ currentMatchIndex + 1 }}</span> of {{ matchOccurrences.length }}
					{{ matchOccurrences.length === 1 ? 'match' : 'matches' }}
				</template>
				<template v-else-if="debouncedSearchQuery.trim()">No matches</template>
			</span>
			<ToolbarButton
				label="Previous match"
				shortcut="Shift+Enter"
				size="icon-xs"
				:disabled="matchOccurrences.length === 0"
				@click="navigateMatch(-1)"
			>
				<ChevronUp />
			</ToolbarButton>
			<ToolbarButton
				label="Next match"
				shortcut="Enter"
				size="icon-xs"
				:disabled="matchOccurrences.length === 0"
				@click="navigateMatch(1)"
			>
				<ChevronDown />
			</ToolbarButton>
			<ToolbarButton label="Clear search" size="icon-xs" @click="clearSearch">
				<XIcon />
			</ToolbarButton>
		</div>

		<!-- Strikethrough action bar -->
		<div
			v-if="strikethroughMode && strikethroughCount > 0"
			class="flex h-9 shrink-0 items-center gap-1 border-b border-line-subtle pl-3 pr-1.5"
		>
			<span class="tabular min-w-0 flex-1 truncate text-xs text-fg-muted">
				{{ strikethroughCount }} marked
			</span>
			<Button variant="ghost" size="xs" title="Unmark all words" @click="clearStrikethrough">Clear</Button>
			<Button
				variant="destructive-soft"
				size="xs"
				title="Delete marked words and ripple-delete from timeline"
				@click="commitStrikethrough"
			>
				<Trash2 />
				Delete
			</Button>
		</div>

		<!-- Selection action bar -->
		<div
			v-if="selectionStartIndex !== -1 && selectionEndIndex !== -1"
			class="flex h-9 shrink-0 items-center gap-1 border-b border-line-subtle pl-3 pr-1.5"
		>
			<span class="tabular min-w-0 flex-1 truncate font-mono text-xs text-brand">
				{{ formatTime(selectionTimeRange?.startTime ?? 0) }}–{{ formatTime(selectionTimeRange?.endTime ?? 0) }}
			</span>
			<Button
				variant="ghost"
				size="xs"
				title="Split video at selection start"
				@click="splitAtWord(selectionStartIndex)"
			>
				<SplitSquareHorizontal />
				Split
			</Button>
			<Button
				variant="destructive-soft"
				size="xs"
				title="Delete selected words and ripple-delete from timeline"
				@click="deleteSelectedWords"
			>
				<Trash2 />
				Delete
			</Button>
			<ToolbarButton label="Clear selection" size="icon-xs" @click="clearSelection">
				<XIcon />
			</ToolbarButton>
		</div>

		<!-- Loading -->
		<div v-if="loading" class="flex flex-1 flex-col items-center justify-center gap-2">
			<Loader2 class="size-5 animate-spin text-fg-subtle" />
			<p class="text-xs text-fg-muted">Loading transcript…</p>
		</div>

		<!-- Error -->
		<div v-else-if="error" class="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
			<div class="my-auto">
				<EmptyState size="sm" :icon="FileText" title="No transcript" :description="error" class="px-0">
					<Button variant="secondary" size="sm" @click="loadTranscript">Retry</Button>
					<Button variant="primary" size="sm" :loading="isGenerating" @click="handleGenerateTranscript">
						{{ isGenerating ? 'Generating…' : 'Generate transcript' }}
					</Button>
				</EmptyState>
				<p v-if="generatingStep" class="-mt-4 text-center text-2xs text-fg-subtle">{{ generatingStep }}</p>
			</div>
		</div>

		<!-- Empty -->
		<div v-else-if="words.length === 0" class="flex min-h-0 flex-1 flex-col overflow-y-auto p-3">
			<div class="my-auto">
				<EmptyState
					size="sm"
					:icon="FileText"
					title="No transcript"
					description="Generate one from the timeline audio to edit this clip by text."
					class="px-0"
				>
					<Button variant="primary" size="sm" :loading="isGenerating" @click="handleGenerateTranscript">
						{{ isGenerating ? 'Generating…' : 'Generate transcript' }}
					</Button>
				</EmptyState>
				<p v-if="generatingStep" class="-mt-4 text-center text-2xs text-fg-subtle">{{ generatingStep }}</p>
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
				:data-paragraph-id="paragraph.id"
				class="-mx-1.5 mb-2 rounded-md border px-1.5 py-1 transition-colors"
				:class="[
					dragOverParagraphId === paragraph.id
						? 'border-brand-line bg-brand-soft'
						: hoveredParagraphId === paragraph.id
							? 'border-line-subtle bg-surface-hover'
							: 'border-transparent',
					draggingParagraphId === paragraph.id && 'opacity-50',
				]"
				@pointerdown="onParagraphPointerDown($event, paragraph.id)"
				@mouseenter="onParagraphMouseEnter(paragraph.id)"
				@mouseleave="onParagraphMouseLeave"
			>
				<!-- Paragraph header -->
				<div class="mb-0.5 flex h-5 items-center gap-1">
					<GripVertical class="size-3 shrink-0 cursor-grab text-fg-disabled" />
					<span class="tabular font-mono text-2xs text-fg-subtle">
						{{ formatTime(paragraph.startTime) }}
					</span>
					<button
						v-if="pIdx > 0"
						type="button"
						class="grid size-5 place-items-center rounded text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
						title="Split video at paragraph boundary"
						aria-label="Split video at paragraph boundary"
						@click="splitAtWord(paragraphWordOffsets[pIdx])"
					>
						<Scissors class="size-3" />
					</button>
				</div>

				<!-- Words -->
				<div class="select-none break-words text-xs leading-relaxed">
					<span
						v-for="(word, wIdx) in paragraph.words"
						:key="`${paragraph.id}-${wIdx}`"
						:ref="(el) => setWordRef(el, paragraphWordOffsets[pIdx] + wIdx)"
						:class="[
							'inline-block cursor-pointer whitespace-normal rounded border px-0.5 transition-colors',
							getWordClasses(paragraphWordOffsets[pIdx] + wIdx),
							strikethroughMode && 'hover:bg-danger-soft hover:text-danger',
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
							class="min-w-[20px] border-b border-brand bg-transparent px-0 text-inherit outline-none"
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
			title="Delete transcript words"
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
