<script setup lang="ts">
import { ref, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useImageMode } from "../../../composables/useImageMode";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SegmentedControl, type SegmentedOption } from "@/components/ui/segmented-control";
import { Pencil } from "lucide-vue-next";
import PanelHeader from "../../chrome/PanelHeader.vue";
import { AssetTile, InspectorField, InspectorSection, NumberBox, OptionChip } from "../shared";

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

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull();
});

const activeSettingsTab = ref<"project-info" | "background">("project-info");
const settingsTabs: SegmentedOption<"project-info" | "background">[] = [
	{ value: "project-info", label: "Info" },
	{ value: "background", label: "Background" },
];

const editingName = ref(false);
/** Focus the name field as soon as it replaces the read-only value (autofocus doesn't fire on late inserts). */
const vFocus = { mounted: (el: HTMLElement) => el.focus() };
const nameInput = ref("");

function startEditingName() {
	nameInput.value = activeProject.value?.metadata?.name ?? "";
	editingName.value = true;
}

async function commitName() {
	editingName.value = false;
	const id = activeProject.value?.metadata?.id;
	const trimmed = nameInput.value.trim();
	if (!id || !trimmed || trimmed === activeProject.value?.metadata?.name) return;
	await editor.project.renameProject({ id, name: trimmed });
}

// Canvas presets for video mode
const videoCanvasPresets = [
	{ width: 1080, height: 1920, label: "9:16" },
	{ width: 1920, height: 1080, label: "16:9" },
	{ width: 1080, height: 1080, label: "1:1" },
	{ width: 1080, height: 1350, label: "4:5" },
	{ width: 1920, height: 1920, label: "1:1 HD" },
];

// Canvas presets for image mode
const imageCanvasPresets = [
	{ width: 1280, height: 720, label: "YT Thumbnail", desc: "YouTube Thumbnail" },
	{ width: 1080, height: 1080, label: "IG Post", desc: "Instagram Post" },
	{ width: 1080, height: 1920, label: "IG Story", desc: "Instagram Story / TikTok" },
	{ width: 1500, height: 500, label: "X Banner", desc: "Twitter/X Banner" },
	{ width: 1920, height: 1080, label: "Twitch", desc: "Twitch Offline Screen" },
	{ width: 1080, height: 1350, label: "4:5 Poster", desc: "Stream Poster" },
	{ width: 1920, height: 1080, label: "16:9", desc: "Landscape" },
	{ width: 1080, height: 1080, label: "1:1", desc: "Square" },
];

const canvasPresets = computed(() => isImageMode.value ? imageCanvasPresets : videoCanvasPresets);

// Custom size inputs for image mode
const customWidth = ref("");
const customHeight = ref("");

function applyCustomSize() {
	const w = parseInt(customWidth.value);
	const h = parseInt(customHeight.value);
	if (w > 0 && h > 0 && w <= 7680 && h <= 7680) {
		handleAspectRatioChange({ width: w, height: h });
	}
}

const fpsPresets = [
	{ value: "24", label: "24 fps" },
	{ value: "25", label: "25 fps" },
	{ value: "30", label: "30 fps" },
	{ value: "50", label: "50 fps" },
	{ value: "60", label: "60 fps" },
];

const currentCanvasSize = computed(() => activeProject.value?.settings?.canvasSize ?? { width: 1080, height: 1920 });
const currentFps = computed(() => activeProject.value?.settings?.fps ?? 30);
const currentBackground = computed(() => activeProject.value?.settings?.background);

function handleAspectRatioChange(preset: { width: number; height: number }) {
	editor.project.updateSettings({ settings: { canvasSize: preset } });
}

function handleFpsChange(fps: number) {
	editor.project.updateSettings({ settings: { fps } });
}

function handleBackgroundColor(color: string) {
	editor.project.updateSettings({ settings: { background: { type: "color", color } } });
}

function handleBackgroundBlur(blurIntensity: number) {
	editor.project.updateSettings({ settings: { background: { type: "blur", blurIntensity } } });
}

const solidColors = [
	"#000000", "#1a1a2e", "#16213e", "#0f3460", "#533483",
	"#e94560", "#f38181", "#fce38a", "#eaffd0", "#95e1d3",
	"#ffffff", "#f5f5f5", "#e0e0e0", "#9e9e9e", "#424242",
	"#ff6b6b", "#ffa502", "#2ed573", "#1e90ff", "#a29bfe",
];

const blurPresets = [
	{ label: "Light", value: 4 },
	{ label: "Medium", value: 8 },
	{ label: "Strong", value: 16 },
	{ label: "Heavy", value: 24 },
];

const isBlurBg = computed(() => currentBackground.value?.type === "blur");
const isColorBg = computed(() => currentBackground.value?.type === "color");
const currentBgColor = computed(() => isColorBg.value ? (currentBackground.value as any)?.color : "#000000");
const currentBlurIntensity = computed(() => isBlurBg.value ? (currentBackground.value as any)?.blurIntensity : 8);
</script>

<template>
	<div class="flex h-full flex-col">
		<PanelHeader title="Settings">
			<SegmentedControl v-model="activeSettingsTab" :options="settingsTabs" size="sm" />
		</PanelHeader>

		<!-- Project info -->
		<div v-if="activeSettingsTab === 'project-info'" class="flex-1 overflow-y-auto">
			<InspectorSection title="Project">
				<InspectorField label="Name">
					<Input
						v-if="editingName"
						v-model="nameInput"
						class="h-7 px-2 text-xs"
						v-focus
						aria-label="Project name"
						autofocus
						@blur="commitName"
						@keydown.enter="commitName"
						@keydown.escape="editingName = false"
					/>
					<button
						v-else
						type="button"
						class="group flex h-7 w-full min-w-0 items-center gap-2 rounded-md border border-line bg-surface-raised px-2 text-left text-xs text-fg transition-colors hover:border-line-strong focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none"
						title="Rename project"
						@click="startEditingName"
					>
						<span class="min-w-0 flex-1 truncate">{{ activeProject?.metadata?.name ?? 'Untitled' }}</span>
						<Pencil class="size-3 shrink-0 text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100" />
					</button>
				</InspectorField>
			</InspectorSection>

			<!-- Aspect ratio / canvas size -->
			<InspectorSection :title="isImageMode ? 'Canvas size' : 'Aspect ratio'" :flush="isImageMode">
				<template #actions>
					<span class="tabular pr-1 text-2xs text-fg-subtle">{{ currentCanvasSize.width }} × {{ currentCanvasSize.height }}</span>
				</template>
				<div class="grid gap-1.5" :class="isImageMode ? 'grid-cols-2' : 'grid-cols-3'">
					<OptionChip
						v-for="preset in canvasPresets"
						:key="preset.label"
						:active="currentCanvasSize.width === preset.width && currentCanvasSize.height === preset.height"
						:title="(preset as any).desc || preset.label"
						class="px-1.5"
						@click="handleAspectRatioChange(preset)"
					>
						<span class="truncate">{{ preset.label }}</span>
					</OptionChip>
				</div>
				<!-- Image mode: custom size -->
				<InspectorField v-if="isImageMode" label="Custom size">
					<div class="flex items-center gap-1.5">
						<NumberBox
							prefix="W"
							:value="customWidth"
							:min="1"
							:max="7680"
							:placeholder="String(currentCanvasSize.width)"
							aria-label="Custom width"
							class="flex-1"
							@input="(v) => (customWidth = v)"
						/>
						<span class="shrink-0 text-xs text-fg-subtle">×</span>
						<NumberBox
							prefix="H"
							:value="customHeight"
							:min="1"
							:max="7680"
							:placeholder="String(currentCanvasSize.height)"
							aria-label="Custom height"
							class="flex-1"
							@input="(v) => (customHeight = v)"
						/>
						<Button variant="secondary" size="sm" class="shrink-0" @click="applyCustomSize">Apply</Button>
					</div>
				</InspectorField>
			</InspectorSection>

			<!-- Frame rate -->
			<InspectorSection v-if="!isImageMode" title="Frame rate" flush>
				<template #actions>
					<span class="pr-1 text-2xs text-fg-subtle">fps</span>
				</template>
				<div class="grid grid-cols-5 gap-1.5">
					<OptionChip
						v-for="preset in fpsPresets"
						:key="preset.value"
						:active="currentFps === Number(preset.value)"
						:title="preset.label"
						class="tabular px-1"
						@click="handleFpsChange(Number(preset.value))"
					>
						{{ preset.value }}
					</OptionChip>
				</div>
			</InspectorSection>
		</div>

		<!-- Background -->
		<div v-else class="flex-1 overflow-y-auto">
			<InspectorSection title="Blur">
				<div class="grid grid-cols-4 gap-1.5">
					<AssetTile
						v-for="blur in blurPresets"
						:key="blur.value"
						aspect="1"
						hide-check
						:selected="isBlurBg && currentBlurIntensity === blur.value"
						:title="`${blur.label} blur`"
						@click="handleBackgroundBlur(blur.value)"
					>
						<!-- Sample image blurred at the preset strength -->
						<img
							src="/editor/stock/city-sunset.jpg"
							alt=""
							draggable="false"
							class="size-full scale-125 object-cover"
							:style="{ filter: `blur(${blur.value / 3}px)` }"
						/>
						<template #footer>
							<p
								class="truncate px-1 py-1 text-center text-2xs leading-4"
								:class="isBlurBg && currentBlurIntensity === blur.value ? 'text-fg' : 'text-fg-muted'"
							>
								{{ blur.label }}
							</p>
						</template>
					</AssetTile>
				</div>
			</InspectorSection>

			<InspectorSection title="Color" flush>
				<div class="grid grid-cols-5 gap-1.5">
					<!-- Swatches show the background colors themselves (content, not chrome) -->
					<button
						v-for="color in solidColors"
						:key="color"
						type="button"
						:title="color"
						:aria-label="`Background color ${color}`"
						:aria-pressed="isColorBg && currentBgColor === color"
						:class="[
							'aspect-square w-full rounded-md border border-line-strong transition-[border-color,box-shadow] focus-visible:shadow-[var(--focus-ring)] focus-visible:outline-none',
							isColorBg && currentBgColor === color
								? 'shadow-[0_0_0_2px_var(--panel),0_0_0_4px_var(--brand)]'
								: 'hover:border-fg-subtle',
						]"
						:style="{ backgroundColor: color }"
						@click="handleBackgroundColor(color)"
					/>
				</div>
			</InspectorSection>
		</div>
	</div>
</template>
