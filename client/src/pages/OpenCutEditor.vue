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
const loadStage = ref("Reading project metadata…");
let loadController: AbortController | null = null;
let loadedEditor: EditorCore | null = null;

async function loadProject() {
	console.log('[OpenCutEditor] Component mounted, route query:', route.query);
	error.value = null;
	isLoading.value = true;
	loadStage.value = "Reading project metadata…";
	loadController?.abort();
	loadController = new AbortController();
	const controller = loadController;

	const projectId = route.query.projectId as string;
	if (!projectId) {
		console.error('[OpenCutEditor] No project ID in query params');
		error.value = "No project ID provided";
		isLoading.value = false;
		return;
	}

	console.log('[OpenCutEditor] Loading project:', projectId);

	try {
		// Load the Clippster project into the OpenCut editor via bridge
		// This initializes EditorCore internally and converts the SQLite project
		console.log('[OpenCutEditor] Calling loadClippsterProject...');
		loadStage.value = "Preparing editor workspace…";
		const editor = await loadClippsterProject(projectId, {
			signal: controller.signal,
		});
		if (controller.signal.aborted) {
			editor.dispose();
			return;
		}
		loadedEditor = editor;
		console.log('[OpenCutEditor] Project loaded successfully');

		console.log('[OpenCutEditor] Project fully loaded and ready');
		isLoading.value = false;
	} catch (err) {
		if (controller.signal.aborted) return;
		console.error('[OpenCutEditor] Failed to load project into editor:', err);
		console.error('[OpenCutEditor] Error stack:', err instanceof Error ? err.stack : 'No stack trace');
		error.value = err instanceof Error ? err.message : "Failed to load project";
		isLoading.value = false;
	}
}

onMounted(loadProject);

onUnmounted(() => {
	loadController?.abort();
	EditorCore.reset(loadedEditor ?? undefined);
	loadedEditor = null;
});

async function retryLoad() {
	EditorCore.reset(loadedEditor ?? undefined);
	loadedEditor = null;
	await loadProject();
}

function handleBack() {
	router.push("/video-editor");
}
</script>

<template>
	<!-- Loading state -->
	<div v-if="isLoading" class="flex h-screen w-screen items-center justify-center bg-background">
		<div class="flex flex-col items-center gap-3">
			<Loader2 class="text-primary size-8 animate-spin" />
			<p class="text-muted-foreground text-sm">{{ loadStage }}</p>
		</div>
	</div>

	<!-- Error state -->
	<div v-else-if="error" class="flex h-screen w-screen items-center justify-center bg-background">
		<div class="flex flex-col items-center gap-4 text-center">
			<p class="text-destructive text-lg font-medium">Failed to load editor</p>
			<p class="text-muted-foreground text-sm">{{ error }}</p>
			<button
				type="button"
				class="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground"
				@click="retryLoad"
			>
				Try again
			</button>
			<button type="button" class="text-primary text-sm underline" @click="handleBack">
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
