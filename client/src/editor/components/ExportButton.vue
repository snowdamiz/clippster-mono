<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useEditor } from "../composables/useEditor";
import { useExportDialog } from "../composables/useExportDialog";
import type { ExportTranscriptSummary } from "../lib/export-summary-toast";
import {
	getConfiguredFramingConfigs,
	isManualFramingConfigConfigured,
	pairExportVariants,
} from "../lib/export-framing";
import {
	Download,
	X,
	RotateCcw,
	Copy,
	Check,
	Sparkles,
	PencilRuler,
	ChevronRight,
	CropIcon,
	Trash2,
	Megaphone,
	Share2,
} from "lucide-vue-next";
import ManualPOIEditor from "../../components/poi/ManualPOIEditor.vue";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { SectionHeader } from "@/components/ui/section-header";
import ExportOptionGroup from "./export/ExportOptionGroup.vue";
import ExportProgress from "./export/ExportProgress.vue";
import ExportResult from "./export/ExportResult.vue";
import ExportChoiceTile from "./export/ExportChoiceTile.vue";
import SimplifiedPublishDialog from "../../components/SimplifiedPublishDialog.vue";
import type { ManualFramingConfig, ManualFramingConfigs } from "@/types";
import type { Campaign } from "@/services/campaignApi";
import type { Clip, ClipBuild } from "@/services/database";

type ClipWithBuilds = Clip & { builds: ClipBuild[] };

const { editor, version } = useEditor({
	subscribe: {
		project: true,
		timeline: true,
		media: true,
		playback: false,
		scenes: false,
		selection: false,
	},
});
const { isOpen, exportTimeRange, exportSegmentName, openExportDialog, closeExportDialog } = useExportDialog();
const format = ref<"mp4" | "webm">("mp4");
const quality = ref<"low" | "medium" | "high" | "very_high">("high");
const frameRate = ref<30 | 60>(30);
const isExporting = ref(false);
const progress = ref(0);
const exportError = ref<string | null>(null);
const copied = ref(false);
const cancelRequested = ref(false);
const currentExportId = ref<string | null>(null);
const exportedPath = ref<string | null>(null);
const exportedVariants = ref<Array<{ ratio: string; path: string }>>([]);
const showSuccess = ref(false);
const showPublishDialog = ref(false);
const publishClip = ref<ClipWithBuilds | null>(null);
const publishBuild = ref<ClipBuild | null>(null);
const publishThumbnailUrl = ref<string | null>(null);

const hasProject = computed(() => {
	void version.value;
	return !!editor.project.getActiveOrNull();
});

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull();
});

const projectName = computed(() => activeProject.value?.metadata.name || "Untitled Project");

const projectDuration = computed(() => {
	void version.value;
	if (exportTimeRange.value) {
		return exportTimeRange.value.endTime - exportTimeRange.value.startTime;
	}
	try {
		return editor.timeline.getTotalDuration();
	} catch {
		return 0;
	}
});

const exportDialogSubtitle = computed(() => {
	const duration = formatDuration(projectDuration.value);
	if (exportTimeRange.value) {
		const label = exportSegmentName.value?.trim() || "Selected segment";
		return `${label} \u2022 ${duration}`;
	}
	return `${projectName.value} \u2022 ${duration}`;
});

const exportDialogTitle = computed(() =>
	exportTimeRange.value ? "Export segment" : "Export video",
);

function handleOpenExportDialog() {
	// Always export the full timeline from the header Export button.
	// Per-segment export is available from the timeline context menu.
	openExportDialog();
}

const exportOutputFileName = computed(() => exportSegmentName.value?.trim() || null);

function formatDuration(seconds: number): string {
	if (!seconds) return "0:00";
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, "0")}`;
}

const qualityHint = computed(() => {
	switch (quality.value) {
		case "low": return "Fast export, smaller file size";
		case "medium": return "Balanced quality and file size";
		case "high": return "Best quality, recommended";
		case "very_high": return "Maximum quality, largest file size";
		default: return "";
	}
});

const formatHint = computed(() => {
	return format.value === "mp4"
		? "Best compatibility across all platforms"
		: "Smaller file size, modern browsers";
});

const fpsHint = computed(() => {
	return frameRate.value === 30
		? "Standard for most platforms"
		: "Smoother motion for fast-paced content";
});

// Aspect ratio presets for export
const aspectPresets = [
	{ width: 1920, height: 1080, label: "16:9", platforms: "YouTube \u2022 Twitch" },
	{ width: 1080, height: 1920, label: "9:16", platforms: "TikTok \u2022 Reels" },
	{ width: 1080, height: 1080, label: "1:1", platforms: "Instagram Feed" },
	{ width: 1080, height: 1350, label: "4:5", platforms: "Instagram Post" },
];

const projectCanvasSize = computed(() => activeProject.value?.settings?.canvasSize ?? { width: 1920, height: 1080 });

const projectAspectLabel = computed(() => {
	const w = projectCanvasSize.value.width;
	const h = projectCanvasSize.value.height;
	const match = aspectPresets.find((p) => p.width === w && p.height === h);
	return match?.label ?? `${w}\u00d7${h}`;
});

const isProjectLandscape = computed(() => {
	return projectCanvasSize.value.width > projectCanvasSize.value.height;
});

// Multi-select aspect ratios (like ClipBuildSettingsDialog)
const selectedRatios = ref<string[]>(["16:9"]);
const framingMode = ref<"auto" | "manual">("manual");

// Manual framing configs per aspect ratio
const manualFramingConfigs = ref<ManualFramingConfigs>({});
const showManualPOIEditor = ref(false);
const editingAspectRatio = ref<string>("9:16");

// Video frame for POI editor
const videoFrameUrl = ref<string | null>(null);
const loadingVideoFrame = ref(false);
const firstVideoPath = ref<string | null>(null);

// Check if portrait ratios are selected
const hasPortraitRatio = computed(() => {
	const portraitRatios = ["9:16", "4:5", "1:1"];
	return selectedRatios.value.some((r) => portraitRatios.includes(r));
});

// Selected portrait ratios that need framing config
const selectedPortraitRatios = computed(() => {
	const portraitRatios = ["9:16", "4:5", "1:1"];
	return selectedRatios.value.filter((r) => portraitRatios.includes(r));
});

// Export canvas size (uses project canvas for now; actual per-ratio export handled by export pipeline)
const exportCanvasSize = computed(() => {
	return projectCanvasSize.value;
});

// Campaign selection state
const isForCampaign = ref(false);
const availableCampaigns = ref<Campaign[]>([]);
const selectedCampaign = ref<Campaign | null>(null);
const loadingCampaigns = ref(false);
const sourceClipId = ref<string | null>(null);
const creatorProfileServerId = ref<number | null>(null);

// Steps: platforms -> framing (conditional) -> campaign (conditional) -> settings
type ExportStep = "platforms" | "framing" | "campaign" | "settings";
const currentStep = ref<ExportStep>("settings");

const visibleSteps = computed(() => {
	const steps: ExportStep[] = ["platforms"];
	if (hasPortraitRatio.value) steps.push("framing");
	if (availableCampaigns.value.length > 0) steps.push("campaign");
	steps.push("settings");
	return steps;
});

const currentStepIndex = computed(() => visibleSteps.value.indexOf(currentStep.value));

function nextStep() {
	const idx = currentStepIndex.value;
	if (idx < visibleSteps.value.length - 1) {
		currentStep.value = visibleSteps.value[idx + 1];
	}
}

function previousStep() {
	const idx = currentStepIndex.value;
	if (idx > 0) {
		currentStep.value = visibleSteps.value[idx - 1];
	}
}

const isFirstStep = computed(() => currentStepIndex.value === 0);
const isLastStep = computed(() => currentStepIndex.value === visibleSteps.value.length - 1);

// Toggle aspect ratio selection
function toggleRatio(ratio: string) {
	const idx = selectedRatios.value.indexOf(ratio);
	if (idx >= 0) {
		selectedRatios.value = selectedRatios.value.filter((r) => r !== ratio);
	} else {
		selectedRatios.value = [...selectedRatios.value, ratio];
	}
}

// Manual framing helpers
function isRatioConfigured(ratio: string): boolean {
	const config = manualFramingConfigs.value[ratio as keyof ManualFramingConfigs];
	return isManualFramingConfigConfigured(config);
}

function getConfigForRatio(ratio: string): ManualFramingConfig | null {
	return manualFramingConfigs.value[ratio as keyof ManualFramingConfigs] || null;
}

function openPOIEditorForRatio(ratio: string) {
	editingAspectRatio.value = ratio;
	showManualPOIEditor.value = true;
}

function onManualConfigConfirm(config: ManualFramingConfig) {
	manualFramingConfigs.value = {
		...manualFramingConfigs.value,
		[editingAspectRatio.value]: config,
	};
	showManualPOIEditor.value = false;
}

// Campaign selection helpers
function toggleIsForCampaign() {
	isForCampaign.value = !isForCampaign.value;
	if (!isForCampaign.value) {
		selectedCampaign.value = null;
	}
}

function selectCampaign(campaign: Campaign) {
	selectedCampaign.value = campaign;
}

const campaignBadgeText = computed(() => {
	if (!selectedCampaign.value) return "None";
	const c = selectedCampaign.value;
	if (c.creator_profile_id === null) return "Global";
	return c.creator_profile?.name || "Campaign";
});

// Load video frame for POI editor preview
async function loadVideoFrame() {
	if (loadingVideoFrame.value) return;

	// Find the first video asset in the project
	const assets = editor.media.getAssets();
	const videoAsset = assets.find((a) => a.type === "video" && a.filePath);
	if (!videoAsset?.filePath) return;

	firstVideoPath.value = videoAsset.filePath;
	loadingVideoFrame.value = true;

	try {
		const { invoke } = await import("@tauri-apps/api/core");
		const thumbnailPath = await invoke<string>("generate_thumbnail_at_timestamp", {
			videoPath: videoAsset.filePath,
			timestampSeconds: 1,
			outputFilename: `poi_editor_preview`,
		});
		const dataUrl = await invoke<string>("read_file_as_data_url", {
			filePath: thumbnailPath,
		});
		videoFrameUrl.value = dataUrl;
	} catch (error) {
		console.warn("[ExportButton] Failed to load video frame:", error);
	} finally {
		loadingVideoFrame.value = false;
	}
}

// Load available campaigns for the source clip
async function loadAvailableCampaigns() {
	const project = activeProject.value;
	if (!project) return;

	loadingCampaigns.value = true;
	availableCampaigns.value = [];
	sourceClipId.value = null;
	creatorProfileServerId.value = null;

	try {
		// Get the source clip from video_editor_sources
		const { getVideoEditorSourcesByProjectId } = await import("@/services/database/video-editor-projects");
		const sources = await getVideoEditorSourcesByProjectId(project.metadata.id);
		const clipSource = sources.find((s) => s.source_type === "clip" && s.source_id);
		
		if (!clipSource?.source_id) {
			console.log("[ExportButton] No clip source found, skipping campaign fetch");
			return;
		}

		sourceClipId.value = clipSource.source_id;

		// Get the clip to find its creator profile
		const { getClip } = await import("@/services/database");
		const clip = await getClip(clipSource.source_id);
		
		if (clip?.project_id) {
			// Read-only: org-streamer match for campaign API (do not use resolveBrandingProfile — it persists auto-selection).
			const { resolveApplicableProfiles } = await import("@/composables/useBrandingProfileSelection");
			const candidates = await resolveApplicableProfiles(clip.project_id);
			const orgStreamer = candidates.find((c) => c.source === "org-streamer");
			if (
				orgStreamer?.profile?.id &&
				!orgStreamer.profile.id.startsWith("campaign-")
			) {
				const serverId = parseInt(orgStreamer.profile.id, 10);
				if (!isNaN(serverId)) {
					creatorProfileServerId.value = serverId;
				}
			}
		}

		// Fetch campaigns (global branding + creator-profile-specific)
		const { getMyGlobalBrandingCampaigns, getCampaignsByCreatorProfile } = await import("@/services/campaignApi");
		const results: Campaign[] = [];

		// 1. Fetch global branding campaigns (work with ANY VOD)
		const globalRes = await getMyGlobalBrandingCampaigns();
		if (globalRes.success && globalRes.campaigns) {
			results.push(...globalRes.campaigns);
		}

		// 2. If this clip has a creator profile, also fetch campaigns for that profile
		if (creatorProfileServerId.value) {
			const profileRes = await getCampaignsByCreatorProfile(creatorProfileServerId.value);
			if (profileRes.success && profileRes.campaigns) {
				// Add campaigns not already in list (no duplicates)
				for (const c of profileRes.campaigns) {
					if (!results.find((r) => r.id === c.id)) {
						results.push(c);
					}
				}
			}
		}

		availableCampaigns.value = results;
		console.log("[ExportButton] Loaded campaigns:", availableCampaigns.value.length);
	} catch (error) {
		console.error("[ExportButton] Failed to load campaigns:", error);
	} finally {
		loadingCampaigns.value = false;
	}
}

// Reset state when dialog opens
watch(isOpen, async (open) => {
	if (open) {
		exportError.value = null;
		progress.value = 0;
		copied.value = false;
		cancelRequested.value = false;
		showSuccess.value = false;
		exportedPath.value = null;
		exportedVariants.value = [];
		selectedRatios.value = ["16:9"];
		framingMode.value = "manual";
		manualFramingConfigs.value = {};
		videoFrameUrl.value = null;
		firstVideoPath.value = null;
		isForCampaign.value = false;
		selectedCampaign.value = null;
		currentStep.value = isProjectLandscape.value ? "platforms" : "settings";

		if (isProjectLandscape.value) {
			await loadVideoFrame();
		}
		
		// Load campaigns in background
		loadAvailableCampaigns();
	}
});

// If framing step becomes hidden while on it, skip to settings
watch(hasPortraitRatio, (show) => {
	if (!show && currentStep.value === "framing") {
		currentStep.value = "settings";
	}
});

async function handleExport() {
	const project = activeProject.value;
	if (!project) return;
	const portraitRatios = selectedPortraitRatios.value;
	const missingFramingRatio = portraitRatios.find((ratio) => !isRatioConfigured(ratio));
	if (missingFramingRatio) {
		exportError.value = `Configure manual framing for ${missingFramingRatio} before exporting.`;
		return;
	}

	// Free tier: 1 export/day limit
	const { useAuthStore } = await import("@/stores/auth");
	const _authStore = useAuthStore();
	const _user = _authStore.user;
	const { useSubscription } = await import("@/composables/useSubscription");
	const { fetchSubscriptionStatus } = useSubscription();
	await fetchSubscriptionStatus();
	const _isFree = _user && !_user.is_admin && !_user.created_by_organization_id &&
		(!(_user as any).subscription_status || (_user as any).subscription_status === "none" || (_user as any).subscription_status === "expired");
	if (_isFree) {
		const { getUsageCount, recordUsage } = await import("@/services/database/free-tier-usage");
		const FREE_LIMIT = 1;
		const used = await getUsageCount(String(_user.id), "editor_export");
		if (used >= FREE_LIMIT) {
			exportError.value = "Daily export limit reached (1/day on free plan). Upgrade for unlimited exports.";
			return;
		}
		await recordUsage(String(_user.id), "editor_export");
	}

	cancelRequested.value = false;
	const exportId = `editor-export-${Date.now()}-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`;
	currentExportId.value = exportId;
	isExporting.value = true;
	progress.value = 0;
	exportError.value = null;

	// ── Campaign Branding Application ────────────────────────────────────────
	if (isForCampaign.value && selectedCampaign.value) {
		try {
			console.log("[ExportButton] Applying campaign branding:", selectedCampaign.value.title);
			const campaign = selectedCampaign.value;
			const { invoke } = await import("@tauri-apps/api/core");

			// Download and add intro if campaign has one
			if (campaign.global_intro) {
				try {
					const introResult = await invoke<{ success: boolean; filePath: string }>("download_campaign_asset", {
						assetUrl: campaign.global_intro.url,
						assetId: `org-asset-${campaign.global_intro.id}`,
						assetType: "intro",
					});

					if (introResult.success && introResult.filePath) {
						// Add intro video to the beginning of the timeline (track 0)
						const introDuration = campaign.global_intro.duration ? parseFloat(campaign.global_intro.duration) : 3;
						const introElement: any = {
							type: "video" as const,
							name: "Campaign Intro",
							trackIndex: 0,
							startTime: 0,
							duration: introDuration,
							mediaId: introResult.filePath,
							trimStart: 0,
							trimEnd: introDuration,
							transform: { scale: 1, rotation: 0 },
							opacity: 1,
						};
						const tracks = editor.timeline.getTracks();
						const videoTrack = tracks.find(t => t.type === "video");
						if (videoTrack) {
							editor.timeline.insertElement({ element: introElement, placement: { mode: "explicit", trackId: videoTrack.id } });
						}
						console.log("[ExportButton] Added campaign intro");
					}
				} catch (err) {
					console.warn("[ExportButton] Failed to add campaign intro:", err);
				}
			}

			// Download and add outro if campaign has one
			if (campaign.global_outro) {
				try {
					const outroResult = await invoke<{ success: boolean; filePath: string }>("download_campaign_asset", {
						assetUrl: campaign.global_outro.url,
						assetId: `org-asset-${campaign.global_outro.id}`,
						assetType: "outro",
					});

					if (outroResult.success && outroResult.filePath) {
						// Add outro video to the end of the timeline (track 0)
						const outroDuration = campaign.global_outro.duration ? parseFloat(campaign.global_outro.duration) : 3;
						const outroElement: any = {
							type: "video" as const,
							name: "Campaign Outro",
							trackIndex: 0,
							startTime: 0,
							duration: outroDuration,
							mediaId: outroResult.filePath,
							trimStart: 0,
							trimEnd: outroDuration,
							transform: { scale: 1, rotation: 0 },
							opacity: 1,
						};
						const tracks = editor.timeline.getTracks();
						const videoTrack = tracks.find(t => t.type === "video");
						if (videoTrack) {
							editor.timeline.insertElement({ element: outroElement, placement: { mode: "explicit", trackId: videoTrack.id } });
						}
						console.log("[ExportButton] Added campaign outro");
					}
				} catch (err) {
					console.warn("[ExportButton] Failed to add campaign outro:", err);
				}
			}

			// Add watermark if campaign has one (via creator profile)
			if (campaign.creator_profile?.watermark_settings) {
				try {
					const watermarkSettings = campaign.creator_profile.watermark_settings;
					if (watermarkSettings.watermark_id) {
						const { getWatermarkImage } = await import("@/services/database/watermarks");
						const watermark = await getWatermarkImage(String(watermarkSettings.watermark_id));
						if (watermark?.file_path) {
							// Add watermark as image element on overlay track
							const position = String(watermarkSettings.position || "bottom-right");
							const watermarkElement: any = {
								type: "image" as const,
								name: "Campaign Watermark",
								trackIndex: 1,
								startTime: 0,
								duration: 999999,
								mediaId: watermark.file_path,
								trimStart: 0,
								trimEnd: 999999,
								transform: {
									scale: Number(watermarkSettings.scale) || 0.15,
									rotation: 0,
								},
								position: {
									x: position.includes("right") ? 200 : -200,
									y: position.includes("bottom") ? 150 : -150,
								},
								opacity: Number(watermarkSettings.opacity) || 0.8,
							};
							// Use auto placement for watermark (will create appropriate track)
							editor.timeline.insertElement({ element: watermarkElement, placement: { mode: "auto" } });
							console.log("[ExportButton] Added campaign watermark");
						}
					}
				} catch (err) {
					console.warn("[ExportButton] Failed to add campaign watermark:", err);
				}
			}
		} catch (err) {
			console.error("[ExportButton] Campaign branding failed:", err);
			// Continue with export even if branding fails
		}
	}
	// ── End Campaign Branding Application ───────────────────────────────────

	try {
		const result = await editor.project.export({
			options: {
				format: format.value,
				quality: quality.value,
				fps: frameRate.value,
				includeAudio: true,
				canvasSize: exportCanvasSize.value,
				timeRange: exportTimeRange.value ?? undefined,
				outputFileName: exportOutputFileName.value ?? undefined,
				onProgress: (p: { progress: number }) => {
					progress.value = portraitRatios.length > 0 ? p.progress * 0.75 : p.progress;
				},
				onCancel: () => cancelRequested.value,
				exportId,
			},
		});

		currentExportId.value = null;

		if (result.cancelled) {
			isExporting.value = false;
			progress.value = 0;
			return;
		}

		if (result.success) {
			exportedPath.value = result.outputPath || null;
			exportedVariants.value = [];

			if (result.outputPath && portraitRatios.length > 0) {
				progress.value = 0.78;
				const { invoke } = await import("@tauri-apps/api/core");
				const configs = getConfiguredFramingConfigs(
					portraitRatios,
					manualFramingConfigs.value,
				);
				const variantPaths = await invoke<string[]>("build_editor_export_variants", {
					videoPath: result.outputPath,
					duration: projectDuration.value,
					aspectRatios: portraitRatios,
					manualFramingConfigs: configs,
					quality: quality.value,
					frameRate: frameRate.value,
				});
				exportedVariants.value = pairExportVariants(portraitRatios, variantPaths);
				progress.value = 0.98;
			}

			isExporting.value = false;
			showSuccess.value = true;
			progress.value = 0;

			if (result.outputPath) {
				const { registerEditorExportBuild } = await import("../services/registerEditorExportBuild");
				const { showExportSummaryToast } = await import("../lib/export-summary-toast");

				let built: "registered" | "failed" | "skipped" = "skipped";
				let transcript: ExportTranscriptSummary = "skipped";

				try {
					const reg = await registerEditorExportBuild({
						outputPath: result.outputPath,
						exportedDuration: projectDuration.value,
						projectId: project.metadata.id,
						projectName: exportOutputFileName.value ?? project.metadata.name,
						buildOptions: {
							aspectLabel: projectAspectLabel.value,
							quality: quality.value,
							frameRate: frameRate.value,
							format: format.value,
							isForCampaign: isForCampaign.value,
							campaign: selectedCampaign.value
								? {
										id: String(selectedCampaign.value.id),
										title: selectedCampaign.value.title,
										organization: selectedCampaign.value.organization
											? {
													id: String(selectedCampaign.value.organization.id),
													name: selectedCampaign.value.organization.name,
												}
											: undefined,
									}
								: null,
						},
					});

					if (reg?.mode === "clip_build" || reg?.mode === "standalone_clip") {
						built = "registered";
					}
					if (reg?.mode === "clip_build") {
						transcript = await transcribeExportedVideo(reg.clipId, result.outputPath, {
							suppressToasts: true,
						});
						await loadPublishData(reg.clipId, result.outputPath);
					}
				} catch (e) {
					console.warn("[ExportButton] Built Clips registration failed:", e);
					built = "failed";
				}

				showExportSummaryToast({
					exportOk: true,
					builtClips: built,
					transcript,
				});
			}
		} else {
			isExporting.value = false;
			exportError.value = result.error || "Unknown error occurred";
		}
	} catch (err) {
		isExporting.value = false;
		currentExportId.value = null;
		exportError.value = err instanceof Error ? err.message : "Export failed";
	}
}

function handleCancel() {
	cancelRequested.value = true;
	const exportId = currentExportId.value;
	if (!exportId) return;

	import("@tauri-apps/api/core")
		.then(({ invoke }) => invoke("cancel_video_editor_export", { exportId }))
		.catch((err) => console.warn("[ExportButton] Failed to cancel export:", err));
}

function handleClose() {
	if (!isExporting.value) {
		closeExportDialog();
		exportError.value = null;
		progress.value = 0;
		showSuccess.value = false;
		exportedPath.value = null;
		exportedVariants.value = [];
	}
}

async function handleDownload(sourcePath = exportedPath.value) {
	if (!sourcePath) return;

	try {
		const { save } = await import("@tauri-apps/plugin-dialog");
		const { invoke } = await import("@tauri-apps/api/core");

		// Prefer segment title for save-as default; otherwise use the exported file name.
		const extension = sourcePath.split(".").pop()?.toLowerCase() || format.value;
		const filename = sourcePath.split(/[\\/]/).pop() || `export.${extension}`;

		// Show save dialog
		const savePath = await save({
			defaultPath: filename,
			filters: [{
				name: "Video",
				extensions: [extension],
			}],
		});

		if (savePath) {
			// Copy file to selected location using the same command as clip building
			await invoke("copy_clip_to_destination", {
				sourcePath,
				destinationPath: savePath,
			});
			
			console.log("[ExportButton] File saved to:", savePath);
			
			// Show success toast
			const { useToast } = await import("@/composables/useToast");
			const { showToast } = useToast();
			showToast(`Video saved to ${savePath}`, "success", "projects");
			
			// Keep dialog open - user can download multiple times or clean up project
		}
		// If user cancels the save dialog, stay on current screen
	} catch (err) {
		console.error("[ExportButton] Download failed:", err);
		const { useToast } = await import("@/composables/useToast");
		const { showToast } = useToast();
		showToast(err instanceof Error ? err.message : "Failed to save file", "error", "projects");
	}
}

async function transcribeExportedVideo(
	clipId: string,
	videoPath: string,
	opts?: { suppressToasts?: boolean },
): Promise<ExportTranscriptSummary> {
	const silent = opts?.suppressToasts ?? false;
	let tempProjectId: string | null = null;
	let tempRawVideoId: string | null = null;
	try {
		console.log("[ExportButton] Starting background transcription for exported video:", clipId, videoPath);

		const { useTranscriptionOnly } = await import("@/composables/useTranscriptionOnly");
		const { createProject, createRawVideo } = await import("@/services/database");
		const { getClipWithBuildStatus } = await import("@/services/database/clip-build");
		const { useToast } = await import("@/composables/useToast");
		const { invoke } = await import("@tauri-apps/api/core");
		const { showToast } = useToast();

		const clip = await getClipWithBuildStatus(clipId);
		if (!clip) {
			console.warn("[ExportButton] Could not find clip for transcription");
			return "skipped";
		}

		const transcriptTargetProjectId = activeProject.value?.metadata.id ?? clip.project_id ?? null;

		try {
			const fileExists = await invoke<boolean>("file_exists", { path: videoPath });
			if (!fileExists) {
				throw new Error("Exported video file not found at: " + videoPath);
			}
			console.log("[ExportButton] Verified exported file exists:", videoPath);
		} catch (err) {
			console.error("[ExportButton] Failed to verify exported file:", err);
			throw new Error("Cannot access exported video file");
		}

		tempProjectId = await createProject(
			`Export Transcript - ${clip.name || "Untitled"}`,
			`Temporary project for transcribing exported video`,
		);

		console.log("[ExportButton] Created temp project:", tempProjectId);

		let videoDuration = clip.built_duration || clip.duration || 0;
		try {
			const metadata = await invoke<{ duration: number }>("get_video_metadata", {
				path: videoPath,
			});
			videoDuration = metadata.duration;
			console.log("[ExportButton] Got video duration:", videoDuration);
		} catch (err) {
			console.warn("[ExportButton] Failed to get video duration, using clip duration:", err);
		}

		tempRawVideoId = await createRawVideo(videoPath, {
			projectId: tempProjectId,
			originalFilename: videoPath.split(/[\\/]/).pop() || "export.mp4",
			duration: videoDuration,
		});

		console.log("[ExportButton] Created raw_video entry:", tempRawVideoId);

		if (!silent) {
			showToast("Generating transcript for exported video...", "info", "clips");
		}

		const { transcribeProject } = useTranscriptionOnly({
			showSuccessToast: false,
			showErrorToast: false,
			showChunkCompletionToast: false,
			showCacheReuseToast: false,
		});
		const result = await transcribeProject(tempProjectId, {
			organizationId: null,
		});

		if (result.success && !result.alreadyTranscribed) {
			console.log("[ExportButton] Background transcription completed for clip:", clipId);
			await copyTranscriptToClip(clipId, tempProjectId, transcriptTargetProjectId);
			if (!silent) {
				showToast("Transcript generated successfully", "success", "clips");
			}
			return "success";
		}
		if (result.alreadyTranscribed) {
			console.log("[ExportButton] Transcript already exists");
			if (!silent) {
				showToast("Transcript already exists", "info", "clips");
			}
			return "already";
		}
		const errorMsg = result.error || "";
		if (errorMsg.includes("No audio chunks") || errorMsg.includes("no audio")) {
			console.log("[ExportButton] Video has no audio track - skipping transcription");
			if (!silent) {
				showToast("Export complete - video has no audio to transcribe", "info", "clips");
			}
			return "no_audio";
		}
		throw new Error(result.error || "Transcription failed");
	} catch (error) {
		console.error("[ExportButton] Background transcription error:", error);
		if (!silent) {
			const { useToast } = await import("@/composables/useToast");
			const { showToast } = useToast();
			showToast(
				"Transcription failed: " + (error instanceof Error ? error.message : String(error)),
				"error",
				"clips",
			);
		}
		return "failed";
	} finally {
		if (tempRawVideoId || tempProjectId) {
			try {
				const { deleteRawVideo, deleteProject } = await import("@/services/database");
				if (tempRawVideoId) {
					await deleteRawVideo(tempRawVideoId);
				}
				if (tempProjectId) {
					await deleteProject(tempProjectId);
				}
			} catch (cleanupError) {
				console.warn("[ExportButton] Failed to clean up temp transcription project:", cleanupError);
			}
		}
	}
}

async function copyTranscriptToClip(clipId: string, tempProjectId: string, targetProjectId: string | null) {
	try {
		const { getTranscriptByProjectId, createTranscript, createTranscriptSegment, getRawVideosByProjectId } = await import("@/services/database");
		
		// Get transcript from temp project
		const tempTranscript = await getTranscriptByProjectId(tempProjectId);
		if (!tempTranscript) {
			console.warn("[ExportButton] No transcript found in temp project");
			return;
		}

		// Get the target project's raw video (or use the clip's project if it exists)
		if (!targetProjectId) {
			console.warn("[ExportButton] No target project for transcript");
			return;
		}

		const targetRawVideos = await getRawVideosByProjectId(targetProjectId);
		if (targetRawVideos.length === 0) {
			console.warn("[ExportButton] No raw videos in target project");
			return;
		}

		// Create transcript in target project
		const newTranscriptId = await createTranscript(
			targetRawVideos[0].id,
			tempTranscript.raw_json,
			tempTranscript.text,
			tempTranscript.language || 'en',
			tempTranscript.duration || undefined
		);

		// Copy all transcript segments
		const { getTranscriptSegments } = await import("@/services/database");
		const segments = await getTranscriptSegments(tempTranscript.id);
		
		for (let i = 0; i < segments.length; i++) {
			const segment = segments[i];
			await createTranscriptSegment(
				newTranscriptId,
				segment.start_time,
				segment.end_time,
				segment.text,
				i,
				undefined
			);
		}

		console.log("[ExportButton] Copied transcript to target project:", targetProjectId);
	} catch (error) {
		console.error("[ExportButton] Failed to copy transcript:", error);
	}
}

async function handleCleanupProject() {
	const project = activeProject.value;
	if (!project) return;

	// Show confirmation dialog
	const confirmed = await confirm(
		"Close and Remove Editor Project?\n\nThis will close this project in the video editor and permanently remove its editable project files. After this, it can no longer be modified in the video editor. The exported video will remain in Built Clips."
	);

	if (!confirmed) return;

	try {
		// Delete video editor project and its files
		const { deleteVideoEditorProject } = await import("@/services/database/video-editor-projects");
		const { invoke } = await import("@tauri-apps/api/core");

		// Delete database records (project, sources, edits)
		await deleteVideoEditorProject(project.metadata.id);

		// Delete local files (editor-media/{project_id}/ directory)
		try {
			await invoke("delete_editor_project_media", { projectId: project.metadata.id });
			console.log("[ExportButton] Deleted project media directory for:", project.metadata.id);
		} catch (err) {
			console.warn("[ExportButton] Failed to delete project media directory:", err);
		}

		// Show success toast
		const { useToast } = await import("@/composables/useToast");
		const { showToast } = useToast();
		showToast("Editor project removed", "success", "projects");

		// Close dialog and navigate to video editor projects page
		closeExportDialog();
		const { useRouter } = await import("vue-router");
		const router = useRouter();
		router.push("/video-editor");
	} catch (err) {
		console.error("[ExportButton] Failed to clean up project:", err);
		const { useToast } = await import("@/composables/useToast");
		const { showToast } = useToast();
		showToast(err instanceof Error ? err.message : "Failed to remove editor project", "error", "projects");
	}
}

async function handleCopyError() {
	if (exportError.value) {
		await navigator.clipboard.writeText(exportError.value);
		copied.value = true;
		setTimeout(() => { copied.value = false; }, 1000);
	}
}

async function loadPublishData(clipId: string, exportPath: string) {
	try {
		const { getClipWithBuildStatus, getClipBuilds } = await import("@/services/database/clip-build");
		const { invoke } = await import("@tauri-apps/api/core");
		
		// Load clip data
		const clip = await getClipWithBuildStatus(clipId);
		if (!clip) {
			console.warn("[ExportButton] Could not load clip for publish:", clipId);
			return;
		}
		
		// Load builds for this clip
		const builds = await getClipBuilds(clipId);
		const latestBuild = builds.find(b => b.file_path === exportPath) || builds[0];
		
		if (!latestBuild) {
			console.warn("[ExportButton] Could not find build for exported file:", exportPath);
			return;
		}
		
		// Generate thumbnail for the exported video
		try {
			const thumbnailPath = await invoke<string>("generate_thumbnail_at_timestamp", {
				videoPath: exportPath,
				timestampSeconds: 1,
				outputFilename: `export_publish_thumb_${Date.now()}`,
			});
			const dataUrl = await invoke<string>("read_file_as_data_url", {
				filePath: thumbnailPath,
			});
			publishThumbnailUrl.value = dataUrl;
		} catch (err) {
			console.warn("[ExportButton] Failed to generate thumbnail:", err);
			publishThumbnailUrl.value = null;
		}
		
		// Create ClipWithBuilds object
		publishClip.value = {
			...clip,
			builds: builds,
		};
		publishBuild.value = latestBuild;
		
		console.log("[ExportButton] Loaded publish data:", { clip, build: latestBuild });
	} catch (err) {
		console.error("[ExportButton] Failed to load publish data:", err);
	}
}

function handlePublishNow() {
	if (!publishClip.value || !publishBuild.value || !exportedPath.value) {
		console.warn("[ExportButton] Missing publish data");
		return;
	}
	
	showPublishDialog.value = true;
}
</script>

<template>
	<div class="relative">
		<!-- Export trigger -->
		<Button
			variant="primary"
			size="sm"
			:disabled="!hasProject"
			@click="hasProject && handleOpenExportDialog()"
		>
			<Download />
			Export
		</Button>

		<!-- Export dialog (hidden while the framing editor or publish dialog is on top) -->
		<Modal
			:open="isOpen && hasProject && !showManualPOIEditor && !showPublishDialog"
			:title="exportDialogTitle"
			:description="exportDialogSubtitle"
			:icon="Download"
			size="lg"
			:dismissible="!isExporting"
			:hide-close="isExporting"
			@update:open="(open) => { if (!open) handleClose(); }"
		>
			<!-- Success -->
			<ExportResult
				v-if="showSuccess && exportedPath && !isExporting"
				status="success"
				title="Export complete"
				:message="`${1 + exportedVariants.length} video${exportedVariants.length > 0 ? 's have' : ' has'} been saved to Built Clips.`"
			>
				<div class="flex flex-col gap-2">
					<Button variant="secondary" block class="justify-start" @click="handleDownload()">
						<Download />
						Download {{ projectAspectLabel }}
					</Button>
					<Button
						v-for="variant in exportedVariants"
						:key="variant.ratio"
						variant="secondary"
						block
						class="justify-start"
						@click="handleDownload(variant.path)"
					>
						<Download />
						Download {{ variant.ratio }}
					</Button>
				</div>
				<div class="flex items-center justify-between gap-3 rounded-lg border border-line-subtle bg-surface px-3 py-2.5">
					<p class="text-xs text-fg-muted">Done editing? Remove this editor project to free up space.</p>
					<Button variant="destructive-soft" size="sm" @click="handleCleanupProject">
						<Trash2 />
						Close and remove project
					</Button>
				</div>
			</ExportResult>

			<!-- Error -->
			<ExportResult
				v-else-if="exportError && !isExporting && !showSuccess"
				status="error"
				title="Export failed"
				:message="exportError"
			>
				<div>
					<Button variant="secondary" size="sm" @click="handleCopyError">
						<component :is="copied ? Check : Copy" />
						{{ copied ? "Copied" : "Copy error" }}
					</Button>
				</div>
			</ExportResult>

			<!-- Exporting -->
			<ExportProgress
				v-else-if="isExporting"
				label="Rendering video"
				:value="progress"
				:hint="progress < 0.15 ? 'Preparing overlays…' : progress < 0.5 ? 'Encoding video…' : progress < 0.9 ? 'Finalizing…' : 'Almost done…'"
			/>

			<template v-else>
				<!-- Step indicator (multi-step flow for landscape projects) -->
				<p v-if="isProjectLandscape && visibleSteps.length > 1" class="eyebrow mb-3">
					Step {{ currentStepIndex + 1 }} of {{ visibleSteps.length }}
				</p>

				<!-- Step 1: Platforms (landscape projects only) -->
				<section v-if="isProjectLandscape && currentStep === 'platforms'" class="flex flex-col gap-3">
					<SectionHeader title="Choose formats" description="Export extra aspect ratios for other platforms." />

					<div class="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
						<!-- 16:9 original (always included) -->
						<ExportChoiceTile selected disabled>
							<template #title>
								16:9
								<Badge variant="neutral">Original</Badge>
							</template>
							<template #preview>
								<div class="aspect-video w-16 rounded-sm border border-brand bg-brand-soft" />
							</template>
							{{ aspectPresets[0].platforms }}
						</ExportChoiceTile>

						<ExportChoiceTile
							v-for="preset in aspectPresets.slice(1)"
							:key="preset.label"
							:selected="selectedRatios.includes(preset.label)"
							@click="toggleRatio(preset.label)"
						>
							<template #title>{{ preset.label }}</template>
							<template #preview>
								<div
									:class="[
										'rounded-sm border transition-colors',
										selectedRatios.includes(preset.label) ? 'border-brand bg-brand-soft' : 'border-line-strong bg-surface-hover',
									]"
									:style="{
										aspectRatio: `${preset.width} / ${preset.height}`,
										height: preset.width === preset.height ? '2.5rem' : '3rem',
									}"
								/>
							</template>
							{{ preset.platforms }}
						</ExportChoiceTile>
					</div>

					<p v-if="selectedRatios.length > 0" class="text-xs text-fg-subtle">
						{{ selectedRatios.length }} format{{ selectedRatios.length > 1 ? "s" : "" }} selected
					</p>
				</section>

				<!-- Step 2: Framing (only when portrait ratios are selected) -->
				<section v-else-if="isProjectLandscape && currentStep === 'framing'" class="flex flex-col gap-3">
					<SectionHeader title="Portrait framing" description="Choose how landscape footage is cropped for portrait formats." />

					<div class="grid grid-cols-2 gap-2">
						<ExportChoiceTile disabled>
							<template #title>
								<Sparkles class="size-3.5 text-fg-subtle" />
								Auto
								<Badge variant="neutral">Soon</Badge>
							</template>
							Automatic subject tracking
						</ExportChoiceTile>
						<ExportChoiceTile :selected="framingMode === 'manual'" @click="framingMode = 'manual'">
							<template #title>
								<PencilRuler class="size-3.5" />
								Manual
							</template>
							Set the crop regions for each format
						</ExportChoiceTile>
					</div>

					<div v-if="framingMode === 'manual'" class="flex flex-col gap-1.5">
						<p class="text-xs font-medium text-fg-muted">Configure each format</p>
						<button
							v-for="ratio in selectedPortraitRatios"
							:key="ratio"
							type="button"
							class="flex items-center gap-3 rounded-lg border border-line-subtle bg-surface px-3 py-2 text-left transition-colors hover:border-line hover:bg-surface-hover"
							@click="openPOIEditorForRatio(ratio)"
						>
							<div
								:class="[
									'shrink-0 rounded-sm border',
									isRatioConfigured(ratio) ? 'border-success bg-success-soft' : 'border-line-strong bg-surface-hover',
								]"
								:style="{
									aspectRatio: ratio.replace(':', '/'),
									height: ratio === '1:1' ? '1.25rem' : '1.75rem',
								}"
							/>
							<span class="text-sm font-medium text-fg">{{ ratio }}</span>
							<Badge v-if="isRatioConfigured(ratio)" variant="success" class="ml-auto">
								<Check />
								{{ getConfigForRatio(ratio)?.regions.length }} region{{ getConfigForRatio(ratio)?.regions.length !== 1 ? "s" : "" }}
							</Badge>
							<span v-else class="ml-auto text-xs text-fg-subtle">Not configured</span>
							<ChevronRight class="size-4 shrink-0 text-fg-subtle" />
						</button>
						<p v-if="loadingVideoFrame" class="text-xs text-fg-subtle">Loading video preview…</p>
					</div>
				</section>

				<!-- Step 3: Campaign (conditional) -->
				<section v-else-if="currentStep === 'campaign'" class="flex flex-col gap-3">
					<SectionHeader title="Campaign" description="Optionally export this clip for a campaign." />

					<label class="flex cursor-pointer items-center gap-3 rounded-lg border border-line-subtle bg-surface px-3 py-2.5">
						<Megaphone class="size-4 shrink-0 text-fg-subtle" />
						<span class="flex-1 text-sm text-fg">This clip is for a campaign or organization</span>
						<Switch :model-value="isForCampaign" @update:model-value="toggleIsForCampaign" />
					</label>

					<div v-if="isForCampaign" class="flex flex-col gap-1.5">
						<p class="text-xs font-medium text-fg-muted">Select campaign</p>
						<div class="flex flex-col gap-1">
							<button
								v-for="campaign in availableCampaigns"
								:key="campaign.id"
								type="button"
								role="radio"
								:aria-checked="selectedCampaign?.id === campaign.id"
								:class="[
									'flex items-center gap-3 rounded-lg border px-3 py-2 text-left transition-colors',
									selectedCampaign?.id === campaign.id
										? 'border-brand-line bg-brand-soft'
										: 'border-line-subtle bg-surface hover:border-line hover:bg-surface-hover',
								]"
								@click="selectCampaign(campaign)"
							>
								<span
									:class="[
										'grid size-4 shrink-0 place-items-center rounded-full border',
										selectedCampaign?.id === campaign.id ? 'border-brand' : 'border-line-strong',
									]"
								>
									<span v-if="selectedCampaign?.id === campaign.id" class="size-2 rounded-full bg-brand" />
								</span>
								<span class="flex min-w-0 flex-1 flex-col">
									<span class="truncate text-sm font-medium text-fg">{{ campaign.title }}</span>
									<span class="truncate text-xs text-fg-subtle">{{ campaign.organization?.name }}</span>
								</span>
								<Badge v-if="campaign.creator_profile_id === null" variant="brand">Global branding</Badge>
							</button>
						</div>
						<p v-if="loadingCampaigns" class="text-xs text-fg-subtle">Loading campaigns…</p>
						<p v-else-if="availableCampaigns.length === 0" class="text-xs text-fg-subtle">No campaigns available</p>
					</div>
				</section>

				<!-- Settings (final step, or the only step for non-landscape projects) -->
				<section v-else class="flex flex-col gap-4">
					<ExportOptionGroup
						v-model="quality"
						label="Quality"
						:hint="qualityHint"
						:options="[
							{ value: 'low', label: 'Low' },
							{ value: 'medium', label: 'Medium' },
							{ value: 'high', label: 'High' },
							{ value: 'very_high', label: 'Very high' },
						]"
					/>
					<ExportOptionGroup
						v-model="frameRate"
						label="Frame rate"
						:hint="fpsHint"
						:options="[
							{ value: 30, label: '30 fps' },
							{ value: 60, label: '60 fps' },
						]"
					/>
					<ExportOptionGroup
						v-model="format"
						label="Format"
						:hint="formatHint"
						:options="[
							{ value: 'mp4', label: 'MP4' },
							{ value: 'webm', label: 'WebM' },
						]"
					/>
				</section>
			</template>

			<template #footer>
				<!-- Exporting -->
				<Button v-if="isExporting && currentExportId" variant="secondary" @click="handleCancel">Cancel export</Button>

				<!-- Error -->
				<template v-else-if="exportError && !isExporting">
					<Button variant="ghost" @click="handleClose">Close</Button>
					<Button variant="primary" @click="handleExport">
						<RotateCcw />
						Retry export
					</Button>
				</template>

				<!-- Success -->
				<template v-else-if="showSuccess && !isExporting">
					<Button variant="ghost" @click="handleClose">Close</Button>
					<Button variant="primary" @click="handlePublishNow">
						<Share2 />
						Publish now
					</Button>
				</template>

				<!-- Steps -->
				<template v-else-if="!isExporting">
					<Button v-if="!isFirstStep" variant="ghost" class="mr-auto" @click="previousStep">Back</Button>
					<Button v-if="!isLastStep" variant="primary" @click="nextStep">Next</Button>
					<Button v-else variant="primary" @click="handleExport">
						<Download />
						Export video
					</Button>
				</template>
			</template>
		</Modal>

		<!-- Publish Dialog -->
		<SimplifiedPublishDialog
			v-if="publishClip && publishBuild && exportedPath"
			v-model="showPublishDialog"
			:clip="publishClip"
			:build="publishBuild"
			:file-path="exportedPath"
			:thumbnail-url="publishThumbnailUrl"
			@close="showPublishDialog = false"
		/>

		<!-- Manual POI Editor Dialog -->
		<ManualPOIEditor
			v-model="showManualPOIEditor"
			:initial-config="getConfigForRatio(editingAspectRatio)"
			:target-aspect-ratio="editingAspectRatio"
			:source-aspect-ratio="'16:9'"
			:thumbnail-url="videoFrameUrl"
			:video-path="firstVideoPath"
			:timeline-preview-canvas="editor.getLivePreviewCanvas()"
			:use-timeline-playback="true"
			:clip-start-time="0"
			:clip-end-time="projectDuration"
			@confirm="onManualConfigConfirm"
		/>
	</div>
</template>
