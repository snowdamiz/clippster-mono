<script setup lang="ts">
import { ref, computed } from "vue";
import { useEditor } from "../composables/useEditor";
import { useImageMode } from "../composables/useImageMode";
import type { ImageExportFormat } from "../composables/useImageMode";
import { useRouter } from "vue-router";
import ExportButton from "./ExportButton.vue";
import { Button } from "@/components/ui/button";
import { ChevronDown, ArrowLeft, Pencil, Trash2, Keyboard, X, Download, Image, Check, Paintbrush, Stamp, Megaphone } from "lucide-vue-next";
import ShortcutsDialog from "./dialogs/ShortcutsDialog.vue";
import { useWatermarkExport } from "@/composables/useWatermarkExport";
import { useCampaignImageSubmit } from "@/composables/useCampaignImageSubmit";
import ChatFab from "@/components/chat/ChatFab.vue";

const { editor, version } = useEditor();
const { isImageMode, isCoverMode, exportAsImage, exportAndSave, exportAndSaveAsCover } = useImageMode();
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
const renameInput = ref("");

const activeProject = computed(() => {
	void version.value;
	try {
		return editor.project.getActive();
	} catch {
		return null;
	}
});

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
	<header class="flex h-[3.2rem] items-center justify-between border-b border-white/10 bg-[#0e0e10] px-3 pt-0.5">
		<div class="relative flex items-center gap-2">
			<!-- Project dropdown -->
			<Button
				variant="secondary"
				class="flex h-auto items-center justify-center gap-1 px-2.5 py-1.5"
				@click="showDropdown = !showDropdown"
			>
				<ChevronDown class="text-zinc-400 size-4" />
				<span class="mr-2 text-[0.85rem]">{{ activeProject?.metadata.name }}</span>
			</Button>

			<!-- Dropdown menu -->
			<div
				v-if="showDropdown"
				class="absolute top-full left-0 z-50 mt-1 w-52 rounded-md border border-white/10 bg-[#1e1e22] shadow-md"
			>
				<button
					type="button"
					class="flex w-full items-center gap-1.5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
					:disabled="isExiting"
					@click="handleExit(); showDropdown = false"
				>
					<ArrowLeft class="size-4" />
					Exit project
				</button>
				<button
					type="button"
					class="flex w-full items-center gap-1.5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
					@click="openRename"
				>
					<Pencil class="size-4" />
					Rename project
				</button>
				<button
					type="button"
					class="flex w-full items-center gap-1.5 px-3 py-2 text-sm text-red-400 hover:bg-white/5"
					@click="handleDelete(); showDropdown = false"
				>
					<Trash2 class="size-4" />
					Delete project
				</button>
				<template v-if="!isImageMode">
					<div class="border-t border-white/10" />
					<button
						type="button"
						class="flex w-full items-center gap-1.5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
						@click="router.push('/design-studio'); showDropdown = false"
					>
						<Paintbrush class="size-4" />
						Design Thumbnail
					</button>
				</template>
				<div class="border-t border-white/10" />
				<button
					type="button"
					class="flex w-full items-center gap-1.5 px-3 py-2 text-sm text-zinc-200 hover:bg-white/5"
					@click="showShortcutsDialog = true; showDropdown = false"
				>
					<Keyboard class="size-4" />
					Keyboard shortcuts
				</button>
			</div>

			<!-- Click-away overlay -->
			<div
				v-if="showDropdown"
				class="fixed inset-0 z-40"
				@click="showDropdown = false"
			/>
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
			<ChatFab />
			<button
				type="button"
				class="flex items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
				:disabled="isExiting"
				title="Close (Esc)"
				@click="handleExit"
			>
				<X :size="16" />
			</button>
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
