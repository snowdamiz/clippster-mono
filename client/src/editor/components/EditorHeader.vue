<script setup lang="ts">
import { ref, computed } from "vue";
import { useEditor } from "../composables/useEditor";
import { useRouter } from "vue-router";
import ExportButton from "./ExportButton.vue";
import { Button } from "@/components/ui/button";
import { ChevronDown, ArrowLeft, Pencil, Trash2, Keyboard, X } from "lucide-vue-next";
import ShortcutsDialog from "./dialogs/ShortcutsDialog.vue";

const { editor, version } = useEditor();
const router = useRouter();

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
