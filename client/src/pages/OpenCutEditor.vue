<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useRoute, useRouter } from "vue-router";
import EditorLayout from "@/editor/components/EditorLayout.vue";
import { EditorCore } from "@/editor/core";
import { loadClippsterProject } from "@/editor/bridge/project-loader";
import { Loader2 } from "lucide-vue-next";

const route = useRoute();
const router = useRouter();

const isLoading = ref(true);
const error = ref<string | null>(null);

onMounted(async () => {
	const projectId = route.query.projectId as string;
	if (!projectId) {
		error.value = "No project ID provided";
		isLoading.value = false;
		return;
	}

	try {
		// Load the Clippster project into the OpenCut editor via bridge
		// This initializes EditorCore internally and converts the SQLite project
		const editor = await loadClippsterProject(projectId);

		// Wait for project to be fully loaded and ready
		// Verify that both project and scene are accessible before rendering
		let retries = 0;
		const maxRetries = 50; // 5 seconds max wait
		while (retries < maxRetries) {
			const project = editor.project.getActiveOrNull();
			const scenes = editor.scenes.getScenes();
			
			if (project && scenes.length > 0) {
				// Project and scenes are loaded, safe to render
				break;
			}
			
			await new Promise(resolve => setTimeout(resolve, 100));
			retries++;
		}

		if (retries >= maxRetries) {
			throw new Error("Timeout waiting for project to load");
		}

		isLoading.value = false;
	} catch (err) {
		console.error("Failed to load project into editor:", err);
		error.value = err instanceof Error ? err.message : "Failed to load project";
		isLoading.value = false;
	}
});

onUnmounted(() => {
	// Reset the editor singleton when leaving the page
	EditorCore.reset();
});

function handleBack() {
	router.push("/video-editor");
}
</script>

<template>
	<!-- Loading state -->
	<div v-if="isLoading" class="flex h-screen w-screen items-center justify-center bg-background">
		<div class="flex flex-col items-center gap-3">
			<Loader2 class="text-primary size-8 animate-spin" />
			<p class="text-muted-foreground text-sm">Loading editor...</p>
		</div>
	</div>

	<!-- Error state -->
	<div v-else-if="error" class="flex h-screen w-screen items-center justify-center bg-background">
		<div class="flex flex-col items-center gap-4 text-center">
			<p class="text-destructive text-lg font-medium">Failed to load editor</p>
			<p class="text-muted-foreground text-sm">{{ error }}</p>
			<button
				type="button"
				class="text-primary text-sm underline"
				@click="handleBack"
			>
				Back to projects
			</button>
		</div>
	</div>

	<!-- Editor -->
	<div v-else class="opencut-editor h-screen w-screen overflow-hidden">
		<EditorLayout />
	</div>
</template>

<style scoped>
/* FloatingChat is hidden via useChatPopout composable for this route */
</style>
