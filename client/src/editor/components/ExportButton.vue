<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useEditor } from "../composables/useEditor";
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
} from "lucide-vue-next";
import ManualPOIEditor from "../../components/poi/ManualPOIEditor.vue";
import type { ManualFramingConfig, ManualFramingConfigs } from "@/types";

const { editor, version } = useEditor();

const isOpen = ref(false);
const format = ref<"mp4" | "webm">("mp4");
const quality = ref<"low" | "medium" | "high" | "very_high">("high");
const frameRate = ref<30 | 60>(30);
const isExporting = ref(false);
const progress = ref(0);
const exportError = ref<string | null>(null);
const copied = ref(false);
const cancelRequested = ref(false);
const exportedPath = ref<string | null>(null);

const hasProject = computed(() => {
	void version.value;
	return !!editor.project.getActive();
});

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActive();
});

const projectName = computed(() => activeProject.value?.metadata.name || "Untitled Project");

const projectDuration = computed(() => {
	void version.value;
	try {
		return editor.timeline.getTotalDuration();
	} catch {
		return 0;
	}
});

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
const framingMode = ref<"auto" | "manual">("auto");

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

// Steps: platforms -> framing (conditional) -> settings
type ExportStep = "platforms" | "framing" | "settings";
const currentStep = ref<ExportStep>("settings");

const visibleSteps = computed(() => {
	const steps: ExportStep[] = ["platforms"];
	if (hasPortraitRatio.value) steps.push("framing");
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
	return config !== undefined && config.regions.length > 0;
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

// Reset state when dialog opens
watch(isOpen, async (open) => {
	if (open) {
		exportError.value = null;
		progress.value = 0;
		copied.value = false;
		cancelRequested.value = false;
		selectedRatios.value = ["16:9"];
		framingMode.value = "auto";
		manualFramingConfigs.value = {};
		videoFrameUrl.value = null;
		firstVideoPath.value = null;
		currentStep.value = isProjectLandscape.value ? "platforms" : "settings";

		if (isProjectLandscape.value) {
			await loadVideoFrame();
		}
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
	isExporting.value = true;
	progress.value = 0;
	exportError.value = null;

	try {
		const result = await editor.project.export({
			options: {
				format: format.value,
				quality: quality.value,
				fps: frameRate.value,
				includeAudio: true,
				canvasSize: exportCanvasSize.value,
				onProgress: (p: { progress: number }) => { progress.value = p.progress; },
				onCancel: () => cancelRequested.value,
			},
		});

		isExporting.value = false;

		if (result.cancelled) {
			progress.value = 0;
			return;
		}

		if (result.success) {
			exportedPath.value = result.outputPath || null;
			isOpen.value = false;
			progress.value = 0;
		} else {
			exportError.value = result.error || "Unknown error occurred";
		}
	} catch (err) {
		isExporting.value = false;
		exportError.value = err instanceof Error ? err.message : "Export failed";
	}
}

function handleCancel() {
	cancelRequested.value = true;
}

function handleClose() {
	if (!isExporting.value) {
		isOpen.value = false;
		exportError.value = null;
		progress.value = 0;
	}
}

async function handleCopyError() {
	if (exportError.value) {
		await navigator.clipboard.writeText(exportError.value);
		copied.value = true;
		setTimeout(() => { copied.value = false; }, 1000);
	}
}
</script>

<template>
	<div class="relative">
		<!-- Export trigger button -->
		<button
			type="button"
			:class="[
				'flex items-center gap-1.5 rounded-md bg-[#38BDF8] px-[0.12rem] py-[0.12rem] text-white',
				hasProject ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
			]"
			:disabled="!hasProject"
			@click="hasProject && (isOpen = true)"
		>
			<div class="relative flex items-center gap-1.5 rounded-[0.6rem] bg-gradient-to-l from-[#2567EC] to-[#37B6F7] px-4 py-1 shadow-[0_1px_3px_0px_rgba(0,0,0,0.65)]">
				<Download class="z-50 size-4" />
				<span class="z-50 text-[0.875rem]">Export</span>
			</div>
		</button>

		<!-- Export Dialog (full modal) -->
		<Teleport to="body">
			<Transition name="modal">
				<div v-if="isOpen && hasProject" class="export-dialog__overlay">
					<Transition name="dialog" appear>
						<div class="export-dialog">
							<!-- Decorative top accent -->
							<div class="export-dialog__accent" />

							<!-- Header -->
							<div class="export-dialog__header">
								<button class="export-dialog__close" @click="handleClose" title="Close" :disabled="isExporting">
									<X :size="18" />
								</button>
								<div class="export-dialog__icon">
									<Download :size="24" />
								</div>
								<h2 class="export-dialog__title">Export Configuration</h2>
								<p class="export-dialog__subtitle">
									{{ projectName }} &bull; {{ formatDuration(projectDuration) }}
								</p>
							</div>

							<!-- Content -->
							<div class="export-dialog__content">
								<!-- Error State -->
								<div v-if="exportError && !isExporting" class="export-dialog__step-content">
									<div class="export-dialog__error-section">
										<div class="export-dialog__error-header">
											<div class="export-dialog__error-icon">
												<X :size="20" />
											</div>
											<h3 class="export-dialog__error-title">Export Failed</h3>
										</div>
										<p class="export-dialog__error-message">{{ exportError }}</p>
										<div class="export-dialog__error-actions">
											<button class="export-dialog__error-btn" @click="handleCopyError">
												<component :is="copied ? Check : Copy" :size="14" />
												{{ copied ? 'Copied' : 'Copy Error' }}
											</button>
											<button class="export-dialog__error-btn export-dialog__error-btn--retry" @click="handleExport">
												<RotateCcw :size="14" />
												Retry Export
											</button>
										</div>
									</div>
								</div>

								<!-- Exporting State -->
								<div v-else-if="isExporting" class="export-dialog__step-content">
									<div class="export-dialog__step-header">
										<h3 class="export-dialog__step-title">Exporting Project</h3>
										<p class="export-dialog__step-subtitle">Please wait while your video is being rendered</p>
									</div>

									<div class="export-dialog__progress-section">
										<div class="export-dialog__progress-header">
											<span class="export-dialog__progress-label">Progress</span>
											<span class="export-dialog__progress-value">{{ Math.round(progress * 100) }}%</span>
										</div>
										<div class="export-dialog__progress-bar">
											<div
												class="export-dialog__progress-fill"
												:style="{ width: `${progress * 100}%` }"
											/>
										</div>
										<p class="export-dialog__progress-hint">
											{{ progress < 0.15 ? 'Preparing overlays...' : progress < 0.5 ? 'Encoding video...' : progress < 0.9 ? 'Finalizing...' : 'Almost done...' }}
										</p>
									</div>
								</div>

								<!-- Step 1: Platforms (only for landscape projects) -->
								<div v-else-if="isProjectLandscape && currentStep === 'platforms'" class="export-dialog__step-content">
									<div class="export-dialog__step-header">
										<h3 class="export-dialog__step-title">Choose Your Platforms</h3>
										<p class="export-dialog__step-subtitle">Select aspect ratios for your target platforms</p>
									</div>

									<div class="export-dialog__aspect-grid">
										<!-- 16:9 Original (always selected) -->
										<div class="export-dialog__aspect-card export-dialog__aspect-card--original">
											<div class="export-dialog__aspect-card-header">
												<div class="export-dialog__aspect-label-group">
													<span class="export-dialog__aspect-ratio-text">16:9</span>
													<span class="export-dialog__aspect-badge">Original</span>
												</div>
												<div class="export-dialog__aspect-check export-dialog__aspect-check--active">
													<Check class="export-dialog__aspect-check-icon" />
												</div>
											</div>
											<div class="export-dialog__aspect-preview">
												<div class="export-dialog__aspect-box export-dialog__aspect-box--selected" style="aspect-ratio: 16/9; width: 4rem" />
											</div>
											<div class="export-dialog__aspect-platforms">
												<p class="export-dialog__aspect-platform-text">YouTube &bull; Twitch</p>
											</div>
										</div>

										<!-- 9:16 -->
										<button
											type="button"
											class="export-dialog__aspect-card"
											:class="{ 'export-dialog__aspect-card--selected': selectedRatios.includes('9:16') }"
											@click="toggleRatio('9:16')"
										>
											<div class="export-dialog__aspect-card-header">
												<span class="export-dialog__aspect-ratio-text">9:16</span>
												<div class="export-dialog__aspect-check" :class="{ 'export-dialog__aspect-check--active': selectedRatios.includes('9:16') }">
													<Check v-if="selectedRatios.includes('9:16')" class="export-dialog__aspect-check-icon" />
												</div>
											</div>
											<div class="export-dialog__aspect-preview">
												<div class="export-dialog__aspect-box" :class="{ 'export-dialog__aspect-box--selected': selectedRatios.includes('9:16') }" style="aspect-ratio: 9/16; height: 3rem" />
											</div>
											<div class="export-dialog__aspect-platforms">
												<p class="export-dialog__aspect-platform-text">TikTok &bull; Reels</p>
											</div>
										</button>

										<!-- 1:1 -->
										<button
											type="button"
											class="export-dialog__aspect-card"
											:class="{ 'export-dialog__aspect-card--selected': selectedRatios.includes('1:1') }"
											@click="toggleRatio('1:1')"
										>
											<div class="export-dialog__aspect-card-header">
												<span class="export-dialog__aspect-ratio-text">1:1</span>
												<div class="export-dialog__aspect-check" :class="{ 'export-dialog__aspect-check--active': selectedRatios.includes('1:1') }">
													<Check v-if="selectedRatios.includes('1:1')" class="export-dialog__aspect-check-icon" />
												</div>
											</div>
											<div class="export-dialog__aspect-preview">
												<div class="export-dialog__aspect-box" :class="{ 'export-dialog__aspect-box--selected': selectedRatios.includes('1:1') }" style="aspect-ratio: 1/1; width: 2.5rem" />
											</div>
											<div class="export-dialog__aspect-platforms">
												<p class="export-dialog__aspect-platform-text">Instagram Feed</p>
											</div>
										</button>

										<!-- 4:5 -->
										<button
											type="button"
											class="export-dialog__aspect-card"
											:class="{ 'export-dialog__aspect-card--selected': selectedRatios.includes('4:5') }"
											@click="toggleRatio('4:5')"
										>
											<div class="export-dialog__aspect-card-header">
												<span class="export-dialog__aspect-ratio-text">4:5</span>
												<div class="export-dialog__aspect-check" :class="{ 'export-dialog__aspect-check--active': selectedRatios.includes('4:5') }">
													<Check v-if="selectedRatios.includes('4:5')" class="export-dialog__aspect-check-icon" />
												</div>
											</div>
											<div class="export-dialog__aspect-preview">
												<div class="export-dialog__aspect-box" :class="{ 'export-dialog__aspect-box--selected': selectedRatios.includes('4:5') }" style="aspect-ratio: 4/5; height: 2.5rem" />
											</div>
											<div class="export-dialog__aspect-platforms">
												<p class="export-dialog__aspect-platform-text">Instagram Post</p>
											</div>
										</button>
									</div>

									<!-- Selection summary -->
									<div v-if="selectedRatios.length > 0" class="export-dialog__selection-summary">
										<Check class="export-dialog__selection-icon" />
										<span class="export-dialog__selection-text">
											{{ selectedRatios.length }} format{{ selectedRatios.length > 1 ? 's' : '' }} selected
										</span>
									</div>
								</div>

								<!-- Step 2: Framing (only when portrait ratios selected) -->
								<div v-else-if="isProjectLandscape && currentStep === 'framing'" class="export-dialog__step-content">
									<div class="export-dialog__step-header">
										<h3 class="export-dialog__step-title">Framing &amp; Layout</h3>
										<p class="export-dialog__step-subtitle">Configure cropping for portrait formats</p>
									</div>

									<div class="export-dialog__framing-section">
										<div class="export-dialog__section-header">
											<CropIcon class="export-dialog__section-icon" />
											<h4 class="export-dialog__section-title">Portrait Cropping</h4>
										</div>

										<!-- Mode Toggle -->
										<div class="export-dialog__framing-grid">
											<button
												@click="framingMode = 'auto'"
												class="export-dialog__framing-mode"
												:class="{ 'export-dialog__framing-mode--active': framingMode === 'auto' }"
											>
												<div class="export-dialog__framing-mode-header">
													<div class="export-dialog__framing-mode-icon" :class="{ 'export-dialog__framing-mode-icon--active': framingMode === 'auto' }">
														<Sparkles class="export-dialog__framing-icon" />
													</div>
													<span class="export-dialog__framing-mode-label">Auto</span>
												</div>
												<p class="export-dialog__framing-mode-desc">Center-crop to fit the target aspect ratio</p>
											</button>
											<button
												@click="framingMode = 'manual'"
												class="export-dialog__framing-mode"
												:class="{ 'export-dialog__framing-mode--active': framingMode === 'manual' }"
											>
												<div class="export-dialog__framing-mode-header">
													<div class="export-dialog__framing-mode-icon" :class="{ 'export-dialog__framing-mode-icon--active': framingMode === 'manual' }">
														<PencilRuler class="export-dialog__framing-icon" />
													</div>
													<span class="export-dialog__framing-mode-label">Manual</span>
												</div>
												<p class="export-dialog__framing-mode-desc">Manually configure regions for each aspect ratio</p>
											</button>
										</div>

										<!-- Manual mode configuration list -->
										<Transition name="slide-fade">
											<div v-if="framingMode === 'manual'" class="export-dialog__manual-config">
												<p class="export-dialog__manual-hint">Configure each aspect ratio:</p>
												<div class="export-dialog__manual-list">
													<button
														v-for="ratio in selectedPortraitRatios"
														:key="ratio"
														@click="openPOIEditorForRatio(ratio)"
														class="export-dialog__ratio-config"
														:class="{ 'export-dialog__ratio-config--configured': isRatioConfigured(ratio) }"
													>
														<div class="export-dialog__ratio-config-left">
															<div
																class="export-dialog__ratio-preview-mini"
																:class="{ 'export-dialog__ratio-preview-mini--configured': isRatioConfigured(ratio) }"
																:style="{ aspectRatio: ratio.replace(':', '/'), height: ratio === '1:1' ? '1.5rem' : '2rem', width: ratio === '1:1' ? '1.5rem' : 'auto' }"
															/>
															<span class="export-dialog__ratio-label">{{ ratio }}</span>
														</div>
														<div class="export-dialog__ratio-config-right">
															<span
																v-if="isRatioConfigured(ratio)"
																class="export-dialog__ratio-status export-dialog__ratio-status--configured"
															>
																&#10003; {{ getConfigForRatio(ratio)?.regions.length }} region{{ getConfigForRatio(ratio)?.regions.length !== 1 ? 's' : '' }}
															</span>
															<span v-else class="export-dialog__ratio-status">Click to configure</span>
															<ChevronRight class="export-dialog__ratio-chevron" />
														</div>
													</button>
												</div>
												<div v-if="loadingVideoFrame" class="export-dialog__loading-hint">Loading video preview...</div>
											</div>
										</Transition>
									</div>
								</div>

								<!-- Settings State (final step, or only step for non-landscape) -->
								<div v-else class="export-dialog__step-content">
									<div class="export-dialog__step-header">
										<h3 class="export-dialog__step-title">Export Settings</h3>
										<p class="export-dialog__step-subtitle">Configure quality and format options</p>
									</div>

									<div class="export-dialog__export-settings">
										<!-- Quality -->
										<div class="export-dialog__setting-group">
											<div class="export-dialog__setting-header">
												<label class="export-dialog__setting-label">Quality</label>
												<span class="export-dialog__setting-badge">{{ quality === 'very_high' ? 'Very High' : quality }}</span>
											</div>
											<div class="export-dialog__setting-buttons">
												<button @click="quality = 'low'" class="export-dialog__setting-btn" :class="{ 'export-dialog__setting-btn--active': quality === 'low' }">Low</button>
												<button @click="quality = 'medium'" class="export-dialog__setting-btn" :class="{ 'export-dialog__setting-btn--active': quality === 'medium' }">Medium</button>
												<button @click="quality = 'high'" class="export-dialog__setting-btn" :class="{ 'export-dialog__setting-btn--active': quality === 'high' }">High</button>
												<button @click="quality = 'very_high'" class="export-dialog__setting-btn" :class="{ 'export-dialog__setting-btn--active': quality === 'very_high' }">Very High</button>
											</div>
											<p class="export-dialog__setting-hint">{{ qualityHint }}</p>
										</div>

										<!-- Frame Rate -->
										<div class="export-dialog__setting-group">
											<div class="export-dialog__setting-header">
												<label class="export-dialog__setting-label">Frame Rate</label>
												<span class="export-dialog__setting-badge">{{ frameRate }} FPS</span>
											</div>
											<div class="export-dialog__setting-buttons">
												<button @click="frameRate = 30" class="export-dialog__setting-btn" :class="{ 'export-dialog__setting-btn--active': frameRate === 30 }">30 FPS</button>
												<button @click="frameRate = 60" class="export-dialog__setting-btn" :class="{ 'export-dialog__setting-btn--active': frameRate === 60 }">60 FPS</button>
											</div>
											<p class="export-dialog__setting-hint">{{ fpsHint }}</p>
										</div>

										<!-- Format -->
										<div class="export-dialog__setting-group">
											<div class="export-dialog__setting-header">
												<label class="export-dialog__setting-label">Output Format</label>
												<span class="export-dialog__setting-badge">{{ format.toUpperCase() }}</span>
											</div>
											<div class="export-dialog__setting-buttons">
												<button @click="format = 'mp4'" class="export-dialog__setting-btn" :class="{ 'export-dialog__setting-btn--active': format === 'mp4' }">MP4</button>
												<button @click="format = 'webm'" class="export-dialog__setting-btn" :class="{ 'export-dialog__setting-btn--active': format === 'webm' }">WebM</button>
											</div>
											<p class="export-dialog__setting-hint">{{ formatHint }}</p>
										</div>
									</div>
								</div>
							</div>

							<!-- Footer -->
							<div class="export-dialog__footer">
								<div class="export-dialog__footer-left">
									<button
										v-if="isExporting"
										@click="handleCancel"
										class="export-dialog__btn export-dialog__btn--back"
									>
										Cancel
									</button>
									<button
										v-if="!isExporting && !exportError && !isFirstStep"
										@click="previousStep"
										class="export-dialog__btn export-dialog__btn--back"
									>
										Back
									</button>
								</div>

								<div class="export-dialog__footer-right">
									<button
										v-if="!isExporting && !exportError && !isLastStep"
										@click="nextStep"
										class="export-dialog__btn export-dialog__btn--primary"
									>
										<span>Next</span>
									</button>
									<button
										v-if="!isExporting && !exportError && isLastStep"
										@click="handleExport"
										class="export-dialog__btn export-dialog__btn--primary"
									>
										<Download :size="16" />
										<span>Export Video</span>
									</button>
									<button
										v-if="exportError && !isExporting"
										@click="handleClose"
										class="export-dialog__btn export-dialog__btn--back"
									>
										Close
									</button>
								</div>
							</div>
						</div>
					</Transition>
				</div>
			</Transition>
		</Teleport>

		<!-- Manual POI Editor Dialog -->
		<ManualPOIEditor
			v-model="showManualPOIEditor"
			:initial-config="getConfigForRatio(editingAspectRatio)"
			:target-aspect-ratio="editingAspectRatio"
			:source-aspect-ratio="'16:9'"
			:thumbnail-url="videoFrameUrl"
			:video-path="firstVideoPath"
			:clip-start-time="0"
			:clip-end-time="projectDuration"
			@confirm="onManualConfigConfirm"
		/>
	</div>
</template>

<style scoped>
/* ===== Overlay ===== */
.export-dialog__overlay {
	position: fixed;
	inset: 0;
	background-color: rgba(0, 0, 0, 0.7);
	backdrop-filter: blur(4px);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 10000;
}

/* ===== Dialog Container ===== */
.export-dialog {
	background-color: var(--sidebar-surface);
	border: 1px solid var(--sidebar-border);
	border-radius: 12px;
	width: 100%;
	max-width: 520px;
	margin: 1rem;
	max-height: 90vh;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

/* ===== Accent Bar ===== */
.export-dialog__accent {
	height: 3px;
	background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
	flex-shrink: 0;
}

/* ===== Header ===== */
.export-dialog__header {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 1.5rem 1.5rem 1rem;
	text-align: center;
}

.export-dialog__close {
	position: absolute;
	top: 1rem;
	right: 1rem;
	width: 32px;
	height: 32px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: transparent;
	border: none;
	border-radius: 6px;
	color: var(--sidebar-text-muted);
	cursor: pointer;
	transition: all 150ms ease;
}

.export-dialog__close:hover {
	background-color: var(--sidebar-hover);
	color: var(--sidebar-text);
}

.export-dialog__close:disabled {
	opacity: 0.3;
	cursor: not-allowed;
}

.export-dialog__icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 52px;
	height: 52px;
	border-radius: 12px;
	background-color: rgba(6, 182, 212, 0.15);
	color: var(--sidebar-accent);
	margin-bottom: 0.875rem;
}

.export-dialog__title {
	font-size: 1.25rem;
	font-weight: 700;
	color: var(--sidebar-text);
	margin: 0;
	letter-spacing: -0.02em;
}

.export-dialog__subtitle {
	font-size: 0.8125rem;
	color: var(--sidebar-text-muted);
	margin: 0.25rem 0 0;
}

/* ===== Content Area ===== */
.export-dialog__content {
	flex: 1;
	overflow-y: auto;
	padding: 0;
}

.export-dialog__content::-webkit-scrollbar {
	width: 6px;
}

.export-dialog__content::-webkit-scrollbar-track {
	background: transparent;
}

.export-dialog__content::-webkit-scrollbar-thumb {
	background-color: rgba(255, 255, 255, 0.15);
	border-radius: 3px;
}

/* ===== Step Content ===== */
.export-dialog__step-content {
	display: flex;
	flex-direction: column;
	gap: 1rem;
	padding: 1.5rem;
}

.export-dialog__step-header {
	text-align: center;
	margin-bottom: 0.5rem;
}

.export-dialog__step-title {
	font-size: 1rem;
	font-weight: 600;
	color: var(--sidebar-text);
	margin: 0 0 0.25rem;
}

.export-dialog__step-subtitle {
	font-size: 0.875rem;
	color: var(--sidebar-text-muted);
	margin: 0;
}

/* ===== Export Settings ===== */
.export-dialog__export-settings {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.export-dialog__setting-group {
	background-color: rgba(255, 255, 255, 0.03);
	border: 1px solid var(--sidebar-border);
	border-radius: 10px;
	padding: 1rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.export-dialog__setting-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.export-dialog__setting-label {
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--sidebar-text);
}

.export-dialog__setting-badge {
	font-size: 0.75rem;
	font-family: monospace;
	color: var(--sidebar-accent);
	background-color: rgba(6, 182, 212, 0.1);
	padding: 0.25rem 0.5rem;
	border-radius: 4px;
	text-transform: capitalize;
}

.export-dialog__setting-buttons {
	display: flex;
	gap: 0.5rem;
}

.export-dialog__setting-btn {
	flex: 1;
	padding: 0.625rem 1rem;
	font-size: 0.875rem;
	font-weight: 500;
	border-radius: 8px;
	border: 1px solid var(--sidebar-border);
	background-color: rgba(255, 255, 255, 0.05);
	color: var(--sidebar-text-muted);
	cursor: pointer;
	transition: all 150ms ease;
	display: flex;
	align-items: center;
	justify-content: center;
}

.export-dialog__setting-btn:hover {
	background-color: rgba(255, 255, 255, 0.08);
	color: var(--sidebar-text);
}

.export-dialog__setting-btn--active {
	background-color: var(--sidebar-accent);
	color: white;
	border-color: var(--sidebar-accent);
	box-shadow: 0 2px 8px rgba(6, 182, 212, 0.2);
}

.export-dialog__setting-hint {
	font-size: 0.6875rem;
	color: var(--sidebar-text-muted);
	line-height: 1.4;
	margin: 0;
}

/* ===== Progress Section ===== */
.export-dialog__progress-section {
	background-color: rgba(255, 255, 255, 0.03);
	border: 1px solid var(--sidebar-border);
	border-radius: 10px;
	padding: 1.25rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.export-dialog__progress-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.export-dialog__progress-label {
	font-size: 0.875rem;
	font-weight: 500;
	color: var(--sidebar-text-muted);
}

.export-dialog__progress-value {
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--sidebar-accent);
	font-family: monospace;
}

.export-dialog__progress-bar {
	height: 8px;
	background-color: rgba(255, 255, 255, 0.08);
	border-radius: 4px;
	overflow: hidden;
}

.export-dialog__progress-fill {
	height: 100%;
	background: linear-gradient(90deg, var(--sidebar-accent), #0891b2);
	border-radius: 4px;
	transition: width 300ms ease;
}

.export-dialog__progress-hint {
	font-size: 0.6875rem;
	color: var(--sidebar-text-muted);
	margin: 0;
	text-align: center;
}

/* ===== Error Section ===== */
.export-dialog__error-section {
	display: flex;
	flex-direction: column;
	gap: 1rem;
	align-items: center;
	text-align: center;
}

.export-dialog__error-header {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.75rem;
}

.export-dialog__error-icon {
	width: 48px;
	height: 48px;
	border-radius: 12px;
	background-color: rgba(239, 68, 68, 0.15);
	color: #ef4444;
	display: flex;
	align-items: center;
	justify-content: center;
}

.export-dialog__error-title {
	font-size: 1rem;
	font-weight: 600;
	color: #ef4444;
	margin: 0;
}

.export-dialog__error-message {
	font-size: 0.75rem;
	color: var(--sidebar-text-muted);
	margin: 0;
	max-height: 120px;
	overflow-y: auto;
	background-color: rgba(255, 255, 255, 0.03);
	border: 1px solid var(--sidebar-border);
	border-radius: 8px;
	padding: 0.75rem;
	width: 100%;
	text-align: left;
	word-break: break-word;
}

.export-dialog__error-actions {
	display: flex;
	gap: 0.5rem;
	width: 100%;
}

.export-dialog__error-btn {
	flex: 1;
	padding: 0.625rem 1rem;
	font-size: 0.875rem;
	font-weight: 500;
	border-radius: 8px;
	border: 1px solid var(--sidebar-border);
	background-color: rgba(255, 255, 255, 0.05);
	color: var(--sidebar-text-muted);
	cursor: pointer;
	transition: all 150ms ease;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.375rem;
}

.export-dialog__error-btn:hover {
	background-color: rgba(255, 255, 255, 0.08);
	color: var(--sidebar-text);
}

.export-dialog__error-btn--retry {
	background-color: var(--sidebar-accent);
	color: white;
	border-color: var(--sidebar-accent);
}

.export-dialog__error-btn--retry:hover {
	opacity: 0.9;
}

/* ===== Footer ===== */
.export-dialog__footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.75rem;
	padding: 1rem 1.5rem;
	border-top: 1px solid var(--sidebar-border);
}

.export-dialog__footer-left,
.export-dialog__footer-right {
	flex: 1;
}

.export-dialog__footer-right {
	display: flex;
	justify-content: flex-end;
}

.export-dialog__btn {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	padding: 0.625rem 1.25rem;
	font-size: 0.875rem;
	font-weight: 600;
	border-radius: 8px;
	border: none;
	cursor: pointer;
	transition: all 150ms ease;
}

.export-dialog__btn--back {
	background: transparent;
	color: var(--sidebar-text-muted);
	padding: 0.5rem 1rem;
}

.export-dialog__btn--back:hover {
	color: var(--sidebar-text);
}

.export-dialog__btn--primary {
	background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
	color: white;
}

.export-dialog__btn--primary:hover {
	opacity: 0.9;
}

/* ===== Aspect Ratio Grid ===== */
.export-dialog__aspect-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 0.75rem;
}

.export-dialog__aspect-card {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	padding: 0.875rem;
	border-radius: 10px;
	border: 1px solid var(--sidebar-border);
	background-color: rgba(255, 255, 255, 0.03);
	cursor: pointer;
	transition: all 150ms ease;
	text-align: left;
}

.export-dialog__aspect-card:hover {
	background-color: rgba(255, 255, 255, 0.06);
	border-color: rgba(255, 255, 255, 0.15);
}

.export-dialog__aspect-card--selected {
	border-color: var(--sidebar-accent);
	background-color: rgba(6, 182, 212, 0.08);
}

.export-dialog__aspect-card--selected:hover {
	border-color: var(--sidebar-accent);
	background-color: rgba(6, 182, 212, 0.12);
}

.export-dialog__aspect-card-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.export-dialog__aspect-label-group {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.export-dialog__aspect-ratio-text {
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--sidebar-text);
}

.export-dialog__aspect-badge {
	font-size: 0.625rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.05em;
	color: var(--sidebar-accent);
	background-color: rgba(6, 182, 212, 0.15);
	padding: 0.125rem 0.375rem;
	border-radius: 3px;
}

.export-dialog__aspect-check {
	width: 20px;
	height: 20px;
	border-radius: 50%;
	border: 2px solid var(--sidebar-border);
	display: flex;
	align-items: center;
	justify-content: center;
	transition: all 150ms ease;
}

.export-dialog__aspect-check--active {
	border-color: var(--sidebar-accent);
	background-color: var(--sidebar-accent);
}

.export-dialog__aspect-check-icon {
	width: 12px;
	height: 12px;
	color: white;
}

.export-dialog__aspect-preview {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0.25rem 0;
}

.export-dialog__aspect-box {
	border: 1.5px solid var(--sidebar-border);
	border-radius: 3px;
	background-color: rgba(255, 255, 255, 0.05);
	transition: all 150ms ease;
}

.export-dialog__aspect-box--selected {
	border-color: var(--sidebar-accent);
	background-color: rgba(6, 182, 212, 0.15);
}

.export-dialog__aspect-platforms {
	margin-top: -0.125rem;
}

.export-dialog__aspect-platform-text {
	font-size: 0.6875rem;
	color: var(--sidebar-text-muted);
	margin: 0;
}

/* ===== Framing Section ===== */
.export-dialog__framing-section {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
	margin-top: 0.25rem;
	padding-top: 0.75rem;
	border-top: 1px solid var(--sidebar-border);
}

.export-dialog__framing-grid {
	display: grid;
	grid-template-columns: repeat(2, 1fr);
	gap: 0.5rem;
}

.export-dialog__framing-mode {
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
	padding: 0.75rem;
	border-radius: 8px;
	border: 1px solid var(--sidebar-border);
	background-color: rgba(255, 255, 255, 0.03);
	cursor: pointer;
	transition: all 150ms ease;
	text-align: left;
}

.export-dialog__framing-mode:hover {
	background-color: rgba(255, 255, 255, 0.06);
}

.export-dialog__framing-mode--active {
	border-color: var(--sidebar-accent);
	background-color: rgba(6, 182, 212, 0.08);
}

.export-dialog__framing-mode-header {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.export-dialog__framing-mode-icon {
	width: 28px;
	height: 28px;
	border-radius: 6px;
	background-color: rgba(255, 255, 255, 0.08);
	display: flex;
	align-items: center;
	justify-content: center;
	color: var(--sidebar-text-muted);
	transition: all 150ms ease;
}

.export-dialog__framing-mode-icon--active {
	background-color: rgba(6, 182, 212, 0.2);
	color: var(--sidebar-accent);
}

.export-dialog__framing-icon {
	width: 14px;
	height: 14px;
}

.export-dialog__framing-mode-label {
	font-size: 0.8125rem;
	font-weight: 600;
	color: var(--sidebar-text);
}

.export-dialog__framing-mode-desc {
	font-size: 0.6875rem;
	color: var(--sidebar-text-muted);
	margin: 0;
	line-height: 1.3;
}

/* ===== Original Card ===== */
.export-dialog__aspect-card--original {
	cursor: default;
	border-color: var(--sidebar-accent);
	background-color: rgba(6, 182, 212, 0.08);
}

/* ===== Selection Summary ===== */
.export-dialog__selection-summary {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.625rem 0.875rem;
	border-radius: 8px;
	background-color: rgba(6, 182, 212, 0.08);
	border: 1px solid rgba(6, 182, 212, 0.2);
}

.export-dialog__selection-icon {
	width: 14px;
	height: 14px;
	color: var(--sidebar-accent);
}

.export-dialog__selection-text {
	font-size: 0.8125rem;
	font-weight: 500;
	color: var(--sidebar-accent);
}

/* ===== Section Header ===== */
.export-dialog__section-header {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.export-dialog__section-icon {
	width: 16px;
	height: 16px;
	color: var(--sidebar-accent);
}

.export-dialog__section-title {
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--sidebar-text);
	margin: 0;
}

/* ===== Manual Config ===== */
.export-dialog__manual-config {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
}

.export-dialog__manual-hint {
	font-size: 0.75rem;
	color: var(--sidebar-text-muted);
	margin: 0;
}

.export-dialog__manual-list {
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
}

.export-dialog__ratio-config {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.625rem 0.75rem;
	border-radius: 8px;
	border: 1px solid var(--sidebar-border);
	background-color: rgba(255, 255, 255, 0.03);
	cursor: pointer;
	transition: all 150ms ease;
}

.export-dialog__ratio-config:hover {
	background-color: rgba(255, 255, 255, 0.06);
	border-color: rgba(255, 255, 255, 0.15);
}

.export-dialog__ratio-config--configured {
	border-color: rgba(6, 182, 212, 0.3);
	background-color: rgba(6, 182, 212, 0.05);
}

.export-dialog__ratio-config-left {
	display: flex;
	align-items: center;
	gap: 0.625rem;
}

.export-dialog__ratio-preview-mini {
	border: 1.5px solid var(--sidebar-border);
	border-radius: 2px;
	background-color: rgba(255, 255, 255, 0.05);
}

.export-dialog__ratio-preview-mini--configured {
	border-color: var(--sidebar-accent);
	background-color: rgba(6, 182, 212, 0.15);
}

.export-dialog__ratio-label {
	font-size: 0.8125rem;
	font-weight: 600;
	color: var(--sidebar-text);
}

.export-dialog__ratio-config-right {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.export-dialog__ratio-status {
	font-size: 0.6875rem;
	color: var(--sidebar-text-muted);
}

.export-dialog__ratio-status--configured {
	color: var(--sidebar-accent);
}

.export-dialog__ratio-chevron {
	width: 14px;
	height: 14px;
	color: var(--sidebar-text-muted);
}

.export-dialog__loading-hint {
	font-size: 0.6875rem;
	color: var(--sidebar-text-muted);
	text-align: center;
	padding: 0.25rem 0;
}

/* ===== Slide-Fade Transition ===== */
.slide-fade-enter-active {
	transition: all 200ms ease;
}

.slide-fade-leave-active {
	transition: all 150ms ease;
}

.slide-fade-enter-from {
	opacity: 0;
	transform: translateY(-8px);
}

.slide-fade-leave-to {
	opacity: 0;
	transform: translateY(-8px);
}

/* ===== Transitions ===== */
.modal-enter-active,
.modal-leave-active {
	transition: opacity 200ms ease;
}

.modal-enter-from,
.modal-leave-to {
	opacity: 0;
}

.dialog-enter-active {
	transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.dialog-leave-active {
	transition: all 150ms ease-in;
}

.dialog-enter-from {
	opacity: 0;
	transform: scale(0.96) translateY(8px);
}

.dialog-leave-to {
	opacity: 0;
	transform: scale(0.98);
}

/* ===== Responsive ===== */
@media (max-width: 640px) {
	.export-dialog {
		max-width: calc(100% - 1rem);
		margin: 0.5rem;
	}

	.export-dialog__header {
		padding: 1.25rem 1.25rem 0.875rem;
	}

	.export-dialog__step-content {
		padding: 1.25rem;
	}

	.export-dialog__footer {
		padding: 0.875rem 1.25rem;
	}
}
</style>
