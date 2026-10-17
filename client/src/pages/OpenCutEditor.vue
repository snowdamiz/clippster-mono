<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import EditorLayout from "@/editor/components/EditorLayout.vue";
import { EditorCore } from "@/editor/core";
import { loadClippsterProject } from "@/editor/bridge/project-loader";
import { AlertTriangle, ArrowLeft, Loader2, RotateCcw } from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { useAppTour } from "@/composables/useAppTour";

const route = useRoute();
const router = useRouter();
const { notifyEditorReadyForTour } = useAppTour();

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
		await nextTick();
		await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));

		notifyEditorReadyForTour(route.query.tour === '1' ? 'page_video_editor' : undefined);
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
	<div v-if="isLoading" class="flex h-full w-full items-center justify-center bg-panel">
		<div class="flex flex-col items-center gap-3">
			<Loader2 class="size-6 animate-spin text-brand" />
			<p class="text-sm text-fg-muted">{{ loadStage }}</p>
		</div>
	</div>

	<!-- Error state -->
	<div v-else-if="error" class="flex h-full w-full items-center justify-center bg-panel">
		<EmptyState :icon="AlertTriangle" tone="danger" title="Couldn't open the editor" :description="error">
			<Button variant="ghost" @click="handleBack">
				<ArrowLeft />
				Back to projects
			</Button>
			<Button variant="primary" @click="retryLoad">
				<RotateCcw />
				Try again
			</Button>
		</EmptyState>
	</div>

	<!-- Editor (fills the content area under the app title bar) -->
	<div v-else class="opencut-editor h-full w-full overflow-hidden">
		<EditorLayout />
	</div>
</template>
