<script setup lang="ts">
import { computed } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import type { TextElement, VideoElement, ImageElement, AudioElement, StickerElement, EffectElement, CaptionElement } from "../../types/timeline";
import TextProperties from "./properties/TextProperties.vue";
import VideoProperties from "./properties/VideoProperties.vue";
import AudioProperties from "./properties/AudioProperties.vue";
import ImageProperties from "./properties/ImageProperties.vue";
import StickerProperties from "./properties/StickerProperties.vue";
import EffectProperties from "./properties/EffectProperties.vue";
import CaptionProperties from "./properties/CaptionProperties.vue";
import CaptionMultiProperties from "./properties/CaptionMultiProperties.vue";
import TransitionProperties from "./properties/TransitionProperties.vue";
import { Settings } from "lucide-vue-next";
import { useImageMode } from "../../composables/useImageMode";
import type { Transition } from "../../types/transitions";

const { editor, version } = useEditor({
	subscribe: {
		playback: false,
		project: false,
		timeline: true,
		selection: true,
		scenes: true,
		media: true,
	},
});
const { selectedElements } = useElementSelection();
const { isImageMode } = useImageMode();

const elementsWithTracks = computed(() => {
	void version.value;
	return editor.timeline.getElementsWithTracks({ elements: selectedElements.value });
});

// When all selected elements are captions, show only the first as representative
// to avoid mounting CaptionProperties N times (causes flicker/layout corruption).
const captionRepresentative = computed(() => {
	const all = elementsWithTracks.value;
	if (all.length <= 1) return null;
	if (all.every(({ element }) => element.type === "caption")) return all[0];
	return null;
});
const multiCaptionElements = computed(() => {
	const all = elementsWithTracks.value;
	if (all.length <= 1) return [];
	if (!all.every(({ element }) => element.type === "caption")) return [];
	return all.map(({ track, element }) => ({
		trackId: track.id,
		element: element as CaptionElement,
	}));
});

const selectedTransition = computed((): Transition | null => {
	void version.value;
	const id = editor.selection.getSelectedTransitionId();
	if (!id) return null;
	try {
		const scene = editor.scenes.getActiveScene();
		return scene?.transitions?.find((t) => t.id === id) ?? null;
	} catch {
		return null;
	}
});
</script>

<template>
	<div
		:class="[
			'flex h-full flex-col overflow-hidden text-zinc-200',
			isImageMode ? 'bg-[#1e1e1e]' : 'rounded-sm bg-[#18181b]',
		]"
	>
		<template v-if="selectedElements.length > 0 && !(isImageMode && captionRepresentative)">
			<!-- Multi-caption selection: render a single representative panel to avoid N-mount flicker -->
			<div v-if="captionRepresentative" class="min-h-0 flex-1 overflow-hidden">
				<CaptionMultiProperties v-if="multiCaptionElements.length > 1" :elements="multiCaptionElements" />
				<CaptionProperties
					v-else
					:element="(captionRepresentative.element as CaptionElement)"
					:track-id="captionRepresentative.track.id"
				/>
			</div>

			<!-- Element-specific properties (scrollable, takes remaining space) -->
			<template v-else>
				<div
					v-for="{ track, element } in elementsWithTracks"
					:key="element.id"
					class="min-h-0 flex-1 overflow-hidden"
				>
					<TextProperties
						v-if="element.type === 'text'"
						:element="(element as TextElement)"
						:track-id="track.id"
					/>

					<VideoProperties
						v-else-if="!isImageMode && element.type === 'video'"
						:element="(element as VideoElement)"
						:track-id="track.id"
					/>

					<ImageProperties
						v-else-if="element.type === 'image'"
						:element="(element as ImageElement)"
						:track-id="track.id"
					/>

					<AudioProperties
						v-else-if="!isImageMode && element.type === 'audio'"
						:element="(element as AudioElement)"
						:track-id="track.id"
					/>

					<StickerProperties
						v-else-if="element.type === 'sticker'"
						:element="(element as StickerElement)"
						:track-id="track.id"
					/>

					<EffectProperties
						v-else-if="!isImageMode && element.type === 'effect'"
						:element="(element as EffectElement)"
						:track-id="track.id"
					/>

					<CaptionProperties
						v-else-if="!isImageMode && element.type === 'caption'"
						:element="(element as CaptionElement)"
						:track-id="track.id"
					/>
				</div>
			</template>
		</template>

		<!-- Junction transition selected from timeline badge (not mixed with clip inspector) -->
		<template v-else-if="!isImageMode && selectedTransition">
			<div class="flex min-h-0 flex-1 flex-col overflow-hidden">
				<div class="shrink-0 border-b border-white/10 px-3 py-2">
					<p class="text-xs font-medium text-zinc-300">Transition</p>
					<p class="text-[10px] text-zinc-500">Between clips on this track</p>
				</div>
				<div class="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3">
					<TransitionProperties :transition="selectedTransition" />
				</div>
			</div>
		</template>

		<!-- Empty state -->
		<div v-else class="flex h-full flex-col">
			<div class="flex flex-1 flex-col items-center justify-center gap-2 p-4">
				<Settings class="size-6 text-zinc-700" :stroke-width="1" />
				<p class="text-center text-[11px] text-zinc-500">
					{{ isImageMode ? "Select a layer" : "Select a layer to edit" }}
				</p>
			</div>
		</div>
	</div>
</template>
