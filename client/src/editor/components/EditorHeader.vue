<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useEditor } from "../composables/useEditor";
import { useEditorUIState } from "../composables/useEditorUIState";
import { useRouter } from "vue-router";
import ExportButton from "./ExportButton.vue";
import { ArrowLeft, ChevronDown, Maximize, Minimize, Smartphone } from "lucide-vue-next";
import ShortcutsDialog from "./dialogs/ShortcutsDialog.vue";
import ChatFab from "@/components/chat/ChatFab.vue";
import {
	getVideoEditorSourcesByProjectId,
	getClip,
	getProject,
	getRawVideosByProjectId,
	getRawVideo,
} from "@/services/database";
import { getPlatformConfig } from "@/config/platforms";
import { SOCIAL_OVERLAY_PRESETS } from "../constants/social-overlay-constants";
import type { SocialOverlayPreset } from "../types/social-overlays";
import type { ManualSourceFramingPayload } from "@/types";

const props = defineProps<{
	previewContainer: HTMLDivElement | null;
}>();

const { editor, version } = useEditor();
const { activeSocialOverlay } = useEditorUIState();
const router = useRouter();

const isExiting = ref(false);
const showShortcutsDialog = ref(false);
const showAspectMenu = ref(false);
const showSocialMenu = ref(false);
const showDropdown = ref(false);
const isFullscreen = ref(false);
const aspectButtonRef = ref<HTMLButtonElement | null>(null);
const socialButtonRef = ref<HTMLButtonElement | null>(null);
const titleInputRef = ref<HTMLInputElement | null>(null);

const aspectMenuStyle = computed(() => {
	const el = aspectButtonRef.value;
	if (!el) return {};
	const rect = el.getBoundingClientRect();
	return {
		top: `${rect.bottom + 6}px`,
		left: `${rect.left + rect.width / 2}px`,
		transform: "translateX(-50%)",
	};
});

const socialMenuStyle = computed(() => {
	const el = socialButtonRef.value;
	if (!el) return {};
	const rect = el.getBoundingClientRect();
	return {
		top: `${rect.bottom + 6}px`,
		left: `${rect.left + rect.width / 2}px`,
		transform: "translateX(-50%)",
	};
});
const isRenamingTitle = ref(false);
const renameInput = ref("");
const vodInfo = ref<{ platform: string; streamerName: string | null } | null>(null);

const aspectPresets = [
	{ width: 1920, height: 1080, label: "16:9" },
	{ width: 1080, height: 1920, label: "9:16" },
	{ width: 1080, height: 1080, label: "1:1" },
	{ width: 1080, height: 1350, label: "4:5" },
];

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull();
});

const projectTitle = computed(() => activeProject.value?.metadata.name || "Untitled");
const canvasWidth = computed(() => activeProject.value?.settings?.canvasSize?.width ?? 1920);
const canvasHeight = computed(() => activeProject.value?.settings?.canvasSize?.height ?? 1080);

const currentAspectLabel = computed(() => {
	const match = aspectPresets.find((p) => p.width === canvasWidth.value && p.height === canvasHeight.value);
	return match ? match.label : `${canvasWidth.value}×${canvasHeight.value}`;
});

const is916 = computed(() => canvasWidth.value === 1080 && canvasHeight.value === 1920);

/** Show Use 16:9 when project canvas is not ~16:9 (matches Manual POI target panel). */
const is169Canvas = computed(() => {
	const p = activeProject.value;
	if (!p?.settings?.canvasSize) return true;
	const w = p.settings.canvasSize.width;
	const h = p.settings.canvasSize.height;
	if (w <= 0 || h <= 0) return true;
	return Math.abs(w / h - 16 / 9) < 0.02;
});

const canvasSourceFraming = computed(() => activeProject.value?.settings.canvasSourceFraming ?? null);

const use169Checked = computed(() => canvasSourceFraming.value?.mode === "use16x9");

const showCanvasFramingBlur = ref(false);
const framingBlurButtonRef = ref<HTMLButtonElement | null>(null);

const framingBlurMenuStyle = computed(() => {
	const el = framingBlurButtonRef.value;
	if (!el) return {};
	const rect = el.getBoundingClientRect();
	return {
		top: `${rect.bottom + 6}px`,
		left: `${rect.left}px`,
	};
});

watch(is916, (val) => {
	if (!val) {
		activeSocialOverlay.value = null;
		showSocialMenu.value = false;
	}
});

function setAspectRatio(preset: { width: number; height: number }) {
	const is169 = Math.abs(preset.width / preset.height - 16 / 9) < 0.02;
	void editor.project.updateSettings({
		settings: {
			canvasSize: preset,
			...(is169 ? { canvasSourceFraming: undefined } : {}),
		},
	});
	showAspectMenu.value = false;
}

async function persistCanvasFraming(fr: ManualSourceFramingPayload | null) {
	await editor.project.updateSettings({
		settings: { canvasSourceFraming: fr ?? undefined },
	});
}

function onToggleUse169(e: Event) {
	const checked = (e.target as HTMLInputElement).checked;
	const cur = canvasSourceFraming.value;
	if (checked) {
		void persistCanvasFraming({
			mode: "use16x9",
			blurEnabled: (cur?.blurAmount ?? 12) > 0,
			blurAmount: cur?.blurAmount ?? 12,
			scale: 1,
			x: 0,
			y: 0,
		});
	} else if (cur?.mode === "use16x9") {
		void persistCanvasFraming(null);
	}
}

function setCanvasFramingBlurAmount(amount: number) {
	const cur = canvasSourceFraming.value;
	if (!cur || cur.mode === "none") return;
	void persistCanvasFraming({
		...cur,
		blurAmount: amount,
		blurEnabled: amount > 0,
	});
}

function toggleSocialOverlay(preset: SocialOverlayPreset) {
	if (activeSocialOverlay.value?.platform === preset.platform) {
		activeSocialOverlay.value = null;
	} else {
		activeSocialOverlay.value = preset;
	}
	showSocialMenu.value = false;
}

function toggleFullscreen() {
	const target = props.previewContainer ?? document.documentElement;
	if (!isFullscreen.value) {
		target.requestFullscreen?.();
	} else {
		document.exitFullscreen?.();
	}
}

function handleFullscreenChange() {
	isFullscreen.value = !!document.fullscreenElement;
}

onMounted(() => {
	document.addEventListener("fullscreenchange", handleFullscreenChange);
});

onUnmounted(() => {
	document.removeEventListener("fullscreenchange", handleFullscreenChange);
});

function normalizePlatformKey(platform: string): string {
	return platform === "YouTube" ? "YouTube" : platform.toLowerCase();
}

async function loadVodInfo() {
	const projectId = activeProject.value?.metadata.id;
	if (!projectId) {
		vodInfo.value = null;
		return;
	}
	try {
		const sources = await getVideoEditorSourcesByProjectId(projectId);
		const source = sources.find((s) => s.source_type === "clip" || s.source_type === "raw_video");
		if (!source) {
			vodInfo.value = null;
			return;
		}
		const sourceId = source.source_id;
		if (!sourceId) { vodInfo.value = null; return; }
		if (source.source_type === "clip") {
			const clip = await getClip(sourceId);
			if (!clip || !clip.project_id) { vodInfo.value = null; return; }
			const project = await getProject(clip.project_id);
			const platform = project?.platform;
			if (!project || !platform || platform === "Manual") {
				vodInfo.value = null;
				return;
			}
			const rawVideos = await getRawVideosByProjectId(project.id);
			vodInfo.value = {
				platform: normalizePlatformKey(platform),
				streamerName: rawVideos[0]?.source_mint_id ?? null,
			};
		} else {
			const rawVideo = await getRawVideo(sourceId);
			if (!rawVideo || !rawVideo.project_id) { vodInfo.value = null; return; }
			const project = await getProject(rawVideo.project_id);
			const platform = project?.platform;
			if (!project || !platform || platform === "Manual") {
				vodInfo.value = null;
				return;
			}
			vodInfo.value = {
				platform: normalizePlatformKey(platform),
				streamerName: rawVideo.source_mint_id ?? null,
			};
		}
	} catch {
		vodInfo.value = null;
	}
}

watch(() => activeProject.value?.metadata.id, loadVodInfo, { immediate: true });

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
	const trimmed = renameInput.value.trim();
	if (!project || !trimmed || trimmed === project.metadata.name) {
		isRenamingTitle.value = false;
		renameInput.value = project?.metadata.name ?? "";
		return;
	}
	try {
		await editor.project.renameProject({
			id: project.metadata.id,
			name: trimmed,
		});
	} catch (error) {
		console.error("Failed to rename project:", error);
		renameInput.value = project.metadata.name;
	}
	isRenamingTitle.value = false;
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

async function openRename() {
	renameInput.value = activeProject.value?.metadata.name || "";
	isRenamingTitle.value = true;
	showDropdown.value = false;
	await nextTick();
	titleInputRef.value?.focus();
	titleInputRef.value?.select();
}

function cancelRename() {
	renameInput.value = activeProject.value?.metadata.name || "";
	isRenamingTitle.value = false;
}
</script>

<template>
	<header class="relative z-10 flex h-[3.2rem] items-center justify-between border-b border-white/10 bg-[#0e0e10] px-3 pt-0.5">
		<div class="flex items-center gap-2">
			<!-- Back arrow -->
			<button
				type="button"
				class="flex items-center justify-center rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
				:disabled="isExiting"
				@click="handleExit"
			>
				<ArrowLeft class="size-4" />
			</button>

			<!-- VOD info + project name -->
			<template v-if="vodInfo">
				<img
					:src="getPlatformConfig(vodInfo.platform)?.icon"
					class="size-4 object-contain"
					:alt="vodInfo.platform"
				/>
				<span v-if="vodInfo.streamerName" class="text-[0.8rem] text-zinc-300">
					{{ vodInfo.streamerName }}
				</span>
				<span class="text-zinc-600">|</span>
			</template>

			<input
				v-if="isRenamingTitle"
				ref="titleInputRef"
				v-model="renameInput"
				type="text"
				class="h-7 min-w-24 max-w-72 rounded border border-white/10 bg-white/5 px-2 text-[0.85rem] text-zinc-100 outline-none ring-0 transition-colors focus:border-blue-400/70 focus:bg-white/10"
				aria-label="Project name"
				@blur="handleRename"
				@keydown.enter.prevent="handleRename"
				@keydown.escape.prevent="cancelRename"
			/>
			<button
				v-else
				type="button"
				class="max-w-72 truncate rounded px-1.5 py-1 text-left text-[0.85rem] text-zinc-200 transition-colors hover:bg-white/5 hover:text-zinc-50 focus:outline-none focus:ring-1 focus:ring-blue-400/60"
				:title="`Rename ${projectTitle}`"
				@click="openRename"
			>
				{{ projectTitle }}
			</button>
		</div>

	<!-- Center: Aspect ratio + Use 16:9 + Social overlay + Fullscreen -->
	<div class="pointer-events-auto absolute left-1/2 top-1/2 z-20 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2">
		<!-- Aspect ratio dropdown -->
		<div class="relative">
			<button
				ref="aspectButtonRef"
				type="button"
				class="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
				@click="showAspectMenu = !showAspectMenu"
			>
				{{ currentAspectLabel }}
				<ChevronDown class="size-3" />
			</button>
			<Teleport to="body">
				<div
					v-if="showAspectMenu"
					class="fixed z-[200] rounded-md border border-white/10 bg-[#1e1e22] py-1 shadow-lg"
					:style="aspectMenuStyle"
				>
					<button
						v-for="preset in aspectPresets"
						:key="preset.label"
						type="button"
						:class="[
							'flex w-full items-center gap-2 px-4 py-1.5 text-xs transition-colors',
							canvasWidth === preset.width && canvasHeight === preset.height
								? 'text-primary bg-primary/10'
								: 'text-zinc-300 hover:bg-white/5',
						]"
						@click="setAspectRatio(preset)"
					>
						{{ preset.label }}
						<span class="text-zinc-500">{{ preset.width }}×{{ preset.height }}</span>
					</button>
				</div>
			</Teleport>
			<div v-if="showAspectMenu" class="fixed inset-0 z-[199]" @click="showAspectMenu = false" />
		</div>

		<!-- Use 16:9 (non-16:9 canvas; same as Manual POI target panel) -->
		<template v-if="!is169Canvas">
			<div class="h-3 w-px bg-white/20" />
			<label
				class="flex cursor-pointer items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors"
				:class="use169Checked ? 'bg-cyan-500/20 text-cyan-300' : 'text-zinc-500 hover:text-zinc-300'"
			>
				<input
					type="checkbox"
					class="size-2.5 rounded border-zinc-600 bg-zinc-800 accent-cyan-500"
					:checked="use169Checked"
					@change="onToggleUse169"
				/>
				<span>Use 16:9</span>
			</label>
			<div v-if="use169Checked" class="relative">
				<button
					ref="framingBlurButtonRef"
					type="button"
					class="flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-zinc-200"
					@click="showCanvasFramingBlur = !showCanvasFramingBlur"
				>
					Blur<span v-if="(canvasSourceFraming?.blurAmount ?? 0) > 0">: {{ canvasSourceFraming?.blurAmount }}</span>
					<ChevronDown class="size-2.5 transition-transform" :class="{ 'rotate-180': showCanvasFramingBlur }" />
				</button>
				<Teleport to="body">
					<div
						v-if="showCanvasFramingBlur"
						class="fixed z-[200] min-w-[140px] rounded-md border border-white/10 bg-[#1e1e22] p-2 shadow-lg"
						:style="framingBlurMenuStyle"
						@click.stop
					>
						<div class="mb-1 flex items-center justify-between text-[10px] text-zinc-400">
							<span>Blur</span>
							<span class="font-mono text-zinc-300">{{ canvasSourceFraming?.blurAmount ?? 0 }}</span>
						</div>
						<input
							type="range"
							min="0"
							max="30"
							step="1"
							:value="canvasSourceFraming?.blurAmount ?? 0"
							class="h-1 w-full accent-cyan-500"
							@input="setCanvasFramingBlurAmount(Number(($event.target as HTMLInputElement).value))"
						/>
					</div>
				</Teleport>
				<div
					v-if="showCanvasFramingBlur"
					class="fixed inset-0 z-[199]"
					@click="showCanvasFramingBlur = false"
				/>
			</div>
		</template>

		<!-- Social overlay toggle (9:16 only) -->
		<template v-if="is916">
			<div class="h-3 w-px bg-white/20" />
			<div class="relative">
				<button
					ref="socialButtonRef"
					type="button"
					:class="[
						'flex items-center rounded-md p-1.5 transition-colors',
						activeSocialOverlay
							? 'text-cyan-400 bg-cyan-500/15'
							: 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300',
					]"
					@click="showSocialMenu = !showSocialMenu"
				>
					<Smartphone class="size-3.5" />
				</button>
				<Teleport to="body">
					<div
						v-if="showSocialMenu"
						class="fixed z-[200] w-44 rounded-md border border-white/10 bg-[#1e1e22] py-1 shadow-lg"
						:style="socialMenuStyle"
					>
						<button
							v-if="activeSocialOverlay"
							type="button"
							class="flex w-full items-center gap-2 px-3 py-1.5 text-xs text-zinc-400 hover:bg-white/5"
							@click="activeSocialOverlay = null; showSocialMenu = false"
						>
							Hide Overlay
						</button>
						<button
							v-for="preset in SOCIAL_OVERLAY_PRESETS"
							:key="preset.platform"
							type="button"
							:class="[
								'flex w-full items-center gap-2 px-3 py-1.5 text-xs transition-colors',
								activeSocialOverlay?.platform === preset.platform
									? 'text-cyan-400 bg-cyan-500/10'
									: 'text-zinc-300 hover:bg-white/5',
							]"
							@click="toggleSocialOverlay(preset)"
						>
							<span>{{ preset.icon }}</span>
							<span>{{ preset.label }}</span>
							<span class="ml-auto text-[10px] text-zinc-500">{{ preset.aspectRatio }}</span>
						</button>
					</div>
				</Teleport>
				<div v-if="showSocialMenu" class="fixed inset-0 z-[199]" @click="showSocialMenu = false" />
			</div>
		</template>

		<div class="h-3 w-px bg-white/20" />

		<!-- Fullscreen toggle -->
		<button
			type="button"
			class="flex items-center rounded-md p-1.5 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
			@click="toggleFullscreen"
		>
			<Minimize v-if="isFullscreen" class="size-3.5" />
			<Maximize v-else class="size-3.5" />
		</button>
	</div>

		<nav class="flex items-center gap-2">
			<ChatFab compact />
			<ExportButton />
		</nav>

		<!-- Shortcuts dialog -->
		<ShortcutsDialog v-model:open="showShortcutsDialog" />
	</header>
</template>
