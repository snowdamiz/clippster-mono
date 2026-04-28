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
import KeyframeEditorPanel from "./KeyframeEditorPanel.vue";
import TransitionProperties from "./properties/TransitionProperties.vue";
import { Settings } from "lucide-vue-next";
import type { Transition } from "../../types/transitions";

const { editor, version } = useEditor();
const { selectedElements } = useElementSelection();

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
	<div class="flex h-full flex-col overflow-hidden rounded-sm bg-[#18181b] text-zinc-200">
		<template v-if="selectedElements.length > 0">
			<!-- Multi-caption selection: render a single representative panel to avoid N-mount flicker -->
			<div v-if="captionRepresentative" class="min-h-0 flex-1 overflow-hidden">
				<CaptionProperties
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
						v-else-if="element.type === 'video'"
						:element="(element as VideoElement)"
						:track-id="track.id"
					/>

					<ImageProperties
						v-else-if="element.type === 'image'"
						:element="(element as ImageElement)"
						:track-id="track.id"
					/>

					<AudioProperties
						v-else-if="element.type === 'audio'"
						:element="(element as AudioElement)"
						:track-id="track.id"
					/>

					<StickerProperties
						v-else-if="element.type === 'sticker'"
						:element="(element as StickerElement)"
						:track-id="track.id"
					/>

					<EffectProperties
						v-else-if="element.type === 'effect'"
						:element="(element as EffectElement)"
						:track-id="track.id"
					/>

					<CaptionProperties
						v-else-if="element.type === 'caption'"
						:element="(element as CaptionElement)"
						:track-id="track.id"
					/>
				</div>

				<!-- Keyframe editor — fixed height panel below element properties -->
				<div v-if="selectedElements.length === 1" class="h-56 flex-shrink-0 border-t border-white/10">
					<KeyframeEditorPanel />
				</div>
			</template>
		</template>

		<!-- Junction transition selected from timeline badge (not mixed with clip inspector) -->
		<template v-else-if="selectedTransition">
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
		<div v-else class="flex h-full flex-col items-center justify-center gap-3 p-4">
			<Settings class="text-zinc-500/75 size-10" :stroke-width="1" />
			<div class="flex flex-col gap-2 text-center">
				<p class="text-sm font-medium text-zinc-300">It's empty here</p>
				<p class="text-zinc-500 text-xs text-balance">
					Click an element on the timeline to edit its properties
				</p>
			</div>
		</div>
	</div>
</template>
