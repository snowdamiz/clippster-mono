<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";
import { Type, Sparkles, ExternalLink } from "lucide-vue-next";
import { buildTextElement } from "@/editor/lib/timeline/element-utils";
import { TIMELINE_CONSTANTS } from "@/editor/constants/timeline-constants";
import { useEditor } from "@/editor/composables/useEditor";
import { useAuthStore } from "@/stores/auth";
import { canAccessAIVideo } from "@/utils/aiVideoAccess";

const router = useRouter();
const authStore = useAuthStore();
const { editor } = useEditor();

const hasThumbnailAccess = computed(() => canAccessAIVideo(authStore.user));

const quickTexts = [
	"MAKE IT HAPPEN",
	"THE FUTURE IS NOW",
	"LEVEL UP",
	"BREAKING",
	"WATCH THIS",
];

function addTextToCanvas(text: string) {
	const element = buildTextElement({
		raw: {
			content: text,
			name: text.slice(0, 30),
			duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
		},
		startTime: editor.playback.getCurrentTime(),
	});
	editor.timeline.insertElement({ element, placement: { mode: "auto" } });
}

function openThumbnailGenerator() {
	if (!hasThumbnailAccess.value) return;
	router.push("/ai-thumbnail");
}
</script>

<template>
	<div class="flex h-full flex-col gap-4 overflow-y-auto p-4">
		<div
			class="rounded-lg border p-3"
			:class="
				hasThumbnailAccess
					? 'border-purple-500/30 bg-purple-600/10'
					: 'border-white/10 bg-white/[0.03] opacity-60'
			"
		>
			<div class="mb-2 flex items-center gap-2">
				<Sparkles class="size-4" :class="hasThumbnailAccess ? 'text-purple-400' : 'text-zinc-500'" />
				<h3 class="text-xs font-semibold text-zinc-200">AI Thumbnail Generator</h3>
				<span
					v-if="!hasThumbnailAccess"
					class="ml-auto rounded bg-white/5 px-1.5 py-0.5 text-[0.5625rem] font-semibold leading-none text-zinc-500"
				>
					Coming Soon
				</span>
			</div>
			<p class="mb-3 text-[10px] leading-relaxed text-zinc-400">
				Chat-based thumbnail creation with Quick (flat PNG) or Editable (layered project) modes,
				references, and 3 refinement rounds.
			</p>
			<button
				type="button"
				class="flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 text-xs font-medium transition-colors"
				:class="
					hasThumbnailAccess
						? 'bg-purple-600 text-white hover:bg-purple-500'
						: 'cursor-not-allowed bg-zinc-700 text-zinc-400'
				"
				:disabled="!hasThumbnailAccess"
				@click="openThumbnailGenerator"
			>
				Open AI Thumbnail
				<ExternalLink class="size-3" />
			</button>
		</div>

		<div class="border-t border-white/5" />

		<div>
			<div class="mb-2 flex items-center gap-2">
				<Type class="size-4 text-blue-400" />
				<h3 class="text-xs font-semibold text-zinc-200">Quick text</h3>
			</div>
			<p class="mb-2 text-[10px] text-zinc-500">Drop a common hook onto the canvas</p>
			<div class="space-y-1.5">
				<button
					v-for="text in quickTexts"
					:key="text"
					type="button"
					class="flex w-full items-center rounded-md border border-white/5 px-3 py-2 text-left text-xs text-zinc-300 transition-colors hover:border-blue-500/30 hover:bg-white/5"
					@click="addTextToCanvas(text)"
				>
					{{ text }}
				</button>
			</div>
		</div>
	</div>
</template>
