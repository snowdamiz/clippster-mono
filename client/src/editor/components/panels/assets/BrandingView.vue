<script setup lang="ts">
import { ref, computed, watch, defineComponent, h } from "vue";
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
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import PanelHeader from "../../chrome/PanelHeader.vue";
import { AssetListRow, InspectorSection } from "../shared";
import {
	Info,
	Film,
	ChevronDown,
	ChevronRight,
	Monitor,
	Smartphone,
	Square,
	RectangleVertical,
	Move,
	User,
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

/** Status dot on ratios that already have branding configured (rendered as the option icon). */
const ConfiguredDot = defineComponent({
	inheritAttrs: false,
	setup: () => () =>
		h("span", {
			class: "pointer-events-none absolute right-0.5 top-0.5 size-1.5 rounded-full bg-success",
			"aria-hidden": "true",
		}),
});

const ratioOptions = computed<SegmentedOption<AspectRatioId>[]>(() =>
	ratioConfig.map((ar) => {
		const configured = !!(getActiveWatermark(ar.id) || getActiveIntro(ar.id) || getActiveOutro(ar.id));
		return {
			value: ar.id,
			label: ar.label,
			icon: configured ? ConfiguredDot : undefined,
			title: configured ? `${ar.label} · branding configured` : undefined,
		};
	}),
);

/** Picker rows look like a select field: value + meta, trailing chevron. */
const pickerRowClass =
	"rounded-lg border border-line bg-surface-raised px-2 py-2 hover:border-line-strong hover:bg-surface-raised data-[state=open]:border-line-strong disabled:cursor-not-allowed disabled:opacity-60";
const activeItemClass = "bg-brand-soft text-brand focus:bg-brand-soft [&>svg]:text-brand";

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
		<PanelHeader title="Branding">
			<SegmentedControl v-model="activeRatio" :options="ratioOptions" size="sm" class="[&>button]:relative" />
		</PanelHeader>

		<!-- Read-only notice -->
		<div v-if="isReadOnly && selectedBrandingProfileName" class="shrink-0 px-3 pt-3">
			<div class="flex items-start gap-2 rounded-lg border border-brand-line bg-brand-soft px-2.5 py-2">
				<Info class="mt-px size-3.5 shrink-0 text-brand" />
				<div class="min-w-0">
					<p class="truncate text-xs font-medium text-fg">{{ selectedBrandingProfileName }}</p>
					<p class="text-2xs text-fg-muted">Configured by creator profile</p>
				</div>
			</div>
		</div>

		<!-- Content -->
		<div class="flex-1 overflow-y-auto">
			<InspectorSection title="Branding profile">
				<DropdownMenu v-model:open="showProfileDropdown">
					<DropdownMenuTrigger as-child>
						<AssetListRow as="button" persistent-actions :class="pickerRowClass">
							<template #leading>
								<div class="grid size-8 place-items-center rounded-md bg-surface-sunken">
									<User class="size-3.5 text-fg-subtle" />
								</div>
							</template>
							<template #title>
								<span :class="selectedBrandingProfileName ? 'text-fg' : 'text-fg-muted'">
									{{ selectedBrandingProfileName ?? 'None' }}
								</span>
							</template>
							<template #meta>
								<span class="truncate">{{ selectedBrandingProfileName ? 'Profile branding applied' : 'No profile selected' }}</span>
							</template>
							<template #trailing>
								<ChevronDown class="size-3.5 text-fg-subtle" />
							</template>
						</AssetListRow>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						class="max-h-64 w-[var(--reka-dropdown-menu-trigger-width)] overflow-y-auto"
					>
						<DropdownMenuItem
							:class="!selectedBrandingProfileId && activeItemClass"
							@select="applyBrandingProfileSelection(null)"
						>
							<X />
							None
						</DropdownMenuItem>
						<DropdownMenuItem
							v-for="profile in applicableProfiles"
							:key="profile.profile.id"
							:class="selectedBrandingProfileId === profile.profile.id && activeItemClass"
							@select="applyBrandingProfileSelection(profile)"
						>
							<User />
							<span class="min-w-0 flex-1 truncate">{{ profile.profile.name }}</span>
							<span class="shrink-0 text-2xs text-fg-subtle">{{ profile.label }}</span>
						</DropdownMenuItem>
						<p v-if="applicableProfiles.length === 0" class="px-2 py-2 text-center text-xs text-fg-subtle">
							No branding profiles available
						</p>
					</DropdownMenuContent>
				</DropdownMenu>
			</InspectorSection>

			<!-- Watermark: opens WatermarkPositionPicker (viewable even when read-only) -->
			<InspectorSection title="Watermark">
				<AssetListRow as="button" persistent-actions :class="pickerRowClass" @click="openPositionPicker">
					<template #leading>
						<div class="grid size-8 place-items-center overflow-hidden rounded-md bg-surface-sunken">
							<img v-if="activeWatermarkThumbnail" :src="activeWatermarkThumbnail" alt="" class="size-full object-contain" />
							<Move v-else class="size-3.5 text-fg-subtle" />
						</div>
					</template>
					<template #title>
						<span :class="activeWatermarkName ? 'text-fg' : 'text-fg-muted'">
							{{ activeWatermarkName ?? "Configure watermark" }}
						</span>
					</template>
					<template #meta>
						<span v-if="activeWatermark?.position" class="tabular truncate">
							{{ activeWatermark.position.opacity }}% opacity · {{ activeWatermark.position.scale }}% scale
						</span>
						<span v-else-if="!activeWatermarkName" class="truncate">Position, opacity and scale</span>
					</template>
					<template #trailing>
						<ChevronRight class="size-3.5 text-fg-subtle" />
					</template>
				</AssetListRow>
			</InspectorSection>

			<!-- Intro -->
			<InspectorSection title="Intro video">
				<DropdownMenu v-model:open="showIntroDropdown">
					<DropdownMenuTrigger as-child :disabled="isReadOnly">
						<AssetListRow as="button" persistent-actions :disabled="isReadOnly" :class="pickerRowClass">
							<template #leading>
								<div class="grid size-8 place-items-center rounded-md bg-surface-sunken">
									<Film class="size-3.5 text-fg-subtle" />
								</div>
							</template>
							<template #title>
								<span :class="activeIntroName ? 'text-fg' : 'text-fg-muted'">{{ activeIntroName ?? "None" }}</span>
							</template>
							<template #meta>
								<span v-if="activeIntro?.duration" class="tabular">{{ formatDuration(activeIntro.duration) }}</span>
								<span v-else-if="!activeIntroName" class="truncate">Plays before the clip</span>
							</template>
							<template #trailing>
								<ChevronDown class="size-3.5 text-fg-subtle" />
							</template>
						</AssetListRow>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						class="max-h-64 w-[var(--reka-dropdown-menu-trigger-width)] overflow-y-auto"
					>
						<DropdownMenuItem :class="!activeIntro?.assetId && activeItemClass" @select="selectIntro(null)">
							<X />
							None
						</DropdownMenuItem>
						<DropdownMenuItem
							v-for="intro in intros"
							:key="intro.id"
							:class="activeIntro?.assetId === intro.id && activeItemClass"
							@select="selectIntro(intro)"
						>
							<Film />
							<span class="min-w-0 flex-1 truncate">{{ intro.name }}</span>
							<span v-if="intro.duration" class="tabular shrink-0 text-2xs text-fg-subtle">
								{{ formatDuration(intro.duration) }}
							</span>
						</DropdownMenuItem>
						<p v-if="loadingIntroOutros" class="flex items-center justify-center gap-1.5 px-2 py-2 text-xs text-fg-subtle">
							<Loader2 class="size-3.5 animate-spin" />
							Loading…
						</p>
						<p
							v-if="!loadingIntroOutros && intros.length === 0"
							class="px-2 py-2 text-center text-xs text-fg-subtle"
						>
							No intros available
						</p>
						<DropdownMenuSeparator />
						<DropdownMenuItem :disabled="uploadingIntro" @select="uploadIntroOutro('intro')">
							<Upload v-if="!uploadingIntro" />
							<Loader2 v-else class="animate-spin" />
							{{ uploadingIntro ? 'Uploading…' : 'Upload new' }}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</InspectorSection>

			<!-- Outro -->
			<InspectorSection title="Outro video" flush>
				<DropdownMenu v-model:open="showOutroDropdown">
					<DropdownMenuTrigger as-child :disabled="isReadOnly">
						<AssetListRow as="button" persistent-actions :disabled="isReadOnly" :class="pickerRowClass">
							<template #leading>
								<div class="grid size-8 place-items-center rounded-md bg-surface-sunken">
									<Film class="size-3.5 text-fg-subtle" />
								</div>
							</template>
							<template #title>
								<span :class="activeOutroName ? 'text-fg' : 'text-fg-muted'">{{ activeOutroName ?? "None" }}</span>
							</template>
							<template #meta>
								<span v-if="activeOutro?.duration" class="tabular">{{ formatDuration(activeOutro.duration) }}</span>
								<span v-else-if="!activeOutroName" class="truncate">Plays after the clip</span>
							</template>
							<template #trailing>
								<ChevronDown class="size-3.5 text-fg-subtle" />
							</template>
						</AssetListRow>
					</DropdownMenuTrigger>
					<DropdownMenuContent
						align="start"
						class="max-h-64 w-[var(--reka-dropdown-menu-trigger-width)] overflow-y-auto"
					>
						<DropdownMenuItem :class="!activeOutro?.assetId && activeItemClass" @select="selectOutro(null)">
							<X />
							None
						</DropdownMenuItem>
						<DropdownMenuItem
							v-for="outro in outros"
							:key="outro.id"
							:class="activeOutro?.assetId === outro.id && activeItemClass"
							@select="selectOutro(outro)"
						>
							<Film />
							<span class="min-w-0 flex-1 truncate">{{ outro.name }}</span>
							<span v-if="outro.duration" class="tabular shrink-0 text-2xs text-fg-subtle">
								{{ formatDuration(outro.duration) }}
							</span>
						</DropdownMenuItem>
						<p v-if="loadingIntroOutros" class="flex items-center justify-center gap-1.5 px-2 py-2 text-xs text-fg-subtle">
							<Loader2 class="size-3.5 animate-spin" />
							Loading…
						</p>
						<p
							v-if="!loadingIntroOutros && outros.length === 0"
							class="px-2 py-2 text-center text-xs text-fg-subtle"
						>
							No outros available
						</p>
						<DropdownMenuSeparator />
						<DropdownMenuItem :disabled="uploadingOutro" @select="uploadIntroOutro('outro')">
							<Upload v-if="!uploadingOutro" />
							<Loader2 v-else class="animate-spin" />
							{{ uploadingOutro ? 'Uploading…' : 'Upload new' }}
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</InspectorSection>
		</div>

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
