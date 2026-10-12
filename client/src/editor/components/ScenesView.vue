<script setup lang="ts">
import { ref, computed } from "vue";
import { useEditor } from "../composables/useEditor";
import { Button } from "@/components/ui/button";
import { Check, ListChecks, Trash2 } from "lucide-vue-next";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";

const { editor, version } = useEditor({
	subscribe: {
		scenes: true,
		playback: false,
		timeline: false,
		project: false,
		media: false,
		selection: false,
	},
});

const isOpen = ref(false);
const isSelectMode = ref(false);
const selectedScenes = ref<Set<string>>(new Set());

const scenes = computed(() => {
	void version.value;
	return editor.scenes.getScenes();
});

const currentScene = computed(() => {
	void version.value;
	return editor.scenes.getActiveScene();
});

function handleSceneSwitch(sceneId: string) {
	if (isSelectMode.value) {
		toggleSceneSelection(sceneId);
		return;
	}
	try {
		editor.scenes.switchToScene({ sceneId });
	} catch (error) {
		console.error("Failed to switch scene:", error);
	}
}

function toggleSceneSelection(sceneId: string) {
	const newSet = new Set(selectedScenes.value);
	if (newSet.has(sceneId)) {
		newSet.delete(sceneId);
	} else {
		newSet.add(sceneId);
	}
	selectedScenes.value = newSet;
}

function handleSelectMode() {
	isSelectMode.value = !isSelectMode.value;
	selectedScenes.value = new Set();
}

async function handleDeleteSelected() {
	for (const sceneId of selectedScenes.value) {
		const scene = scenes.value.find((s) => s.id === sceneId);
		if (!scene || scene.isMain) continue;
		try {
			await editor.scenes.deleteScene({ sceneId });
		} catch (error) {
			console.error("Failed to delete scene:", error);
		}
	}
	selectedScenes.value = new Set();
	isSelectMode.value = false;
}

const isMainSceneSelected = computed(() => {
	const mainScene = scenes.value.find((s) => s.isMain);
	return mainScene ? selectedScenes.value.has(mainScene.id) : false;
});
</script>

<template>
	<div>
		<!-- Trigger slot -->
		<div @click="isOpen = true">
			<slot />
		</div>

		<Sheet v-model:open="isOpen">
			<SheetContent side="right" class="flex w-80 flex-col gap-0 p-0">
				<!-- Header -->
				<div class="border-b border-line-subtle px-4 py-3 pr-12">
					<SheetTitle class="text-sm font-semibold text-fg">
						{{ isSelectMode ? `Select scenes (${selectedScenes.size})` : "Scenes" }}
					</SheetTitle>
					<SheetDescription class="mt-0.5 text-xs text-fg-muted">
						{{ isSelectMode ? "Select scenes to delete" : "Switch between scenes in your project" }}
					</SheetDescription>
				</div>

				<!-- Actions -->
				<div class="flex items-center gap-2 border-b border-line-subtle px-4 py-2.5">
					<Button :variant="isSelectMode ? 'secondary' : 'ghost'" size="sm" @click="handleSelectMode">
						<ListChecks />
						{{ isSelectMode ? "Cancel" : "Select" }}
					</Button>
					<Button
						v-if="isSelectMode"
						variant="destructive-soft"
						size="sm"
						:disabled="isMainSceneSelected || selectedScenes.size === 0"
						@click="handleDeleteSelected"
					>
						<Trash2 />
						Delete ({{ selectedScenes.size }})
					</Button>
				</div>

				<!-- Scene list -->
				<div class="flex-1 space-y-1 overflow-y-auto p-2">
					<p v-if="scenes.length === 0" class="px-2 py-3 text-sm text-fg-subtle">No scenes available</p>
					<button
						v-for="scene in scenes"
						:key="scene.id"
						type="button"
						:class="[
							'flex h-9 w-full items-center justify-between rounded-md px-2.5 text-left text-sm transition-colors',
							(currentScene?.id === scene.id && !isSelectMode) || (isSelectMode && selectedScenes.has(scene.id))
								? 'bg-brand-soft text-brand'
								: 'text-fg hover:bg-surface-hover',
						]"
						@click="handleSceneSwitch(scene.id)"
					>
						<span class="truncate">{{ scene.name }}</span>
						<Check
							v-if="(isSelectMode && selectedScenes.has(scene.id)) || (!isSelectMode && currentScene?.id === scene.id)"
							class="size-4 shrink-0"
						/>
					</button>
				</div>
			</SheetContent>
		</Sheet>
	</div>
</template>
