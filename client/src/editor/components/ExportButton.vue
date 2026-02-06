<script setup lang="ts">
import { ref, computed } from "vue";
import { useEditor } from "../composables/useEditor";
import { Button } from "@/components/ui/button";
import { Download, X, RotateCcw, Copy, Check } from "lucide-vue-next";

const { editor, version } = useEditor();

const isOpen = ref(false);
const format = ref<"mp4" | "webm">("mp4");
const quality = ref<"low" | "medium" | "high" | "very_high">("high");
const includeAudio = ref(true);
const isExporting = ref(false);
const progress = ref(0);
const exportError = ref<string | null>(null);
const copied = ref(false);
const cancelRequested = ref(false);
const exportedPath = ref<string | null>(null);

const hasProject = computed(() => {
	void version.value;
	return !!editor.project.getActive();
});

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActive();
});

async function handleExport() {
	const project = activeProject.value;
	if (!project) return;

	cancelRequested.value = false;
	isExporting.value = true;
	progress.value = 0;
	exportError.value = null;

	try {
		const result = await editor.project.export({
			options: {
				format: format.value,
				quality: quality.value,
				fps: project.settings.fps,
				includeAudio: includeAudio.value,
				onProgress: (p: { progress: number }) => { progress.value = p.progress; },
				onCancel: () => cancelRequested.value,
			},
		});

		isExporting.value = false;

		if (result.cancelled) {
			progress.value = 0;
			return;
		}

		if (result.success) {
			exportedPath.value = result.outputPath || null;
			isOpen.value = false;
			progress.value = 0;
		} else {
			exportError.value = result.error || "Unknown error occurred";
		}
	} catch (err) {
		isExporting.value = false;
		exportError.value = err instanceof Error ? err.message : "Export failed";
	}
}

function handleCancel() {
	cancelRequested.value = true;
}

function handleClose() {
	if (!isExporting.value) {
		isOpen.value = false;
		exportError.value = null;
		progress.value = 0;
	}
}

async function handleCopyError() {
	if (exportError.value) {
		await navigator.clipboard.writeText(exportError.value);
		copied.value = true;
		setTimeout(() => { copied.value = false; }, 1000);
	}
}
</script>

<template>
	<div class="relative">
		<!-- Export trigger button -->
		<button
			type="button"
			:class="[
				'flex items-center gap-1.5 rounded-md bg-[#38BDF8] px-[0.12rem] py-[0.12rem] text-white',
				hasProject ? 'cursor-pointer' : 'cursor-not-allowed opacity-50',
			]"
			:disabled="!hasProject"
			@click="hasProject && (isOpen = !isOpen)"
		>
			<div class="relative flex items-center gap-1.5 rounded-[0.6rem] bg-gradient-to-l from-[#2567EC] to-[#37B6F7] px-4 py-1 shadow-[0_1px_3px_0px_rgba(0,0,0,0.65)]">
				<Download class="z-50 size-4" />
				<span class="z-50 text-[0.875rem]">Export</span>
			</div>
		</button>

		<!-- Export popover -->
		<div
			v-if="isOpen && hasProject"
			class="absolute top-full right-0 z-50 mt-2 flex w-80 flex-col gap-3 rounded-lg border border-white/10 bg-[#1e1e22] p-4 shadow-lg text-zinc-200"
		>
			<!-- Error state -->
			<template v-if="exportError && !isExporting">
				<div class="space-y-4">
					<div class="flex flex-col gap-1.5">
						<p class="text-red-400 text-sm font-medium">Export failed</p>
						<p class="text-zinc-500 text-xs">{{ exportError }}</p>
					</div>
					<div class="flex gap-2">
						<Button variant="outline" size="sm" class="h-8 flex-1 text-xs" @click="handleCopyError">
							<component :is="copied ? Check : Copy" class="mr-1 size-3" />
							Copy
						</Button>
						<Button variant="outline" size="sm" class="h-8 flex-1 text-xs" @click="handleExport">
							<RotateCcw class="mr-1 size-3" />
							Retry
						</Button>
					</div>
				</div>
			</template>

			<!-- Normal state -->
			<template v-else>
				<div class="flex items-center justify-between">
					<h3 class="font-medium">{{ isExporting ? 'Exporting project' : 'Export project' }}</h3>
					<Button variant="ghost" size="icon" class="size-6" @click="handleClose">
						<X class="size-4" />
					</Button>
				</div>

				<div class="flex flex-col gap-4">
					<!-- Options (shown when not exporting) -->
					<template v-if="!isExporting">
						<!-- Format -->
						<div class="space-y-2">
							<label class="text-zinc-500 text-xs">Format</label>
							<div class="space-y-1">
								<label class="flex items-center gap-2 text-sm">
									<input v-model="format" type="radio" value="mp4" class="accent-primary" />
									MP4 (H.264) - Better compatibility
								</label>
								<label class="flex items-center gap-2 text-sm">
									<input v-model="format" type="radio" value="webm" class="accent-primary" />
									WebM (VP9) - Smaller file size
								</label>
							</div>
						</div>

						<!-- Quality -->
						<div class="space-y-2">
							<label class="text-zinc-500 text-xs">Quality</label>
							<div class="space-y-1">
								<label v-for="q in [
									{ value: 'low', label: 'Low - Smallest file size' },
									{ value: 'medium', label: 'Medium - Balanced' },
									{ value: 'high', label: 'High - Recommended' },
									{ value: 'very_high', label: 'Very High - Largest file size' },
								]" :key="q.value" class="flex items-center gap-2 text-sm">
									<input v-model="quality" type="radio" :value="q.value" class="accent-primary" />
									{{ q.label }}
								</label>
							</div>
						</div>

						<!-- Audio -->
						<div class="space-y-2">
							<label class="flex items-center gap-2 text-sm">
								<input v-model="includeAudio" type="checkbox" class="accent-primary" />
								Include audio in export
							</label>
						</div>

						<Button class="w-full gap-2" @click="handleExport">
							<Download class="size-4" />
							Export
						</Button>
					</template>

					<!-- Progress (shown when exporting) -->
					<template v-else>
						<div class="space-y-4">
							<div class="flex flex-col">
								<div class="flex items-center justify-between text-center">
									<p class="text-zinc-500 mb-2 text-sm">{{ Math.round(progress * 100) }}%</p>
									<p class="text-zinc-500 mb-2 text-sm">100%</p>
								</div>
								<div class="bg-zinc-700 h-2 w-full overflow-hidden rounded-full">
									<div class="bg-primary h-full transition-all" :style="{ width: `${progress * 100}%` }" />
								</div>
							</div>
							<Button variant="outline" class="w-full" @click="handleCancel">
								Cancel
							</Button>
						</div>
					</template>
				</div>
			</template>
		</div>

		<!-- Click-away overlay -->
		<div
			v-if="isOpen && !isExporting"
			class="fixed inset-0 z-40"
			@click="handleClose"
		/>
	</div>
</template>
