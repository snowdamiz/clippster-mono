<script setup lang="ts">
import { ref, watch } from "vue";
import { useEditor } from "../../../composables/useEditor";
import type { TextElement } from "../../../types/timeline";
import { Button } from "@/components/ui/button";

const props = defineProps<{
	element: TextElement;
	trackId: string;
}>();

const { editor } = useEditor();

const fontSizeInput = ref(props.element.fontSize.toString());
const opacityInput = ref(Math.round(props.element.opacity * 100).toString());
const contentInput = ref(props.element.content);

watch(() => props.element.fontSize, (v) => { fontSizeInput.value = v.toString(); });
watch(() => props.element.opacity, (v) => { opacityInput.value = Math.round(v * 100).toString(); });
watch(() => props.element.content, (v) => { contentInput.value = v; });

function update(updates: Record<string, unknown>) {
	editor.timeline.updateTextElement({
		trackId: props.trackId,
		elementId: props.element.id,
		updates: updates as any,
	});
}

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function handleFontSizeChange(value: string) {
	fontSizeInput.value = value;
	if (value.trim() !== "") {
		const parsed = parseInt(value, 10);
		if (!Number.isNaN(parsed)) {
			update({ fontSize: clamp(parsed, 8, 300) });
		}
	}
}

function handleFontSizeBlur() {
	const parsed = parseInt(fontSizeInput.value, 10);
	const fontSize = Number.isNaN(parsed) ? props.element.fontSize : clamp(parsed, 8, 300);
	fontSizeInput.value = fontSize.toString();
	update({ fontSize });
}

function handleOpacityChange(value: string) {
	opacityInput.value = value;
	if (value.trim() !== "") {
		const parsed = parseInt(value, 10);
		if (!Number.isNaN(parsed)) {
			update({ opacity: clamp(parsed, 0, 100) / 100 });
		}
	}
}

function handleOpacityBlur() {
	const parsed = parseInt(opacityInput.value, 10);
	const pct = Number.isNaN(parsed) ? Math.round(props.element.opacity * 100) : clamp(parsed, 0, 100);
	opacityInput.value = pct.toString();
	update({ opacity: pct / 100 });
}

function handleContentChange(e: Event) {
	const value = (e.target as HTMLTextAreaElement).value;
	contentInput.value = value;
	update({ content: value });
}

const alignOptions = ["left", "center", "right"] as const;
</script>

<template>
	<div class="space-y-5 p-4">
		<!-- Content -->
		<div class="space-y-1.5">
			<label class="text-zinc-500 text-xs">Content</label>
			<textarea
				class="min-h-20 w-full rounded-md border border-white/10 bg-white/5 px-3 py-2 text-sm text-zinc-200"
				:value="contentInput"
				@input="handleContentChange"
			/>
		</div>

		<!-- Font Family -->
		<div class="space-y-1.5">
			<label class="text-zinc-500 text-xs">Font</label>
			<select
				class="w-full rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-zinc-200"
				:value="element.fontFamily"
				@change="update({ fontFamily: ($event.target as HTMLSelectElement).value })"
			>
				<option value="Inter">Inter</option>
				<option value="Arial">Arial</option>
				<option value="Helvetica">Helvetica</option>
				<option value="Georgia">Georgia</option>
				<option value="Times New Roman">Times New Roman</option>
				<option value="Courier New">Courier New</option>
				<option value="Verdana">Verdana</option>
				<option value="Impact">Impact</option>
				<option value="Comic Sans MS">Comic Sans MS</option>
			</select>
		</div>

		<!-- Style buttons -->
		<div class="space-y-1.5">
			<label class="text-zinc-500 text-xs">Style</label>
			<div class="flex items-center gap-2">
				<Button
					:variant="element.fontWeight === 'bold' ? 'default' : 'outline'"
					size="sm"
					class="h-8 px-3 font-bold"
					@click="update({ fontWeight: element.fontWeight === 'bold' ? 'normal' : 'bold' })"
				>
					B
				</Button>
				<Button
					:variant="element.fontStyle === 'italic' ? 'default' : 'outline'"
					size="sm"
					class="h-8 px-3 italic"
					@click="update({ fontStyle: element.fontStyle === 'italic' ? 'normal' : 'italic' })"
				>
					I
				</Button>
				<Button
					:variant="element.textDecoration === 'underline' ? 'default' : 'outline'"
					size="sm"
					class="h-8 px-3 underline"
					@click="update({ textDecoration: element.textDecoration === 'underline' ? 'none' : 'underline' })"
				>
					U
				</Button>
				<Button
					:variant="element.textDecoration === 'line-through' ? 'default' : 'outline'"
					size="sm"
					class="h-8 px-3 line-through"
					@click="update({ textDecoration: element.textDecoration === 'line-through' ? 'none' : 'line-through' })"
				>
					S
				</Button>
			</div>
		</div>

		<!-- Font Size -->
		<div class="space-y-1.5">
			<label class="text-zinc-500 text-xs">Font size</label>
			<div class="flex items-center gap-2">
				<input
					type="range"
					:value="element.fontSize"
					min="8"
					max="300"
					step="1"
					class="flex-1"
					@input="(e) => {
						const val = (e.target as HTMLInputElement).value;
						update({ fontSize: Number(val) });
						fontSizeInput = val;
					}"
				/>
				<input
					type="number"
					:value="fontSizeInput"
					min="8"
					max="300"
					class="h-7 w-14 rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200"
					@input="(e) => handleFontSizeChange((e.target as HTMLInputElement).value)"
					@blur="handleFontSizeBlur"
				/>
			</div>
		</div>

		<!-- Text Color -->
		<div class="space-y-1.5">
			<label class="text-zinc-500 text-xs">Color</label>
			<div class="flex items-center gap-2">
				<input
					type="color"
					:value="element.color"
					class="h-8 w-8 cursor-pointer rounded border-0"
					@input="(e) => update({ color: (e.target as HTMLInputElement).value })"
				/>
				<span class="text-xs uppercase">{{ element.color }}</span>
			</div>
		</div>

		<!-- Text Align -->
		<div class="space-y-1.5">
			<label class="text-zinc-500 text-xs">Alignment</label>
			<div class="flex items-center gap-2">
				<Button
					v-for="align in alignOptions"
					:key="align"
					:variant="element.textAlign === align ? 'default' : 'outline'"
					size="sm"
					class="h-8 flex-1 capitalize"
					@click="update({ textAlign: align })"
				>
					{{ align }}
				</Button>
			</div>
		</div>

		<!-- Opacity -->
		<div class="space-y-1.5">
			<label class="text-zinc-500 text-xs">Opacity</label>
			<div class="flex items-center gap-2">
				<input
					type="range"
					:value="element.opacity * 100"
					min="0"
					max="100"
					step="1"
					class="flex-1"
					@input="(e) => {
						const val = Number((e.target as HTMLInputElement).value);
						update({ opacity: val / 100 });
						opacityInput = val.toString();
					}"
				/>
				<input
					type="number"
					:value="opacityInput"
					min="0"
					max="100"
					class="h-7 w-14 rounded-sm border border-white/10 bg-white/5 px-2 text-center text-xs text-zinc-200"
					@input="(e) => handleOpacityChange((e.target as HTMLInputElement).value)"
					@blur="handleOpacityBlur"
				/>
			</div>
		</div>

		<!-- Background Color -->
		<div class="space-y-1.5">
			<label class="text-zinc-500 text-xs">Background</label>
			<div class="flex items-center gap-2">
				<input
					type="color"
					:value="element.backgroundColor === 'transparent' ? '#000000' : element.backgroundColor"
					class="h-8 w-8 cursor-pointer rounded border-0"
					:class="element.backgroundColor === 'transparent' && 'opacity-50'"
					@input="(e) => update({ backgroundColor: (e.target as HTMLInputElement).value })"
				/>
				<Button
					variant="outline"
					size="sm"
					:class="element.backgroundColor === 'transparent' && 'border-primary text-primary'"
					@click="update({ backgroundColor: element.backgroundColor === 'transparent' ? '#000000' : 'transparent' })"
				>
					{{ element.backgroundColor === 'transparent' ? 'Add BG' : 'Remove BG' }}
				</Button>
			</div>
		</div>
	</div>
</template>
