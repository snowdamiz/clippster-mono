<script setup lang="ts">
import { ref, computed, onUnmounted } from "vue";
import { useEditorActions } from "../composables/actions/useEditorActions";
import { useKeybindingsListener } from "../composables/useKeybindings";
import { useImageMode } from "../composables/useImageMode";
import EditorHeader from "./EditorHeader.vue";
import Timeline from "./timeline/Timeline.vue";
import PreviewPanel from "./preview/PreviewPanel.vue";
import AssetsPanel from "./panels/AssetsPanel.vue";
import PropertiesPanel from "./panels/PropertiesPanel.vue";
import LayersPanel from "./panels/LayersPanel.vue";
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
	SlidersHorizontal,
	Stamp,
	Settings,
	LayoutTemplate,
	Sparkles,
} from "lucide-vue-next";

// Register global editor actions and keybindings
useEditorActions();
useKeybindingsListener();

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
	"filters",
	"adjustment",
	"branding",
	"settings",
] as const;

type Tab = (typeof TAB_KEYS)[number];

// Tabs hidden in image mode (video/audio-specific)
const IMAGE_MODE_HIDDEN_TABS: Tab[] = ["sounds", "captions", "transcript", "transitions", "branding"];
// Tabs only visible in image mode
const IMAGE_MODE_ONLY_TABS: Tab[] = ["templates", "brandkit", "aitools"];

const visibleTabs = computed(() => {
	if (isImageMode.value) {
		return TAB_KEYS.filter((t) => !IMAGE_MODE_HIDDEN_TABS.includes(t));
	}
	return TAB_KEYS.filter((t) => !IMAGE_MODE_ONLY_TABS.includes(t));
});

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
	filters: { icon: Palette, label: "Filters" },
	adjustment: { icon: SlidersHorizontal, label: "Adjustment" },
	branding: { icon: Stamp, label: "Branding" },
	settings: { icon: Settings, label: "Settings" },
};

const activeTab = ref<Tab>("media");

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
});
</script>

<template>
	<div class="flex h-full w-full flex-col overflow-hidden bg-[#0e0e10] text-white">
		<!-- Header -->
		<EditorHeader />

		<!-- ============ IMAGE MODE LAYOUT (Photoshop-like) ============ -->
		<div v-if="isImageMode" class="flex flex-1 min-h-0 overflow-hidden">
			<!-- Tool sidebar: icons + labels -->
			<div class="flex w-[52px] shrink-0 flex-col items-center gap-0.5 border-r border-white/[0.06] bg-[#111113] pt-2 pb-3 overflow-y-auto scrollbar-hidden">
				<button
					v-for="tabKey in visibleTabs"
					:key="tabKey"
					type="button"
					:title="tabConfig[tabKey].label"
					:class="[
						'group relative flex flex-col items-center justify-center w-[44px] rounded-md py-1.5 transition-all',
						activeTab === tabKey
							? 'bg-white/[0.08] text-blue-400'
							: 'text-zinc-600 hover:text-zinc-300 hover:bg-white/[0.04]',
					]"
					@click="activeTab = tabKey"
				>
					<component :is="tabConfig[tabKey].icon" class="size-[16px]" />
					<span
						:class="[
							'mt-[3px] text-[8px] leading-none font-medium tracking-wide',
							activeTab === tabKey ? 'text-blue-400' : 'text-zinc-600 group-hover:text-zinc-400',
						]"
					>{{ tabConfig[tabKey].label }}</span>
					<!-- Active indicator -->
					<div
						v-if="activeTab === tabKey"
						class="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-4 rounded-r bg-blue-500"
					/>
				</button>
			</div>

			<!-- Left panel: Assets content (wider for image mode) -->
			<div class="w-[320px] shrink-0 border-r border-white/[0.06] bg-[#141416] overflow-hidden flex flex-col">
				<AssetsPanel :active-tab="activeTab" />
			</div>

			<!-- Center: Canvas workspace -->
			<div class="flex-1 min-w-0 overflow-hidden bg-[#0a0a0c]">
				<PreviewPanel />
			</div>

			<!-- Right panel: Layers + Properties stacked -->
			<div class="w-[280px] shrink-0 border-l border-white/[0.06] bg-[#141416] overflow-hidden flex flex-col">
				<!-- Layers panel (top half) -->
				<div class="h-[45%] shrink-0 border-b border-white/[0.06] overflow-hidden">
					<LayersPanel />
				</div>
				<!-- Properties panel (bottom half) -->
				<div class="flex-1 min-h-0 overflow-hidden">
					<PropertiesPanel />
				</div>
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

				<!-- Right panel: Properties -->
				<div class="w-72 shrink-0 border-l border-white/10 bg-[#18181b] overflow-hidden">
					<PropertiesPanel />
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
	</div>
</template>
