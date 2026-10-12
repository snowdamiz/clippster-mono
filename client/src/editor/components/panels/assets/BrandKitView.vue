<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { invoke } from "@tauri-apps/api/core";
import { useEditor } from "../../../composables/useEditor";
import { getAllCreatorProfiles } from "@/services/database/creator-profiles";
import { getAllWatermarkImages } from "@/services/database/watermarks";
import { getAllImageAssets, getImageAssetsByType } from "@/services/database/image-assets";
import type { CreatorProfileWithLinks, WatermarkImage, ImageAsset } from "@/services/database/types";
import { processMediaAssets } from "../../../lib/media/processing";
import { buildImageElement } from "../../../lib/timeline/element-utils";
import { TIMELINE_CONSTANTS } from "../../../constants/timeline-constants";
import {
	Palette,
	Image as ImageIcon,
	User,
	Stamp,
	Loader2,
	SearchX,
} from "lucide-vue-next";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { IconTile } from "@/components/ui/icon-tile";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import PanelHeader from "../../chrome/PanelHeader.vue";
import { AssetGrid, AssetListRow, AssetTile } from "../shared";
import PanelSearchBar from "./PanelSearchBar.vue";

const { editor, version } = useEditor();

const activeSubTab = ref<"profiles" | "watermarks" | "logos">("profiles");
const subTabs: SegmentedOption<"profiles" | "watermarks" | "logos">[] = [
	{ value: "profiles", label: "Profiles" },
	{ value: "watermarks", label: "Watermarks" },
	{ value: "logos", label: "Logos" },
];
const profiles = ref<CreatorProfileWithLinks[]>([]);
const watermarks = ref<WatermarkImage[]>([]);
const logos = ref<ImageAsset[]>([]);
const isLoading = ref(false);
const searchQuery = ref("");
const thumbnailCache = ref<Map<string, string>>(new Map());

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull();
});

const filteredWatermarks = computed(() => {
	if (!searchQuery.value.trim()) return watermarks.value;
	const q = searchQuery.value.toLowerCase();
	return watermarks.value.filter((w) => w.name.toLowerCase().includes(q));
});

const filteredLogos = computed(() => {
	if (!searchQuery.value.trim()) return logos.value;
	const q = searchQuery.value.toLowerCase();
	return logos.value.filter((l) => l.name.toLowerCase().includes(q));
});

onMounted(async () => {
	isLoading.value = true;
	try {
		const [p, w, l] = await Promise.all([
			getAllCreatorProfiles(),
			getAllWatermarkImages(),
			getImageAssetsByType("logo"),
		]);
		profiles.value = p;
		watermarks.value = w;
		logos.value = l;

		// Load thumbnails for watermarks
		for (const wm of w) {
			if (wm.file_path && !thumbnailCache.value.has(wm.id)) {
				try {
					const dataUrl = await invoke<string>("read_file_as_data_url", { filePath: wm.file_path });
					thumbnailCache.value.set(wm.id, dataUrl);
				} catch { /* ignore */ }
			}
		}
	} catch (err) {
		console.error("[BrandKitView] Failed to load brand assets:", err);
	} finally {
		isLoading.value = false;
	}
});

async function addImageToCanvas(filePath: string, name: string) {
	if (!activeProject.value) return;

	try {
		const dataUrl = await invoke<string>("read_file_as_data_url", { filePath });
		const response = await fetch(dataUrl);
		const blob = await response.blob();
		const file = new File([blob], name, { type: blob.type || "image/png" });

		const dt = new DataTransfer();
		dt.items.add(file);

		const processedAssets = await processMediaAssets({
			files: dt.files,
			onProgress: () => {},
		});

		for (const asset of processedAssets) {
			const mediaId = await editor.media.addMediaAsset({
				projectId: activeProject.value!.metadata.id,
				asset,
			});
			const element = buildImageElement({
				mediaId,
				name: asset.name,
				duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
				startTime: editor.playback.getCurrentTime(),
			});
			editor.timeline.insertElement({ element, placement: { mode: "auto" } });
		}
	} catch (err) {
		console.error("[BrandKitView] Failed to add image:", err);
	}
}

function applyProfileColors(profile: CreatorProfileWithLinks) {
	// Apply the profile's primary color as background if available
	// For now, use a sensible default based on the profile
	const colors = [
		"#1a1a2e", "#16213e", "#0f3460", "#533483",
		"#e94560", "#0e0e10", "#18181b",
	];
	const colorIndex = profiles.value.indexOf(profile) % colors.length;
	editor.project.updateSettings({
		settings: {
			background: { type: "color", color: colors[colorIndex] },
		},
	});
}
</script>

<template>
	<div class="flex h-full flex-col">
		<PanelHeader class="px-1.5">
			<SegmentedControl v-model="activeSubTab" :options="subTabs" size="sm" block />
		</PanelHeader>

		<div v-if="isLoading" class="flex flex-1 items-center justify-center">
			<Loader2 class="size-5 animate-spin text-fg-subtle" />
		</div>

		<!-- Profiles tab -->
		<div v-else-if="activeSubTab === 'profiles'" class="flex-1 overflow-y-auto p-3">
			<EmptyState
				v-if="profiles.length === 0"
				size="sm"
				:icon="User"
				title="No creator profiles found"
				description="Create a creator profile to reuse its watermark here."
			/>
			<div v-else class="-mx-1 space-y-px">
				<AssetListRow v-for="profile in profiles" :key="profile.id" :title="profile.name">
					<template #leading>
						<IconTile :icon="User" size="md" />
					</template>
					<template #meta>
						<span class="truncate capitalize">{{ profile.scope }}</span>
					</template>
					<template #trailing>
						<Button
							v-if="profile.watermark_id"
							variant="ghost"
							size="icon-xs"
							title="Add watermark to canvas"
							aria-label="Add watermark to canvas"
							@click.stop="() => {
								const wm = watermarks.find(w => w.id === profile.watermark_id);
								if (wm?.file_path) addImageToCanvas(wm.file_path, wm.name + ' (watermark)');
							}"
						>
							<Stamp />
						</Button>
						<Button
							variant="ghost"
							size="icon-xs"
							title="Apply profile colors"
							aria-label="Apply profile colors"
							@click.stop="applyProfileColors(profile)"
						>
							<Palette />
						</Button>
					</template>
				</AssetListRow>
			</div>
		</div>

		<!-- Watermarks tab -->
		<div v-else-if="activeSubTab === 'watermarks'" class="flex flex-1 flex-col overflow-hidden">
			<PanelSearchBar v-model="searchQuery" placeholder="Search watermarks…" />
			<div class="flex-1 overflow-y-auto p-3">
				<EmptyState
					v-if="filteredWatermarks.length === 0"
					size="sm"
					:icon="searchQuery.trim() ? SearchX : ImageIcon"
					title="No watermarks found"
					:description="searchQuery.trim() ? 'Try a different search term.' : undefined"
				/>
				<AssetGrid v-else :min="80">
					<AssetTile
						v-for="wm in filteredWatermarks"
						:key="wm.id"
						aspect="1"
						:label="wm.name"
						:title="`Add ${wm.name} to canvas`"
						@click="addImageToCanvas(wm.file_path, wm.name)"
					>
						<div class="flex size-full items-center justify-center p-2">
							<img
								v-if="thumbnailCache.get(wm.id)"
								:src="thumbnailCache.get(wm.id)"
								:alt="wm.name"
								class="max-h-full max-w-full object-contain"
								draggable="false"
							/>
							<ImageIcon v-else class="size-6 text-fg-subtle" />
						</div>
					</AssetTile>
				</AssetGrid>
			</div>
		</div>

		<!-- Logos tab -->
		<div v-else-if="activeSubTab === 'logos'" class="flex flex-1 flex-col overflow-hidden">
			<PanelSearchBar v-model="searchQuery" placeholder="Search logos…" />
			<div class="flex-1 overflow-y-auto p-3">
				<EmptyState
					v-if="filteredLogos.length === 0"
					size="sm"
					:icon="searchQuery.trim() ? SearchX : Palette"
					:title="searchQuery.trim() ? 'No logos found' : 'No logos saved yet'"
					:description="searchQuery.trim() ? 'Try a different search term.' : 'Export images with type &quot;logo&quot; to see them here.'"
				/>
				<AssetGrid v-else :min="80">
					<AssetTile
						v-for="logo in filteredLogos"
						:key="logo.id"
						aspect="1"
						:label="logo.name"
						:title="`Add ${logo.name} to canvas`"
						@click="addImageToCanvas(logo.file_path, logo.name)"
					>
						<div class="flex size-full items-center justify-center">
							<Palette class="size-6 text-fg-subtle" />
						</div>
					</AssetTile>
				</AssetGrid>
			</div>
		</div>
	</div>
</template>
