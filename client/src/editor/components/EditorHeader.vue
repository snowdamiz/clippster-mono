<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useEditor } from "../composables/useEditor";
import { useRouter } from "vue-router";
import ExportButton from "./ExportButton.vue";
import { Button } from "@/components/ui/button";
import { ChevronDown, ArrowLeft, Pencil, Trash2, Keyboard, X, Download, Image, Check, Paintbrush, Stamp, Megaphone, Smartphone, Maximize, Minimize } from "lucide-vue-next";
import ShortcutsDialog from "./dialogs/ShortcutsDialog.vue";
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

const props = defineProps<{
	previewContainer: HTMLDivElement | null;
}>();

const { editor, version } = useEditor();
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
	{ value: "webp", label: "WebP" },
	{ value: "svg", label: "SVG" },
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

		const canvas = editor.getPreviewCanvas();
		const project = activeProject.value;
		const name = project?.metadata.name || "Watermark";

		const wmId = await saveAsWatermark({
			blob,
			name,
			width: canvas?.width,
			height: canvas?.height,
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
const showDropdown = ref(false);
const showRenameDialog = ref(false);
const showShortcutsDialog = ref(false);
const showAspectMenu = ref(false);
const showSocialMenu = ref(false);
const isFullscreen = ref(false);
const aspectButtonRef = ref<HTMLButtonElement | null>(null);
const socialButtonRef = ref<HTMLButtonElement | null>(null);

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
const renameInput = ref("");
const vodInfo = ref<{ platform: string; streamerName: string | null } | null>(null);

const aspectPresets = [
	{ width: 1920, height: 1080, label: "16:9" },
	{ width: 1080, height: 1920, label: "9:16" },
	{ width: 1080, height: 1080, label: "1:1" },
	{ width: 1080, height: 1350, label: "4:5" },
];

const activeProject = computed(() => {
	void version.value;
	try {
		return editor.project.getActive();
	} catch {
		return null;
	}
});

const canvasWidth = computed(() => activeProject.value?.settings?.canvasSize?.width ?? 1920);
const canvasHeight = computed(() => activeProject.value?.settings?.canvasSize?.height ?? 1080);

const currentAspectLabel = computed(() => {
	const match = aspectPresets.find((p) => p.width === canvasWidth.value && p.height === canvasHeight.value);
	return match ? match.label : `${canvasWidth.value}×${canvasHeight.value}`;
});

const is916 = computed(() => canvasWidth.value === 1080 && canvasHeight.value === 1920);

watch(is916, (val) => {
	if (!val) {
		activeSocialOverlay.value = null;
		showSocialMenu.value = false;
	}
});

function setAspectRatio(preset: { width: number; height: number }) {
	editor.project.updateSettings({ settings: { canvasSize: preset } });
	showAspectMenu.value = false;
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
		if (source.source_type === "clip") {
			const clip = await getClip(source.source_id);
			if (!clip) { vodInfo.value = null; return; }
			const project = await getProject(clip.project_id);
			if (!project || !project.platform || project.platform === "Manual") {
				vodInfo.value = null;
				return;
			}
			const rawVideos = await getRawVideosByProjectId(project.id);
			vodInfo.value = {
				platform: normalizePlatformKey(project.platform),
				streamerName: rawVideos[0]?.source_mint_id ?? null,
			};
		} else {
			const rawVideo = await getRawVideo(source.source_id);
			if (!rawVideo) { vodInfo.value = null; return; }
			const project = await getProject(rawVideo.project_id);
			if (!project || !project.platform || project.platform === "Manual") {
				vodInfo.value = null;
				return;
			}
			vodInfo.value = {
				platform: normalizePlatformKey(project.platform),
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

	router.push(isImageMode.value ? "/" : "/video-editor");
}

async function handleRename() {
	const project = activeProject.value;
	if (!project || !renameInput.value.trim() || renameInput.value === project.metadata.name) {
		showRenameDialog.value = false;
		return;
	}
	try {
		await editor.project.renameProject({
			id: project.metadata.id,
			name: renameInput.value.trim(),
		});
	} catch (error) {
		console.error("Failed to rename project:", error);
	}
	showRenameDialog.value = false;
}

async function handleDelete() {
	const project = activeProject.value;
	if (!project) return;
	if (!confirm(`Delete "${project.metadata.name}"? This cannot be undone.`)) return;
	try {
		await editor.project.deleteProjects({ ids: [project.metadata.id] });
		router.push(isImageMode.value ? "/" : "/video-editor");
	} catch (error) {
		console.error("Failed to delete project:", error);
	}
}

function openRename() {
	renameInput.value = activeProject.value?.metadata.name || "";
	showRenameDialog.value = true;
	showDropdown.value = false;
}
</script>

<template>
	<header class="relative z-10 flex h-[3.2rem] items-center justify-between border-b border-white/10 bg-[#0e0e10] px-3 pt-0.5">
		<div class="flex items-center gap-2">
			<!-- Back arrow -->
			<button
				type="button"
				class="flex items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
				:disabled="isExiting"
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

			<span class="text-[0.85rem] text-zinc-200">{{ activeProject?.metadata.name }}</span>
		</div>

	<!-- Center: Aspect ratio + Social overlay + Fullscreen -->
	<div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 flex items-center gap-2">
		<!-- Aspect ratio dropdown -->
		<div class="relative">
			<button
				ref="aspectButtonRef"
				type="button"
				class="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
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
			@click="toggleFullscreen"
		>
			<Minimize v-if="isFullscreen" class="size-3.5" />
			<Maximize v-else class="size-3.5" />
		</button>
	</div>

	<nav class="flex items-center gap-2">
		<!-- Image mode: format selector + export image button -->
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
			<!-- Export button -->
			<button
				type="button"
				:class="[
					'flex items-center gap-1.5 rounded-md px-[0.12rem] py-[0.12rem] text-white',
					isImageExporting ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer',
				]"
				:disabled="isImageExporting"
				@click="handleImageExport"
			>
				<div class="relative flex items-center gap-1.5 rounded-[0.6rem] bg-gradient-to-l from-[#7c3aed] to-[#a855f7] px-4 py-1 shadow-[0_1px_3px_0px_rgba(0,0,0,0.65)]">
					<component :is="imageExportSuccess ? Check : (isImageExporting ? Image : Download)" class="z-50 size-4" :class="{ 'animate-pulse': isImageExporting }" />
					<span class="z-50 text-[0.875rem]">{{ imageExportSuccess ? 'Saved!' : (isImageExporting ? 'Exporting...' : (isCoverMode ? 'Save Cover' : 'Export Image')) }}</span>
				</div>
			</button>

			<!-- More export options (non-cover mode) -->
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
					<button
						type="button"
						class="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-200 hover:bg-white/5"
						@click="handleSaveAsWatermark"
					>
						<Stamp class="size-3.5" />
						Save as Watermark
					</button>
					<button
						type="button"
						class="flex w-full items-center gap-2 px-3 py-2 text-xs text-zinc-200 hover:bg-white/5"
						@click="openCampaignPicker"
					>
						<Megaphone class="size-3.5" />
						Submit to Campaign
					</button>
				</div>
				<div
					v-if="showExportMenu"
					class="fixed inset-0 z-40"
					@click="showExportMenu = false"
				/>
			</div>
		</template>
		<!-- Video mode: standard export -->
		<ExportButton v-else />
		<ChatFab compact />
	</nav>

	<!-- Rename dialog -->
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

		<!-- Campaign picker dialog -->
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

		<!-- Shortcuts dialog -->
		<ShortcutsDialog v-model:open="showShortcutsDialog" />
	</header>
</template>
