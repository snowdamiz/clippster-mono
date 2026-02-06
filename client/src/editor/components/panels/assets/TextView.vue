<script setup lang="ts">
import { useEditor } from "../../../composables/useEditor";
import { DEFAULT_TEXT_ELEMENT } from "../../../constants/text-constants";
import { buildTextElement } from "../../../lib/timeline/element-utils";
import DraggableItem from "./DraggableItem.vue";

const { editor } = useEditor();

function handleAddToTimeline({ currentTime }: { currentTime: number }) {
	const element = buildTextElement({
		raw: DEFAULT_TEXT_ELEMENT,
		startTime: currentTime,
	});

	editor.timeline.insertElement({
		element,
		placement: { mode: "auto" },
	});
}
</script>

<template>
	<div class="p-4">
		<DraggableItem
			name="Default text"
			:drag-data="{
				id: 'temp-text-id',
				type: DEFAULT_TEXT_ELEMENT.type,
				name: DEFAULT_TEXT_ELEMENT.name,
				content: DEFAULT_TEXT_ELEMENT.content,
			}"
			:aspect-ratio="1"
			:should-show-label="false"
			@add-to-timeline="handleAddToTimeline"
		>
			<template #preview>
				<div class="bg-zinc-800 flex size-full items-center justify-center rounded text-zinc-300">
					<span class="select-none text-xs">Default text</span>
				</div>
			</template>
		</DraggableItem>
	</div>
</template>
