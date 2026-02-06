<script setup lang="ts">
import { ref } from "vue";
import { useEditorActions } from "../composables/actions/useEditorActions";
import { useKeybindingsListener } from "../composables/useKeybindings";
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
	Palette,
	SlidersHorizontal,
	Settings,
} from "lucide-vue-next";

// Register global editor actions and keybindings
useEditorActions();
useKeybindingsListener();

const TAB_KEYS = [
	"media",
	"sounds",
	"text",
	"stickers",
	"effects",
	"transitions",
	"captions",
	"filters",
	"adjustment",
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
	filters: { icon: Palette, label: "Filters" },
	adjustment: { icon: SlidersHorizontal, label: "Adjustment" },
	settings: { icon: Settings, label: "Settings" },
};

const activeTab = ref<Tab>("media");
</script>

<template>
	<div class="flex h-full w-full flex-col overflow-hidden bg-[#0e0e10] text-white">
		<!-- Header -->
		<EditorHeader />

		<!-- Main content row -->
		<div class="flex flex-1 min-h-0 overflow-hidden">
			<!-- Icon sidebar -->
			<div class="flex w-12 shrink-0 flex-col items-center gap-4 border-r border-white/10 bg-[#0e0e10] py-3 overflow-y-auto scrollbar-hidden">
				<button
					v-for="tabKey in TAB_KEYS"
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

		<!-- Bottom: Timeline -->
		<div class="h-[300px] shrink-0 border-t border-white/10 overflow-hidden bg-[#18181b]">
			<Timeline />
		</div>
	</div>
</template>
