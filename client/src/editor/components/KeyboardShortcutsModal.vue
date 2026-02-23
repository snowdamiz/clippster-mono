<script setup lang="ts">
import { computed } from "vue";
import { ACTIONS, type TActionDefinition, type TActionCategory } from "../lib/actions/definitions";
import { X } from "lucide-vue-next";

defineProps<{ open: boolean }>();
const emit = defineEmits<{ (e: "close"): void }>();

const categories: { key: TActionCategory; label: string }[] = [
	{ key: "playback", label: "Playback" },
	{ key: "navigation", label: "Navigation" },
	{ key: "editing", label: "Editing" },
	{ key: "selection", label: "Selection" },
	{ key: "history", label: "History" },
	{ key: "timeline", label: "Timeline" },
	{ key: "controls", label: "Controls" },
];

const groupedActions = computed(() => {
	const groups: Record<string, Array<{ action: string; def: TActionDefinition }>> = {};
	for (const [action, def] of Object.entries(ACTIONS) as [string, TActionDefinition][]) {
		if (!def.defaultShortcuts || def.defaultShortcuts.length === 0) continue;
		const cat = def.category;
		if (!groups[cat]) groups[cat] = [];
		groups[cat].push({ action, def });
	}
	return groups;
});

function formatShortcut(s: string): string {
	return s
		.replace("ctrl+", "Ctrl + ")
		.replace("shift+", "Shift + ")
		.replace("alt+", "Alt + ")
		.replace("space", "Space")
		.replace("backspace", "Backspace")
		.replace("delete", "Delete")
		.replace("left", "←")
		.replace("right", "→")
		.replace("home", "Home")
		.replace("end", "End")
		.replace("enter", "Enter");
}
</script>

<template>
	<Teleport to="body">
		<div
			v-if="open"
			class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60"
			@click.self="emit('close')"
		>
			<div class="relative max-h-[80vh] w-full max-w-lg overflow-y-auto rounded-xl border border-white/10 bg-[#1c1c1e] p-6 shadow-2xl">
				<button
					type="button"
					class="absolute top-3 right-3 rounded p-1 text-zinc-400 hover:bg-white/10 hover:text-white"
					@click="emit('close')"
				>
					<X class="size-4" />
				</button>

				<h2 class="mb-4 text-lg font-semibold text-white">Keyboard Shortcuts</h2>

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
										v-for="(shortcut, idx) in item.def.defaultShortcuts"
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
