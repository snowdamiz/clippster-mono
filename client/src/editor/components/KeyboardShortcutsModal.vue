<script setup lang="ts">
import { computed } from "vue";
import { ACTIONS, type TActionDefinition, type TActionCategory } from "../lib/actions/definitions";
import { X } from "lucide-vue-next";
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
	<Teleport to="body">
		<div
			v-if="open"
			class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
			role="dialog"
			aria-modal="true"
			aria-labelledby="keyboard-shortcuts-title"
			@click.self="emit('close')"
			@keydown.esc="emit('close')"
		>
			<div class="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-[#1c1c1e] p-6 shadow-2xl">
				<button
					type="button"
					class="absolute top-3 right-3 rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
					aria-label="Close keyboard shortcuts"
					@click="emit('close')"
				>
					<X class="size-4" />
				</button>

				<h2 id="keyboard-shortcuts-title" class="mb-4 text-lg font-semibold text-white">Keyboard Shortcuts</h2>

				<div v-for="cat in categories" :key="cat.key" class="mb-4">
					<template v-if="groupedActions[cat.key]?.length">
						<h3 class="mb-1.5 text-xs font-medium uppercase tracking-wider text-zinc-500">{{ cat.label }}</h3>
						<div class="space-y-1">
							<div
								v-for="item in groupedActions[cat.key]"
								:key="item.action"
								class="flex items-center justify-between rounded px-2 py-1 text-sm hover:bg-white/5"
							>
								<span class="text-zinc-300">{{ item.def.description }}</span>
								<div class="flex gap-1">
									<kbd
										v-for="(shortcut, idx) in shortcutsFor(item.action, item.def)"
										:key="idx"
										class="rounded border border-white/10 bg-white/5 px-1.5 py-0.5 font-mono text-xs text-zinc-400"
									>
										{{ formatShortcut(shortcut) }}
									</kbd>
								</div>
							</div>
						</div>
					</template>
				</div>
			</div>
		</div>
	</Teleport>
</template>
