<script setup lang="ts">
import { ref, provide, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import EditorLayout from "@/editor/components/EditorLayout.vue";
import { EditorCore } from "@/editor/core";
import { createImageProject, loadImageProject } from "@/editor/bridge/image-project-loader";
import { Loader2 } from "lucide-vue-next";

const route = useRoute();
const router = useRouter();

const isLoading = ref(true);
const error = ref<string | null>(null);

// Cover image mode: when opened from a clip's "Design Cover" action
const coverForClipId = ref<string | null>(route.query.coverForClip as string | null);
provide("coverForClipId", coverForClipId);

onMounted(async () => {
	const projectId = route.query.projectId as string | undefined;

	try {
		if (projectId) {
			// Load existing image project
			const editor = await loadImageProject(projectId);

			// Wait for project to be fully loaded
			let retries = 0;
			const maxRetries = 50;
			while (retries < maxRetries) {
				const project = editor.project.getActiveOrNull();
				const scenes = editor.scenes.getScenes();
				if (project && scenes.length > 0) break;
				await new Promise(resolve => setTimeout(resolve, 100));
				retries++;
			}

			if (retries >= maxRetries) {
				throw new Error("Timeout waiting for project to load");
			}
		} else {
			// Create a new blank image project
			const name = coverForClipId.value ? "Clip Cover Image" : "Untitled Design";
			await createImageProject({
				name,
				canvasSize: { width: 1280, height: 720 },
			});
		}

		isLoading.value = false;
	} catch (err) {
		console.error("Failed to load image editor:", err);
		error.value = err instanceof Error ? err.message : "Failed to load editor";
		isLoading.value = false;
	}
});

onUnmounted(() => {
	EditorCore.reset();
});

function handleBack() {
	router.push("/design-studio");
}
</script>

<template>
	<!-- Loading state -->
	<div v-if="isLoading" class="flex h-screen w-screen items-center justify-center bg-[#0e0e10]">
		<div class="flex flex-col items-center gap-3">
			<Loader2 class="text-primary size-8 animate-spin" />
			<p class="text-zinc-500 text-sm">Loading design studio...</p>
		</div>
	</div>

	<!-- Error state -->
	<div v-else-if="error" class="flex h-screen w-screen items-center justify-center bg-[#0e0e10]">
		<div class="flex flex-col items-center gap-4 text-center">
			<p class="text-destructive text-lg font-medium">Failed to load editor</p>
			<p class="text-zinc-500 text-sm">{{ error }}</p>
			<button
				type="button"
				class="text-primary text-sm underline"
				@click="handleBack"
			>
				Back to Design Studio
			</button>
		</div>
	</div>

	<!-- Editor -->
	<div v-else class="h-screen w-screen overflow-hidden">
		<EditorLayout />
	</div>
</template>
