<script setup lang="ts">
import { computed } from "vue";
import { open } from "@tauri-apps/plugin-dialog";
import { Upload, X, FileImage } from "lucide-vue-next";
import { Button } from "@/components/ui/button";

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
		<!-- Current LUT -->
		<div v-if="lutName" class="flex h-7 items-center gap-2 rounded-md border border-line bg-surface-raised pl-2 pr-1">
			<FileImage class="size-3.5 shrink-0 text-fg-subtle" />
			<span class="min-w-0 flex-1 truncate text-xs text-fg" :title="lutPath">{{ lutName }}</span>
			<Button variant="ghost" size="icon-xs" title="Remove LUT" aria-label="Remove LUT" @click="clearLut">
				<X />
			</Button>
		</div>

		<Button variant="secondary" size="sm" block @click="browseLut">
			<Upload />
			{{ lutPath ? "Change LUT" : "Browse .cube file…" }}
		</Button>

		<p class="text-2xs text-fg-subtle">
			Supports .cube files (17³ or 33³ grids). Applied on export.
		</p>
	</div>
</template>
