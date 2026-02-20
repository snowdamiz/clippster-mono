<script setup lang="ts">
import { ref, computed } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { DEFAULT_TEXT_ELEMENT } from "../../../constants/text-constants";
import { buildTextElement } from "../../../lib/timeline/element-utils";
import {
	IMAGE_TEMPLATES,
	TEMPLATE_CATEGORIES,
	type ImageTemplate,
	type TemplateCategory,
} from "../../../constants/image-templates";
import { LayoutTemplate, Search } from "lucide-vue-next";

const { editor } = useEditor();

const activeCategory = ref<TemplateCategory | "all">("all");
const searchQuery = ref("");

const filteredTemplates = computed(() => {
	let templates = IMAGE_TEMPLATES;
	if (activeCategory.value !== "all") {
		templates = templates.filter((t) => t.category === activeCategory.value);
	}
	if (searchQuery.value.trim()) {
		const q = searchQuery.value.toLowerCase();
		templates = templates.filter(
			(t) =>
				t.name.toLowerCase().includes(q) ||
				t.description.toLowerCase().includes(q),
		);
	}
	return templates;
});

function applyTemplate(template: ImageTemplate) {
	// Update canvas size and background
	editor.project.updateSettings({
		settings: {
			canvasSize: { width: template.canvasWidth, height: template.canvasHeight },
			background: { type: "color", color: template.backgroundColor },
		},
	});

	// Add text elements from template
	for (const textEl of template.textElements) {
		const merged = {
			...DEFAULT_TEXT_ELEMENT,
			content: textEl.content,
			fontSize: textEl.fontSize,
			fontFamily: textEl.fontFamily,
			fontWeight: textEl.fontWeight as any,
			color: textEl.color,
			textAlign: textEl.textAlign,
			letterSpacing: textEl.letterSpacing || 0,
			textCase: textEl.textCase || ("none" as const),
			transform: {
				scale: 1,
				position: textEl.position,
				rotate: 0,
			},
			stroke: textEl.stroke,
			shadow: textEl.shadow,
			gradient: textEl.gradient,
		};

		const element = buildTextElement({ raw: merged, startTime: 0 });
		editor.timeline.insertElement({
			element,
			placement: { mode: "auto" },
		});
	}
}

function getPreviewStyle(template: ImageTemplate): Record<string, string> {
	const style: Record<string, string> = {};
	if (template.previewGradient) {
		style.background = template.previewGradient;
	} else {
		style.backgroundColor = template.backgroundColor;
	}
	return style;
}

function getAspectLabel(w: number, h: number): string {
	if (w === 1280 && h === 720) return "16:9";
	if (w === 1920 && h === 1080) return "16:9";
	if (w === 1080 && h === 1920) return "9:16";
	if (w === 1080 && h === 1080) return "1:1";
	if (w === 1080 && h === 1350) return "4:5";
	if (w === 1500 && h === 500) return "3:1";
	return `${w}×${h}`;
}
</script>

<template>
	<div class="flex h-full flex-col">
		<!-- Search -->
		<div class="flex items-center gap-2 border-b border-white/10 px-3 py-2">
			<Search class="size-3.5 text-zinc-500" />
			<input
				v-model="searchQuery"
				type="text"
				placeholder="Search templates..."
				class="flex-1 bg-transparent text-xs text-zinc-200 outline-none placeholder:text-zinc-600"
			/>
		</div>

		<!-- Category tabs -->
		<div class="flex items-center gap-0.5 overflow-x-auto border-b border-white/10 px-2 py-1 scrollbar-hidden">
			<button
				v-for="cat in TEMPLATE_CATEGORIES"
				:key="cat.value"
				type="button"
				:class="[
					'whitespace-nowrap rounded px-2 py-1 text-[10px] font-medium transition-colors',
					activeCategory === cat.value
						? 'bg-purple-600/20 text-purple-400'
						: 'text-zinc-500 hover:text-zinc-300',
				]"
				@click="activeCategory = cat.value"
			>
				{{ cat.label }}
			</button>
		</div>

		<!-- Template grid -->
		<div class="flex-1 overflow-y-auto p-2">
			<div v-if="filteredTemplates.length === 0" class="flex items-center justify-center h-20 text-zinc-600 text-xs">
				No templates found
			</div>
			<div
				v-else
				class="grid gap-2"
				style="grid-template-columns: repeat(auto-fill, minmax(100px, 1fr))"
			>
				<button
					v-for="template in filteredTemplates"
					:key="template.id"
					type="button"
					class="group relative overflow-hidden rounded-lg border border-white/10 text-left transition-all hover:border-purple-500/50 hover:shadow-lg hover:shadow-purple-500/10"
					@click="applyTemplate(template)"
				>
					<!-- Preview -->
					<div
						class="relative flex items-center justify-center overflow-hidden"
						:style="{ ...getPreviewStyle(template), aspectRatio: '16/10' }"
					>
						<!-- Mini text preview -->
						<div class="flex flex-col items-center gap-0.5 px-2">
							<span
								v-for="(textEl, i) in template.textElements.slice(0, 2)"
								:key="i"
								class="truncate text-center leading-tight"
								:style="{
									fontSize: Math.min(textEl.fontSize / 8, 11) + 'px',
									fontWeight: textEl.fontWeight,
									color: textEl.color,
									letterSpacing: textEl.letterSpacing ? Math.min(textEl.letterSpacing, 2) + 'px' : undefined,
									textTransform: textEl.textCase === 'uppercase' ? 'uppercase' : 'none',
								}"
							>
								{{ textEl.content.slice(0, 20) }}
							</span>
							<LayoutTemplate v-if="template.textElements.length === 0" class="size-5 text-white/20" />
						</div>

						<!-- Aspect badge -->
						<div class="absolute right-1 bottom-1 rounded bg-black/60 px-1 text-[8px] text-white/70">
							{{ getAspectLabel(template.canvasWidth, template.canvasHeight) }}
						</div>
					</div>

					<!-- Name -->
					<div class="px-2 py-1.5">
						<div class="truncate text-[10px] font-medium text-zinc-300">{{ template.name }}</div>
						<div class="truncate text-[9px] text-zinc-600">{{ template.description }}</div>
					</div>

					<!-- Hover overlay -->
					<div class="absolute inset-0 hidden items-center justify-center bg-black/40 group-hover:flex">
						<span class="rounded bg-purple-600 px-2 py-1 text-[10px] font-medium text-white">Use Template</span>
					</div>
				</button>
			</div>
		</div>
	</div>
</template>
