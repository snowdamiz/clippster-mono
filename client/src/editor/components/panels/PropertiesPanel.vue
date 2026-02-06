<script setup lang="ts">
import { computed } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import type { TextElement, VideoElement, ImageElement, AudioElement, StickerElement } from "../../types/timeline";
import TextProperties from "./properties/TextProperties.vue";
import { Settings, Volume2, Film, Image, Sticker } from "lucide-vue-next";

const { editor, version } = useEditor();
const { selectedElements } = useElementSelection();

const elementsWithTracks = computed(() => {
	void version.value;
	return editor.timeline.getElementsWithTracks({ elements: selectedElements.value });
});

function formatTime(seconds: number): string {
	const min = Math.floor(seconds / 60);
	const sec = (seconds % 60).toFixed(2);
	return `${min}:${sec.padStart(5, "0")}`;
}
</script>

<template>
	<div class="h-full overflow-y-auto rounded-sm bg-[#18181b] text-zinc-200">
		<template v-if="selectedElements.length > 0">
			<div
				v-for="{ track, element } in elementsWithTracks"
				:key="element.id"
			>
				<!-- Text properties (full editor) -->
				<TextProperties
					v-if="element.type === 'text'"
					:element="(element as TextElement)"
					:track-id="track.id"
				/>

				<!-- Audio properties -->
				<div v-else-if="element.type === 'audio'" class="space-y-4 border-b border-white/10 p-4">
					<div class="flex items-center gap-2">
						<Volume2 class="text-zinc-500 size-4" />
						<h3 class="text-sm font-medium">Audio</h3>
					</div>
					<div class="space-y-3">
						<div class="space-y-1">
							<label class="text-zinc-500 text-xs">Name</label>
							<p class="text-sm">{{ element.name }}</p>
						</div>
						<div class="flex gap-4">
							<div class="space-y-1">
								<label class="text-zinc-500 text-xs">Start</label>
								<p class="text-sm">{{ formatTime(element.startTime) }}</p>
							</div>
							<div class="space-y-1">
								<label class="text-zinc-500 text-xs">Duration</label>
								<p class="text-sm">{{ formatTime(element.duration) }}</p>
							</div>
						</div>
						<div class="space-y-1.5">
							<label class="text-zinc-500 text-xs">Volume</label>
							<div class="flex items-center gap-2">
								<input
									type="range"
									:value="(element as AudioElement).volume * 100"
									min="0"
									max="200"
									step="1"
									class="flex-1"
								/>
								<span class="text-xs w-10 text-right">{{ Math.round((element as AudioElement).volume * 100) }}%</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Video/Image properties -->
				<div v-else-if="element.type === 'video' || element.type === 'image'" class="space-y-4 border-b border-white/10 p-4">
					<div class="flex items-center gap-2">
						<component :is="element.type === 'video' ? Film : Image" class="text-zinc-500 size-4" />
						<h3 class="text-sm font-medium">{{ element.type === 'video' ? 'Video' : 'Image' }}</h3>
					</div>
					<div class="space-y-3">
						<div class="space-y-1">
							<label class="text-zinc-500 text-xs">Name</label>
							<p class="text-sm">{{ element.name }}</p>
						</div>
						<div class="flex gap-4">
							<div class="space-y-1">
								<label class="text-zinc-500 text-xs">Start</label>
								<p class="text-sm">{{ formatTime(element.startTime) }}</p>
							</div>
							<div class="space-y-1">
								<label class="text-zinc-500 text-xs">Duration</label>
								<p class="text-sm">{{ formatTime(element.duration) }}</p>
							</div>
						</div>
						<div class="space-y-1.5">
							<label class="text-zinc-500 text-xs">Opacity</label>
							<div class="flex items-center gap-2">
								<input
									type="range"
									:value="(element as VideoElement | ImageElement).opacity * 100"
									min="0"
									max="100"
									step="1"
									class="flex-1"
								/>
								<span class="text-xs w-10 text-right">{{ Math.round((element as VideoElement | ImageElement).opacity * 100) }}%</span>
							</div>
						</div>
					</div>
				</div>

				<!-- Sticker properties -->
				<div v-else-if="element.type === 'sticker'" class="space-y-4 border-b border-white/10 p-4">
					<div class="flex items-center gap-2">
						<Sticker class="text-zinc-500 size-4" />
						<h3 class="text-sm font-medium">Sticker</h3>
					</div>
					<div class="space-y-3">
						<div class="space-y-1">
							<label class="text-zinc-500 text-xs">Name</label>
							<p class="text-sm">{{ element.name }}</p>
						</div>
						<div class="flex gap-4">
							<div class="space-y-1">
								<label class="text-zinc-500 text-xs">Start</label>
								<p class="text-sm">{{ formatTime(element.startTime) }}</p>
							</div>
							<div class="space-y-1">
								<label class="text-zinc-500 text-xs">Duration</label>
								<p class="text-sm">{{ formatTime(element.duration) }}</p>
							</div>
						</div>
						<div class="space-y-1.5">
							<label class="text-zinc-500 text-xs">Opacity</label>
							<div class="flex items-center gap-2">
								<input
									type="range"
									:value="(element as StickerElement).opacity * 100"
									min="0"
									max="100"
									step="1"
									class="flex-1"
								/>
								<span class="text-xs w-10 text-right">{{ Math.round((element as StickerElement).opacity * 100) }}%</span>
							</div>
						</div>
					</div>
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
