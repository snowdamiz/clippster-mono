<script setup lang="ts">
import { computed } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { Upload, X, FileImage } from "lucide-vue-next";

const props = defineProps<{
	lutPath?: string;
}>();

const emit = defineEmits<{
	(e: "update", lutPath: string | undefined): void;
}>();

const lutName = computed(() => {
	if (!props.lutPath) return null;
	// Extract filename from path (handle both / and \ separators)
	return props.lutPath.split(/[\\/]/).pop() ?? props.lutPath;
});

async function browseLut() {
	const selected = await open({
		multiple: false,
		filters: [
			{ name: "LUT files", extensions: ["cube"] },
		],
	});
	if (!selected) return;
	const path = Array.isArray(selected) ? selected[0] : selected;
	emit("update", path);
}

function clearLut() {
	emit("update", undefined);
}
</script>

<template>
	<div class="space-y-2">
		<div class="flex items-center justify-between">
			<span class="text-[11px] font-medium text-zinc-300">LUT (Look-Up Table)</span>
		</div>

		<!-- Current LUT -->
		<div v-if="lutName" class="flex items-center gap-2 rounded border border-white/10 bg-white/5 px-2 py-1.5">
			<FileImage class="size-3.5 shrink-0 text-zinc-400" />
			<span class="flex-1 truncate text-[11px] text-zinc-300">{{ lutName }}</span>
			<button
				type="button"
				class="shrink-0 text-zinc-500 transition-colors hover:text-zinc-300"
				title="Remove LUT"
				@click="clearLut"
			>
				<X class="size-3" />
			</button>
		</div>

		<!-- Browse button -->
		<button
			type="button"
			class="flex w-full items-center justify-center gap-1.5 rounded border border-dashed border-white/20 bg-white/[0.03] px-3 py-2 text-[11px] text-zinc-400 transition-colors hover:border-white/30 hover:text-zinc-200"
			@click="browseLut"
		>
			<Upload class="size-3.5" />
			{{ lutPath ? "Change LUT" : "Browse .cube file…" }}
		</button>

		<p class="text-[9px] leading-snug text-zinc-600">
			Supports .cube format (17³ or 33³ grids). Applied on export via FFmpeg lut3d filter.
		</p>
	</div>
</template>
