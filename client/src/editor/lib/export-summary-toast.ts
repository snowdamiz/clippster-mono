import { useToast } from "@/composables/useToast";

export type ExportTranscriptSummary = "success" | "already" | "no_audio" | "failed" | "skipped";

export function showExportSummaryToast(parts: {
	exportOk: boolean;
	builtClips?: "registered" | "failed" | "skipped";
	transcript?: ExportTranscriptSummary;
	transcriptError?: string;
	/** Optional extra line (e.g. user-chosen save path). */
	extra?: string;
}): void {
	const { showToast } = useToast();
	const lines: string[] = [];
	if (parts.exportOk) {
		lines.push("Export finished");
	} else {
		lines.push("Export did not complete");
	}
	if (parts.builtClips === "registered") {
		lines.push("Saved to Built Clips");
	} else if (parts.builtClips === "failed") {
		lines.push("Built Clips registration failed (file is still on disk)");
	}
	switch (parts.transcript) {
		case "success":
			lines.push("Transcript: generated");
			break;
		case "already":
			lines.push("Transcript: already present");
			break;
		case "no_audio":
			lines.push("Transcript: skipped (no audio)");
			break;
		case "failed":
			lines.push(`Transcript: failed${parts.transcriptError ? ` — ${parts.transcriptError}` : ""}`);
			break;
		case "skipped":
		default:
			break;
	}
	if (parts.extra) {
		lines.push(parts.extra);
	}
	showToast(lines.join(" · "), parts.exportOk ? "success" : "error", "projects");
}
