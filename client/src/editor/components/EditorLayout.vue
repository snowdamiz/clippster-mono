<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useEditorActions } from "../composables/actions/useEditorActions";
import { useKeybindingsListener } from "../composables/useKeybindings";
import { useSaveStatus } from "../composables/useSaveStatus";
import { providePointerDrag } from "../composables/usePointerDrag";
import KeyboardShortcutsModal from "./KeyboardShortcutsModal.vue";
import EditorHeader from "./EditorHeader.vue";
import Timeline from "./timeline/Timeline.vue";
import PreviewPanel from "./preview/PreviewPanel.vue";
import AssetsPanel from "./panels/AssetsPanel.vue";
import PropertiesPanel from "./panels/PropertiesPanel.vue";
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
	PanelRightClose,
	PanelRightOpen,
} from "lucide-vue-next";

// Register global editor actions and keybindings
useEditorActions();
useKeybindingsListener();
const { isSaving, lastSavedAt } = useSaveStatus();
providePointerDrag();

const previewPanelRef = ref<InstanceType<typeof PreviewPanel> | null>(null);

const TAB_KEYS = [
	"media",
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

const tabConfig: Record<Tab, { icon: any; label: string }> = {
	media: { icon: FolderOpen, label: "Media" },
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

const activeTab = ref<Tab | null>("media");
const propertiesCollapsed = ref(false);
const shortcutsOpen = ref(false);

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
	<div class="flex h-full w-full flex-col overflow-hidden bg-[#0e0e10] text-white">
		<!-- Header -->
		<EditorHeader
			:preview-container="previewPanelRef?.containerRef ?? null"
			:is-saving="isSaving"
			:last-saved-at="lastSavedAt"
		/>

		<!-- Main content row -->
		<div class="flex flex-1 min-h-0 overflow-hidden">
			<!-- Icon sidebar (left border) -->
			<div class="flex w-14 shrink-0 flex-col items-center gap-2 border-r border-white/10 bg-[#0e0e10] py-3 overflow-y-auto scrollbar-hidden">
				<button
					v-for="tabKey in TAB_KEYS"
					:key="tabKey"
					type="button"
					:title="tabConfig[tabKey].label"
					:aria-label="`${tabConfig[tabKey].label} panel`"
					:aria-pressed="activeTab === tabKey"
					:class="[
						'flex w-full flex-col items-center justify-center rounded-md p-1.5 transition-colors',
						activeTab === tabKey
							? 'text-blue-400'
							: 'text-zinc-500 hover:text-zinc-300',
					]"
					@click="activeTab = activeTab === tabKey ? null : tabKey"
				>
					<component :is="tabConfig[tabKey].icon" class="size-[15px]" />
					<span v-if="activeTab === tabKey" class="mt-0.5 max-w-11 truncate text-[8px] leading-none">
						{{ tabConfig[tabKey].label }}
					</span>
				</button>
			</div>

			<!-- Left panel: Assets content -->
			<div v-if="activeTab !== null" class="w-64 shrink-0 border-r border-white/10 bg-[#18181b] overflow-hidden">
				<AssetsPanel :active-tab="activeTab" />
			</div>

			<!-- Center: Preview -->
			<div class="flex-1 min-w-0 overflow-hidden bg-[#0e0e10]">
				<PreviewPanel ref="previewPanelRef" />
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

		<KeyboardShortcutsModal :open="shortcutsOpen" @close="shortcutsOpen = false" />
	</div>
</template>
