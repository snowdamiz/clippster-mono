<script setup lang="ts">
import { ref, computed, watch } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useBrandingConfig, ASPECT_RATIOS } from "../../../composables/useBrandingConfig";
import { useEditor } from "../../../composables/useEditor";
import { resolveApplicableProfiles, type ApplicableProfile } from "@/composables/useBrandingProfileSelection";
import { getAllWatermarkImages, resolveWatermarkById, type WatermarkImage } from "@/services/database/watermarks";
import { getAllIntroOutros, createIntroOutro } from "@/services/database/intro-outros";
import type { IntroOutro } from "@/services/database/types";
import type { AspectRatioId } from "../../../types/project";
import WatermarkPositionPicker from "@/components/WatermarkPositionPicker.vue";
import type { CreatorWatermarkSettings } from "@/components/WatermarkPositionPicker.vue";
import {
	Info,
	Film,
	ChevronDown,
	Monitor,
	Smartphone,
	Square,
	RectangleVertical,
	Move,
	X,
	Upload,
	Loader2,
} from "lucide-vue-next";

const { editor } = useEditor({ subscribe: false });
const {
	creatorProfile,
	isReadOnly,
	config,
	setWatermarkForRatio,
	setIntroForRatio,
	setOutroForRatio,
	initFromCreatorProfile,
	detachCreatorProfile,
	getActiveWatermark,
	getActiveIntro,
	getActiveOutro,
} = useBrandingConfig();

const activeRatio = ref<AspectRatioId>("16:9");
const showProfileDropdown = ref(false);
const applicableProfiles = ref<ApplicableProfile[]>([]);

const ratioConfig = [
	{ id: "16:9" as AspectRatioId, label: "16:9", icon: Monitor },
	{ id: "9:16" as AspectRatioId, label: "9:16", icon: Smartphone },
	{ id: "1:1" as AspectRatioId, label: "1:1", icon: Square },
	{ id: "4:5" as AspectRatioId, label: "4:5", icon: RectangleVertical },
];

// Watermark data
const watermarks = ref<WatermarkImage[]>([]);
const watermarkThumbnails = ref<Map<string, string>>(new Map());

// Intro/Outro data
const intros = ref<IntroOutro[]>([]);
const outros = ref<IntroOutro[]>([]);
const loadingIntroOutros = ref(false);
const showIntroDropdown = ref(false);
const showOutroDropdown = ref(false);
const uploadingIntro = ref(false);
const uploadingOutro = ref(false);

// Watermark position picker
const showPositionPicker = ref(false);

// Resolved org watermark data (for org-asset- IDs that aren't in the local watermarks list)
const resolvedOrgWatermark = ref<{
	name: string;
	dataUrl: string | null;
	filePath: string | null;
	width: number | null;
	height: number | null;
} | null>(null);
const lastResolvedWmId = ref<string | null>(null);

// Current ratio's active config
const activeWatermark = computed(() => getActiveWatermark(activeRatio.value));
const activeIntro = computed(() => getActiveIntro(activeRatio.value));
const activeOutro = computed(() => getActiveOutro(activeRatio.value));
const brandingProjectId = computed(() => editor.project.getActiveOrNull()?.settings?.sourceProjectId ?? null);
const selectedBrandingProfileId = computed(() => config.value.creatorProfileId ?? null);
const selectedBrandingProfileName = computed(() => {
	if (creatorProfile.value?.name) return creatorProfile.value.name;
	const selected = applicableProfiles.value.find((profile) => profile.profile.id === selectedBrandingProfileId.value);
	return selected?.profile.name ?? null;
});

// Watch active watermark ID and resolve org-asset- watermarks
watch(
	() => activeWatermark.value?.watermarkId,
	async (wmId) => {
		if (!wmId || !wmId.startsWith('org-asset-')) {
			resolvedOrgWatermark.value = null;
			lastResolvedWmId.value = null;
			return;
		}
		if (wmId === lastResolvedWmId.value) return;
		lastResolvedWmId.value = wmId;

		try {
			const resolved = await resolveWatermarkById(wmId);
			if (resolved?.filePath) {
				let dataUrl: string | null = null;
				try {
					dataUrl = await invoke<string>('read_file_as_data_url', { filePath: resolved.filePath });
				} catch { /* thumbnail optional */ }

				const fileName = resolved.filePath.split(/[\\/]/).pop() || 'Org Watermark';
				resolvedOrgWatermark.value = {
					name: fileName,
					dataUrl,
					filePath: resolved.filePath,
					width: resolved.width,
					height: resolved.height,
				};
			} else {
				resolvedOrgWatermark.value = null;
			}
		} catch (e) {
			console.warn('[BrandingView] Failed to resolve org watermark:', e);
			resolvedOrgWatermark.value = null;
		}
	},
	{ immediate: true },
);

// Resolve watermark name for display
const activeWatermarkName = computed(() => {
	const wm = activeWatermark.value;
	if (!wm?.watermarkId) return null;
	if (resolvedOrgWatermark.value) return resolvedOrgWatermark.value.name;
	const found = watermarks.value.find((w) => w.id === wm.watermarkId);
	return found?.name ?? "Unknown";
});

const activeWatermarkThumbnail = computed(() => {
	const wm = activeWatermark.value;
	if (!wm?.watermarkId) return null;
	if (resolvedOrgWatermark.value?.dataUrl) return resolvedOrgWatermark.value.dataUrl;
	return watermarkThumbnails.value.get(wm.watermarkId) ?? null;
});

// Resolve the default watermark file path and dimensions for the position picker
const defaultWatermarkFilePath = computed(() => {
	const wm = activeWatermark.value;
	if (!wm?.watermarkId) return undefined;
	if (resolvedOrgWatermark.value?.filePath) return resolvedOrgWatermark.value.filePath;
	const found = watermarks.value.find((w) => w.id === wm.watermarkId);
	return found?.file_path;
});

const defaultWatermarkDimensions = computed(() => {
	const wm = activeWatermark.value;
	if (!wm?.watermarkId) return { width: null, height: null };
	if (resolvedOrgWatermark.value) return { width: resolvedOrgWatermark.value.width, height: resolvedOrgWatermark.value.height };
	const found = watermarks.value.find((w) => w.id === wm.watermarkId);
	return { width: found?.width ?? null, height: found?.height ?? null };
});

// Resolve intro/outro names
const activeIntroName = computed(() => {
	const intro = activeIntro.value;
	if (!intro?.assetId) return null;
	const found = intros.value.find((i) => i.id === intro.assetId);
	return found?.name ?? "Unknown";
});

const activeOutroName = computed(() => {
	const outro = activeOutro.value;
	if (!outro?.assetId) return null;
	const found = outros.value.find((o) => o.id === outro.assetId);
	return found?.name ?? "Unknown";
});

// Load data on mount
async function loadAssets() {
	loadingIntroOutros.value = true;

	try {
		watermarks.value = await getAllWatermarkImages();
		for (const wm of watermarks.value) {
			if (!watermarkThumbnails.value.has(wm.id)) {
				try {
					const dataUrl = await invoke<string>("read_file_as_data_url", {
						filePath: wm.file_path,
					});
					watermarkThumbnails.value.set(wm.id, dataUrl);
				} catch {
					// Skip failed thumbnails
				}
			}
		}
	} catch (e) {
		console.error("[BrandingView] Failed to load watermarks:", e);
	}

	try {
		intros.value = await getAllIntroOutros("intro");
		outros.value = await getAllIntroOutros("outro");
	} catch (e) {
		console.error("[BrandingView] Failed to load intro/outros:", e);
	} finally {
		loadingIntroOutros.value = false;
	}
}

loadAssets();

async function loadApplicableBrandingProfiles() {
	const projectId = brandingProjectId.value;
	if (!projectId) {
		applicableProfiles.value = [];
		return;
	}
	try {
		applicableProfiles.value = await resolveApplicableProfiles(projectId);
	} catch (error) {
		console.warn("[BrandingView] Failed to load applicable branding profiles:", error);
		applicableProfiles.value = [];
	}
}
function applyBrandingProfileSelection(profile: ApplicableProfile | null) {
	if (profile) {
		closeDropdowns();
		showProfileDropdown.value = false;
		initFromCreatorProfile(profile.profile);
		return;
	}
	detachCreatorProfile();
	closeDropdowns();
	showProfileDropdown.value = false;
}

watch(brandingProjectId, () => {
	loadApplicableBrandingProfiles();
}, { immediate: true });

// Persist branding config to project settings when it changes
watch(
	config,
	(newConfig) => {
		const project = editor.project.getActiveOrNull();
		if (!project) return;
		editor.project.updateSettings({ settings: { brandingConfig: newConfig } });
	},
	{ deep: true },
);

// Intro/Outro selection
function selectIntro(intro: IntroOutro | null) {
	if (intro) {
		setIntroForRatio(activeRatio.value, {
			assetId: intro.id,
			filePath: intro.file_path,
			duration: intro.duration ?? undefined,
		});
	} else {
		setIntroForRatio(activeRatio.value, null);
	}
	showIntroDropdown.value = false;
}

function selectOutro(outro: IntroOutro | null) {
	if (outro) {
		setOutroForRatio(activeRatio.value, {
			assetId: outro.id,
			filePath: outro.file_path,
			duration: outro.duration ?? undefined,
		});
	} else {
		setOutroForRatio(activeRatio.value, null);
	}
	showOutroDropdown.value = false;
}

// Upload intro/outro video
async function uploadIntroOutro(type: "intro" | "outro") {
	const isIntro = type === "intro";
	const uploading = isIntro ? uploadingIntro : uploadingOutro;
	if (uploading.value) return;

	try {
		uploading.value = true;
		const dropdown = isIntro ? showIntroDropdown : showOutroDropdown;
		dropdown.value = false;

		const { open } = await import("@tauri-apps/plugin-dialog");
		const selected = await open({
			multiple: false,
			filters: [
				{
					name: "Videos",
					extensions: ["mp4", "mov", "webm", "avi", "mkv"],
				},
			],
		});

		if (!selected) return;
		const sourcePath = selected;
		const originalFilename = sourcePath.split(/[\\\/]/).pop() || "Unknown";

		// Copy to storage using existing asset copy command
		const result = await invoke<{
			destination_path: string;
			original_filename: string;
			thumbnail_path: string | null;
		}>("copy_asset_to_storage", { sourcePath, assetType: type });

		// Probe duration using existing validate_video_file command
		let duration: number | undefined;
		try {
			const validation = await invoke<{
				is_valid: boolean;
				duration: number | null;
			}>("validate_video_file", { filePath: result.destination_path });
			if (validation.duration && validation.duration > 0) {
				duration = validation.duration;
			}
		} catch {
			// Duration probe is optional
		}

		// Create database record
		const id = await createIntroOutro(
			type,
			result.original_filename || originalFilename,
			result.destination_path,
			duration,
		);

		// Reload and select
		if (isIntro) {
			intros.value = await getAllIntroOutros("intro");
			const newIntro = intros.value.find((i) => i.id === id);
			if (newIntro) selectIntro(newIntro);
		} else {
			outros.value = await getAllIntroOutros("outro");
			const newOutro = outros.value.find((o) => o.id === id);
			if (newOutro) selectOutro(newOutro);
		}
	} catch (err) {
		console.error(`[BrandingView] Failed to upload ${type}:`, err);
	} finally {
		uploading.value = false;
	}
}

// Open watermark position picker — the picker handles everything:
// per-ratio watermark selection, upload, drag positioning, opacity, scale, full-frame overlay
function openPositionPicker() {
	showPositionPicker.value = true;
}

// Build settings for position picker from current branding config
const positionPickerSettings = computed((): CreatorWatermarkSettings => {
	const result: Record<string, any> = {};
	for (const ratio of ASPECT_RATIOS) {
		const wm = getActiveWatermark(ratio);
		if (wm && wm.position) {
			result[ratio] = {
				watermarkId: wm.watermarkId,
				position: wm.position,
			};
		} else {
			result[ratio] = null;
		}
	}
	return result as CreatorWatermarkSettings;
});

// Handle save from position picker — writes all ratios back to branding config
function handlePositionPickerSave(settings: CreatorWatermarkSettings) {
	if (isReadOnly.value) {
		showPositionPicker.value = false;
		return;
	}
	for (const ratio of ASPECT_RATIOS) {
		const ratioSettings = settings[ratio];
		if (ratioSettings && ratioSettings.position) {
			setWatermarkForRatio(ratio, {
				watermarkId: ratioSettings.watermarkId,
				position: ratioSettings.position,
			});
		} else {
			setWatermarkForRatio(ratio, null);
		}
	}
	showPositionPicker.value = false;

	// Reload watermarks in case user uploaded a new one inside the picker
	loadAssets();
}

// Close all dropdowns when clicking away
function closeDropdowns() {
	showProfileDropdown.value = false;
	showIntroDropdown.value = false;
	showOutroDropdown.value = false;
}

function formatDuration(d: number | null | undefined): string {
	if (!d) return "";
	const sec = Math.floor(d % 60);
	const min = Math.floor(d / 60);
	return `${min}:${sec.toString().padStart(2, "0")}`;
}
</script>

<template>
	<div class="flex h-full flex-col overflow-hidden">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-white/10 px-3 py-2">
			<span class="text-sm text-zinc-400">Branding</span>
			<div class="flex items-center gap-1">
				<button
					v-for="ar in ratioConfig"
					:key="ar.id"
					type="button"
					:class="[
						'relative flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium transition-colors',
						activeRatio === ar.id
							? 'bg-blue-500/15 text-blue-400'
							: 'text-zinc-500 hover:bg-white/5 hover:text-zinc-300',
					]"
					@click="activeRatio = ar.id"
				>
					{{ ar.label }}
					<span
						v-if="getActiveWatermark(ar.id) || getActiveIntro(ar.id) || getActiveOutro(ar.id)"
						class="absolute -right-0.5 -top-0.5 size-1.5 rounded-full bg-green-500"
					/>
				</button>
			</div>
		</div>

		<!-- Read-only banner -->
		<div
			v-if="isReadOnly && selectedBrandingProfileName"
			class="mx-3 mt-2 flex items-center gap-2 rounded-md border border-blue-500/20 bg-blue-500/10 px-3 py-2"
		>
			<Info class="size-3.5 shrink-0 text-blue-400" />
			<div class="min-w-0">
				<p class="truncate text-[11px] font-medium text-blue-300">
					{{ selectedBrandingProfileName }}
				</p>
				<p class="text-[10px] text-blue-400/70">Configured by creator profile</p>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto">
			<div>
				<div class="px-3 pb-1 pt-3">
					<span class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Branding Profile</span>
				</div>

				<div class="relative">
					<button
						type="button"
						class="flex w-full items-center gap-3 border-b border-white/5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
						@click.stop="showProfileDropdown = !showProfileDropdown"
					>
						<div class="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/5">
							<Info class="size-3.5 text-zinc-500" />
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-xs" :class="selectedBrandingProfileName ? 'text-zinc-200' : 'text-zinc-500'">
								{{ selectedBrandingProfileName ?? 'None' }}
							</p>
							<p class="text-[10px] text-zinc-500">
								{{ selectedBrandingProfileName ? 'Profile branding applied' : 'No profile selected' }}
							</p>
						</div>
						<ChevronDown class="size-3 shrink-0 text-zinc-500" />
					</button>

					<div
						v-if="showProfileDropdown"
						class="absolute left-0 right-0 top-full z-50 mt-1 max-h-48 overflow-y-auto rounded-lg border border-white/10 bg-[#1e1e22] py-1 shadow-xl"
						@click.stop
					>
						<button
							type="button"
							:class="[
								'flex w-full items-center gap-2 px-2.5 py-1.5 text-xs transition-colors',
								!selectedBrandingProfileId ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-300 hover:bg-white/5',
							]"
							@click="applyBrandingProfileSelection(null)"
						>
							<X class="size-3" />
							None
						</button>
						<button
							v-for="profile in applicableProfiles"
							:key="profile.profile.id"
							type="button"
							:class="[
								'flex w-full items-center gap-2 px-2.5 py-1.5 text-xs transition-colors',
								selectedBrandingProfileId === profile.profile.id ? 'bg-blue-500/10 text-blue-400' : 'text-zinc-300 hover:bg-white/5',
							]"
							@click="applyBrandingProfileSelection(profile)"
						>
							<Info class="size-3 shrink-0 text-zinc-500" />
							<span class="truncate">{{ profile.profile.name }}</span>
							<span class="ml-auto text-[10px] text-zinc-500">{{ profile.label }}</span>
						</button>
						<div v-if="applicableProfiles.length === 0" class="px-2.5 py-2 text-center text-[10px] text-zinc-500">
							No branding profiles available
						</div>
					</div>
				</div>
			</div>

			<!-- Watermark Section -->
			<div>
				<div class="px-3 pb-1 pt-3">
					<span class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Watermark</span>
				</div>

				<!-- Open WatermarkPositionPicker button (viewable even when read-only) -->
				<button
					type="button"
					class="flex w-full items-center gap-3 border-b border-white/5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03]"
					@click="openPositionPicker"
				>
					<div class="relative flex size-8 shrink-0 items-center justify-center overflow-hidden rounded-md bg-white/5">
						<img v-if="activeWatermarkThumbnail" :src="activeWatermarkThumbnail" class="size-full object-contain" />
						<Move v-else class="size-3.5 text-zinc-500" />
					</div>
					<div class="min-w-0 flex-1">
						<p class="truncate text-xs" :class="activeWatermarkName ? 'text-zinc-200' : 'text-zinc-500'">
							{{ activeWatermarkName ?? "Configure Watermark" }}
						</p>
						<p v-if="activeWatermark?.position" class="text-[10px] text-zinc-500">
							{{ activeWatermark.position.opacity }}% opacity · {{ activeWatermark.position.scale }}% scale
						</p>
					</div>
					<ChevronDown class="size-3 shrink-0 text-zinc-500" />
				</button>
			</div>

			<!-- Intro Section -->
			<div>
				<div class="px-3 pb-1 pt-3">
					<span class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Intro Video</span>
				</div>

				<div class="relative">
					<button
						type="button"
						:disabled="isReadOnly"
						class="flex w-full items-center gap-3 border-b border-white/5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
						@click.stop="showIntroDropdown = !showIntroDropdown"
					>
						<div class="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/5">
							<Film class="size-3.5 text-zinc-500" />
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-xs" :class="activeIntroName ? 'text-zinc-200' : 'text-zinc-500'">
								{{ activeIntroName ?? "None" }}
							</p>
							<p v-if="activeIntro?.duration" class="text-[10px] text-zinc-500">
								{{ formatDuration(activeIntro.duration) }}
							</p>
						</div>
						<ChevronDown class="size-3 shrink-0 text-zinc-500" />
					</button>

					<div
						v-if="showIntroDropdown"
						class="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-[#1e1e22] py-1 shadow-xl"
						@click.stop
					>
						<button
							type="button"
							class="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-white/5"
							@click="selectIntro(null)"
						>
							<X class="size-3" />
							None
						</button>
						<button
							v-for="intro in intros"
							:key="intro.id"
							type="button"
							:class="[
								'flex w-full items-center gap-2 px-2.5 py-1.5 text-xs transition-colors',
								activeIntro?.assetId === intro.id
									? 'bg-blue-500/10 text-blue-400'
									: 'text-zinc-300 hover:bg-white/5',
							]"
							@click="selectIntro(intro)"
						>
							<Film class="size-3.5 shrink-0 text-zinc-500" />
							<span class="truncate">{{ intro.name }}</span>
							<span v-if="intro.duration" class="ml-auto text-[10px] text-zinc-500">
								{{ formatDuration(intro.duration) }}
							</span>
						</button>
						<div v-if="loadingIntroOutros" class="px-2.5 py-2 text-center text-[10px] text-zinc-500">
							Loading...
						</div>
						<div v-if="!loadingIntroOutros && intros.length === 0" class="px-2.5 py-2 text-center text-[10px] text-zinc-500">
							No intros available
						</div>
						<!-- Upload new intro -->
						<button
							type="button"
							:disabled="uploadingIntro"
							class="flex w-full items-center gap-2 border-t border-white/10 px-2.5 py-1.5 text-xs text-blue-400 transition-colors hover:bg-white/5"
							@click="uploadIntroOutro('intro')"
						>
							<Upload v-if="!uploadingIntro" class="size-3" />
							<Loader2 v-else class="size-3 animate-spin" />
							{{ uploadingIntro ? 'Uploading...' : 'Upload new' }}
						</button>
					</div>
				</div>
			</div>

			<!-- Outro Section -->
			<div>
				<div class="px-3 pb-1 pt-3">
					<span class="text-[10px] font-medium uppercase tracking-wider text-zinc-500">Outro Video</span>
				</div>

				<div class="relative">
					<button
						type="button"
						:disabled="isReadOnly"
						class="flex w-full items-center gap-3 border-b border-white/5 px-3 py-2.5 text-left transition-colors hover:bg-white/[0.03] disabled:cursor-not-allowed disabled:opacity-60"
						@click.stop="showOutroDropdown = !showOutroDropdown"
					>
						<div class="flex size-8 shrink-0 items-center justify-center rounded-md bg-white/5">
							<Film class="size-3.5 text-zinc-500" />
						</div>
						<div class="min-w-0 flex-1">
							<p class="truncate text-xs" :class="activeOutroName ? 'text-zinc-200' : 'text-zinc-500'">
								{{ activeOutroName ?? "None" }}
							</p>
							<p v-if="activeOutro?.duration" class="text-[10px] text-zinc-500">
								{{ formatDuration(activeOutro.duration) }}
							</p>
						</div>
						<ChevronDown class="size-3 shrink-0 text-zinc-500" />
					</button>

					<div
						v-if="showOutroDropdown"
						class="absolute left-0 right-0 top-full z-50 mt-1 max-h-40 overflow-y-auto rounded-lg border border-white/10 bg-[#1e1e22] py-1 shadow-xl"
						@click.stop
					>
						<button
							type="button"
							class="flex w-full items-center gap-2 px-2.5 py-1.5 text-xs text-zinc-400 hover:bg-white/5"
							@click="selectOutro(null)"
						>
							<X class="size-3" />
							None
						</button>
						<button
							v-for="outro in outros"
							:key="outro.id"
							type="button"
							:class="[
								'flex w-full items-center gap-2 px-2.5 py-1.5 text-xs transition-colors',
								activeOutro?.assetId === outro.id
									? 'bg-blue-500/10 text-blue-400'
									: 'text-zinc-300 hover:bg-white/5',
							]"
							@click="selectOutro(outro)"
						>
							<Film class="size-3.5 shrink-0 text-zinc-500" />
							<span class="truncate">{{ outro.name }}</span>
							<span v-if="outro.duration" class="ml-auto text-[10px] text-zinc-500">
								{{ formatDuration(outro.duration) }}
							</span>
						</button>
						<div v-if="loadingIntroOutros" class="px-2.5 py-2 text-center text-[10px] text-zinc-500">
							Loading...
						</div>
						<div v-if="!loadingIntroOutros && outros.length === 0" class="px-2.5 py-2 text-center text-[10px] text-zinc-500">
							No outros available
						</div>
						<!-- Upload new outro -->
						<button
							type="button"
							:disabled="uploadingOutro"
							class="flex w-full items-center gap-2 border-t border-white/10 px-2.5 py-1.5 text-xs text-blue-400 transition-colors hover:bg-white/5"
							@click="uploadIntroOutro('outro')"
						>
							<Upload v-if="!uploadingOutro" class="size-3" />
							<Loader2 v-else class="size-3 animate-spin" />
							{{ uploadingOutro ? 'Uploading...' : 'Upload new' }}
						</button>
					</div>
				</div>
			</div>
		</div>

		<!-- Click-away for dropdowns -->
		<div
			v-if="showProfileDropdown || showIntroDropdown || showOutroDropdown"
			class="fixed inset-0 z-40"
			@click="closeDropdowns"
		/>

		<!-- Watermark Position Picker Dialog -->
		<!-- This handles everything: per-ratio watermark selection, upload, drag positioning, opacity, scale, full-frame overlay -->
		<WatermarkPositionPicker
			:show="showPositionPicker"
			:watermark-file-path="defaultWatermarkFilePath"
			:watermark-id="activeWatermark?.watermarkId ?? undefined"
			:watermark-width="defaultWatermarkDimensions.width"
			:watermark-height="defaultWatermarkDimensions.height"
			:settings="positionPickerSettings"
			:read-only="isReadOnly"
			@close="showPositionPicker = false"
			@save="handlePositionPickerSave"
		/>
	</div>
</template>
