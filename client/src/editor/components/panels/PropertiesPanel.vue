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
import { Settings, SlidersHorizontal } from "lucide-vue-next";
import { useImageMode } from "../../composables/useImageMode";

const { editor, version } = useEditor();
const { selectedElements } = useElementSelection();
const { isImageMode } = useImageMode();

const elementsWithTracks = computed(() => {
	void version.value;
	return editor.timeline.getElementsWithTracks({ elements: selectedElements.value });
});
</script>

<template>
	<div class="h-full overflow-y-auto rounded-sm bg-[#18181b] text-zinc-200">
		<template v-if="selectedElements.length > 0">
			<div
				v-for="{ track, element } in elementsWithTracks"
				:key="element.id"
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
			<!-- Keyframe Editor -->
			<div class="border-t border-white/10">
				<KeyframeEditorPanel />
			</div>
		</template>

		<!-- Empty state -->
		<div v-else class="flex h-full flex-col">
			<!-- Header -->
			<div v-if="isImageMode" class="flex items-center gap-1.5 border-b border-white/[0.06] px-3 py-2">
				<SlidersHorizontal class="size-3.5 text-zinc-500" />
				<span class="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Properties</span>
			</div>
			<div class="flex flex-1 flex-col items-center justify-center gap-2 p-4">
				<Settings class="text-zinc-700 size-7" :stroke-width="1" />
				<p class="text-[11px] text-zinc-600 text-center">Select a layer to edit</p>
			</div>
		</div>
	</div>
</template>
