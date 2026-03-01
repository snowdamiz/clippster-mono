<script setup lang="ts">
import { ref, provide, onMounted, onUnmounted, computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import EditorLayout from "@/editor/components/EditorLayout.vue";
import { EditorCore } from "@/editor/core";
import { createImageProject, loadImageProject } from "@/editor/bridge/image-project-loader";
import { useImageEditorProjects } from "@/composables/useImageEditorProjects";
import { Loader2, Wand2, X, Plus, Trash2, ArrowLeft, Image as ImageIcon } from "lucide-vue-next";

const route = useRoute();
const router = useRouter();

const isLoading = ref(true);
const error = ref<string | null>(null);
const projectManager = useImageEditorProjects();
const isLoadingProjects = ref(false);
const showProjectNameDialog = ref(false);
const projectNameInput = ref("");
const projectNameError = ref("");

// Cover image mode: when opened from a clip's "Design Cover" action
const coverForClipId = ref<string | null>(route.query.coverForClip as string | null);
provide("coverForClipId", coverForClipId);

const showProjectPicker = computed(() => !projectManager.project.value && !isLoading.value && !error.value);

onMounted(async () => {
	const projectId = route.query.projectId as string | undefined;

	// If no projectId, show project picker
	if (!projectId) {
		isLoading.value = false;
		await loadProjects();
		return;
	}

	// Load existing project
	try {
		// Load from backend
		const backendProject = await projectManager.loadProject(parseInt(projectId));
		
		// Load into editor
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

async function loadProjects() {
	isLoadingProjects.value = true;
	try {
		await projectManager.listProjects();
	} catch (e) {
		console.error("[ImageEditor] Failed to load projects:", e);
	} finally {
		isLoadingProjects.value = false;
	}
}

function createNewProject() {
	projectNameInput.value = "";
	projectNameError.value = "";
	showProjectNameDialog.value = true;
}

async function confirmCreateProject() {
	const name = projectNameInput.value.trim();
	if (!name) {
		projectNameError.value = "Project name is required";
		return;
	}
	if (name.length > 100) {
		projectNameError.value = "Project name must be 100 characters or less";
		return;
	}

	try {
		isLoading.value = true;
		showProjectNameDialog.value = false;
		
		// Create editor project first
		const canvasSize = coverForClipId.value 
			? { width: 1280, height: 720 }
			: { width: 1280, height: 720 };
		
		await createImageProject({ name, canvasSize });
		
		// Get the editor state to save
		const editor = EditorCore.getInstance();
		const project = editor.project.getActiveOrNull();
		if (!project) throw new Error("Failed to create editor project");
		
		// Save to backend (project data will be stored in Tauri SQLite)
		const backendProject = await projectManager.createProject({
			name,
			project_data: { id: project.metadata.id, name: project.metadata.name },
			canvas_width: canvasSize.width,
			canvas_height: canvasSize.height,
		});
		
		// Update URL with project ID
		router.replace({ query: { ...route.query, projectId: backendProject.id.toString() } });
		
		isLoading.value = false;
	} catch (e) {
		console.error("[ImageEditor] Failed to create project:", e);
		projectNameError.value = "Failed to create project. Please try again.";
		isLoading.value = false;
	}
}

async function openProject(id: number) {
	try {
		router.push({ path: "/design-studio", query: { projectId: id.toString() } });
	} catch (e) {
		console.error("[ImageEditor] Failed to open project:", e);
	}
}

async function deleteProject(id: number) {
	const project = projectManager.projects.value.find(p => p.id === id);
	const projectName = project?.name || "Untitled Design";
	
	if (!confirm(`Are you sure you want to delete "${projectName}"? This action cannot be undone.`)) {
		return;
	}

	try {
		await projectManager.deleteProject(id);
	} catch (e) {
		console.error("[ImageEditor] Failed to delete project:", e);
		alert("Failed to delete project. Please try again.");
	}
}

function backToProjects() {
	projectManager.closeProject();
	EditorCore.reset();
	router.push({ path: "/design-studio" });
}

function formatDate(dateStr: string): string {
	try {
		const d = new Date(dateStr);
		const now = new Date();
		const diffMs = now.getTime() - d.getTime();
		const diffMins = Math.floor(diffMs / 60000);
		if (diffMins < 1) return "Just now";
		if (diffMins < 60) return `${diffMins}m ago`;
		const diffHours = Math.floor(diffMins / 60);
		if (diffHours < 24) return `${diffHours}h ago`;
		const diffDays = Math.floor(diffHours / 24);
		if (diffDays < 7) return `${diffDays}d ago`;
		return d.toLocaleDateString();
	} catch {
		return "";
	}
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
				@click="backToProjects"
			>
				Back to Projects
			</button>
		</div>
	</div>

	<!-- Project Picker -->
	<div v-else-if="showProjectPicker" class="h-screen w-screen overflow-hidden bg-[#0e0e10]">
		<div class="flex h-full flex-col">
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-white/10 px-6 py-4">
				<div class="flex items-center gap-3">
					<div class="flex size-10 items-center justify-center rounded-lg bg-purple-600/20">
						<ImageIcon :size="20" class="text-purple-400" />
					</div>
					<div>
						<h2 class="text-lg font-semibold text-zinc-100">Design Studio</h2>
						<p class="text-xs text-zinc-500">Create and manage your design projects</p>
					</div>
				</div>
				<button
					@click="router.back()"
					class="flex size-8 items-center justify-center rounded-lg text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
					title="Close"
				>
					<X :size="18" />
				</button>
			</div>

			<!-- Content -->
			<div class="flex-1 overflow-y-auto p-6">
				<!-- Loading state -->
				<div v-if="isLoadingProjects" class="flex items-center justify-center py-20">
					<Loader2 :size="32" class="animate-spin text-zinc-500" />
					<p class="ml-3 text-sm text-zinc-500">Loading your projects...</p>
				</div>

				<!-- Empty state -->
				<div v-else-if="projectManager.projects.value.length === 0" class="flex flex-col items-center justify-center py-20">
					<div class="flex size-20 items-center justify-center rounded-full bg-white/5">
						<ImageIcon :size="40" class="text-zinc-600" />
					</div>
					<h3 class="mt-4 text-lg font-medium text-zinc-200">No projects yet</h3>
					<p class="mt-1 text-sm text-zinc-500">Create your first design project to get started</p>
					<button
						@click="createNewProject"
						class="mt-6 flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
					>
						<Plus :size="16" />
						<span>Create Your First Project</span>
					</button>
				</div>

				<!-- Projects grid -->
				<div v-else>
					<div class="mb-4 flex items-center justify-between">
						<p class="text-sm text-zinc-500">{{ projectManager.projects.value.length }} project{{ projectManager.projects.value.length !== 1 ? 's' : '' }}</p>
						<button
							@click="createNewProject"
							class="flex items-center gap-2 rounded-lg bg-purple-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-purple-700"
						>
							<Plus :size="16" />
							<span>New Project</span>
						</button>
					</div>

					<div class="grid gap-4" style="grid-template-columns: repeat(auto-fill, minmax(280px, 1fr))">
						<div
							v-for="(proj, index) in projectManager.projects.value"
							:key="proj.id"
							class="group relative cursor-pointer overflow-hidden rounded-lg border border-white/10 bg-zinc-900 transition-all hover:border-purple-500/50 hover:bg-zinc-800"
							@click="openProject(proj.id)"
						>
							<!-- Thumbnail -->
							<div class="relative aspect-video bg-gradient-to-br from-purple-600/20 to-pink-600/20">
								<div class="absolute inset-0 flex items-center justify-center">
									<ImageIcon :size="48" class="text-purple-400/40" />
								</div>
								<div class="absolute bottom-2 right-2 rounded bg-black/60 px-2 py-1 text-[10px] text-zinc-300">
									{{ proj.canvas_width }}×{{ proj.canvas_height }}
								</div>
							</div>

							<!-- Content -->
							<div class="p-3">
								<div class="flex items-start justify-between gap-2">
									<h3 class="flex-1 truncate text-sm font-medium text-zinc-200">{{ proj.name || 'Untitled Design' }}</h3>
									<button
										@click.stop="deleteProject(proj.id)"
										class="flex size-6 items-center justify-center rounded text-zinc-500 opacity-0 transition-all hover:bg-red-500/20 hover:text-red-400 group-hover:opacity-100"
										title="Delete project"
									>
										<Trash2 :size="14" />
									</button>
								</div>
								<p class="mt-1 text-xs text-zinc-500">{{ formatDate(proj.updated_at) }}</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>

		<!-- Project Name Dialog -->
		<Teleport to="body">
			<Transition name="modal">
				<div v-if="showProjectNameDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/60" @click.self="showProjectNameDialog = false">
					<div class="w-full max-w-md rounded-lg border border-white/10 bg-zinc-900 p-6 shadow-xl">
						<div class="mb-4 flex size-12 items-center justify-center rounded-full bg-purple-600/20">
							<ImageIcon :size="24" class="text-purple-400" />
						</div>
						<h3 class="text-lg font-semibold text-zinc-100">Name Your Project</h3>
						<p class="mt-1 text-sm text-zinc-500">Give your design project a memorable name</p>
						<div class="mt-4">
							<input
								v-model="projectNameInput"
								type="text"
								placeholder="e.g., Social Media Banner"
								maxlength="100"
								class="w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-purple-500"
								@keyup.enter="confirmCreateProject"
								autofocus
							/>
							<p v-if="projectNameError" class="mt-2 text-xs text-red-400">{{ projectNameError }}</p>
						</div>
						<div class="mt-6 flex gap-2">
							<button
								@click="showProjectNameDialog = false"
								class="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5"
							>
								Cancel
							</button>
							<button
								@click="confirmCreateProject"
								class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700"
							>
								<Plus :size="14" />
								<span>Create Project</span>
							</button>
						</div>
					</div>
				</div>
			</Transition>
		</Teleport>
	</div>

	<!-- Editor -->
	<div v-else class="h-screen w-screen overflow-hidden">
		<EditorLayout />
	</div>
</template>
