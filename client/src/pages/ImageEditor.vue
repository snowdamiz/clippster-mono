<script setup lang="ts">
import { ref, provide, onMounted, onUnmounted, computed, watch, Transition } from "vue";
import { useRoute, useRouter } from "vue-router";
import {
	Loader2,
	Plus,
	Trash2,
	Image as ImageIcon,
	Search,
	Check,
	Play,
	Maximize2,
} from "lucide-vue-next";
import PageLayout from "@/components/PageLayout.vue";
import { Input } from "@/components/ui/input";
import CustomDropdown from "@/components/CustomDropdown.vue";
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

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const { getRelativeTime: formatRelativeTimeFromUnix } = useFormatters();

const isEditorLoading = ref(true);
const editorError = ref<string | null>(null);
const projectManager = useImageEditorProjects();
const isLoadingProjects = ref(false);
const showProjectNameDialog = ref(false);
const projectNameInput = ref("");
const projectNameError = ref("");
const selectedCanvasPreset = ref("youtube-720");
const isSyncing = ref(false);
const isCreatingProject = ref(false);
const isCoverBootstrapping = ref(false);

const searchQuery = ref("");
const sortBy = ref("updated");
const selectedProjects = ref<Set<number>>(new Set());
const showDeleteDialog = ref(false);
const projectToDelete = ref<ProjectSummary | null>(null);
const showAuthModal = ref(false);

let cloudAutosaveTimer: ReturnType<typeof setTimeout> | null = null;
let unsubScenes: (() => void) | null = null;
let unsubTimeline: (() => void) | null = null;

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
	{ value: "updated", label: "Last Updated" },
	{ value: "created", label: "Date Created" },
	{ value: "name", label: "Name" },
];

const coverForClipId = ref<string | null>((route.query.coverForClip as string) || null);
provide("coverForClipId", coverForClipId);
const backendProjectId = computed(() => projectManager.projectId.value);
provide("imageEditorBackendProjectId", backendProjectId);

const hasProjectId = computed(() => !!route.query.projectId);
const isEditorView = computed(
	() => hasProjectId.value || !!projectManager.project.value || isCoverBootstrapping.value,
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

const groupedProjects = computed(() => {
	const groups: { dateLabel: string; projects: ProjectSummary[] }[] = [];
	const now = new Date();
	const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
	const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);
	const lastWeek = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

	const todayProjects: ProjectSummary[] = [];
	const yesterdayProjects: ProjectSummary[] = [];
	const lastWeekProjects: ProjectSummary[] = [];
	const olderProjects: ProjectSummary[] = [];

	for (const project of filteredProjects.value) {
		const date = new Date(project.updated_at);
		if (date >= today) {
			todayProjects.push(project);
		} else if (date >= yesterday) {
			yesterdayProjects.push(project);
		} else if (date >= lastWeek) {
			lastWeekProjects.push(project);
		} else {
			olderProjects.push(project);
		}
	}

	if (todayProjects.length > 0) groups.push({ dateLabel: "Today", projects: todayProjects });
	if (yesterdayProjects.length > 0) groups.push({ dateLabel: "Yesterday", projects: yesterdayProjects });
	if (lastWeekProjects.length > 0) groups.push({ dateLabel: "Last 7 Days", projects: lastWeekProjects });
	if (olderProjects.length > 0) groups.push({ dateLabel: "Older", projects: olderProjects });

	return groups;
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
				await loadProjects();
			}
			return;
		}

		if (projectManager.project.value?.id === parseInt(projectId as string, 10)) {
			return;
		}

		if (previousId) {
			await syncToCloud({ flush: true });
		}

		await loadEditorProject(parseInt(projectId as string, 10));
	},
);

onMounted(async () => {
	const projectId = route.query.projectId as string | undefined;
	const coverForClip = route.query.coverForClip as string | undefined;

	if (projectId) {
		await loadEditorProject(parseInt(projectId, 10));
		return;
	}

	if (coverForClip) {
		await openOrCreateCoverProject(coverForClip);
		return;
	}

	isEditorLoading.value = false;
	await loadProjects();
});

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

async function syncToCloud(_opts: { flush?: boolean } = {}) {
	if (!projectManager.project.value) return;
	if (isSyncing.value) return;

	isSyncing.value = true;
	try {
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
}

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
	if (!authStore.isAuthenticated) {
		showAuthModal.value = true;
		return;
	}
	projectNameInput.value = "";
	projectNameError.value = "";
	selectedCanvasPreset.value = "youtube-720";
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

	const preset = CANVAS_PRESETS.find((p) => p.id === selectedCanvasPreset.value) ?? CANVAS_PRESETS[0];
	const canvasSize = { width: preset.width, height: preset.height };

	try {
		isCreatingProject.value = true;
		showProjectNameDialog.value = false;

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
		await router.push({
			path: "/design-studio",
			query: {
				...route.query,
				projectId: backendProject.id.toString(),
			},
		});
	} catch (e) {
		console.error("[ImageEditor] Failed to create project:", e);
		projectNameError.value = "Failed to create project. Please try again.";
		showProjectNameDialog.value = true;
	} finally {
		isCreatingProject.value = false;
	}
}

function openProject(id: number) {
	router.push({
		path: "/design-studio",
		query: {
			...route.query,
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

function backToProjects() {
	stopCloudAutosave();
	void syncToCloud({ flush: true }).finally(() => {
		projectManager.closeProject();
		EditorCore.reset();
		coverForClipId.value = null;
		const query = { ...route.query };
		delete query.projectId;
		delete query.coverForClip;
		router.push({ path: "/design-studio", query });
	});
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

function cardAspectRatio(project: ProjectSummary): string {
	if (!project.canvas_width || !project.canvas_height) return "16 / 9";
	return `${project.canvas_width} / ${project.canvas_height}`;
}
</script>

<template>
	<!-- Editor view -->
	<div v-if="isEditorView" class="h-screen w-screen overflow-hidden bg-[#0e0e10]">
		<div v-if="isEditorLoading" class="flex h-full w-full items-center justify-center">
			<div class="flex flex-col items-center gap-3">
				<Loader2 class="text-primary size-8 animate-spin" />
				<p class="text-sm text-zinc-500">Loading Image Editor...</p>
			</div>
		</div>

		<div v-else-if="editorError" class="flex h-full w-full items-center justify-center">
			<div class="flex flex-col items-center gap-4 text-center">
				<p class="text-destructive text-lg font-medium">Failed to load editor</p>
				<p class="text-sm text-zinc-500">{{ editorError }}</p>
				<button type="button" class="text-primary text-sm underline" @click="backToProjects">
					Back to Projects
				</button>
			</div>
		</div>

		<EditorLayout v-else />
	</div>

	<!-- Project home -->
	<PageLayout
		v-else
		title="Image Editor"
		description="Create and manage your image design projects"
		:show-header="true"
		:icon="ImageIcon"
	>
		<template #actions>
			<div class="imageeditor-header-actions">
				<div class="imageeditor-header__search">
					<Search class="imageeditor-header__search-icon" />
					<Input
						v-model="searchQuery"
						placeholder="Search projects..."
						class="imageeditor-header__search-input"
					/>
				</div>

				<CustomDropdown
					v-model="sortBy"
					:options="sortOptions"
					placeholder="Sort By"
					class="imageeditor-header__sort"
					trigger-class="imageeditor-header__dropdown-trigger"
				/>

				<button type="button" class="imageeditor-create-btn" @click="createNewProject">
					<Plus class="imageeditor-create-btn__icon" />
					New Project
				</button>
			</div>
		</template>

		<div
			class="imageeditor__content"
			:class="{ 'imageeditor__content--empty': !isLoadingProjects && projectManager.projects.value.length === 0 }"
		>
			<div v-if="projectManager.projects.value.length > 0 || isLoadingProjects" class="imageeditor__heading">
				<h1 class="imageeditor__title">Design Projects</h1>
				<p class="imageeditor__subtitle">Create thumbnails, banners, and social graphics with canvas presets</p>
			</div>

			<div v-if="isLoadingProjects" class="imageeditor__loading">
				<div class="imageeditor__grid">
					<div v-for="i in 6" :key="`skeleton-${i}`" class="imageeditor-card imageeditor-card--skeleton">
						<div class="imageeditor-card__skeleton-bg"></div>
						<div class="imageeditor-card__bottom">
							<div class="imageeditor-skeleton__card-title"></div>
							<div class="imageeditor-skeleton__card-meta"></div>
						</div>
					</div>
				</div>
			</div>

			<div v-else-if="projectManager.projects.value.length > 0" class="imageeditor__main">
				<Transition name="selection-bar">
					<div v-if="selectedProjects.size > 0" class="imageeditor__selection-bar">
						<div class="imageeditor__selection-info">
							<Check class="imageeditor__selection-icon" />
							<span>{{ selectedProjects.size }} selected</span>
						</div>
						<div class="imageeditor__selection-actions">
							<button type="button" class="imageeditor__selection-clear" @click="clearSelection">Clear</button>
							<button type="button" class="imageeditor__selection-delete" @click="confirmBulkDelete">
								<Trash2 class="imageeditor__selection-delete-icon" />
								Delete Selected
							</button>
						</div>
					</div>
				</Transition>

				<div v-if="filteredProjects.length > 0" class="imageeditor__section">
					<div v-for="group in groupedProjects" :key="group.dateLabel" class="imageeditor__date-group">
						<h3 class="imageeditor__section-header">{{ group.dateLabel }}</h3>

						<div class="imageeditor__grid">
							<div
								v-for="project in group.projects"
								:key="project.id"
								class="imageeditor-card"
								:class="{ 'imageeditor-card--selected': isProjectSelected(project.id) }"
								:style="{ aspectRatio: cardAspectRatio(project) }"
								@click="openProject(project.id)"
							>
								<div
									class="imageeditor-card__checkbox"
									:class="{ 'imageeditor-card__checkbox--visible': isProjectSelected(project.id) }"
									@click.stop="toggleProjectSelection(project.id)"
								>
									<div
										class="imageeditor-card__checkbox-inner"
										:class="{ 'imageeditor-card__checkbox-inner--checked': isProjectSelected(project.id) }"
									>
										<Check v-if="isProjectSelected(project.id)" class="imageeditor-card__checkbox-icon" />
									</div>
								</div>

								<div class="imageeditor-card__badge imageeditor-card__badge--canvas">
									<Maximize2 class="imageeditor-card__badge-icon" />
									<span>{{ formatCanvasSize(project) }}</span>
								</div>

								<div
									v-if="project.thumbnail_url"
									class="imageeditor-card__thumbnail"
									:style="{ backgroundImage: `url(${project.thumbnail_url})` }"
								>
									<div class="imageeditor-card__vignette"></div>
								</div>
								<div v-else class="imageeditor-card__thumbnail imageeditor-card__thumbnail--empty">
									<div class="imageeditor-card__thumbnail-gradient"></div>
									<div class="imageeditor-card__empty-icon">
										<ImageIcon class="imageeditor-card__folder-icon" />
									</div>
								</div>

								<div class="imageeditor-card__bottom">
									<h3 class="imageeditor-card__title" :title="project.name">
										{{ project.name || "Untitled Design" }}
									</h3>
									<div class="imageeditor-card__meta">
										<span class="imageeditor-card__meta-text">{{ getRelativeTime(project.updated_at) }}</span>
									</div>
								</div>

								<div class="imageeditor-card__hover-actions">
									<button
										type="button"
										class="imageeditor-card__action-btn"
										title="Open Editor"
										@click.stop="openProject(project.id)"
									>
										<Play class="imageeditor-card__action-icon" />
									</button>
									<button
										type="button"
										class="imageeditor-card__action-btn"
										title="Delete"
										@click.stop="confirmDelete(project)"
									>
										<Trash2 class="imageeditor-card__action-icon" />
									</button>
								</div>
							</div>
						</div>
					</div>
				</div>

				<div v-if="filteredProjects.length === 0" class="imageeditor__no-results">
					<div class="imageeditor__no-results-icon-wrapper">
						<Search class="imageeditor__no-results-icon" />
					</div>
					<h3 class="imageeditor__no-results-title">No projects found</h3>
					<p class="imageeditor__no-results-description">
						We couldn't find any projects matching your search. Try adjusting your search query.
					</p>
					<button type="button" class="imageeditor__no-results-btn" @click="searchQuery = ''">Clear search</button>
				</div>
			</div>

			<div v-else class="imageeditor__empty">
				<div class="imageeditor__empty-icon-wrapper">
					<ImageIcon class="imageeditor__empty-icon" />
				</div>
				<h3 class="imageeditor__empty-title">No design projects yet</h3>
				<p class="imageeditor__empty-description">Create your first image project to get started</p>
				<button type="button" class="imageeditor-create-btn imageeditor__empty-cta" @click="createNewProject">
					<Plus class="imageeditor-create-btn__icon" />
					Create Your First Project
				</button>
			</div>
		</div>

		<ConfirmationModal
			:show="showDeleteDialog"
			title="Delete Project"
			:message="deleteMessage"
			suffix="This action cannot be undone."
			confirm-text="Delete"
			variant="destructive"
			@close="showDeleteDialog = false"
			@confirm="handleDeleteConfirm"
		/>

		<AuthModal v-model="showAuthModal" />

		<Teleport to="body">
			<Transition name="modal">
				<div
					v-if="showProjectNameDialog"
					class="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
					@click.self="showProjectNameDialog = false"
				>
					<div class="w-full max-w-md rounded-lg border border-white/10 bg-zinc-900 p-6 shadow-xl">
						<div class="mb-4 flex size-12 items-center justify-center rounded-full bg-purple-600/20">
							<ImageIcon :size="24" class="text-purple-400" />
						</div>
						<h3 class="text-lg font-semibold text-zinc-100">Name Your Project</h3>
						<p class="mt-1 text-sm text-zinc-500">Give your image project a memorable name</p>
						<div class="mt-4 space-y-3">
							<input
								v-model="projectNameInput"
								type="text"
								placeholder="e.g., Social Media Banner"
								maxlength="100"
								class="w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-purple-500"
								autofocus
								@keyup.enter="confirmCreateProject"
							/>
							<select
								v-model="selectedCanvasPreset"
								class="w-full rounded-lg border border-white/10 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 outline-none focus:border-purple-500"
							>
								<option v-for="preset in CANVAS_PRESETS" :key="preset.id" :value="preset.id">
									{{ preset.label }}
								</option>
							</select>
							<p v-if="projectNameError" class="text-xs text-red-400">{{ projectNameError }}</p>
						</div>
						<div class="mt-6 flex gap-2">
							<button
								type="button"
								class="flex-1 rounded-lg border border-white/10 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-white/5"
								@click="showProjectNameDialog = false"
							>
								Cancel
							</button>
							<button
								type="button"
								class="flex flex-1 items-center justify-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
								:disabled="isCreatingProject"
								@click="confirmCreateProject"
							>
								<Loader2 v-if="isCreatingProject" :size="14" class="animate-spin" />
								<Plus v-else :size="14" />
								<span>Create Project</span>
							</button>
						</div>
					</div>
				</div>
			</Transition>
		</Teleport>
	</PageLayout>
</template>

<style scoped>
.imageeditor__content {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
	padding: 1.5rem;
	width: 100%;
	flex: 1;
}

.imageeditor__content--empty {
	justify-content: center;
	align-items: center;
}

.imageeditor__main {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
}

.imageeditor__loading {
	display: flex;
	flex-direction: column;
	gap: 1.5rem;
}

.imageeditor__heading {
	margin-bottom: 0.5rem;
}

.imageeditor__title {
	font-size: 1.5rem;
	font-weight: 700;
	color: var(--sidebar-text);
	margin: 0 0 0.2rem;
	letter-spacing: -0.02em;
}

.imageeditor__subtitle {
	font-size: 0.875rem;
	color: var(--sidebar-text-muted);
	margin: 0;
	line-height: 1.5;
}

.imageeditor-header-actions {
	display: flex;
	align-items: center;
	gap: 0.5rem;
}

.imageeditor-header__search {
	position: relative;
	width: 200px;
}

.imageeditor-header__search-icon {
	position: absolute;
	left: 0.625rem;
	top: 50%;
	transform: translateY(-50%);
	width: 14px;
	height: 14px;
	color: var(--sidebar-text-muted);
	pointer-events: none;
}

.imageeditor-header__search-input {
	width: 100%;
	padding-left: 2rem;
	height: 32px;
	background-color: var(--sidebar-surface);
	border: 1px solid var(--sidebar-border);
	border-radius: 6px;
	font-size: 0.75rem;
}

.imageeditor-header__search-input:focus {
	border-color: var(--sidebar-accent);
	outline: none;
}

.imageeditor-header__sort {
	width: 140px;
	flex-shrink: 0;
}

:deep(.imageeditor-header__dropdown-trigger) {
	height: 32px !important;
	padding: 0 0.625rem !important;
	background-color: var(--sidebar-surface) !important;
	border: 1px solid var(--sidebar-border) !important;
	border-radius: 6px !important;
	font-size: 0.75rem !important;
	color: var(--sidebar-text) !important;
	transition: all 150ms ease !important;
}

:deep(.imageeditor-header__dropdown-trigger:hover) {
	border-color: rgba(255, 255, 255, 0.15) !important;
}

:deep(.imageeditor-header__dropdown-trigger span) {
	color: var(--sidebar-text) !important;
}

:deep(.imageeditor-header__dropdown-trigger svg) {
	width: 12px !important;
	height: 12px !important;
	color: var(--sidebar-text-muted) !important;
}

.imageeditor-create-btn {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	height: 32px;
	padding: 0 0.875rem;
	background-color: var(--sidebar-accent);
	color: var(--sidebar-bg);
	border: none;
	border-radius: 6px;
	font-size: 0.75rem;
	font-weight: 600;
	cursor: pointer;
	transition: all 150ms ease;
}

.imageeditor-create-btn:hover:not(:disabled) {
	opacity: 0.9;
}

.imageeditor-create-btn:disabled {
	opacity: 0.5;
	cursor: not-allowed;
}

.imageeditor-create-btn__icon {
	width: 14px;
	height: 14px;
}

.imageeditor__empty-cta {
	height: 36px;
	margin-top: 1.5rem;
	padding: 0 1rem;
}

.imageeditor-skeleton__card-title {
	height: 16px;
	width: 70%;
	background: linear-gradient(
		90deg,
		rgba(255, 255, 255, 0.1) 25%,
		rgba(255, 255, 255, 0.2) 50%,
		rgba(255, 255, 255, 0.1) 75%
	);
	background-size: 200% 100%;
	animation: shimmer 1.5s infinite;
	border-radius: 4px;
	margin-bottom: 0.5rem;
}

.imageeditor-skeleton__card-meta {
	height: 12px;
	width: 50%;
	background: linear-gradient(
		90deg,
		rgba(255, 255, 255, 0.1) 25%,
		rgba(255, 255, 255, 0.2) 50%,
		rgba(255, 255, 255, 0.1) 75%
	);
	background-size: 200% 100%;
	animation: shimmer 1.5s infinite;
	animation-delay: 0.15s;
	border-radius: 4px;
}

@keyframes shimmer {
	0% {
		background-position: 200% 0;
	}
	100% {
		background-position: -200% 0;
	}
}

.imageeditor__selection-bar {
	display: flex;
	align-items: center;
	justify-content: space-between;
	padding: 0.75rem 1rem;
	background-color: var(--sidebar-surface);
	border: 1px solid var(--sidebar-border);
	border-radius: 10px;
}

.imageeditor__selection-info {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-size: 0.875rem;
	color: var(--sidebar-text);
	font-weight: 500;
}

.imageeditor__selection-icon {
	width: 16px;
	height: 16px;
	color: var(--sidebar-accent);
}

.imageeditor__selection-actions {
	display: flex;
	align-items: center;
	gap: 0.75rem;
}

.imageeditor__selection-clear {
	padding: 0.375rem 0.75rem;
	font-size: 0.75rem;
	font-weight: 500;
	color: var(--sidebar-text-muted);
	background: transparent;
	border: 1px solid var(--sidebar-border);
	border-radius: 6px;
	cursor: pointer;
	transition: all 150ms ease;
}

.imageeditor__selection-clear:hover {
	background-color: var(--sidebar-hover);
	color: var(--sidebar-text);
}

.imageeditor__selection-delete {
	display: flex;
	align-items: center;
	gap: 0.375rem;
	padding: 0.375rem 0.75rem;
	font-size: 0.75rem;
	font-weight: 600;
	color: white;
	background-color: #ef4444;
	border: none;
	border-radius: 6px;
	cursor: pointer;
	transition: all 150ms ease;
}

.imageeditor__selection-delete:hover:not(:disabled) {
	background-color: #dc2626;
}

.imageeditor__selection-delete-icon {
	width: 13px;
	height: 13px;
}

.selection-bar-enter-active {
	animation: slideDown 0.2s ease-out;
}

.selection-bar-leave-active {
	animation: slideUp 0.15s ease-in;
}

@keyframes slideDown {
	from {
		opacity: 0;
		transform: translateY(-8px);
	}
	to {
		opacity: 1;
		transform: translateY(0);
	}
}

@keyframes slideUp {
	from {
		opacity: 1;
		transform: translateY(0);
	}
	to {
		opacity: 0;
		transform: translateY(-8px);
	}
}

.imageeditor__section {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.imageeditor__date-group {
	display: flex;
	flex-direction: column;
	gap: 1rem;
}

.imageeditor__section-header {
	font-size: 0.875rem;
	font-weight: 500;
	color: var(--sidebar-text-muted);
	margin: 0;
	padding-bottom: 0.1rem;
}

.imageeditor__grid {
	display: grid;
	grid-template-columns: repeat(1, 1fr);
	gap: 1.25rem;
}

@media (min-width: 1024px) {
	.imageeditor__grid {
		grid-template-columns: repeat(2, 1fr);
	}
}

@media (min-width: 1400px) {
	.imageeditor__grid {
		grid-template-columns: repeat(3, 1fr);
	}
}

@media (min-width: 1800px) {
	.imageeditor__grid {
		grid-template-columns: repeat(4, 1fr);
	}
}

.imageeditor-card {
	position: relative;
	background-color: var(--sidebar-surface);
	border: 1px solid var(--sidebar-border);
	border-radius: 10px;
	overflow: hidden;
	cursor: pointer;
	transition: all 200ms ease;
	max-height: 280px;
}

.imageeditor-card:hover {
	border-color: rgba(255, 255, 255, 0.15);
	box-shadow: 0 8px 32px rgba(0, 0, 0, 0.25);
	transform: scale(1.02);
}

.imageeditor-card--selected {
	border-color: var(--sidebar-accent);
	box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.3);
}

.imageeditor-card--skeleton {
	pointer-events: none;
	aspect-ratio: 16 / 9;
}

.imageeditor-card__skeleton-bg {
	position: absolute;
	inset: 0;
	background: linear-gradient(135deg, var(--sidebar-hover) 0%, var(--sidebar-surface) 100%);
}

.imageeditor-card__checkbox {
	position: absolute;
	top: 1rem;
	right: 1rem;
	z-index: 30;
	opacity: 0;
	transition: opacity 150ms ease;
}

.imageeditor-card:hover .imageeditor-card__checkbox,
.imageeditor-card__checkbox--visible {
	opacity: 1;
}

.imageeditor-card__checkbox-inner {
	width: 24px;
	height: 24px;
	border-radius: 6px;
	display: flex;
	align-items: center;
	justify-content: center;
	background-color: rgba(0, 0, 0, 0.6);
	border: 1px solid rgba(255, 255, 255, 0.45);
	color: white;
	cursor: pointer;
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
	transition: all 150ms ease;
}

.imageeditor-card__checkbox-inner--checked {
	background-color: var(--sidebar-accent);
	border-color: var(--sidebar-accent);
	color: var(--sidebar-bg);
}

.imageeditor-card__checkbox-icon {
	width: 16px;
	height: 16px;
}

.imageeditor-card__badge {
	position: absolute;
	top: 1rem;
	left: 1rem;
	z-index: 20;
	display: flex;
	align-items: center;
	gap: 0.25rem;
	padding: 0.3125rem 0.5rem;
	border-radius: 5px;
	font-size: 0.625rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.02em;
	backdrop-filter: blur(8px);
	box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.imageeditor-card__badge--canvas {
	background-color: rgba(139, 92, 246, 0.3);
	color: #c4b5fd;
}

.imageeditor-card__badge-icon {
	width: 10px;
	height: 10px;
}

.imageeditor-card__thumbnail {
	position: absolute;
	inset: 0;
	z-index: 0;
	background-size: cover;
	background-position: center;
	background-repeat: no-repeat;
}

.imageeditor-card__vignette {
	position: absolute;
	inset: 0;
	background: linear-gradient(to top, rgba(0, 0, 0, 0.85) 0%, rgba(0, 0, 0, 0.4) 40%, transparent 70%);
}

.imageeditor-card__thumbnail--empty {
	background-color: var(--sidebar-hover);
}

.imageeditor-card__thumbnail-gradient {
	position: absolute;
	inset: 0;
	background: linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(0, 0, 0, 0.4) 50%, rgba(236, 72, 153, 0.1) 100%);
}

.imageeditor-card__empty-icon {
	position: absolute;
	inset: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	opacity: 0.25;
}

.imageeditor-card__folder-icon {
	width: 64px;
	height: 64px;
	color: var(--sidebar-text);
}

.imageeditor-card__bottom {
	position: absolute;
	bottom: 0;
	left: 0;
	right: 0;
	z-index: 5;
	padding: 1rem;
	padding-top: 4rem;
	background: linear-gradient(to top, rgba(0, 0, 0, 0.9) 0%, rgba(0, 0, 0, 0.7) 50%, transparent 100%);
	display: flex;
	flex-direction: column;
	gap: 0.375rem;
}

.imageeditor-card__title {
	font-size: 1rem;
	font-weight: 700;
	color: white;
	margin: 0;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	text-shadow: 0 1px 3px rgba(0, 0, 0, 0.5);
	line-height: 1.3;
}

.imageeditor-card__meta {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	font-size: 0.75rem;
	font-weight: 500;
	color: rgba(255, 255, 255, 0.7);
}

.imageeditor-card__meta-text {
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
}

.imageeditor-card__hover-actions {
	position: absolute;
	inset: 0;
	z-index: 10;
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.75rem;
	background-color: rgba(0, 0, 0, 0.4);
	opacity: 0;
	transition: opacity 200ms ease;
}

.imageeditor-card:hover .imageeditor-card__hover-actions {
	opacity: 1;
}

.imageeditor-card__action-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 0.5rem;
	background-color: rgba(255, 255, 255, 0.9);
	border: none;
	border-radius: 9999px;
	color: #1f2937;
	cursor: pointer;
	transition: all 150ms ease;
	box-shadow: 0 4px 12px rgba(0, 0, 0, 0.25);
}

.imageeditor-card__action-btn:hover {
	background-color: white;
	transform: scale(1.1);
}

.imageeditor-card__action-icon {
	width: 20px;
	height: 20px;
}

.imageeditor__no-results {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	padding: 4rem 1rem;
	text-align: center;
}

.imageeditor__no-results-icon-wrapper {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 64px;
	height: 64px;
	background-color: var(--sidebar-hover);
	border-radius: 9999px;
	margin-bottom: 1rem;
}

.imageeditor__no-results-icon {
	width: 32px;
	height: 32px;
	color: var(--sidebar-text-muted);
}

.imageeditor__no-results-title {
	font-size: 1.125rem;
	font-weight: 600;
	color: var(--sidebar-text);
	margin: 0 0 0.25rem;
}

.imageeditor__no-results-description {
	font-size: 0.875rem;
	color: var(--sidebar-text-muted);
	margin: 0 0 1rem;
	max-width: 24rem;
}

.imageeditor__no-results-btn {
	font-size: 0.875rem;
	font-weight: 500;
	color: var(--sidebar-accent);
	background: transparent;
	border: none;
	cursor: pointer;
}

.imageeditor__no-results-btn:hover {
	opacity: 0.8;
	text-decoration: underline;
}

.imageeditor__empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	text-align: center;
}

.imageeditor__empty-icon-wrapper {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 72px;
	height: 72px;
	background-color: var(--sidebar-hover);
	border-radius: 16px;
	margin-bottom: 1.5rem;
}

.imageeditor__empty-icon {
	width: 36px;
	height: 36px;
	color: var(--sidebar-text-muted);
}

.imageeditor__empty-title {
	font-size: 1.125rem;
	font-weight: 600;
	color: var(--sidebar-text);
	margin: 0 0 0.5rem;
}

.imageeditor__empty-description {
	font-size: 0.875rem;
	color: var(--sidebar-text-muted);
	margin: 0;
	max-width: 320px;
	line-height: 1.5;
}
</style>
