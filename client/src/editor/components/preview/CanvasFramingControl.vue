<script setup lang="ts">
/**
 * "Use 16:9" source framing toggle + blur amount for non-16:9 video canvases
 * (fills the canvas with the 16:9 source over a blurred copy). Lives in the
 * preview toolbar; moved here from the editor header.
 */
import { computed } from "vue";
import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import { useEditor } from "../../composables/useEditor";
import { Button } from "@/components/ui/button";
import ToolbarMenuButton from "../chrome/ToolbarMenuButton.vue";
import type { ManualSourceFramingPayload } from "@/types";

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

const activeProject = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull();
});

const canvasSourceFraming = computed(() => activeProject.value?.settings.canvasSourceFraming ?? null);
const use169Checked = computed(() => canvasSourceFraming.value?.mode === "use16x9");

async function persistCanvasFraming(fr: ManualSourceFramingPayload | null) {
	await editor.project.updateSettings({
		settings: { canvasSourceFraming: fr ?? undefined },
	});
}

function setUse169(checked: boolean) {
	const cur = canvasSourceFraming.value;
	if (checked) {
		void persistCanvasFraming({
			mode: "use16x9",
			blurEnabled: (cur?.blurAmount ?? 12) > 0,
			blurAmount: cur?.blurAmount ?? 12,
			scale: 1,
			x: 0,
			y: 0,
		});
	} else if (cur?.mode === "use16x9") {
		void persistCanvasFraming(null);
	}
}

function setCanvasFramingBlurAmount(amount: number) {
	const cur = canvasSourceFraming.value;
	if (!cur || cur.mode === "none") return;
	void persistCanvasFraming({
		...cur,
		blurAmount: amount,
		blurEnabled: amount > 0,
	});
}
</script>

<template>
	<Button
		variant="ghost"
		size="sm"
		:aria-pressed="use169Checked"
		title="Fit the 16:9 source inside this canvas over a blurred fill"
		:class="['px-2 font-normal', use169Checked && 'bg-brand-soft text-brand hover:bg-[var(--brand-soft-hover)] hover:text-brand']"
		@click="setUse169(!use169Checked)"
	>
		Use 16:9
	</Button>

	<PopoverRoot v-if="use169Checked">
		<PopoverTrigger as-child>
			<ToolbarMenuButton title="Background blur">
				Blur<span v-if="(canvasSourceFraming?.blurAmount ?? 0) > 0">&nbsp;{{ canvasSourceFraming?.blurAmount }}</span>
			</ToolbarMenuButton>
		</PopoverTrigger>
		<PopoverPortal>
			<PopoverContent
				:side-offset="4"
				align="start"
				class="z-[10060] w-48 rounded-lg bg-surface-raised p-3 shadow-[var(--shadow-md)] outline-none"
			>
				<div class="mb-1 flex items-center justify-between text-xs">
					<span class="text-fg-muted">Background blur</span>
					<span class="tabular text-fg">{{ canvasSourceFraming?.blurAmount ?? 0 }}</span>
				</div>
				<input
					type="range"
					min="0"
					max="30"
					step="1"
					:value="canvasSourceFraming?.blurAmount ?? 0"
					class="w-full"
					aria-label="Background blur"
					@input="setCanvasFramingBlurAmount(Number(($event.target as HTMLInputElement).value))"
				/>
			</PopoverContent>
		</PopoverPortal>
	</PopoverRoot>
</template>
