<script setup lang="ts">
/**
 * Canvas size / aspect-ratio menu for the preview toolbar. Presets depend on
 * the editor mode (video vs image); "Custom size…" opens a small dialog.
 * Previously duplicated in EditorHeader and PreviewPanel.
 */
import { computed, ref } from "vue";
import { Link2 } from "lucide-vue-next";
import { useEditor } from "../../composables/useEditor";
import { useImageMode } from "../../composables/useImageMode";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import ToolbarMenuButton from "../chrome/ToolbarMenuButton.vue";
import ToolbarButton from "../chrome/ToolbarButton.vue";

const { editor, version } = useEditor({
	subscribe: {
		project: true,
		playback: false,
		timeline: false,
		scenes: false,
		media: false,
		selection: false,
	},
});
const { isImageMode } = useImageMode();

const videoAspectPresets = [
	{ width: 1920, height: 1080, label: "16:9" },
	{ width: 1080, height: 1920, label: "9:16" },
	{ width: 1080, height: 1080, label: "1:1" },
	{ width: 1080, height: 1350, label: "4:5" },
	{ width: 1280, height: 720, label: "YouTube HD" },
	{ width: 3840, height: 2160, label: "YouTube 4K" },
];

const imageAspectPresets = [
	{ width: 1280, height: 720, label: "YT Thumbnail" },
	{ width: 1920, height: 1080, label: "16:9" },
	{ width: 1080, height: 1080, label: "Square" },
	{ width: 1080, height: 1350, label: "IG Portrait" },
	{ width: 1080, height: 1920, label: "Story / Short" },
	{ width: 1500, height: 500, label: "X Banner" },
];

const aspectPresets = computed(() => (isImageMode.value ? imageAspectPresets : videoAspectPresets));

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull();
});
const canvasWidth = computed(() => activeProject.value?.settings?.canvasSize?.width ?? 1920);
const canvasHeight = computed(() => activeProject.value?.settings?.canvasSize?.height ?? 1080);

const currentAspectLabel = computed(() => {
	const match = aspectPresets.value.find((p) => p.width === canvasWidth.value && p.height === canvasHeight.value);
	return match ? match.label : `${canvasWidth.value}×${canvasHeight.value}`;
});

function setAspectRatio(preset: { width: number; height: number }) {
	const is169 = Math.abs(preset.width / preset.height - 16 / 9) < 0.02;
	void editor.project.updateSettings({
		settings: {
			canvasSize: preset,
			...(is169 ? { canvasSourceFraming: undefined } : {}),
		},
	});
}

// Custom size dialog
const showCustomSize = ref(false);
const customWidth = ref(1920);
const customHeight = ref(1080);
const linkDimensions = ref(true);

function openCustomSize() {
	customWidth.value = canvasWidth.value;
	customHeight.value = canvasHeight.value;
	showCustomSize.value = true;
}

function onCustomWidthChange(value: number) {
	if (linkDimensions.value && customWidth.value > 0) {
		const aspect = customHeight.value / customWidth.value;
		customWidth.value = value;
		customHeight.value = Math.max(1, Math.round(value * aspect));
	} else {
		customWidth.value = value;
	}
}

function onCustomHeightChange(value: number) {
	if (linkDimensions.value && customHeight.value > 0) {
		const aspect = customWidth.value / customHeight.value;
		customHeight.value = value;
		customWidth.value = Math.max(1, Math.round(value * aspect));
	} else {
		customHeight.value = value;
	}
}

function applyCustomSize() {
	editor.project.updateSettings({
		settings: { canvasSize: { width: customWidth.value, height: customHeight.value } },
	});
	showCustomSize.value = false;
}
</script>

<template>
	<DropdownMenu>
		<DropdownMenuTrigger as-child>
			<ToolbarMenuButton aria-label="Change canvas size" title="Canvas size">
				{{ currentAspectLabel }}
			</ToolbarMenuButton>
		</DropdownMenuTrigger>
		<DropdownMenuContent align="center" class="min-w-48">
			<DropdownMenuItem
				v-for="preset in aspectPresets"
				:key="preset.label"
				:class="canvasWidth === preset.width && canvasHeight === preset.height && 'bg-brand-soft text-brand focus:bg-brand-soft'"
				@select="setAspectRatio(preset)"
			>
				<span class="flex-1">{{ preset.label }}</span>
				<span class="tabular text-xs text-fg-subtle">{{ preset.width }}×{{ preset.height }}</span>
			</DropdownMenuItem>
			<DropdownMenuSeparator />
			<DropdownMenuItem @select="openCustomSize">Custom size…</DropdownMenuItem>
		</DropdownMenuContent>
	</DropdownMenu>

	<Modal v-model:open="showCustomSize" title="Custom canvas size" size="sm">
		<div class="flex items-end gap-2">
			<Field label="Width" class="flex-1">
				<Input
					type="number"
					:model-value="customWidth"
					min="100"
					max="7680"
					class="tabular"
					@update:model-value="onCustomWidthChange(Number($event))"
				/>
			</Field>
			<ToolbarButton
				label="Link dimensions"
				toggle
				:active="linkDimensions"
				size="icon"
				@click="linkDimensions = !linkDimensions"
			>
				<Link2 />
			</ToolbarButton>
			<Field label="Height" class="flex-1">
				<Input
					type="number"
					:model-value="customHeight"
					min="100"
					max="7680"
					class="tabular"
					@update:model-value="onCustomHeightChange(Number($event))"
				/>
			</Field>
		</div>
		<template #footer>
			<Button variant="ghost" @click="showCustomSize = false">Cancel</Button>
			<Button variant="primary" @click="applyCustomSize">Apply</Button>
		</template>
	</Modal>
</template>
