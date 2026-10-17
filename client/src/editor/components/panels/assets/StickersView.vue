<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useIntersectionObserver } from "@vueuse/core";
import { useEditor } from "../../../composables/useEditor";
import { buildStickerElement } from "../../../lib/timeline/element-utils";
import {
	getCollections,
	getCollection,
	searchIcons,
	getIconSvgUrl,
	POPULAR_COLLECTIONS,
	type IconSet,
	type CollectionInfo,
	type IconSearchResult,
} from "../../../lib/iconify-api";
import StickerItem from "./StickerItem.vue";
import { ArrowLeft, Loader2, SearchX, Smile } from "lucide-vue-next";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import AssetGrid from "../shared/AssetGrid.vue";
import AssetTile from "../shared/AssetTile.vue";
import PanelSearchBar from "./PanelSearchBar.vue";

const { editor } = useEditor({ subscribe: false });

type ViewMode = "search" | "browse" | "collection";

const searchQuery = ref("");
const selectedCollection = ref<string | null>(null);
const viewMode = ref<ViewMode>("browse");

const collections = ref<Record<string, IconSet>>({});
const currentCollection = ref<CollectionInfo | null>(null);
const searchResults = ref<IconSearchResult | null>(null);
const recentStickers = ref<string[]>([]);

const isLoadingCollections = ref(false);
const isLoadingCollection = ref(false);
const isSearching = ref(false);
const isLoadingMoreSearch = ref(false);
const addingSticker = ref<string | null>(null);

const MAX_RECENT_STICKERS = 50;
const ICONS_PER_PAGE = 60;

let searchDebounce: ReturnType<typeof setTimeout> | null = null;

const popularForCategory = [
	...POPULAR_COLLECTIONS.emoji,
	...POPULAR_COLLECTIONS.brands,
];

// ── Collection pagination ──
const collectionDisplayCount = ref(ICONS_PER_PAGE);

const collectionIcons = computed(() => {
	if (!currentCollection.value) return [];
	const prefix = currentCollection.value.prefix;
	const allIcons: string[] = [];
	if (currentCollection.value.categories) {
		for (const icons of Object.values(currentCollection.value.categories)) {
			for (const icon of icons) allIcons.push(`${prefix}:${icon}`);
		}
	}
	if (currentCollection.value.uncategorized) {
		for (const icon of currentCollection.value.uncategorized) allIcons.push(`${prefix}:${icon}`);
	}
	return allIcons;
});

const displayedCollectionIcons = computed(() =>
	collectionIcons.value.slice(0, collectionDisplayCount.value),
);

const hasMoreCollectionIcons = computed(
	() => collectionDisplayCount.value < collectionIcons.value.length,
);

// ── Search pagination ──
const hasMoreSearchResults = ref(false);

// ── Sentinel refs for infinite scroll ──
const collectionSentinel = ref<HTMLElement | null>(null);
const searchSentinel = ref<HTMLElement | null>(null);

useIntersectionObserver(collectionSentinel, ([entry]) => {
	if (entry.isIntersecting && hasMoreCollectionIcons.value) {
		collectionDisplayCount.value += ICONS_PER_PAGE;
	}
});

useIntersectionObserver(searchSentinel, ([entry]) => {
	if (entry.isIntersecting && hasMoreSearchResults.value && !isLoadingMoreSearch.value) {
		loadMoreSearch();
	}
});

function getSampleIcons(prefix: string): string[] {
	const col = collections.value[prefix];
	if (!col?.samples) return [];
	return col.samples.map((s) => `${prefix}:${s}`);
}

async function loadCollections() {
	isLoadingCollections.value = true;
	try {
		collections.value = await getCollections();
	} catch (error) {
		console.error("Failed to load collections:", error);
	} finally {
		isLoadingCollections.value = false;
	}
}

async function loadCollection(prefix: string) {
	collectionDisplayCount.value = ICONS_PER_PAGE;
	isLoadingCollection.value = true;
	try {
		currentCollection.value = await getCollection(prefix);
	} catch (error) {
		console.error(`Failed to load collection ${prefix}:`, error);
		currentCollection.value = null;
	} finally {
		isLoadingCollection.value = false;
	}
}

async function doSearch(query: string) {
	if (!query.trim()) {
		searchResults.value = null;
		viewMode.value = "browse";
		return;
	}
	isSearching.value = true;
	hasMoreSearchResults.value = false;
	viewMode.value = "search";
	try {
		const result = await searchIcons(query, 60);
		searchResults.value = result;
		hasMoreSearchResults.value = result.total > result.icons.length;
	} catch (error) {
		console.error("Search failed:", error);
		searchResults.value = null;
	} finally {
		isSearching.value = false;
	}
}

async function loadMoreSearch() {
	if (!searchResults.value || !searchQuery.value.trim() || isLoadingMoreSearch.value) return;
	isLoadingMoreSearch.value = true;
	try {
		const result = await searchIcons(searchQuery.value, 60, undefined, undefined, searchResults.value.icons.length);
		searchResults.value = {
			...searchResults.value,
			icons: [...searchResults.value.icons, ...result.icons],
		};
		hasMoreSearchResults.value = searchResults.value.total > searchResults.value.icons.length;
	} catch (error) {
		console.error("Load more search failed:", error);
	} finally {
		isLoadingMoreSearch.value = false;
	}
}

function handleSearchInput() {
	if (searchDebounce) clearTimeout(searchDebounce);
	searchDebounce = setTimeout(() => doSearch(searchQuery.value), 300);
}

function selectCollection(prefix: string) {
	selectedCollection.value = prefix;
	viewMode.value = "collection";
	currentCollection.value = null;
	loadCollection(prefix);
}

function goBack() {
	if (viewMode.value === "collection") {
		selectedCollection.value = null;
		viewMode.value = "browse";
		currentCollection.value = null;
	} else if (viewMode.value === "search") {
		searchQuery.value = "";
		searchResults.value = null;
		viewMode.value = "browse";
	}
}

function addStickerToTimeline(iconName: string) {
	addingSticker.value = iconName;
	try {
		const currentTime = editor.playback.getCurrentTime();
		const element = buildStickerElement({ iconName, startTime: currentTime });
		editor.timeline.insertElement({ element, placement: { mode: "auto" } });
		addToRecent(iconName);
	} finally {
		addingSticker.value = null;
	}
}

function addToRecent(iconName: string) {
	const recent = [iconName, ...recentStickers.value.filter((s) => s !== iconName)];
	recentStickers.value = recent.slice(0, MAX_RECENT_STICKERS);
}

onMounted(() => loadCollections());
</script>

<template>
	<div class="flex h-full flex-col overflow-hidden">
		<PanelSearchBar
			v-model="searchQuery"
			placeholder="Search stickers…"
			@input="handleSearchInput"
		/>

		<!-- Back row (collection / search results) -->
		<button
			v-if="viewMode === 'collection' || viewMode === 'search'"
			type="button"
			class="flex h-8 w-full shrink-0 items-center gap-1.5 border-b border-line-subtle px-3 text-left text-xs text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg focus-visible:outline-none focus-visible:bg-surface-hover"
			@click="goBack"
		>
			<ArrowLeft class="size-3.5 shrink-0" />
			<span class="min-w-0 flex-1 truncate font-medium">
				{{ viewMode === 'collection' ? currentCollection?.title || selectedCollection : 'All collections' }}
			</span>
			<span
				v-if="viewMode === 'collection' && collectionIcons.length > 0"
				class="tabular shrink-0 text-2xs text-fg-subtle"
			>
				{{ collectionIcons.length.toLocaleString() }} icons
			</span>
			<span
				v-else-if="viewMode === 'search' && searchResults && searchResults.icons.length > 0"
				class="tabular shrink-0 text-2xs text-fg-subtle"
			>
				{{ searchResults.total.toLocaleString() }} results
			</span>
		</button>

		<!-- Content -->
		<div class="min-h-0 flex-1 overflow-y-auto p-3">
			<!-- Loading (initial) -->
			<div v-if="isLoadingCollections || isLoadingCollection || (isSearching && !searchResults)" class="flex items-center justify-center py-16">
				<Loader2 class="size-5 animate-spin text-fg-subtle" />
			</div>

			<!-- Search results -->
			<template v-else-if="viewMode === 'search'">
				<template v-if="searchResults && searchResults.icons.length > 0">
					<AssetGrid :min="40" class="gap-1.5">
						<StickerItem
							v-for="iconName in searchResults.icons"
							:key="iconName"
							:icon-name="iconName"
							:is-adding="addingSticker === iconName"
							@add="addStickerToTimeline"
						/>
					</AssetGrid>
					<!-- Sentinel + loading indicator -->
					<div ref="searchSentinel" class="flex items-center justify-center py-3">
						<Loader2 v-if="isLoadingMoreSearch" class="size-4 animate-spin text-fg-subtle" />
					</div>
				</template>
				<EmptyState
					v-else
					size="sm"
					:icon="SearchX"
					title="No stickers found"
					description="Try a different search term."
				/>
			</template>

			<!-- Collection view -->
			<template v-else-if="viewMode === 'collection'">
				<template v-if="collectionIcons.length > 0">
					<AssetGrid :min="40" class="gap-1.5">
						<StickerItem
							v-for="iconName in displayedCollectionIcons"
							:key="iconName"
							:icon-name="iconName"
							:is-adding="addingSticker === iconName"
							@add="addStickerToTimeline"
						/>
					</AssetGrid>
					<!-- Sentinel -->
					<div ref="collectionSentinel" class="h-4" />
				</template>
				<EmptyState
					v-else
					size="sm"
					:icon="Smile"
					title="No icons in this collection"
				/>
			</template>

			<!-- Browse view -->
			<div v-else class="space-y-4">
				<!-- Recent stickers -->
				<section v-if="recentStickers.length > 0">
					<SectionHeader variant="eyebrow" title="Recent" class="mb-1.5 min-h-0" />
					<AssetGrid :min="40" class="gap-1.5">
						<StickerItem
							v-for="iconName in recentStickers.slice(0, 10)"
							:key="iconName"
							:icon-name="iconName"
							:is-adding="addingSticker === iconName"
							@add="addStickerToTimeline"
						/>
					</AssetGrid>
				</section>

				<!-- Collections grid -->
				<section>
					<SectionHeader variant="eyebrow" title="Collections" class="mb-1.5 min-h-0" />
					<AssetGrid :min="88">
						<AssetTile
							v-for="col in popularForCategory"
							:key="col.prefix"
							aspect="2/1"
							:label="col.name"
							:sublabel="collections[col.prefix] ? `${collections[col.prefix].total.toLocaleString()} icons` : undefined"
							@click="selectCollection(col.prefix)"
						>
							<!-- Sample icons (user content) -->
							<div class="flex size-full items-center justify-center gap-1.5 px-2">
								<img
									v-for="sample in getSampleIcons(col.prefix).slice(0, 4)"
									:key="sample"
									:src="getIconSvgUrl(sample, { width: 32, height: 32 })"
									:alt="sample"
									class="size-5 object-contain"
									loading="lazy"
									draggable="false"
								/>
								<template v-if="getSampleIcons(col.prefix).length === 0">
									<div v-for="i in 4" :key="i" class="skeleton size-5 rounded" />
								</template>
							</div>
						</AssetTile>
					</AssetGrid>
				</section>
			</div>
		</div>
	</div>
</template>
