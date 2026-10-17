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
import PanelHeader from "./chrome/PanelHeader.vue";
import ToolbarButton from "./chrome/ToolbarButton.vue";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
// Default to ~36% of the window (clamped) so the preview keeps room at the
// 680px default window height; the user can still drag the handle.
const timelineHeight = ref(
	Math.round(Math.min(330, Math.max(TIMELINE_MIN_HEIGHT + 60, window.innerHeight * 0.36))),
);

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
	<div class="flex h-full w-full min-w-0 max-w-full flex-col overflow-hidden bg-panel text-fg">
		<!-- Header -->
		<EditorHeader
			:preview-container="previewPanelRef?.containerRef ?? null"
			:is-saving="isSaving"
			:last-saved-at="lastSavedAt"
		/>

		<!-- Image mode: tools · options · canvas · one docked panel column -->
		<div v-if="isImageMode" class="flex min-h-0 flex-1 flex-col overflow-hidden">
			<ImageOptionsBar />

			<div class="flex min-h-0 min-w-0 flex-1 overflow-hidden">
				<div class="shrink-0" data-tour-id="tour-image-tool-rail">
					<ImageToolRail />
				</div>

				<div class="min-w-0 flex-1 overflow-hidden bg-canvas" data-tour-id="tour-image-canvas">
					<PreviewPanel ref="previewPanelRef" />
				</div>

				<aside class="box-border flex w-[280px] shrink-0 flex-col overflow-hidden border-l border-line-subtle bg-panel">
					<!-- Dock tab rail -->
					<div class="flex h-9 shrink-0 items-stretch gap-1 border-b border-line-subtle px-2" role="tablist">
						<button
							v-for="tabKey in IMAGE_DOCK_PRIMARY"
							:key="tabKey"
							type="button"
							role="tab"
							:aria-selected="imageDockTab === tabKey"
							:data-tour-id="tabKey === 'media' ? 'tour-image-media' : undefined"
							:class="[
								'px-2 text-xs font-medium transition-colors',
								imageDockTab === tabKey
									? 'text-fg shadow-[inset_0_-2px_0_var(--brand)]'
									: 'text-fg-subtle hover:text-fg',
							]"
							@click="setImageDockTab(tabKey)"
						>
							{{ tabKey === "properties" ? "Properties" : "Media" }}
						</button>
						<DropdownMenu v-model:open="imageMoreOpen">
							<DropdownMenuTrigger as-child>
								<button
									type="button"
									:class="[
										'ml-auto flex shrink-0 items-center gap-1 px-2 text-xs font-medium transition-colors',
										IMAGE_DOCK_MORE.includes(imageDockTab as Tab)
											? 'text-fg shadow-[inset_0_-2px_0_var(--brand)]'
											: 'text-fg-subtle hover:text-fg',
									]"
								>
									<span class="max-w-[88px] truncate">{{ imageDockMoreLabel }}</span>
									<ChevronDown class="size-3 shrink-0 opacity-60" />
								</button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" class="min-w-44">
								<DropdownMenuItem
									v-for="tabKey in IMAGE_DOCK_MORE"
									:key="tabKey"
									:class="imageDockTab === tabKey && 'bg-brand-soft text-brand focus:bg-brand-soft'"
									@select="setImageDockTab(tabKey)"
								>
									<component :is="tabConfig[tabKey].icon" />
									{{ tabConfig[tabKey].label }}
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					<div class="min-h-0 flex-[0.9] overflow-hidden border-b border-line-subtle">
						<PropertiesPanel v-if="imageDockTab === 'properties'" />
						<AssetsPanel v-else :active-tab="imageDockTab" />
					</div>

					<div class="flex min-h-[220px] min-w-0 flex-[1.15] flex-col overflow-hidden" data-tour-id="tour-image-layers">
						<LayersPanel />
					</div>
				</aside>
			</div>
		</div>

		<!-- ============ VIDEO MODE LAYOUT ============ -->
		<div v-else class="flex min-h-0 flex-1 overflow-hidden">
			<!-- Panel rail (full height) -->
			<nav
				class="flex w-12 shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-line-subtle bg-panel py-2"
				aria-label="Editor panels"
				data-tour-id="tour-editor-left-rail"
			>
				<ToolbarButton
					v-for="tabKey in visibleTabs"
					:key="tabKey"
					:label="tabConfig[tabKey].label"
					:active="activeTab === tabKey"
					size="icon"
					:data-tour-id="tabKey === 'media' ? 'tour-editor-media' : undefined"
					class="shrink-0 [&_svg]:size-[18px]"
					@click="activeTab = tabKey"
				>
					<component :is="tabConfig[tabKey].icon" />
				</ToolbarButton>
			</nav>

			<div class="flex min-w-0 flex-1 flex-col overflow-hidden">
				<div class="flex min-h-0 flex-1 overflow-hidden">
					<!-- Left panel: assets -->
					<div class="w-56 shrink-0 overflow-hidden border-r border-line-subtle bg-panel lg:w-64">
						<AssetsPanel :active-tab="activeTab" />
					</div>

					<!-- Center: preview -->
					<div class="min-w-0 flex-1 overflow-hidden bg-canvas" data-tour-id="tour-editor-preview">
						<PreviewPanel />
					</div>

					<!-- Right panel: pinned so selection changes never resize the preview -->
					<div
						data-tour-id="tour-editor-properties"
						:class="[
							'flex shrink-0 flex-col overflow-hidden border-l border-line-subtle bg-panel transition-[width] duration-150',
							propertiesCollapsed ? 'w-11' : 'w-72 lg:w-80',
						]"
					>
						<PanelHeader :title="propertiesCollapsed ? undefined : 'Properties'" :class="propertiesCollapsed && 'justify-center px-0'">
							<ToolbarButton
								:label="propertiesCollapsed ? 'Expand properties panel' : 'Collapse properties panel'"
								:aria-pressed="propertiesCollapsed"
								@click="propertiesCollapsed = !propertiesCollapsed"
							>
								<PanelRightOpen v-if="propertiesCollapsed" />
								<PanelRightClose v-else />
							</ToolbarButton>
						</PanelHeader>
						<div v-if="!propertiesCollapsed" class="min-h-0 flex-1">
							<PropertiesPanel />
						</div>
					</div>
				</div>

				<!-- Timeline resize handle -->
				<div
					class="group relative z-10 -my-0.5 h-[5px] shrink-0 cursor-row-resize"
					role="separator"
					aria-orientation="horizontal"
					aria-label="Resize timeline"
					@mousedown="startTimelineResize"
				>
					<div class="pointer-events-none absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-transparent transition-colors group-hover:bg-brand group-active:bg-brand" />
				</div>

				<!-- Bottom: timeline -->
				<div
					class="shrink-0 overflow-hidden border-t border-line-subtle bg-panel"
					data-tour-id="tour-editor-timeline"
					:style="{ height: `${timelineHeight}px` }"
				>
					<Timeline />
				</div>
			</div>
		</div>

		<KeyboardShortcutsModal :open="shortcutsOpen" @close="shortcutsOpen = false" />
	</div>
</template>
