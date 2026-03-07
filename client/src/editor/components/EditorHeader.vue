<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { useEditor } from "../composables/useEditor";
import { useRouter } from "vue-router";
import ExportButton from "./ExportButton.vue";
import { Button } from "@/components/ui/button";
import { ChevronDown, ArrowLeft, Pencil, Trash2, Keyboard, X } from "lucide-vue-next";
import ShortcutsDialog from "./dialogs/ShortcutsDialog.vue";
import ChatFab from "@/components/chat/ChatFab.vue";
import {
	getVideoEditorSourcesByProjectId,
	getClip,
	getProject,
	getRawVideosByProjectId,
	getRawVideo,
} from "@/services/database";
import { getPlatformConfig } from "@/config/platforms";

const { editor, version } = useEditor();
const router = useRouter();

const isExiting = ref(false);
const showDropdown = ref(false);
const showRenameDialog = ref(false);
const showShortcutsDialog = ref(false);
const renameInput = ref("");
const vodInfo = ref<{ platform: string; streamerName: string | null } | null>(null);

const activeProject = computed(() => {
	void version.value;
	try {
		return editor.project.getActive();
	} catch {
		return null;
	}
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

	router.push("/video-editor");
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
		router.push("/video-editor");
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
			<!-- VOD info + project name + Menu button -->
			<div class="flex items-center gap-2">
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

				<Button
					variant="secondary"
					class="flex h-auto items-center justify-center gap-1 px-2.5 py-1.5"
					@click="showDropdown = !showDropdown"
				>
					<span class="text-[0.85rem]">Menu</span>
					<ChevronDown class="text-zinc-400 size-4" />
				</Button>
			</div>

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
			<ChatFab compact />
			<ExportButton />
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

		<!-- Shortcuts dialog -->
		<ShortcutsDialog v-model:open="showShortcutsDialog" />
	</header>
</template>
