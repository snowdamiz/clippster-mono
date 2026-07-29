<script setup lang="ts">
import { ref, computed } from "vue";
import { useEditor } from "../composables/useEditor";
import { Button } from "@/components/ui/button";
import { Check, ListChecks, Trash2, X } from "lucide-vue-next";

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

		<!-- Sheet overlay -->
		<Teleport to="body">
			<div v-if="isOpen" class="fixed inset-0 z-50 flex">
				<!-- Backdrop -->
				<div class="flex-1 bg-black/50" @click="isOpen = false" />

				<!-- Sheet panel -->
				<div class="flex w-80 flex-col border-l border-white/10 bg-[#18181b] text-zinc-200 shadow-lg">
					<!-- Header -->
					<div class="flex items-center justify-between border-b border-white/10 p-4">
						<div>
							<h2 class="font-medium">
								{{ isSelectMode ? `Select scenes (${selectedScenes.size})` : 'Scenes' }}
							</h2>
							<p class="text-zinc-500 text-xs">
								{{ isSelectMode ? 'Select scenes to delete' : 'Switch between scenes in your project' }}
							</p>
						</div>
						<Button variant="ghost" size="icon" @click="isOpen = false">
							<X class="size-4" />
						</Button>
					</div>

					<!-- Actions -->
					<div class="flex items-center gap-2 border-b border-white/10 p-4">
						<Button
							:variant="isSelectMode ? 'default' : 'outline'"
							size="sm"
							@click="handleSelectMode"
						>
							<ListChecks class="mr-1 size-4" />
							{{ isSelectMode ? 'Cancel' : 'Select' }}
						</Button>
						<Button
							v-if="isSelectMode"
							variant="destructive"
							size="sm"
							:disabled="isMainSceneSelected || selectedScenes.size === 0"
							@click="handleDeleteSelected"
						>
							<Trash2 class="mr-1 size-4" />
							Delete ({{ selectedScenes.size }})
						</Button>
					</div>

					<!-- Scene list -->
					<div class="flex-1 space-y-2 overflow-y-auto p-4">
						<div v-if="scenes.length === 0" class="text-zinc-500 text-sm">
							No scenes available
						</div>
						<Button
							v-for="scene in scenes"
							:key="scene.id"
							variant="outline"
							:class="[
								'w-full justify-between font-normal',
								currentScene?.id === scene.id && !isSelectMode && 'border-primary !text-primary',
								isSelectMode && selectedScenes.has(scene.id) && 'bg-accent border-foreground/30',
							]"
							@click="handleSceneSwitch(scene.id)"
						>
							<span>{{ scene.name }}</span>
							<Check
								v-if="(isSelectMode && selectedScenes.has(scene.id)) || (!isSelectMode && currentScene?.id === scene.id)"
								class="size-4"
							/>
						</Button>
					</div>
				</div>
			</div>
		</Teleport>
	</div>
</template>
