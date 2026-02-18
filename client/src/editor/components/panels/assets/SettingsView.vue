<script setup lang="ts">
import { ref, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { Button } from "@/components/ui/button";
import { ChevronDown } from "lucide-vue-next";

const { editor, version } = useEditor();

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull();
});

const activeSettingsTab = ref<"project-info" | "background">("project-info");

// Canvas presets
const canvasPresets = [
	{ width: 1080, height: 1920, label: "9:16" },
	{ width: 1920, height: 1080, label: "16:9" },
	{ width: 1080, height: 1080, label: "1:1" },
	{ width: 1080, height: 1350, label: "4:5" },
	{ width: 1920, height: 1920, label: "1:1 HD" },
];

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
		<!-- Tabs -->
		<div class="flex border-b border-white/10">
			<button
				type="button"
				:class="['px-4 py-2 text-xs', activeSettingsTab === 'project-info' ? 'text-zinc-200 border-b-2 border-primary' : 'text-zinc-500']"
				@click="activeSettingsTab = 'project-info'"
			>
				Project info
			</button>
			<button
				type="button"
				:class="['px-4 py-2 text-xs', activeSettingsTab === 'background' ? 'text-zinc-200 border-b-2 border-primary' : 'text-zinc-500']"
				@click="activeSettingsTab = 'background'"
			>
				Background
			</button>
		</div>

		<!-- Project Info -->
		<div v-if="activeSettingsTab === 'project-info'" class="flex-1 space-y-4 overflow-y-auto p-5">
			<div class="space-y-1.5">
				<label class="text-zinc-500 text-xs">Name</label>
				<p class="text-sm">{{ activeProject?.metadata?.name ?? 'Untitled' }}</p>
			</div>

			<div class="space-y-1.5">
				<label class="text-zinc-500 text-xs">Aspect ratio</label>
				<div class="grid grid-cols-3 gap-2">
					<button
						v-for="preset in canvasPresets"
						:key="preset.label"
						type="button"
						:class="[
							'rounded-md border px-3 py-1.5 text-xs transition-colors',
							currentCanvasSize.width === preset.width && currentCanvasSize.height === preset.height
								? 'border-primary bg-primary/10 text-primary'
								: 'border-white/10 hover:border-blue-400/50',
						]"
						@click="handleAspectRatioChange(preset)"
					>
						{{ preset.label }}
					</button>
				</div>
			</div>

			<div class="space-y-1.5">
				<label class="text-zinc-500 text-xs">Frame rate</label>
				<div class="grid grid-cols-3 gap-2">
					<button
						v-for="preset in fpsPresets"
						:key="preset.value"
						type="button"
						:class="[
							'rounded-md border px-3 py-1.5 text-xs transition-colors',
							currentFps === Number(preset.value)
								? 'border-primary bg-primary/10 text-primary'
								: 'border-white/10 hover:border-blue-400/50',
						]"
						@click="handleFpsChange(Number(preset.value))"
					>
						{{ preset.label }}
					</button>
				</div>
			</div>
		</div>

		<!-- Background -->
		<div v-else class="flex-1 space-y-4 overflow-y-auto p-5">
			<!-- Blur section -->
			<div class="space-y-2">
				<button type="button" class="flex items-center gap-1.5 text-xs text-zinc-500" @click="() => {}">
					Blur
					<ChevronDown class="size-3" />
				</button>
				<div class="grid grid-cols-4 gap-2">
					<button
						v-for="blur in blurPresets"
						:key="blur.value"
						type="button"
						:class="[
							'aspect-square rounded-sm border overflow-hidden relative',
							isBlurBg && currentBlurIntensity === blur.value ? 'border-primary border-2' : 'border-white/10 hover:border-blue-400/50',
						]"
						@click="handleBackgroundBlur(blur.value)"
					>
						<div class="absolute inset-0 bg-gradient-to-br from-blue-500 to-purple-500" :style="{ filter: `blur(${blur.value}px)` }" />
						<span class="absolute right-1 bottom-1 rounded bg-black/50 px-1 text-[10px] text-white">{{ blur.label }}</span>
					</button>
				</div>
			</div>

			<!-- Colors section -->
			<div class="space-y-2">
				<span class="text-zinc-500 text-xs">Colors</span>
				<div class="grid grid-cols-5 gap-2">
					<button
						v-for="color in solidColors"
						:key="color"
						type="button"
						:class="[
							'aspect-square w-full rounded-sm border',
							isColorBg && currentBgColor === color ? 'border-primary border-2' : 'border-white/10 hover:border-blue-400/50',
						]"
						:style="{ backgroundColor: color }"
						@click="handleBackgroundColor(color)"
					/>
				</div>
			</div>
		</div>
	</div>
</template>
