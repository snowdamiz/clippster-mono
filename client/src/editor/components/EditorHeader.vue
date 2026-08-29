<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useEditor } from "../composables/useEditor";
import { useRouter } from "vue-router";
import ExportButton from "./ExportButton.vue";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ChevronDown, Keyboard, Loader2, Maximize, Minimize, Smartphone, X, Download, Image, Check, Stamp, Megaphone } from "lucide-vue-next";
import { useImageMode } from "../composables/useImageMode";
import type { ImageExportFormat } from "../composables/useImageMode";
import { useEditorUIState } from "../composables/useEditorUIState";
import { useWatermarkExport } from "@/composables/useWatermarkExport";
import { useCampaignImageSubmit } from "@/composables/useCampaignImageSubmit";
import ChatFab from "@/components/chat/ChatFab.vue";
import {
	getVideoEditorSourcesByProjectId,
	getClip,
	getProject,
	getRawVideosByProjectId,
	getRawVideo,
} from "@/services/database";
import { getPlatformConfig } from "@/config/platforms";
import { SOCIAL_OVERLAY_PRESETS } from "../constants/social-overlay-constants";
import type { SocialOverlayPreset } from "../types/social-overlays";
import type { ManualSourceFramingPayload } from "@/types";

const props = defineProps<{
	previewContainer: HTMLDivElement | null;
	isSaving: boolean;
	lastSavedAt: Date | null;
}>();

const { editor, version } = useEditor({
	subscribe: {
		project: true,
		playback: false,
		timeline: false,
		scenes: false,
		media: false,
		selection: false,
	},
});
const { isImageMode, isCoverMode, exportAsImage, exportAndSave, exportAndSaveAsCover } = useImageMode();
const { activeSocialOverlay } = useEditorUIState();
const { saveAsWatermark } = useWatermarkExport();
const { availableCampaigns, isSubmitting, isLoadingCampaigns, loadMyCampaigns, submitImageToCampaign } = useCampaignImageSubmit();
const router = useRouter();

// Image export state
const imageExportFormat = ref<ImageExportFormat>("png");
const isImageExporting = ref(false);
const imageExportSuccess = ref(false);
const showFormatDropdown = ref(false);
const showExportMenu = ref(false);
const showCampaignPicker = ref(false);

const imageFormatOptions: { value: ImageExportFormat; label: string }[] = [
	{ value: "png", label: "PNG" },
	{ value: "jpg", label: "JPG" },
	{ value: "webp", label: "WebP" },
];

async function handleImageExport() {
	if (isImageExporting.value) return;
	isImageExporting.value = true;
	imageExportSuccess.value = false;
	try {
		let result: string | null = null;

		if (isCoverMode.value) {
			result = await exportAndSaveAsCover(imageExportFormat.value);
			if (result) {
				imageExportSuccess.value = true;
				setTimeout(() => { router.push("/clips"); }, 1200);
			}
		} else {
			const project = activeProject.value;
			const name = project?.metadata.name || "design";
			result = await exportAndSave(imageExportFormat.value, `${name}.${imageExportFormat.value}`);
			if (result) {
				imageExportSuccess.value = true;
				setTimeout(() => { imageExportSuccess.value = false; }, 2000);
			}
		}
	} catch (err) {
		console.error("[EditorHeader] Image export failed:", err);
	} finally {
		isImageExporting.value = false;
	}
}

async function handleSubmitToCampaign(campaignId: number) {
	if (isImageExporting.value) return;
	isImageExporting.value = true;
	showCampaignPicker.value = false;
	try {
		const blob = await exportAsImage("png");
		if (!blob) return;

		const project = activeProject.value;
		const name = project?.metadata.name || "design";

		const result = await submitImageToCampaign(campaignId, blob, `${name}.png`);
		if (result?.success) {
			imageExportSuccess.value = true;
			setTimeout(() => { imageExportSuccess.value = false; }, 2000);
		}
	} catch (err) {
		console.error("[EditorHeader] Campaign submission failed:", err);
	} finally {
		isImageExporting.value = false;
	}
}

async function openCampaignPicker() {
	showExportMenu.value = false;
	await loadMyCampaigns();
	showCampaignPicker.value = true;
}

async function handleSaveAsWatermark() {
	if (isImageExporting.value) return;
	isImageExporting.value = true;
	showExportMenu.value = false;
	try {
		const blob = await exportAsImage("png");
		if (!blob) return;

		const project = activeProject.value;
		const name = project?.metadata.name || "Watermark";

		const wmId = await saveAsWatermark({
			blob,
			name,
			width: project?.settings.canvasSize.width,
			height: project?.settings.canvasSize.height,
		});

		if (wmId) {
			imageExportSuccess.value = true;
			setTimeout(() => { imageExportSuccess.value = false; }, 2000);
		}
	} catch (err) {
		console.error("[EditorHeader] Save as watermark failed:", err);
	} finally {
		isImageExporting.value = false;
	}
}

const isExiting = ref(false);
const showRenameDialog = ref(false);
const showAspectMenu = ref(false);
const showSocialMenu = ref(false);
const showDropdown = ref(false);
const isFullscreen = ref(false);
const aspectButtonRef = ref<HTMLButtonElement | null>(null);
const socialButtonRef = ref<HTMLButtonElement | null>(null);
const titleInputRef = ref<HTMLInputElement | null>(null);

const aspectMenuStyle = computed(() => {
	const el = aspectButtonRef.value;
	if (!el) return {};
	const rect = el.getBoundingClientRect();
	return {
		top: `${rect.bottom + 6}px`,
		left: `${rect.left + rect.width / 2}px`,
		transform: "translateX(-50%)",
	};
});

const socialMenuStyle = computed(() => {
	const el = socialButtonRef.value;
	if (!el) return {};
	const rect = el.getBoundingClientRect();
	return {
		top: `${rect.bottom + 6}px`,
		left: `${rect.left + rect.width / 2}px`,
		transform: "translateX(-50%)",
	};
});
const isRenamingTitle = ref(false);
const renameInput = ref("");
const vodInfo = ref<{ platform: string; streamerName: string | null } | null>(null);

const aspectPresets = [
	{ width: 1920, height: 1080, label: "16:9" },
	{ width: 1080, height: 1920, label: "9:16" },
	{ width: 1080, height: 1080, label: "1:1" },
	{ width: 1080, height: 1350, label: "4:5" },
	{ width: 1280, height: 720, label: "YouTube HD" },
	{ width: 3840, height: 2160, label: "YouTube 4K" },
];

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull();
});

const projectTitle = computed(() => activeProject.value?.metadata.name || "Untitled");
const canvasWidth = computed(() => activeProject.value?.settings?.canvasSize?.width ?? 1920);
const canvasHeight = computed(() => activeProject.value?.settings?.canvasSize?.height ?? 1080);

const currentAspectLabel = computed(() => {
	const match = aspectPresets.find((p) => p.width === canvasWidth.value && p.height === canvasHeight.value);
	return match ? match.label : `${canvasWidth.value}×${canvasHeight.value}`;
});

const is916 = computed(() => canvasWidth.value === 1080 && canvasHeight.value === 1920);

/** Show Use 16:9 when project canvas is not ~16:9 (matches Manual POI target panel). */
const is169Canvas = computed(() => {
	const p = activeProject.value;
	if (!p?.settings?.canvasSize) return true;
	const w = p.settings.canvasSize.width;
	const h = p.settings.canvasSize.height;
	if (w <= 0 || h <= 0) return true;
	return Math.abs(w / h - 16 / 9) < 0.02;
});

const canvasSourceFraming = computed(() => activeProject.value?.settings.canvasSourceFraming ?? null);

const use169Checked = computed(() => canvasSourceFraming.value?.mode === "use16x9");

const showCanvasFramingBlur = ref(false);
const framingBlurButtonRef = ref<HTMLButtonElement | null>(null);

const framingBlurMenuStyle = computed(() => {
	const el = framingBlurButtonRef.value;
	if (!el) return {};
	const rect = el.getBoundingClientRect();
	return {
		top: `${rect.bottom + 6}px`,
		left: `${rect.left}px`,
	};
});

watch(is916, (val) => {
	if (!val) {
		activeSocialOverlay.value = null;
		showSocialMenu.value = false;
	}
});

function setAspectRatio(preset: { width: number; height: number }) {
	const is169 = Math.abs(preset.width / preset.height - 16 / 9) < 0.02;
	void editor.project.updateSettings({
		settings: {
			canvasSize: preset,
			...(is169 ? { canvasSourceFraming: undefined } : {}),
		},
	});
	showAspectMenu.value = false;
}

async function persistCanvasFraming(fr: ManualSourceFramingPayload | null) {
	await editor.project.updateSettings({
		settings: { canvasSourceFraming: fr ?? undefined },
	});
}

function onToggleUse169(e: Event) {
	const checked = (e.target as HTMLInputElement).checked;
	const cur = canvasSourceFraming.value;
	if (checked) {
		void persistCanvasFraming({
			mode: "use16x9",
			blurEnabled: (cur?.blurAmount ?? 12) > 0,
			blurAmount: cur?.blurAmount ?? 12,
			scale: 1,
			x: 0,
			y: 0,
		});
	} else if (cur?.mode === "use16x9") {
		void persistCanvasFraming(null);
	}
}

function setCanvasFramingBlurAmount(amount: number) {
	const cur = canvasSourceFraming.value;
	if (!cur || cur.mode === "none") return;
	void persistCanvasFraming({
		...cur,
		blurAmount: amount,
		blurEnabled: amount > 0,
	});
}

function toggleSocialOverlay(preset: SocialOverlayPreset) {
	if (activeSocialOverlay.value?.platform === preset.platform) {
		activeSocialOverlay.value = null;
	} else {
		activeSocialOverlay.value = preset;
	}
	showSocialMenu.value = false;
}

function toggleFullscreen() {
	const target = props.previewContainer ?? document.documentElement;
	if (!isFullscreen.value) {
		target.requestFullscreen?.();
	} else {
		document.exitFullscreen?.();
	}
}

function handleFullscreenChange() {
	isFullscreen.value = !!document.fullscreenElement;
}

function openShortcuts() {
	window.dispatchEvent(new CustomEvent("toggle-shortcuts-modal"));
}

onMounted(() => {
	document.addEventListener("fullscreenchange", handleFullscreenChange);
});

onUnmounted(() => {
	document.removeEventListener("fullscreenchange", handleFullscreenChange);
});

function normalizePlatformKey(platform: string): string {
	return platform === "YouTube" ? "YouTube" : platform.toLowerCase();
}

async function loadVodInfo() {
	const projectId = activeProject.value?.metadata.id;
	if (!projectId) {
		vodInfo.value = null;
		return;
	}
	try {
		const sources = await getVideoEditorSourcesByProjectId(projectId);
		const source = sources.find((s) => s.source_type === "clip" || s.source_type === "raw_video");
		if (!source) {
			vodInfo.value = null;
			return;
		}
		const sourceId = source.source_id;
		if (!sourceId) { vodInfo.value = null; return; }
		if (source.source_type === "clip") {
			const clip = await getClip(sourceId);
			if (!clip || !clip.project_id) { vodInfo.value = null; return; }
			const project = await getProject(clip.project_id);
			const platform = project?.platform;
			if (!project || !platform || platform === "Manual") {
				vodInfo.value = null;
				return;
			}
			const rawVideos = await getRawVideosByProjectId(project.id);
			vodInfo.value = {
				platform: normalizePlatformKey(platform),
				streamerName: rawVideos[0]?.source_mint_id ?? null,
			};
		} else {
			const rawVideo = await getRawVideo(sourceId);
			if (!rawVideo || !rawVideo.project_id) { vodInfo.value = null; return; }
			const project = await getProject(rawVideo.project_id);
			const platform = project?.platform;
			if (!project || !platform || platform === "Manual") {
				vodInfo.value = null;
				return;
			}
			vodInfo.value = {
				platform: normalizePlatformKey(platform),
				streamerName: rawVideo.source_mint_id ?? null,
			};
		}
	} catch {
		vodInfo.value = null;
	}
}

watch(() => activeProject.value?.metadata.id, loadVodInfo, { immediate: true });

async function handleExit() {
	if (isExiting.value) return;
	isExiting.value = true;

	try {
		// Timeout after 3s so exit can never hang
		await Promise.race([
			editor.project.prepareExit(),
			new Promise((resolve) => setTimeout(resolve, 3000)),
		]);
	} catch (error) {
		console.error("Failed to prepare project exit:", error);
	}

	try {
		editor.project.closeProject();
	} catch (error) {
		console.error("Failed to close project:", error);
	}

	router.push(isImageMode.value ? "/design-studio" : "/video-editor");
}

async function handleRename() {
	const project = activeProject.value;
	const trimmed = renameInput.value.trim();
	if (!project || !trimmed || trimmed === project.metadata.name) {
		isRenamingTitle.value = false;
		renameInput.value = project?.metadata.name ?? "";
		return;
	}
	try {
		await editor.project.renameProject({
			id: project.metadata.id,
			name: trimmed,
		});
	} catch (error) {
		console.error("Failed to rename project:", error);
		renameInput.value = project.metadata.name;
	}
	isRenamingTitle.value = false;
}

async function handleDelete() {
	const project = activeProject.value;
	if (!project) return;
	if (!confirm(`Delete "${project.metadata.name}"? This cannot be undone.`)) return;
	try {
		await editor.project.deleteProjects({ ids: [project.metadata.id] });
		router.push(isImageMode.value ? "/design-studio" : "/video-editor");
	} catch (error) {
		console.error("Failed to delete project:", error);
	}
}

async function openRename() {
	renameInput.value = activeProject.value?.metadata.name || "";
	isRenamingTitle.value = true;
	showDropdown.value = false;
	await nextTick();
	titleInputRef.value?.focus();
	titleInputRef.value?.select();
}

function cancelRename() {
	renameInput.value = activeProject.value?.metadata.name || "";
	isRenamingTitle.value = false;
}
</script>

<template>
	<header class="relative z-10 flex h-[3.2rem] shrink-0 items-center justify-between gap-2 border-b border-white/10 bg-[#0e0e10] px-3 pr-4">
		<div class="flex min-w-0 items-center gap-2">
			<!-- Back arrow -->
			<button
				type="button"
				class="flex items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
				:disabled="isExiting"
				:aria-label="isExiting ? 'Saving and exiting editor' : 'Back to projects'"
				@click="handleExit"
			>
				<ArrowLeft class="size-4" />
			</button>

			<!-- VOD info + project name -->
			<template v-if="vodInfo">
				<img
					:src="getPlatformConfig(vodInfo.platform)?.icon"
					class="size-4 object-contain"
					:alt="vodInfo.platform"
				/>
				<span v-if="vodInfo.streamerName" class="text-[0.8rem] text-zinc-300">
					{{ vodInfo.streamerName }}
				</span>
				<span class="text-zinc-600">|</span>
			</template>

			<input
				v-if="isRenamingTitle"
				ref="titleInputRef"
				v-model="renameInput"
				type="text"
				class="h-7 min-w-24 max-w-72 rounded border border-white/10 bg-white/5 px-2 text-[0.85rem] text-zinc-100 outline-none ring-0 transition-colors focus:border-blue-400/70 focus:bg-white/10"
				aria-label="Project name"
				@blur="handleRename"
				@keydown.enter.prevent="handleRename"
				@keydown.escape.prevent="cancelRename"
			/>
			<button
				v-else
				type="button"
				class="max-w-72 truncate rounded px-1.5 py-1 text-left text-[0.85rem] text-zinc-200 transition-colors hover:bg-white/5 hover:text-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-400/60"
				:title="`Rename ${projectTitle}`"
				@click="openRename"
			>
				{{ projectTitle }}
			</button>
		</div>

	<!-- Center: Aspect ratio + Use 16:9 + Social overlay + Fullscreen -->
	<div class="pointer-events-auto absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2">
		<!-- Aspect ratio dropdown -->
		<div class="relative">
			<button
				ref="aspectButtonRef"
				type="button"
				class="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
				aria-label="Change canvas aspect ratio"
				:aria-expanded="showAspectMenu"
				@click="showAspectMenu = !showAspectMenu"
			>
				{{ currentAspectLabel }}
				<ChevronDown class="size-3" />
			</button>
			<Teleport to="body">
				<div
					v-if="showAspectMenu"
					class="fixed z-[200] rounded-md border border-white/10 bg-[#1e1e22] py-1 shadow-lg"
					:style="aspectMenuStyle"
				>
					<button
						v-for="preset in aspectPresets"
						:key="preset.label"
						type="button"
						:class="[
							'flex w-full items-center gap-2 px-4 py-1.5 text-xs transition-colors',
							canvasWidth === preset.width && canvasHeight === preset.height
								? 'text-primary bg-primary/10'
								: 'text-zinc-300 hover:bg-white/5',
						]"
						@click="setAspectRatio(preset)"
					>
						{{ preset.label }}
						<span class="text-zinc-500">{{ preset.width }}×{{ preset.height }}</span>
					</button>
				</div>
			</Teleport>
			<div v-if="showAspectMenu" class="fixed inset-0 z-[199]" @click="showAspectMenu = false" />
		</div>

		<!-- Use 16:9 (non-16:9 canvas; same as Manual POI target panel) -->
		<template v-if="!is169Canvas">
			<div class="h-3 w-px bg-white/20" />
			<label
				class="flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors"
				:class="use169Checked ? 'bg-cyan-500/20 text-cyan-300' : 'text-zinc-500 hover:text-zinc-300'"
			>
				<input
					type="checkbox"
					class="size-2.5 rounded border-zinc-600 bg-zinc-800 accent-cyan-500"
					:checked="use169Checked"
					@change="onToggleUse169"
				/>
				<span>Use 16:9</span>
			</label>
			<div v-if="use169Checked" class="relative">
				<button
					ref="framingBlurButtonRef"
					type="button"
					class="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
					@click="showCanvasFramingBlur = !showCanvasFramingBlur"
				>
					Blur<span v-if="(canvasSourceFraming?.blurAmount ?? 0) > 0">: {{ canvasSourceFraming?.blurAmount }}</span>
					<ChevronDown class="size-2.5 transition-transform" :class="{ 'rotate-180': showCanvasFramingBlur }" />
				</button>
				<Teleport to="body">
					<div
						v-if="showCanvasFramingBlur"
						class="fixed z-[200] min-w-[140px] rounded-md border border-white/10 bg-[#1e1e22] p-2 shadow-lg"
						:style="framingBlurMenuStyle"
						@click.stop
					>
						<div class="mb-1 flex items-center justify-between text-[10px] text-zinc-400">
							<span>Blur</span>
							<span class="font-mono text-zinc-300">{{ canvasSourceFraming?.blurAmount ?? 0 }}</span>
						</div>
						<input
							type="range"
							min="0"
							max="30"
							step="1"
							:value="canvasSourceFraming?.blurAmount ?? 0"
							class="h-1 w-full accent-cyan-500"
							@input="setCanvasFramingBlurAmount(Number(($event.target as HTMLInputElement).value))"
						/>
					</div>
				</Teleport>
				<div
					v-if="showCanvasFramingBlur"
					class="fixed inset-0 z-[199]"
					@click="showCanvasFramingBlur = false"
				/>
			</div>
		</template>

		<!-- Social overlay toggle (9:16 only) -->
		<template v-if="is916">
			<div class="h-3 w-px bg-white/20" />
			<div class="relative">
				<button
					ref="socialButtonRef"
					type="button"
					:class="[
						'flex items-center rounded-md p-1.5 transition-colors',
						activeSocialOverlay
							? 'text-cyan-400 bg-cyan-500/15'
							: 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300',
					]"
					aria-label="Toggle social preview overlay"
					:aria-pressed="Boolean(activeSocialOverlay)"
					:aria-expanded="showSocialMenu"
					@click="showSocialMenu = !showSocialMenu"
				>
					<Smartphone class="size-3.5" />
				</button>
				<Teleport to="body">
					<div
						v-if="showSocialMenu"
						class="fixed z-[200] w-44 rounded-md border border-white/10 bg-[#1e1e22] py-1 shadow-lg"
						:style="socialMenuStyle"
					>
						<button
							v-if="activeSocialOverlay"
							type="button"
							class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/5"
							@click="activeSocialOverlay = null; showSocialMenu = false"
						>
							Hide Overlay
						</button>
						<button
							v-for="preset in SOCIAL_OVERLAY_PRESETS"
							:key="preset.platform"
							type="button"
							:class="[
								'flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors',
								activeSocialOverlay?.platform === preset.platform
									? 'text-cyan-400 bg-cyan-500/10'
									: 'text-zinc-300 hover:bg-white/5',
							]"
							@click="toggleSocialOverlay(preset)"
						>
							<span>{{ preset.icon }}</span>
							<span>{{ preset.label }}</span>
							<span class="ml-auto text-[10px] text-zinc-500">{{ preset.aspectRatio }}</span>
						</button>
					</div>
				</Teleport>
				<div v-if="showSocialMenu" class="fixed inset-0 z-[199]" @click="showSocialMenu = false" />
			</div>
		</template>

		<div class="h-3 w-px bg-white/20" />

		<!-- Fullscreen toggle -->
		<button
			type="button"
			class="flex items-center rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
			:aria-label="isFullscreen ? 'Exit preview fullscreen' : 'Open preview fullscreen'"
			:aria-pressed="isFullscreen"
			@click="toggleFullscreen"
		>
			<Minimize v-if="isFullscreen" class="size-3.5" />
			<Maximize v-else class="size-3.5" />
		</button>
	</div>

		<nav class="flex shrink-0 items-center gap-1.5 sm:gap-2">
			<span
				class="hidden items-center gap-1 text-[10px] text-zinc-500 xl:flex"
				:title="lastSavedAt ? `Last saved at ${lastSavedAt.toLocaleTimeString()}` : 'Autosave is enabled'"
				aria-live="polite"
			>
				<Loader2 v-if="isSaving" class="size-3 animate-spin" />
				{{ isSaving ? "Saving…" : lastSavedAt ? "Saved" : "Autosave on" }}
			</span>
			<button
				type="button"
				class="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
				aria-label="Open keyboard shortcuts"
				title="Keyboard shortcuts (?)"
				@click="openShortcuts"
			>
				<Keyboard class="size-3.5" />
				<span class="hidden 2xl:inline">Shortcuts</span>
			</button>
			<ChatFab compact />
			<template v-if="isImageMode">
				<div class="relative">
					<button
						type="button"
						class="flex items-center gap-1 rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-zinc-300 hover:bg-white/10 transition-colors"
						@click="showFormatDropdown = !showFormatDropdown"
					>
						{{ imageExportFormat.toUpperCase() }}
						<ChevronDown class="size-3" />
					</button>
					<div
						v-if="showFormatDropdown"
						class="absolute top-full right-0 z-50 mt-1 w-28 rounded-md border border-white/10 bg-[#1e1e22] shadow-md"
					>
						<button
							v-for="opt in imageFormatOptions"
							:key="opt.value"
							type="button"
							class="flex w-full items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-200 hover:bg-white/5"
							@click="imageExportFormat = opt.value; showFormatDropdown = false"
						>
							<Check v-if="imageExportFormat === opt.value" class="size-3 text-blue-400" />
							<span v-else class="size-3" />
							{{ opt.label }}
						</button>
					</div>
					<div
						v-if="showFormatDropdown"
						class="fixed inset-0 z-40"
						@click="showFormatDropdown = false"
					/>
				</div>
				<button
					type="button"
					:class="[
						'flex items-center gap-1.5 rounded-md px-[0.12rem] py-[0.12rem] text-white',
						isImageExporting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
					]"
					:disabled="isImageExporting"
					@click="handleImageExport"
				>
					<div class="relative flex items-center gap-1.5 rounded-md bg-[var(--sidebar-accent,#0ea5e9)] px-3 py-1.5 shadow-[0_1px_3px_0px_rgba(0,0,0,0.45)] hover:bg-[#0284c7] transition-colors">
						<component :is="imageExportSuccess ? Check : (isImageExporting ? Image : Download)" class="z-50 size-4" :class="{ 'animate-pulse': isImageExporting }" />
						<span class="z-50 text-[0.875rem] font-medium">{{ imageExportSuccess ? 'Saved!' : (isImageExporting ? 'Exporting...' : (isCoverMode ? 'Save Cover' : 'Export Image')) }}</span>
					</div>
				</button>
				<div v-if="!isCoverMode" class="relative">
					<button
						type="button"
						class="flex items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
						title="More export options"
						@click="showExportMenu = !showExportMenu"
					>
						<ChevronDown class="size-3.5" />
					</button>
					<div
						v-if="showExportMenu"
						class="absolute top-full right-0 z-50 mt-1 w-48 rounded-md border border-white/10 bg-[#1e1e22] shadow-md py-1"
					>
						<button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-200 hover:bg-white/5" @click="handleSaveAsWatermark">
							<Stamp class="size-3.5" />
							Save as Watermark
						</button>
						<button type="button" class="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-200 hover:bg-white/5" @click="openCampaignPicker">
							<Megaphone class="size-3.5" />
							Submit to Campaign
						</button>
					</div>
					<div v-if="showExportMenu" class="fixed inset-0 z-40" @click="showExportMenu = false" />
				</div>
			</template>
			<ExportButton v-else />
		</nav>
	</header>

	<Teleport to="body">
		<div v-if="showRenameDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
			<div class="w-80 rounded-lg border border-white/10 bg-[#1e1e22] p-6 shadow-lg">
				<h3 class="mb-4 font-medium">Rename project</h3>
				<input
					v-model="renameInput"
					type="text"
					class="mb-4 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200"
					@keydown.enter="handleRename"
				/>
				<div class="flex justify-end gap-2">
					<Button variant="outline" size="sm" @click="showRenameDialog = false">Cancel</Button>
					<Button size="sm" @click="handleRename">Save</Button>
				</div>
			</div>
		</div>
	</Teleport>

	<Teleport to="body">
		<div v-if="showCampaignPicker" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
			<div class="w-96 max-h-[60vh] rounded-lg border border-white/10 bg-[#1e1e22] shadow-lg flex flex-col">
				<div class="flex items-center justify-between border-b border-white/10 px-4 py-3">
					<h3 class="text-sm font-medium text-zinc-200">Submit to Campaign</h3>
					<button type="button" class="text-zinc-500 hover:text-zinc-300" @click="showCampaignPicker = false">
						<X class="size-4" />
					</button>
				</div>
				<div class="flex-1 overflow-y-auto p-4">
					<div v-if="isLoadingCampaigns" class="flex items-center justify-center py-8">
						<div class="size-5 animate-spin rounded-full border-2 border-zinc-600 border-t-purple-500" />
					</div>
					<div v-else-if="availableCampaigns.length === 0" class="text-center py-8 text-xs text-zinc-500">
						<Megaphone class="mx-auto mb-2 size-6 text-zinc-700" />
						<p>No active campaigns found</p>
						<p class="mt-1 text-[10px]">Join a campaign first to submit images</p>
					</div>
					<div v-else class="space-y-2">
						<button
							v-for="campaign in availableCampaigns"
							:key="campaign.id"
							type="button"
							class="flex w-full items-center gap-3 rounded-lg border border-white/5 p-3 text-left transition-colors hover:bg-white/5 hover:border-purple-500/30"
							@click="handleSubmitToCampaign(campaign.id)"
						>
							<div class="size-10 shrink-0 rounded-md bg-purple-600/20 flex items-center justify-center">
								<Megaphone class="size-4 text-purple-400" />
							</div>
							<div class="min-w-0 flex-1">
								<div class="truncate text-xs font-medium text-zinc-200">{{ campaign.title }}</div>
								<div class="truncate text-[10px] text-zinc-500">{{ campaign.organization?.name }}</div>
							</div>
						</button>
					</div>
				</div>
			</div>
		</div>
	</Teleport>

</template>
