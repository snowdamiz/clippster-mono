<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, provide } from "vue";
import { useEditorActions } from "../composables/actions/useEditorActions";
import { useKeybindingsListener } from "../composables/useKeybindings";
import { useImageMode } from "../composables/useImageMode";
import { useSaveStatus } from "../composables/useSaveStatus";
import { providePointerDrag } from "../composables/usePointerDrag";
import KeyboardShortcutsModal from "./KeyboardShortcutsModal.vue";
import EditorHeader from "./EditorHeader.vue";
import Timeline from "./timeline/Timeline.vue";
import PreviewPanel from "./preview/PreviewPanel.vue";
import AssetsPanel from "./panels/AssetsPanel.vue";
import PropertiesPanel from "./panels/PropertiesPanel.vue";
import LayersPanel from "./panels/LayersPanel.vue";
import ImageToolRail from "./ImageToolRail.vue";
import ImageOptionsBar from "./ImageOptionsBar.vue";
import {
	FolderOpen,
	Headphones,
	Type,
	Smile,
	Wand2,
	ArrowRightLeft,
	Captions,
	FileText,
	Palette,
	Stamp,
	Sparkles,
	Settings,
	LayoutTemplate,
	PanelRightClose,
	PanelRightOpen,
	ChevronDown,
} from "lucide-vue-next";

// Register global editor actions and keybindings
useEditorActions();
useKeybindingsListener();
const { isSaving, lastSavedAt } = useSaveStatus();
providePointerDrag();

const previewPanelRef = ref<InstanceType<typeof PreviewPanel> | null>(null);

const { isImageMode } = useImageMode();

const TAB_KEYS = [
	"media",
	"templates",
	"brandkit",
	"aitools",
	"sounds",
	"text",
	"stickers",
	"effects",
	"transitions",
	"captions",
	"transcript",
	"broll",
	"filters",
	"branding",
	"settings",
] as const;

type Tab = (typeof TAB_KEYS)[number];

const IMAGE_MODE_ONLY_TABS: Tab[] = ["templates", "brandkit", "aitools"];

const visibleTabs = computed(() => TAB_KEYS.filter((t) => !IMAGE_MODE_ONLY_TABS.includes(t)));

const tabConfig: Record<Tab, { icon: any; label: string }> = {
	media: { icon: FolderOpen, label: "Media" },
	templates: { icon: LayoutTemplate, label: "Templates" },
	brandkit: { icon: Stamp, label: "Brand Kit" },
	aitools: { icon: Sparkles, label: "AI Tools" },
	sounds: { icon: Headphones, label: "Sounds" },
	text: { icon: Type, label: "Text" },
	stickers: { icon: Smile, label: "Stickers" },
	effects: { icon: Wand2, label: "Effects" },
	transitions: { icon: ArrowRightLeft, label: "Transitions" },
	captions: { icon: Captions, label: "Captions" },
	transcript: { icon: FileText, label: "Transcript" },
	broll: { icon: Sparkles, label: "B-roll" },
	filters: { icon: Palette, label: "Filters" },
	branding: { icon: Stamp, label: "Branding" },
	settings: { icon: Settings, label: "Settings" },
};

type ImageDockTab = "properties" | Tab;

const IMAGE_DOCK_PRIMARY: ImageDockTab[] = ["properties", "media"];
const IMAGE_DOCK_MORE: Tab[] = ["templates", "filters", "brandkit", "aitools", "stickers", "text", "settings"];

const activeTab = ref<Tab | null>("media");
const imageDockTab = ref<ImageDockTab>("properties");
const imageMoreOpen = ref(false);
const propertiesCollapsed = ref(false);
const shortcutsOpen = ref(false);

const imageDockMoreLabel = computed(() => {
	if (IMAGE_DOCK_MORE.includes(imageDockTab.value as Tab)) {
		return tabConfig[imageDockTab.value as Tab].label;
	}
	return "More";
});

function setImageDockTab(tab: ImageDockTab) {
	imageDockTab.value = tab;
	imageMoreOpen.value = false;
	if (tab !== "properties") {
		activeTab.value = tab;
	}
}

provide("setImageDockTab", setImageDockTab);
provide("imageDockTab", imageDockTab);

function toggleShortcutsModal() {
	shortcutsOpen.value = !shortcutsOpen.value;
}

onMounted(() => {
	window.addEventListener("toggle-shortcuts-modal", toggleShortcutsModal);
});

// Timeline resize
const TIMELINE_MIN_HEIGHT = 160;
const TIMELINE_MAX_HEIGHT = 600;
const timelineHeight = ref(330);

function startTimelineResize(e: MouseEvent) {
	e.preventDefault();
	const startY = e.clientY;
	const startHeight = timelineHeight.value;

	function onMove(ev: MouseEvent) {
		const delta = startY - ev.clientY;
		timelineHeight.value = Math.min(
			TIMELINE_MAX_HEIGHT,
			Math.max(TIMELINE_MIN_HEIGHT, startHeight + delta),
		);
	}

	function onUp() {
		document.removeEventListener("mousemove", onMove);
		document.removeEventListener("mouseup", onUp);
		document.body.style.cursor = "";
		document.body.style.userSelect = "";
	}

	document.body.style.cursor = "row-resize";
	document.body.style.userSelect = "none";
	document.addEventListener("mousemove", onMove);
	document.addEventListener("mouseup", onUp);
}

onUnmounted(() => {
	document.body.style.cursor = "";
	document.body.style.userSelect = "";
	window.removeEventListener("toggle-shortcuts-modal", toggleShortcutsModal);
});
</script>

<template>
	<div class="flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden bg-[#0e0e10] text-white">
		<!-- Header -->
		<EditorHeader
			:preview-container="previewPanelRef?.containerRef ?? null"
			:is-saving="isSaving"
			:last-saved-at="lastSavedAt"
		/>

		<!-- Image mode: tools · options · canvas · one docked panel column -->
		<div v-if="isImageMode" class="flex flex-1 min-h-0 flex-col overflow-hidden">
			<ImageOptionsBar />

			<div class="flex min-h-0 min-w-0 flex-1 overflow-hidden">
				<ImageToolRail />

				<div class="min-w-0 flex-1 overflow-hidden bg-[#2b2b2b]">
					<PreviewPanel ref="previewPanelRef" />
				</div>

				<aside class="box-border flex w-[280px] shrink-0 flex-col overflow-hidden border-l border-black/40 bg-[#1e1e1e]">
					<div class="relative flex h-7 shrink-0 items-stretch border-b border-black/40 bg-[#2a2a2a] pr-1">
						<button
							v-for="tabKey in IMAGE_DOCK_PRIMARY"
							:key="tabKey"
							type="button"
							:class="[
								'px-2.5 text-[11px] leading-none transition-colors',
								imageDockTab === tabKey
									? 'bg-[#1e1e1e] text-zinc-100'
									: 'text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300',
							]"
							@click="setImageDockTab(tabKey)"
						>
							{{ tabKey === "properties" ? "Properties" : "Media" }}
						</button>
						<button
							type="button"
							:class="[
								'ml-auto flex shrink-0 items-center gap-0.5 px-2 text-[11px]',
								IMAGE_DOCK_MORE.includes(imageDockTab as Tab)
									? 'bg-[#1e1e1e] text-zinc-100'
									: 'text-zinc-500 hover:text-zinc-300',
							]"
							@click="imageMoreOpen = !imageMoreOpen"
						>
							<span class="max-w-[72px] truncate">{{ imageDockMoreLabel }}</span>
							<ChevronDown class="size-3 shrink-0" />
						</button>
						<div
							v-if="imageMoreOpen"
							class="fixed inset-0 z-20"
							@click="imageMoreOpen = false"
						/>
						<div
							v-if="imageMoreOpen"
							class="absolute right-0 top-full z-30 min-w-[140px] border border-black/50 bg-[#2a2a2a] py-1 shadow-lg"
						>
							<button
								v-for="tabKey in IMAGE_DOCK_MORE"
								:key="tabKey"
								type="button"
								class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-[11px] text-zinc-300 hover:bg-white/5"
								@click="setImageDockTab(tabKey)"
							>
								<component :is="tabConfig[tabKey].icon" class="size-3.5 text-zinc-500" />
								{{ tabConfig[tabKey].label }}
							</button>
						</div>
					</div>

					<div class="min-h-0 flex-[0.9] overflow-hidden border-b border-black/40">
						<PropertiesPanel v-if="imageDockTab === 'properties'" />
						<AssetsPanel v-else :active-tab="imageDockTab" />
					</div>

					<div class="flex min-h-[220px] min-w-0 flex-[1.15] flex-col overflow-hidden">
						<LayersPanel />
					</div>
				</aside>
			</div>
		</div>

		<!-- ============ VIDEO MODE LAYOUT (original) ============ -->
		<template v-else>
			<div class="flex flex-1 min-h-0 overflow-hidden">
				<!-- Icon sidebar -->
				<div class="flex w-12 shrink-0 flex-col items-center gap-4 border-r border-white/10 bg-[#0e0e10] py-3 overflow-y-auto scrollbar-hidden">
					<button
						v-for="tabKey in visibleTabs"
						:key="tabKey"
						type="button"
						:title="tabConfig[tabKey].label"
						:class="[
							'flex flex-col items-center justify-center rounded-md p-1.5 transition-colors',
							activeTab === tabKey
								? 'text-blue-400'
								: 'text-zinc-500 hover:text-zinc-300',
						]"
						@click="activeTab = tabKey"
					>
						<component :is="tabConfig[tabKey].icon" class="size-[18px]" />
					</button>
				</div>

				<!-- Left panel: Assets content -->
				<div class="w-64 shrink-0 border-r border-white/10 bg-[#18181b] overflow-hidden">
					<AssetsPanel :active-tab="activeTab" />
				</div>

				<!-- Center: Preview -->
				<div class="flex-1 min-w-0 overflow-hidden bg-[#0e0e10]">
					<PreviewPanel />
				</div>

				<!-- Right panel: pinned so selection changes never resize the preview -->
				<div
					:class="[
						'flex shrink-0 flex-col border-l border-white/10 bg-[#18181b] overflow-hidden transition-[width] duration-150',
						propertiesCollapsed ? 'w-10' : 'w-80',
					]"
				>
					<div class="flex h-9 items-center border-b border-white/10 px-2">
						<span v-if="!propertiesCollapsed" class="flex-1 text-xs font-medium text-zinc-400">Properties</span>
						<button
							type="button"
							class="ml-auto flex size-6 items-center justify-center rounded text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-200"
							:aria-label="propertiesCollapsed ? 'Expand properties panel' : 'Collapse properties panel'"
							:aria-pressed="propertiesCollapsed"
							:title="propertiesCollapsed ? 'Expand properties panel' : 'Collapse properties panel'"
							@click="propertiesCollapsed = !propertiesCollapsed"
						>
							<PanelRightOpen v-if="propertiesCollapsed" class="size-3.5" />
							<PanelRightClose v-else class="size-3.5" />
						</button>
					</div>
					<div v-if="!propertiesCollapsed" class="min-h-0 flex-1">
						<PropertiesPanel />
					</div>
				</div>
			</div>

			<!-- Timeline resize handle -->
			<div
				class="group relative h-[5px] shrink-0 cursor-row-resize bg-transparent hover:bg-blue-500/30 active:bg-blue-500/50 transition-colors"
				@mousedown="startTimelineResize"
			>
				<div class="pointer-events-none absolute inset-x-0 top-1/2 -translate-y-1/2 flex justify-center">
					<div class="h-[3px] w-10 rounded-full bg-white/20 group-hover:bg-blue-400/60 transition-colors" />
				</div>
			</div>

			<!-- Bottom: Timeline -->
			<div
				class="shrink-0 border-t border-white/10 overflow-hidden bg-[#18181b]"
				:style="{ height: `${timelineHeight}px` }"
			>
				<Timeline />
			</div>
		</template>

		<KeyboardShortcutsModal :open="shortcutsOpen" @close="shortcutsOpen = false" />
	</div>
</template>
