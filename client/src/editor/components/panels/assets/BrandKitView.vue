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
	Plus,
	Loader2,
	Search,
} from "lucide-vue-next";

const { editor, version } = useEditor();

const activeSubTab = ref<"profiles" | "watermarks" | "logos">("profiles");
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
		<!-- Sub-tabs -->
		<div class="flex items-center border-b border-white/10">
			<button
				v-for="tab in ([
					{ key: 'profiles', label: 'Profiles', icon: User },
					{ key: 'watermarks', label: 'Watermarks', icon: ImageIcon },
					{ key: 'logos', label: 'Logos', icon: Palette },
				] as const)"
				:key="tab.key"
				type="button"
				:class="[
					'flex items-center gap-1 px-2 py-2 text-[11px] font-medium whitespace-nowrap transition-colors border-b-2',
					activeSubTab === tab.key
						? 'border-purple-500 text-purple-400'
						: 'border-transparent text-zinc-500 hover:text-zinc-300',
				]"
				@click="activeSubTab = tab.key"
			>
				<component :is="tab.icon" class="size-3.5" />
				{{ tab.label }}
			</button>
		</div>

		<div v-if="isLoading" class="flex flex-1 items-center justify-center">
			<Loader2 class="size-5 animate-spin text-zinc-500" />
		</div>

		<!-- Profiles tab -->
		<div v-else-if="activeSubTab === 'profiles'" class="flex-1 overflow-y-auto p-2 space-y-1">
			<div v-if="profiles.length === 0" class="flex items-center justify-center h-20 text-zinc-600 text-xs">
				No creator profiles found
			</div>
			<div
				v-for="profile in profiles"
				:key="profile.id"
				class="group flex items-center gap-2 rounded-md p-2 hover:bg-white/5 cursor-pointer border border-white/5"
			>
				<div class="size-8 shrink-0 overflow-hidden rounded-full bg-zinc-800 flex items-center justify-center">
					<User class="size-4 text-zinc-600" />
				</div>
				<div class="min-w-0 flex-1">
					<div class="truncate text-xs text-zinc-200 font-medium">{{ profile.name }}</div>
					<div class="text-[10px] text-zinc-500">{{ profile.scope }}</div>
				</div>
				<div class="hidden group-hover:flex items-center gap-1">
					<button
						v-if="profile.watermark_id"
						type="button"
						class="rounded bg-purple-600/80 px-1.5 py-0.5 text-[10px] text-white hover:bg-purple-500"
						title="Add watermark to canvas"
						@click.stop="() => {
							const wm = watermarks.find(w => w.id === profile.watermark_id);
							if (wm?.file_path) addImageToCanvas(wm.file_path, wm.name + ' (watermark)');
						}"
					>
						Watermark
					</button>
					<button
						type="button"
						class="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-zinc-300 hover:bg-white/20"
						title="Apply profile colors"
						@click.stop="applyProfileColors(profile)"
					>
						Colors
					</button>
				</div>
			</div>
		</div>

		<!-- Watermarks tab -->
		<div v-else-if="activeSubTab === 'watermarks'" class="flex flex-1 flex-col overflow-hidden">
			<div class="flex items-center gap-2 border-b border-white/10 px-3 py-2">
				<Search class="size-3.5 text-zinc-500" />
				<input
					v-model="searchQuery"
					type="text"
					placeholder="Search watermarks..."
					class="flex-1 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
				/>
			</div>
			<div class="flex-1 overflow-y-auto p-2">
				<div v-if="filteredWatermarks.length === 0" class="flex items-center justify-center h-20 text-zinc-600 text-xs">
					No watermarks found
				</div>
				<div
					v-else
					class="grid gap-2"
					style="grid-template-columns: repeat(auto-fill, minmax(80px, 1fr))"
				>
					<button
						v-for="wm in filteredWatermarks"
						:key="wm.id"
						type="button"
						class="group relative overflow-hidden rounded-lg border border-white/10 hover:border-purple-500/50 transition-colors"
						@click="addImageToCanvas(wm.file_path, wm.name)"
					>
						<div class="aspect-square bg-zinc-800/50 flex items-center justify-center p-2">
							<img
								v-if="thumbnailCache.get(wm.id)"
								:src="thumbnailCache.get(wm.id)"
								:alt="wm.name"
								class="max-h-full max-w-full object-contain"
							/>
							<ImageIcon v-else class="size-6 text-zinc-700" />
						</div>
						<div class="truncate px-1.5 py-1 text-[10px] text-zinc-400">{{ wm.name }}</div>
						<div class="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex">
							<Plus class="size-4 text-white" />
						</div>
					</button>
				</div>
			</div>
		</div>

		<!-- Logos tab -->
		<div v-else-if="activeSubTab === 'logos'" class="flex flex-1 flex-col overflow-hidden">
			<div class="flex items-center gap-2 border-b border-white/10 px-3 py-2">
				<Search class="size-3.5 text-zinc-500" />
				<input
					v-model="searchQuery"
					type="text"
					placeholder="Search logos..."
					class="flex-1 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
				/>
			</div>
			<div class="flex-1 overflow-y-auto p-2">
				<div v-if="filteredLogos.length === 0" class="flex flex-col items-center justify-center h-20 gap-1 text-zinc-600 text-xs">
					<p>No logos saved yet</p>
					<p class="text-[10px]">Export images with type "logo" to see them here</p>
				</div>
				<div
					v-else
					class="grid gap-2"
					style="grid-template-columns: repeat(auto-fill, minmax(80px, 1fr))"
				>
					<button
						v-for="logo in filteredLogos"
						:key="logo.id"
						type="button"
						class="group relative overflow-hidden rounded-lg border border-white/10 hover:border-purple-500/50 transition-colors"
						@click="addImageToCanvas(logo.file_path, logo.name)"
					>
						<div class="aspect-square bg-zinc-800/50 flex items-center justify-center">
							<Palette class="size-6 text-zinc-700" />
						</div>
						<div class="truncate px-1.5 py-1 text-[10px] text-zinc-400">{{ logo.name }}</div>
						<div class="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex">
							<Plus class="size-4 text-white" />
						</div>
					</button>
				</div>
			</div>
		</div>
	</div>
</template>
