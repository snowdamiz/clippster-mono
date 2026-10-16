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
import { LayoutTemplate, SearchX } from "lucide-vue-next";
import { EmptyState } from "@/components/ui/empty-state";
import { AssetGrid, AssetTile, OptionChip } from "../shared";
import PanelSearchBar from "./PanelSearchBar.vue";

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
		<PanelSearchBar v-model="searchQuery" placeholder="Search templates…" />

		<!-- Category filter -->
		<div
			class="flex shrink-0 flex-wrap gap-1 border-b border-line-subtle px-3 py-1.5"
			role="group"
			aria-label="Template category"
		>
			<OptionChip
				v-for="cat in TEMPLATE_CATEGORIES"
				:key="cat.value"
				variant="ghost"
				:active="activeCategory === cat.value"
				@click="activeCategory = cat.value"
			>
				{{ cat.label }}
			</OptionChip>
		</div>

		<!-- Template grid -->
		<div class="flex-1 overflow-y-auto p-3">
			<EmptyState
				v-if="filteredTemplates.length === 0"
				size="sm"
				:icon="SearchX"
				title="No templates found"
				description="Try a different search or category."
			/>
			<AssetGrid v-else :min="100">
				<AssetTile
					v-for="template in filteredTemplates"
					:key="template.id"
					aspect="16/10"
					:label="template.name"
					:sublabel="template.description"
					:title="`Use the ${template.name} template`"
					@click="applyTemplate(template)"
				>
					<!-- Preview: the template's own background and type (content, not chrome) -->
					<div class="flex size-full items-center justify-center" :style="getPreviewStyle(template)">
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
					</div>

					<template #overlay>
						<span class="tabular absolute bottom-1 right-1 rounded bg-black/60 px-1 text-2xs leading-4 text-white">
							{{ getAspectLabel(template.canvasWidth, template.canvasHeight) }}
						</span>
					</template>
				</AssetTile>
			</AssetGrid>
		</div>
	</div>
</template>
