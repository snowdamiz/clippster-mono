<script setup lang="ts">
	import { confirmDialog } from '@/composables/useDialogs';
import { ref, computed, watch, nextTick, inject } from "vue";
import { useEditor } from "../composables/useEditor";
import { useRouter } from "vue-router";
import ExportButton from "./ExportButton.vue";
import ImageExportDialog from "./ImageExportDialog.vue";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ChevronDown, Keyboard, Loader2, Download, Image, Check, Stamp, Megaphone, Redo2, Undo2 } from "lucide-vue-next";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Modal } from "@/components/ui/modal";
import { EmptyState } from "@/components/ui/empty-state";
import { IconTile } from "@/components/ui/icon-tile";
import ToolbarButton from "./chrome/ToolbarButton.vue";
import ToolbarSeparator from "./chrome/ToolbarSeparator.vue";
import { invokeAction } from "../lib/actions";
import { useImageMode } from "../composables/useImageMode";
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

const props = defineProps<{
	previewContainer: HTMLDivElement | null;
	isSaving: boolean;
	lastSavedAt: Date | null;
}>();

const { editor, version } = useEditor({
	subscribe: {
		project: true,
		playback: false,
		// Undo/redo availability changes with timeline + selection edits.
		timeline: true,
		scenes: false,
		media: false,
		selection: true,
	},
});
const { isImageMode, isCoverMode, exportAsImage, exportAndSaveAsCover } = useImageMode();
const { saveAsWatermark } = useWatermarkExport();
const { availableCampaigns, isSubmitting, isLoadingCampaigns, loadMyCampaigns, submitImageToCampaign } = useCampaignImageSubmit();
const router = useRouter();
const imageEditorExitToProjects = inject<(() => Promise<void>) | null>(
	"imageEditorExitToProjects",
	null,
);

// Image export state
const isImageExporting = ref(false);
const imageExportSuccess = ref(false);
const showImageExportDialog = ref(false);
const showExportMenu = ref(false);
const showCampaignPicker = ref(false);

function openImageExportDialog() {
	if (isCoverMode.value) {
		void handleImageExport();
		return;
	}
	showImageExportDialog.value = true;
}

async function handleImageExport() {
	if (isImageExporting.value) return;
	isImageExporting.value = true;
	imageExportSuccess.value = false;
	try {
		const result = await exportAndSaveAsCover("png");
		if (result) {
			imageExportSuccess.value = true;
			setTimeout(() => { router.push("/clips"); }, 1200);
		}
	} catch (err) {
		console.error("[EditorHeader] Cover export failed:", err);
	} finally {
		isImageExporting.value = false;
	}
}

function onImageExported() {
	imageExportSuccess.value = true;
	setTimeout(() => { imageExportSuccess.value = false; }, 2000);
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
const showDropdown = ref(false);
const titleInputRef = ref<HTMLInputElement | null>(null);
const isRenamingTitle = ref(false);
const renameInput = ref("");
const vodInfo = ref<{ platform: string; streamerName: string | null } | null>(null);

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull();
});

const projectTitle = computed(() => activeProject.value?.metadata.name || "Untitled");

const canUndo = computed(() => {
	void version.value;
	return editor.command.canUndo();
});
const canRedo = computed(() => {
	void version.value;
	return editor.command.canRedo();
});

const saveStatusLabel = computed(() =>
	props.isSaving ? "Saving…" : props.lastSavedAt ? "Saved" : "Autosave on",
);

function openShortcuts() {
	window.dispatchEvent(new CustomEvent("toggle-shortcuts-modal"));
}

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

	// Image mode: sync thumbnail + project_data before navigating so Design Projects matches canvas.
	if (isImageMode.value && imageEditorExitToProjects) {
		try {
			await imageEditorExitToProjects();
		} catch (error) {
			console.error("Failed to exit image editor:", error);
			await router.push("/design-studio");
		}
		return;
	}

	try {
		editor.project.closeProject();
	} catch (error) {
		console.error("Failed to close project:", error);
	}

	router.push("/video-editor");
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
	if (!(await confirmDialog({ title: 'Delete project?', message: `"${project.metadata.name}" will be permanently deleted. This cannot be undone.`, confirmText: 'Delete', variant: 'destructive' }))) return;
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
	<header class="relative z-10 flex h-11 shrink-0 items-center gap-2 border-b border-line-subtle bg-panel pl-2 pr-3">
		<!-- Left: back, source, project name -->
		<div class="flex min-w-0 flex-1 items-center gap-1">
			<ToolbarButton
				:label="isExiting ? 'Saving and exiting editor' : 'Back to projects'"
				:disabled="isExiting"
				@click="handleExit"
			>
				<Loader2 v-if="isExiting" class="animate-spin" />
				<ArrowLeft v-else />
			</ToolbarButton>

			<!-- VOD info -->
			<template v-if="vodInfo">
				<ToolbarSeparator />
				<div class="flex min-w-0 shrink items-center gap-1.5 px-1">
					<img
						:src="getPlatformConfig(vodInfo.platform)?.icon"
						class="size-3.5 shrink-0 object-contain"
						:alt="vodInfo.platform"
					/>
					<span v-if="vodInfo.streamerName" class="truncate text-xs text-fg-muted">
						{{ vodInfo.streamerName }}
					</span>
				</div>
				<span class="text-fg-disabled">/</span>
			</template>

			<!-- Project name (click to rename) -->
			<input
				v-if="isRenamingTitle"
				ref="titleInputRef"
				v-model="renameInput"
				type="text"
				class="h-7 w-64 min-w-24 rounded-md border border-brand-line bg-surface-raised px-2 text-sm text-fg shadow-[0_0_0_3px_var(--brand-soft)] outline-none"
				aria-label="Project name"
				@blur="handleRename"
				@keydown.enter.prevent="handleRename"
				@keydown.escape.prevent="cancelRename"
			/>
			<button
				v-else
				type="button"
				class="h-7 min-w-0 max-w-72 truncate rounded-md px-1.5 text-left text-sm font-medium text-fg transition-colors hover:bg-surface-hover focus-visible:shadow-[var(--focus-ring)]"
				:title="`Rename ${projectTitle}`"
				@click="openRename"
			>
				{{ projectTitle }}
			</button>

			<span
				class="ml-1 hidden shrink-0 items-center gap-1 text-2xs text-fg-subtle lg:flex"
				:title="lastSavedAt ? `Last saved at ${lastSavedAt.toLocaleTimeString()}` : 'Autosave is enabled'"
				aria-live="polite"
			>
				<Loader2 v-if="isSaving" class="size-3 animate-spin" />
				<Check v-else-if="lastSavedAt" class="size-3" />
				{{ saveStatusLabel }}
			</span>
		</div>

		<!-- Right: history, utilities, export -->
		<nav class="flex shrink-0 items-center gap-1">
			<ToolbarButton label="Undo" shortcut="Ctrl+Z" :disabled="!canUndo" @click="invokeAction('undo')">
				<Undo2 />
			</ToolbarButton>
			<ToolbarButton label="Redo" shortcut="Ctrl+Shift+Z" :disabled="!canRedo" @click="invokeAction('redo')">
				<Redo2 />
			</ToolbarButton>

			<ToolbarSeparator />

			<ToolbarButton label="Keyboard shortcuts" shortcut="?" @click="openShortcuts">
				<Keyboard />
			</ToolbarButton>
			<ChatFab compact />

			<div class="ml-1.5 flex items-center">
				<template v-if="isImageMode">
					<Button
						variant="primary"
						size="sm"
						data-tour-id="tour-image-export"
						:disabled="isImageExporting"
						:class="!isCoverMode && 'rounded-r-none'"
						@click="openImageExportDialog"
					>
						<component
							:is="imageExportSuccess ? Check : (isImageExporting ? Image : Download)"
							:class="{ 'animate-pulse': isImageExporting }"
						/>
						{{ imageExportSuccess ? "Saved" : (isImageExporting ? "Exporting…" : (isCoverMode ? "Save cover" : "Export image")) }}
					</Button>
					<DropdownMenu v-if="!isCoverMode" v-model:open="showExportMenu">
						<DropdownMenuTrigger as-child>
							<Button
								variant="primary"
								size="icon-sm"
								class="rounded-l-none border-l border-black/15"
								title="More export options"
								aria-label="More export options"
							>
								<ChevronDown />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" class="w-52">
							<DropdownMenuItem @select="handleSaveAsWatermark">
								<Stamp />
								Save as watermark
							</DropdownMenuItem>
							<DropdownMenuItem @select="openCampaignPicker">
								<Megaphone />
								Submit to campaign
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</template>
				<span v-else data-tour-id="tour-editor-export">
					<ExportButton />
				</span>
			</div>
		</nav>
	</header>

	<Modal v-model:open="showRenameDialog" title="Rename project" size="sm">
		<Input v-model="renameInput" aria-label="Project name" @keydown.enter="handleRename" />
		<template #footer>
			<Button variant="ghost" @click="showRenameDialog = false">Cancel</Button>
			<Button variant="primary" @click="handleRename">Save</Button>
		</template>
	</Modal>

	<Modal
		v-model:open="showCampaignPicker"
		title="Submit to campaign"
		description="Send this design to a campaign you've joined."
		:icon="Megaphone"
		size="md"
		:flush="true"
		body-class="px-2 pb-2 pt-2"
	>
		<div v-if="isLoadingCampaigns" class="flex flex-col gap-1.5 p-2">
			<div v-for="i in 3" :key="i" class="skeleton h-12 w-full" />
		</div>
		<EmptyState
			v-else-if="availableCampaigns.length === 0"
			size="sm"
			:icon="Megaphone"
			title="No active campaigns"
			description="Join a campaign first to submit images."
		/>
		<div v-else class="flex flex-col gap-0.5">
			<button
				v-for="campaign in availableCampaigns"
				:key="campaign.id"
				type="button"
				class="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-surface-hover"
				@click="handleSubmitToCampaign(campaign.id)"
			>
				<IconTile :icon="Megaphone" size="md" />
				<div class="min-w-0 flex-1">
					<div class="truncate text-sm font-medium text-fg">{{ campaign.title }}</div>
					<div class="truncate text-xs text-fg-subtle">{{ campaign.organization?.name }}</div>
				</div>
			</button>
		</div>
	</Modal>

	<ImageExportDialog
		:open="showImageExportDialog"
		@close="showImageExportDialog = false"
		@exported="onImageExported"
	/>
</template>
