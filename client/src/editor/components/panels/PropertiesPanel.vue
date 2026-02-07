<script setup lang="ts">
import { computed } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import type { TextElement, VideoElement, ImageElement, AudioElement, StickerElement, EffectElement } from "../../types/timeline";
import TextProperties from "./properties/TextProperties.vue";
import VideoProperties from "./properties/VideoProperties.vue";
import AudioProperties from "./properties/AudioProperties.vue";
import ImageProperties from "./properties/ImageProperties.vue";
import StickerProperties from "./properties/StickerProperties.vue";
import EffectProperties from "./properties/EffectProperties.vue";
import KeyframeEditorPanel from "./KeyframeEditorPanel.vue";
import { Settings } from "lucide-vue-next";

const { editor, version } = useEditor();
const { selectedElements } = useElementSelection();

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
			</div>
			<!-- Keyframe Editor -->
			<div class="border-t border-white/10">
				<KeyframeEditorPanel />
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
