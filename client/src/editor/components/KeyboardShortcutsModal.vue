<script setup lang="ts">
import { computed } from "vue";
import { ACTIONS, type TActionDefinition, type TActionCategory } from "../lib/actions/definitions";
import { Keyboard } from "lucide-vue-next";
import { Modal } from "@/components/ui/modal";
import { useImageMode } from "../composables/useImageMode";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const { isImageMode } = useImageMode();

const allCategories: { key: TActionCategory; label: string }[] = [
	{ key: "playback", label: "Playback" },
	{ key: "navigation", label: "Navigation" },
	{ key: "editing", label: "Editing" },
	{ key: "selection", label: "Selection" },
	{ key: "history", label: "History" },
	{ key: "timeline", label: "Timeline" },
	{ key: "controls", label: "Controls" },
];

const categories = computed(() =>
	isImageMode.value
		? allCategories.filter((c) => c.key !== "playback" && c.key !== "timeline")
		: allCategories,
);

const supplementalShortcuts: Partial<Record<string, string[]>> = {
	"toggle-elements-muted-selected": ["m"],
	"toggle-bookmark": ["b"],
};

const groupedActions = computed(() => {
	const groups: Record<string, Array<{ action: string; def: TActionDefinition }>> = {};
	for (const [action, def] of Object.entries(ACTIONS) as [string, TActionDefinition][]) {
		if ((!def.defaultShortcuts || def.defaultShortcuts.length === 0) && !supplementalShortcuts[action]) continue;
		const cat = def.category;
		if (!groups[cat]) groups[cat] = [];
		groups[cat].push({ action, def });
	}
	return groups;
});

function formatShortcut(s: string): string {
	const labels: Record<string, string> = {
		ctrl: "Ctrl",
		shift: "Shift",
		alt: "Alt",
		space: "Space",
		backspace: "Backspace",
		delete: "Delete",
		left: "←",
		right: "→",
		home: "Home",
		end: "End",
		enter: "Enter",
	};
	return s
		.split("+")
		.map((part) => labels[part] ?? part.toUpperCase())
		.join(" + ");
}

function shortcutsFor(action: string, def: TActionDefinition): string[] {
	return [...(def.defaultShortcuts ?? []), ...(supplementalShortcuts[action] ?? [])];
}
</script>

<template>
	<Modal
		:open="open"
		title="Keyboard shortcuts"
		:description="isImageMode ? 'Shortcuts for the image editor.' : 'Shortcuts for the video editor and timeline.'"
		:icon="Keyboard"
		size="lg"
		body-class="!pt-2"
		@update:open="(value) => { if (!value) emit('close'); }"
	>
		<div class="flex flex-col gap-4">
			<template v-for="cat in categories" :key="cat.key">
				<section v-if="groupedActions[cat.key]?.length" class="flex flex-col gap-1">
					<h3 class="eyebrow px-1 pb-1">{{ cat.label }}</h3>
					<div class="overflow-hidden rounded-[var(--radius-card)] border border-line-subtle bg-surface">
						<div
							v-for="item in groupedActions[cat.key]"
							:key="item.action"
							class="flex min-h-9 items-center justify-between gap-4 border-b border-line-subtle px-3 py-1.5 last:border-b-0"
						>
							<span class="text-sm text-fg">{{ item.def.description }}</span>
							<span class="flex shrink-0 items-center gap-1">
								<kbd
									v-for="(shortcut, idx) in shortcutsFor(item.action, item.def)"
									:key="idx"
									class="inline-flex h-5 min-w-5 items-center justify-center rounded border border-line-strong bg-surface-raised px-1.5 text-2xs font-medium text-fg shadow-[0_1px_0_var(--line-strong)]"
								>
									{{ formatShortcut(shortcut) }}
								</kbd>
							</span>
						</div>
					</div>
				</section>
			</template>
		</div>
	</Modal>
</template>
