import { utf8ToBase64Url } from "@/utils/encoding";
import type { EditorCore } from "../core";
import type { UploadAudioElement, VideoElement } from "../types/timeline";

export interface TimelineSpeechElement {
	filePath: string;
	timelineStart: number;
	trimStart: number;
	duration: number;
}

export interface TranscriptWordResult {
	word: string;
	start: number;
	end: number;
	confidence?: number;
}

/** Collect video/audio clips on the timeline that can be transcribed. */
export function collectTimelineSpeechElements(editor: EditorCore): TimelineSpeechElement[] {
	const tracks = editor.timeline.getTracks();
	const mediaAssets = editor.media.getAssets();
	const speechElements: TimelineSpeechElement[] = [];

	for (const track of tracks) {
		if (track.type === "video") {
			for (const el of track.elements) {
				const videoEl = el as VideoElement;
				const asset = mediaAssets.find((a) => a.id === videoEl.mediaId);
				const path = asset?.filePath ?? asset?.url;
				if (path) {
					speechElements.push({
						filePath: path,
						timelineStart: videoEl.startTime,
						trimStart: videoEl.trimStart,
						duration: videoEl.duration,
					});
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

	return speechElements;
}

function dataUrlToFile(dataUrl: string, name: string, mime: string): File {
	const comma = dataUrl.indexOf(",");
	if (comma === -1) throw new Error("Invalid data URL");
	const binary = atob(dataUrl.slice(comma + 1));
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return new File([bytes], name, { type: mime });
}

/** Build a small audio upload for Whisper — extract via FFmpeg when possible. */
async function buildTranscribeFile(elem: TimelineSpeechElement): Promise<File> {
	if (elem.filePath.startsWith("blob:") || elem.filePath.startsWith("http")) {
		const resp = await fetch(elem.filePath);
		const blob = await resp.blob();
		return new File([blob], "audio.mp4", { type: blob.type || "video/mp4" });
	}

	const { invoke } = await import("@tauri-apps/api/core");
	const sourceId = `caption_${Math.abs(elem.filePath.split("").reduce((a, c) => ((a << 5) - a + c.charCodeAt(0)) | 0, 0))}`;

	try {
		const extracted = await invoke<{ file_path: string; filename: string; duration: number }>(
			"extract_audio_to_file",
			{
				videoPath: elem.filePath,
				sourceId,
				trimStart: elem.trimStart,
				trimDuration: elem.duration,
			},
		);

		if (extracted?.file_path) {
			const dataUrl = await invoke<string>("read_file_as_data_url", {
				filePath: extracted.file_path,
			});
			return dataUrlToFile(dataUrl, extracted.filename || "audio.mp3", "audio/mpeg");
		}
	} catch (err) {
		console.warn("[transcribe-timeline-audio] FFmpeg extract failed, falling back to video stream:", err);
	}

	let port = 8642;
	try {
		port = await invoke<number>("get_video_server_port");
	} catch {
		/* default port */
	}
	const serverUrl = `http://localhost:${port}/video/${utf8ToBase64Url(elem.filePath)}`;
	const resp = await fetch(serverUrl);
	if (!resp.ok) throw new Error(`Video server returned ${resp.status} for ${elem.filePath}`);
	const blob = await resp.blob();
	return new File([blob], "audio.mp4", { type: blob.type || "video/mp4" });
}

/**
 * Transcribe timeline speech elements. Uses local FFmpeg audio extraction
 * (trimmed to clip duration) instead of uploading full video files.
 */
export async function transcribeTimelineSpeechElements(
	elements: TimelineSpeechElement[],
	projectId: string,
	onProgress?: (step: string) => void,
): Promise<TranscriptWordResult[]> {
	const { parseTranscriptToWords } = await import("@/utils/timelineUtils");
	const api = (await import("@/services/api")).default;
	let allWords: TranscriptWordResult[] = [];

	for (let i = 0; i < elements.length; i++) {
		const elem = elements[i];
		onProgress?.(`Extracting audio ${i + 1}/${elements.length}…`);

		try {
			const file = await buildTranscribeFile(elem);
			onProgress?.(`Transcribing ${i + 1}/${elements.length}…`);

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
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			console.warn("[transcribe-timeline-audio] Failed element:", msg);
		}
	}

	allWords.sort((a, b) => a.start - b.start);
	return allWords.filter((w, i, arr) => {
		if (i === 0) return true;
		return !(Math.abs(w.start - arr[i - 1].start) < 0.01 && w.word === arr[i - 1].word);
	});
}
