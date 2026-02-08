<script setup lang="ts">
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import { X } from "lucide-vue-next";

interface ShortcutDef {
	action: string;
	description: string;
	keys: string[];
	category: string;
}

defineProps<{
	open: boolean;
}>();

const emit = defineEmits<{
	(e: "update:open", value: boolean): void;
}>();

const shortcutsList: ShortcutDef[] = [
	{ action: "toggle-play", description: "Play / Pause", keys: ["Space"], category: "Playback" },
	{ action: "seek-forward", description: "Seek forward 1s", keys: ["→"], category: "Playback" },
	{ action: "seek-backward", description: "Seek backward 1s", keys: ["←"], category: "Playback" },
	{ action: "jump-forward", description: "Jump forward 5s", keys: ["Shift+→"], category: "Playback" },
	{ action: "jump-backward", description: "Jump backward 5s", keys: ["Shift+←"], category: "Playback" },
	{ action: "frame-step-forward", description: "Next frame", keys: ["."], category: "Playback" },
	{ action: "frame-step-backward", description: "Previous frame", keys: [","], category: "Playback" },
	{ action: "goto-start", description: "Go to start", keys: ["Home"], category: "Playback" },
	{ action: "goto-end", description: "Go to end", keys: ["End"], category: "Playback" },
	{ action: "split", description: "Split at playhead", keys: ["S"], category: "Editing" },
	{ action: "delete-selected", description: "Delete selected", keys: ["Delete", "Backspace"], category: "Editing" },
	{ action: "select-all", description: "Select all", keys: ["Ctrl+A"], category: "Editing" },
	{ action: "duplicate-selected", description: "Duplicate", keys: ["Ctrl+D"], category: "Editing" },
	{ action: "copy-selected", description: "Copy", keys: ["Ctrl+C"], category: "Editing" },
	{ action: "paste-copied", description: "Paste", keys: ["Ctrl+V"], category: "Editing" },
	{ action: "undo", description: "Undo", keys: ["Ctrl+Z"], category: "History" },
	{ action: "redo", description: "Redo", keys: ["Ctrl+Shift+Z", "Ctrl+Y"], category: "History" },
	{ action: "toggle-muted", description: "Toggle mute", keys: ["M"], category: "Editing" },
	{ action: "toggle-bookmark", description: "Toggle bookmark", keys: ["B"], category: "Editing" },
];

const categories = computed(() => {
	const cats = new Set(shortcutsList.map((s) => s.category));
	return Array.from(cats);
});

function shortcutsForCategory(category: string) {
	return shortcutsList.filter((s) => s.category === category);
}

function close() {
	emit("update:open", false);
}
</script>

<template>
	<Teleport to="body">
		<div v-if="open" class="fixed inset-0 z-50 flex items-center justify-center bg-black/50" @click.self="close">
			<div class="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-lg border border-white/10 bg-[#1e1e22] text-zinc-200 shadow-lg">
				<!-- Header -->
				<div class="flex items-center justify-between border-b border-white/10 px-6 py-4">
					<h2 class="text-lg font-medium">Keyboard shortcuts</h2>
					<Button variant="ghost" size="icon" @click="close">
						<X class="size-4" />
					</Button>
				</div>

				<!-- Body -->
				<div class="flex-1 overflow-y-auto px-6 py-4">
					<div class="flex flex-col gap-6">
						<div v-for="category in categories" :key="category" class="flex flex-col gap-1">
							<h3 class="text-zinc-500 text-xs font-medium uppercase tracking-wide">
								{{ category }}
							</h3>
							<div class="flex flex-col gap-1">
								<div
									v-for="shortcut in shortcutsForCategory(category)"
									:key="shortcut.action"
									class="flex items-center justify-between py-1"
								>
									<span class="text-sm">{{ shortcut.description }}</span>
									<div class="flex items-center gap-2">
										<template v-for="(key, index) in shortcut.keys" :key="`${shortcut.action}-${index}`">
											<div class="flex items-center gap-1">
												<Button
													v-for="(part, partIndex) in key.split('+')"
													:key="`${shortcut.action}-${index}-${partIndex}`"
													variant="outline"
													size="sm"
													class="h-7 min-w-[2rem] cursor-default px-2 text-xs"
												>
													{{ part }}
												</Button>
											</div>
											<span v-if="index < shortcut.keys.length - 1" class="text-zinc-500 text-xs">or</span>
										</template>
									</div>
								</div>
							</div>
						</div>
					</div>
				</div>

				<!-- Footer -->
				<div class="flex justify-end border-t border-white/10 px-6 py-4">
					<Button variant="outline" @click="close">
						Close
					</Button>
				</div>
			</div>
		</div>
	</Teleport>
</template>
