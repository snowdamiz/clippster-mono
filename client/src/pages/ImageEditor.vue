<script setup lang="ts">
import { ref, provide, onMounted, onUnmounted, computed, watch, nextTick } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
	AlertTriangle,
	ArrowLeft,
	Loader2,
	Plus,
	Trash2,
	Image as ImageIcon,
	Paintbrush,
	Pencil,
	SearchX,
	Maximize2,
} from "lucide-vue-next";
import PageLayout from "@/components/PageLayout.vue";
import CustomDropdown from "@/components/CustomDropdown.vue";
import { MediaChip, MediaTile } from "@/components/ui/media-tile";
import { SelectionBar } from "@/components/ui/selection-bar";
import ProjectGrid from "@/components/create/ProjectGrid.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchField } from "@/components/ui/search-field";
import ConfirmationModal from "@/components/ConfirmationModal.vue";
import AuthModal from "@/components/AuthModal.vue";
import EditorLayout from "@/editor/components/EditorLayout.vue";
import { EditorCore } from "@/editor/core";
import { createImageProject, loadImageProject } from "@/editor/bridge/image-project-loader";
import {
	flushAndSerializeActiveImageProject,
	hydrateImageProjectFromDocument,
	resolveLocalProjectId,
} from "@/editor/bridge/image-project-document";
import { storageService } from "@/editor/storage/tauri-storage-adapter";
import type { SerializedProject } from "@/editor/storage/types";
import { useImageEditorProjects } from "@/composables/useImageEditorProjects";
import { useFormatters } from "@/composables/useFormatters";
import { useAuthStore } from "@/stores/auth";
import type { ProjectSummary } from "@/services/imageEditorApi";
import { useAppTour } from "@/composables/useAppTour";

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { notifyEditorReadyForTour } = useAppTour();
const { getRelativeTime: formatRelativeTimeFromUnix } = useFormatters();

const isEditorLoading = ref(true);
const editorError = ref<string | null>(null);
const projectManager = useImageEditorProjects();
// Starts true on the landing route so the empty state never flashes before the first load
const isLoadingProjects = ref(route.name !== "design-studio-edit");
const isCreatingProject = ref(false);
const isCoverBootstrapping = ref(false);
const isSyncing = ref(false);

const searchQuery = ref("");
const sortBy = ref("updated");
const selectedProjects = ref<Set<number>>(new Set());
const showDeleteDialog = ref(false);
const projectToDelete = ref<ProjectSummary | null>(null);
const showAuthModal = ref(false);

let cloudAutosaveTimer: ReturnType<typeof setTimeout> | null = null;
let unsubScenes: (() => void) | null = null;
let unsubTimeline: (() => void) | null = null;
let inflightCloudSync: Promise<void> | null = null;

const CANVAS_PRESETS = [
	{ id: "youtube-720", label: "YouTube 1280×720", width: 1280, height: 720 },
	{ id: "youtube-4k", label: "YouTube 3840×2160", width: 3840, height: 2160 },
	{ id: "shorts", label: "Shorts / Reels 1080×1920", width: 1080, height: 1920 },
	{ id: "square", label: "Square 1080×1080", width: 1080, height: 1080 },
	{ id: "ig-portrait", label: "IG 4:5 1080×1350", width: 1080, height: 1350 },
	{ id: "twitch", label: "Twitch 1920×1080", width: 1920, height: 1080 },
	{ id: "x-banner", label: "X Banner 1500×500", width: 1500, height: 500 },
] as const;

const sortOptions = [
	{ value: "updated", label: "Last updated" },
	{ value: "created", label: "Date created" },
	{ value: "name", label: "Name" },
];

const coverForClipId = ref<string | null>((route.query.coverForClip as string) || null);
provide("coverForClipId", coverForClipId);
const backendProjectId = computed(() => projectManager.projectId.value);
provide("imageEditorBackendProjectId", backendProjectId);

/** Exit edit → projects list after thumbnail refresh + cloud sync (avoids stale cards). */
async function exitToProjects() {
	stopCloudAutosave();
	try {
		await syncToCloud({ flush: true });
	} finally {
		projectManager.closeProject();
		EditorCore.reset();
		coverForClipId.value = null;
	}
	await router.push({ path: "/design-studio" });
}
provide("imageEditorExitToProjects", exitToProjects);

const isEditRoute = computed(() => route.name === "design-studio-edit");
const hasProjectId = computed(() => !!route.query.projectId);
const isEditorView = computed(
	() =>
		isEditRoute.value &&
		(hasProjectId.value || !!projectManager.project.value || isCoverBootstrapping.value || !!route.query.coverForClip),
);

const filteredProjects = computed(() => {
	let result = [...projectManager.projects.value];

	if (searchQuery.value) {
		const query = searchQuery.value.toLowerCase();
		result = result.filter((p) => p.name.toLowerCase().includes(query));
	}

	result.sort((a, b) => {
		switch (sortBy.value) {
			case "name":
				return a.name.localeCompare(b.name);
			case "created":
				return new Date(b.inserted_at).getTime() - new Date(a.inserted_at).getTime();
			case "updated":
			default:
				return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
		}
	});

	return result;
});

// Date sections follow the active sort (none when sorting by name)
const groupDate = computed(() => {
	if (sortBy.value === "name") return undefined;
	return sortBy.value === "created"
		? (project: ProjectSummary) => project.inserted_at
		: (project: ProjectSummary) => project.updated_at;
});

const deleteMessage = computed(() => {
	if (selectedProjects.value.size > 0) {
		return `Are you sure you want to delete ${selectedProjects.value.size} project${selectedProjects.value.size > 1 ? "s" : ""}?`;
	}
	return `Are you sure you want to delete "${projectToDelete.value?.name || "Untitled Design"}"?`;
});

watch(
	() => route.query.coverForClip,
	(value) => {
		coverForClipId.value = (value as string) || null;
	},
);

watch(
	() => route.query.projectId,
	async (projectId, previousId) => {
		if (!isEditRoute.value) return;

		if (!projectId) {
			stopCloudAutosave();
			if (previousId) {
				await syncToCloud({ flush: true });
			}
			projectManager.closeProject();
			EditorCore.reset();
			isEditorLoading.value = false;
			editorError.value = null;
			if (!route.query.coverForClip) {
				await router.replace({ path: "/design-studio" });
			}
			return;
		}

		if (projectManager.project.value?.id === parseInt(projectId as string, 10)) {
			const core = EditorCore.getInstance();
			if (core.imageMode && core.project.getActiveOrNull()) {
				isEditorLoading.value = false;
				return;
			}
			await loadEditorProject(parseInt(projectId as string, 10));
			return;
		}

		if (previousId) {
			await syncToCloud({ flush: true });
		}

		await loadEditorProject(parseInt(projectId as string, 10));
	},
);

watch(isEditorLoading, async (loading, wasLoading) => {
	if (!isEditRoute.value) return;
	if (wasLoading && !loading && !editorError.value) {
		await nextTick();
		const wantsTour = route.query.tour === '1';
		notifyEditorReadyForTour(wantsTour ? 'page_image_editor' : undefined);
	}
});

onMounted(async () => {
	const projectId = route.query.projectId as string | undefined;
	const coverForClip = route.query.coverForClip as string | undefined;
	const isTourBootstrap = route.query.tour === "1";

	// Legacy links used /design-studio?projectId=… — send them to the full-page editor route
	if (!isEditRoute.value && (projectId || coverForClip)) {
		await router.replace({
			path: "/design-studio/edit",
			query: route.query,
		});
		return;
	}

	if (isEditRoute.value) {
		if (projectId) {
			await loadEditorProject(parseInt(projectId, 10));
			return;
		}

		if (coverForClip) {
			await openOrCreateCoverProject(coverForClip);
			return;
		}

		if (isTourBootstrap) {
			await bootstrapTourImageProject();
			return;
		}

		await router.replace({ path: "/design-studio" });
		return;
	}

	isEditorLoading.value = false;
	await loadProjects();
});

async function bootstrapTourImageProject() {
	const preset = CANVAS_PRESETS.find((p) => p.id === "youtube-720") ?? CANVAS_PRESETS[0];
	const canvasSize = { width: preset.width, height: preset.height };
	const name = "Untitled Design";

	try {
		isEditorLoading.value = true;
		await createImageProject({ name, canvasSize });
		const doc = await flushAndSerializeActiveImageProject();
		if (!doc) throw new Error("Failed to serialize project");

		const backendProject = await projectManager.createProject({
			name,
			project_data: doc,
			canvas_width: canvasSize.width,
			canvas_height: canvasSize.height,
		});

		startCloudAutosave();
		await router.replace({
			path: "/design-studio/edit",
			query: { projectId: backendProject.id.toString(), tour: "1" },
		});
	} catch (e) {
		console.error("[ImageEditor] Failed to bootstrap tour project:", e);
		editorError.value = e instanceof Error ? e.message : "Failed to create tour project";
		isEditorLoading.value = false;
	}
}

onUnmounted(() => {
	stopCloudAutosave();
	void syncToCloud({ flush: true }).finally(() => {
		EditorCore.reset();
	});
});

async function loadEditorProject(id: number) {
	isEditorLoading.value = true;
	editorError.value = null;

	try {
		const backendProject = await projectManager.loadProject(id);
		await openDocument(backendProject.project_data);
		startCloudAutosave();
		// Refresh list card from current canvas (heals stale template thumbnails).
		void syncToCloud();
	} catch (err) {
		console.error("Failed to load image editor:", err);
		editorError.value = err instanceof Error ? err.message : "Failed to load editor";
	} finally {
		isEditorLoading.value = false;
	}
}

/** Resolve an existing Image Editor project linked to this clip cover, if any. */
async function findExistingCoverBackendProjectId(clipId: string): Promise<number | null> {
	try {
		const { getClip } = await import("@/services/database/clips");
		const { getImageAsset, getLatestImageAssetForClip } = await import(
			"@/services/database/image-assets"
		);
		const { getProject } = await import("@/services/imageEditorApi");
		const clip = await getClip(clipId);
		const candidates: Array<{
			id?: string;
			editor_project_json?: string | null;
			source_project_id?: string | null;
		}> = [];

		if (clip?.cover_image_id) {
			const coverAsset = await getImageAsset(clip.cover_image_id);
			if (coverAsset) candidates.push(coverAsset);
		}
		const latest = await getLatestImageAssetForClip(clipId);
		if (latest && !candidates.some((c) => c.id === latest.id)) {
			candidates.push(latest);
		}

		for (const asset of candidates) {
			const fromSource = Number(asset.source_project_id);
			if (Number.isFinite(fromSource) && fromSource > 0) {
				try {
					await getProject(fromSource);
					return fromSource;
				} catch {
					/* deleted project */
				}
			}

			if (asset.editor_project_json) {
				try {
					const parsed = JSON.parse(asset.editor_project_json) as {
						backendProjectId?: number | string;
					};
					const id = Number(parsed.backendProjectId);
					if (Number.isFinite(id) && id > 0) {
						try {
							await getProject(id);
							return id;
						} catch {
							/* deleted */
						}
					}
				} catch {
					/* ignore malformed json */
				}
			}
		}

		// Lightweight scan: only Cover-named projects, via API (does not touch active manager state)
		const summaries = await projectManager.listProjects();
		const coverish = summaries.filter(
			(p) =>
				p.name.toLowerCase().includes("cover") ||
				p.name.includes(clipId.slice(0, 8)),
		);
		for (const summary of coverish.slice(0, 25)) {
			try {
				const full = await getProject(summary.id);
				const data = full.project_data as Record<string, unknown> | null;
				const settings = (data?.settings || {}) as Record<string, unknown>;
				const linked =
					settings.sourceClipId === clipId ||
					settings.coverForClipId === clipId ||
					(data as any)?.coverForClipId === clipId;
				if (linked) return summary.id;
			} catch {
				/* skip unloadable */
			}
		}
	} catch (e) {
		console.warn("[ImageEditor] Cover project lookup failed:", e);
	}
	return null;
}

async function openOrCreateCoverProject(clipId: string) {
	isCoverBootstrapping.value = true;
	isEditorLoading.value = true;
	editorError.value = null;

	try {
		const existingId = await findExistingCoverBackendProjectId(clipId);
		if (existingId != null) {
			isCoverBootstrapping.value = false;
			await router.replace({
				path: "/design-studio/edit",
				query: {
					...route.query,
					projectId: existingId.toString(),
					coverForClip: clipId,
				},
			});
			if (projectManager.project.value?.id !== existingId) {
				await loadEditorProject(existingId);
			} else {
				isEditorLoading.value = false;
				startCloudAutosave();
			}
			return;
		}

		await autoCreateCoverProject(clipId);
	} catch (err) {
		console.error("[ImageEditor] Failed to open/create cover project:", err);
		editorError.value = err instanceof Error ? err.message : "Failed to open cover editor";
		isEditorLoading.value = false;
		isCoverBootstrapping.value = false;
	}
}

async function autoCreateCoverProject(clipId?: string) {
	const linkedClipId = clipId || coverForClipId.value || (route.query.coverForClip as string) || null;
	isCoverBootstrapping.value = true;
	isEditorLoading.value = true;
	editorError.value = null;

	const preset = CANVAS_PRESETS.find((p) => p.id === "youtube-720") ?? CANVAS_PRESETS[0];
	const canvasSize = { width: preset.width, height: preset.height };
	const name = linkedClipId ? `Cover · ${linkedClipId.slice(0, 8)}` : "Clip Cover Design";

	try {
		await createImageProject({ name, canvasSize });

		if (linkedClipId) {
			const editor = EditorCore.getInstance();
			await editor.project.updateSettings({
				settings: {
					sourceClipId: linkedClipId,
					coverForClipId: linkedClipId,
				} as any,
			});
		}

		const doc = await flushAndSerializeActiveImageProject();
		if (!doc) throw new Error("Failed to serialize project");

		const backendProject = await projectManager.createProject({
			name,
			project_data: {
				...doc,
				coverForClipId: linkedClipId,
			},
			canvas_width: canvasSize.width,
			canvas_height: canvasSize.height,
		});

		startCloudAutosave();
		await router.replace({
			path: "/design-studio/edit",
			query: {
				...route.query,
				projectId: backendProject.id.toString(),
				...(linkedClipId ? { coverForClip: linkedClipId } : {}),
			},
		});
	} catch (err) {
		console.error("[ImageEditor] Failed to auto-create cover project:", err);
		editorError.value = err instanceof Error ? err.message : "Failed to create cover project";
	} finally {
		isEditorLoading.value = false;
		isCoverBootstrapping.value = false;
	}
}

async function openDocument(projectData: unknown) {
	const localId = resolveLocalProjectId(projectData);

	if (isFullSerializedDocument(projectData)) {
		const existing = localId ? await storageService.loadProject({ id: localId }) : null;
		if (existing) {
			await loadImageProject(localId!);
		} else {
			await hydrateImageProjectFromDocument(projectData);
		}
	} else if (localId) {
		const existing = await storageService.loadProject({ id: localId });
		if (!existing) {
			throw new Error("Project document is missing locally. Re-create or re-export this design.");
		}
		await loadImageProject(localId);
	} else {
		throw new Error("Invalid project data — missing local document id");
	}

	await waitForProjectReady();
}

function isFullSerializedDocument(data: unknown): data is SerializedProject {
	if (!data || typeof data !== "object") return false;
	const d = data as Record<string, unknown>;
	return Array.isArray(d.scenes) && !!d.metadata && typeof d.metadata === "object";
}

async function waitForProjectReady() {
	const editor = EditorCore.getInstance();
	let retries = 0;
	const maxRetries = 50;
	while (retries < maxRetries) {
		const project = editor.project.getActiveOrNull();
		const scenes = editor.scenes.getScenes();
		if (project && scenes.length > 0) return;
		await new Promise((resolve) => setTimeout(resolve, 100));
		retries++;
	}
	throw new Error("Timeout waiting for project to load");
}

function startCloudAutosave() {
	stopCloudAutosave();
	const editor = EditorCore.getInstance();
	const schedule = () => {
		if (cloudAutosaveTimer) clearTimeout(cloudAutosaveTimer);
		cloudAutosaveTimer = setTimeout(() => {
			void syncToCloud();
		}, 3000);
	};
	unsubScenes = editor.scenes.subscribe(schedule);
	unsubTimeline = editor.timeline.subscribe(schedule);
}

function stopCloudAutosave() {
	if (cloudAutosaveTimer) {
		clearTimeout(cloudAutosaveTimer);
		cloudAutosaveTimer = null;
	}
	unsubScenes?.();
	unsubTimeline?.();
	unsubScenes = null;
	unsubTimeline = null;
}

async function syncToCloud(opts: { flush?: boolean } = {}) {
	if (!projectManager.project.value) return;

	// Debounced autosave can skip if busy; exit flush must wait then sync again.
	if (inflightCloudSync) {
		await inflightCloudSync;
		if (!opts.flush || !projectManager.project.value) return;
	}

	const run = async () => {
		isSyncing.value = true;
		try {
			const editor = EditorCore.getInstance();
			if (editor.project.getActiveOrNull()) {
				await editor.project.refreshThumbnail();
			}

			const doc = await flushAndSerializeActiveImageProject();
			if (!doc) return;

			const canvas = doc.settings?.canvasSize;
			await projectManager.saveProject({
				name: doc.metadata.name,
				project_data: doc,
				thumbnail_url: doc.metadata.thumbnail,
				canvas_width: canvas?.width,
				canvas_height: canvas?.height,
			});
		} catch (e) {
			console.warn("[ImageEditor] Cloud autosave failed:", e);
		} finally {
			isSyncing.value = false;
		}
	};

	inflightCloudSync = run().finally(() => {
		inflightCloudSync = null;
	});
	await inflightCloudSync;
}

async function loadProjects() {
	isLoadingProjects.value = true;
	try {
		await projectManager.listProjects();
		// Purge leftover ephemeral tour projects from the old delete-on-exit flow
		const leftovers = projectManager.projects.value.filter((p) => p.name === "Tour Demo");
		for (const project of leftovers) {
			try {
				await projectManager.deleteProject(project.id);
			} catch (e) {
				console.warn("[ImageEditor] Failed to delete leftover Tour Demo project", project.id, e);
			}
		}
		if (leftovers.length > 0) {
			await projectManager.listProjects();
		}
	} catch (e) {
		console.error("[ImageEditor] Failed to load projects:", e);
	} finally {
		isLoadingProjects.value = false;
	}
}

function defaultProjectName(): string {
	const base = "Untitled Design";
	const names = new Set(projectManager.projects.value.map((p) => p.name));
	if (!names.has(base)) return base;
	let i = 2;
	while (names.has(`${base} ${i}`)) i += 1;
	return `${base} ${i}`;
}

function createNewProject() {
	if (!authStore.isAuthenticated) {
		showAuthModal.value = true;
		return;
	}
	void createAndOpenProject();
}

async function createAndOpenProject(name?: string) {
	if (isCreatingProject.value) return;

	const projectName = name ?? defaultProjectName();

	try {
		isCreatingProject.value = true;
		await createImageProject({ name: projectName });

		const doc = await flushAndSerializeActiveImageProject();
		if (!doc) throw new Error("Failed to serialize project");

		const canvas = doc.settings?.canvasSize;
		const backendProject = await projectManager.createProject({
			name: projectName,
			project_data: doc,
			canvas_width: canvas?.width,
			canvas_height: canvas?.height,
		});

		startCloudAutosave();
		await router.push({
			path: "/design-studio/edit",
			query: {
				projectId: backendProject.id.toString(),
			},
		});
	} catch (e) {
		console.error("[ImageEditor] Failed to create project:", e);
	} finally {
		isCreatingProject.value = false;
	}
}

function openProject(id: number) {
	router.push({
		path: "/design-studio/edit",
		query: {
			projectId: id.toString(),
		},
	});
}

function confirmDelete(project: ProjectSummary) {
	projectToDelete.value = project;
	showDeleteDialog.value = true;
}

function confirmBulkDelete() {
	projectToDelete.value = null;
	showDeleteDialog.value = true;
}

async function handleDeleteConfirm() {
	try {
		if (selectedProjects.value.size > 0) {
			for (const id of selectedProjects.value) {
				await projectManager.deleteProject(id);
			}
			selectedProjects.value.clear();
		} else if (projectToDelete.value) {
			await projectManager.deleteProject(projectToDelete.value.id);
		}
	} catch (e) {
		console.error("[ImageEditor] Failed to delete project:", e);
	} finally {
		showDeleteDialog.value = false;
		projectToDelete.value = null;
	}
}

function isProjectSelected(id: number): boolean {
	return selectedProjects.value.has(id);
}

function toggleProjectSelection(id: number) {
	if (selectedProjects.value.has(id)) {
		selectedProjects.value.delete(id);
	} else {
		selectedProjects.value.add(id);
	}
	selectedProjects.value = new Set(selectedProjects.value);
}

function clearSelection() {
	selectedProjects.value.clear();
	selectedProjects.value = new Set();
}

function selectAllProjects() {
	selectedProjects.value = new Set(filteredProjects.value.map((p) => p.id));
}

function backToProjects() {
	void exitToProjects();
}

function formatCanvasSize(project: ProjectSummary): string {
	if (project.canvas_width && project.canvas_height) {
		return `${project.canvas_width}×${project.canvas_height}`;
	}
	return "Custom";
}

function getRelativeTime(dateStr: string): string {
	const timestamp = Math.floor(new Date(dateStr).getTime() / 1000);
	return formatRelativeTimeFromUnix(timestamp) || "Recently";
}

</script>

<template>
	<!-- Editor view -->
	<div v-if="isEditorView" class="h-full w-full overflow-hidden bg-panel">
		<div v-if="isEditorLoading" class="flex h-full w-full items-center justify-center">
			<div class="flex flex-col items-center gap-3">
				<Loader2 class="size-6 animate-spin text-fg-subtle" />
				<p class="text-sm text-fg-muted">Loading Image Editor…</p>
			</div>
		</div>

		<EmptyState
			v-else-if="editorError"
			:icon="AlertTriangle"
			tone="danger"
			title="Failed to load editor"
			:description="editorError"
			class="h-full"
		>
			<Button variant="secondary" @click="backToProjects"><ArrowLeft /> Back to projects</Button>
		</EmptyState>

		<EditorLayout v-else />
	</div>

	<!-- Project home -->
	<PageLayout
		v-else
		title="Image Editor"
		description="Create and manage your image design projects"
		:show-header="true"
		:icon="Paintbrush"
	>
		<template #badge>
			<Badge variant="brand">Beta</Badge>
		</template>

		<template #actions>
			<Button variant="primary" :loading="isCreatingProject" @click="createNewProject">
				<Plus v-if="!isCreatingProject" />
				New project
			</Button>
		</template>

		<template v-if="projectManager.projects.value.length > 0" #toolbar>
			<SelectionBar
				v-if="selectedProjects.size > 0"
				:count="selectedProjects.size"
				:total="filteredProjects.length"
				@clear="clearSelection"
				@select-all="selectAllProjects"
			>
				<Button variant="destructive-soft" size="sm" @click="confirmBulkDelete"><Trash2 /> Delete</Button>
			</SelectionBar>
			<template v-else>
				<SearchField v-model="searchQuery" placeholder="Search projects…" class="min-w-[120px] max-w-64 flex-1" />
				<div class="w-40 shrink-0">
					<CustomDropdown v-model="sortBy" :options="sortOptions" placeholder="Sort by" />
				</div>
			</template>
		</template>

		<ProjectGrid
			v-if="(isLoadingProjects && !projectManager.projects.value.length) || filteredProjects.length > 0"
			:items="filteredProjects"
			:loading="isLoadingProjects"
			:item-key="(project) => project.id"
			:group-date="groupDate"
		>
			<template #tile="{ item: project }">
				<MediaTile
					:title="project.name || 'Untitled Design'"
					:thumbnail="project.thumbnail_url"
					:icon="ImageIcon"
					:meta="[getRelativeTime(project.updated_at)]"
					selectable
					:selected="isProjectSelected(project.id)"
					@open="openProject(project.id)"
					@toggle-select="toggleProjectSelection(project.id)"
				>
					<template #badges>
						<MediaChip><Maximize2 /> {{ formatCanvasSize(project) }}</MediaChip>
					</template>
					<template #actions>
						<Button
							variant="secondary"
							size="icon-xs"
							title="Open editor"
							aria-label="Open editor"
							@click.stop="openProject(project.id)"
						>
							<Pencil />
						</Button>
						<Button
							variant="secondary"
							size="icon-xs"
							class="hover:text-danger"
							title="Delete"
							aria-label="Delete"
							@click.stop="confirmDelete(project)"
						>
							<Trash2 />
						</Button>
					</template>
				</MediaTile>
			</template>
		</ProjectGrid>

		<EmptyState
			v-else-if="projectManager.projects.value.length > 0"
			:icon="SearchX"
			title="No matching projects"
			description="Try a different search."
		>
			<Button variant="secondary" @click="searchQuery = ''">Clear search</Button>
		</EmptyState>

		<EmptyState
			v-else
			:icon="ImageIcon"
			title="No designs yet"
			description="Create thumbnails, banners and social graphics with canvas presets."
		>
			<Button variant="secondary" :disabled="isCreatingProject" @click="createNewProject"><Plus /> New project</Button>
		</EmptyState>

		<ConfirmationModal
			:show="showDeleteDialog"
			title="Delete project"
			:message="deleteMessage"
			suffix=""
			confirm-text="Delete"
			variant="destructive"
			@close="showDeleteDialog = false"
			@confirm="handleDeleteConfirm"
		/>

		<AuthModal v-model="showAuthModal" />
	</PageLayout>
</template>
