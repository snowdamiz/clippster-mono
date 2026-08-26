<script setup lang="ts">
import { computed, ref } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import type { BlendMode } from "../../types/timeline";
import {
	Eye,
	EyeOff,
	Lock,
	Unlock,
	Trash2,
	Type,
	ImageIcon,
	Film,
	Smile,
	Wand2,
	ChevronUp,
	ChevronDown,
	ChevronRight,
	Layers,
	Copy,
} from "lucide-vue-next";

const { editor, version } = useEditor();
const { selectedElements, selectElement } = useElementSelection();

const BLEND_MODES: BlendMode[] = [
	"normal",
	"multiply",
	"screen",
	"overlay",
	"darken",
	"lighten",
	"color-dodge",
	"color-burn",
	"hard-light",
	"soft-light",
	"difference",
	"exclusion",
];

const renamingId = ref<string | null>(null);
const renameValue = ref("");
const collapsedLayerGroups = ref<Set<string>>(new Set());

interface LayerRow {
	elementId: string;
	name: string;
	type: string;
	trackId: string;
	trackIndex: number;
	trackName: string;
	selected: boolean;
	hidden: boolean;
	locked: boolean;
	opacity: number;
	blendMode: BlendMode;
	groupId: string | null;
}

const allElements = computed((): LayerRow[] => {
	void version.value;
	const tracks = editor.timeline.getTracks();
	const elements: LayerRow[] = [];

	[...tracks].reverse().forEach((track, reverseIndex) => {
		const trackIndex = tracks.length - 1 - reverseIndex;
		for (const el of [...track.elements].reverse()) {
			elements.push({
				elementId: el.id,
				name: el.name || el.type,
				type: el.type,
				trackId: track.id,
				trackIndex,
				trackName: track.name || `Group ${trackIndex + 1}`,
				selected: selectedElements.value.some((s) => s.elementId === el.id),
				hidden: !!(el as { hidden?: boolean }).hidden || !!(track as { hidden?: boolean }).hidden,
				locked: !!(el as { locked?: boolean }).locked || !!track.locked,
				opacity: typeof (el as { opacity?: number }).opacity === "number"
					? (el as { opacity: number }).opacity
					: 1,
				blendMode: ((el as { blendMode?: BlendMode }).blendMode || "normal") as BlendMode,
				groupId: (el as { groupId?: string | null }).groupId ?? null,
			});
		}
	});

	return elements;
});

function handleToggleElementLock(trackId: string, elementId: string, type: string, currentlyLocked: boolean) {
	const updates = { locked: !currentlyLocked };
	if (type === "text") {
		editor.timeline.updateTextElement({ trackId, elementId, updates: updates as any });
	} else {
		editor.timeline.updateElement({ trackId, elementId, updates: updates as any });
	}
}

function createGroupFromSelection() {
	const selected = allElements.value.filter((el) => el.selected);
	if (selected.length < 2) return;
	const groupId = `group_${Date.now()}`;
	for (const el of selected) {
		if (el.type === "text") {
			editor.timeline.updateTextElement({
				trackId: el.trackId,
				elementId: el.elementId,
				updates: { groupId, name: el.name } as any,
			});
		} else {
			editor.timeline.updateElement({
				trackId: el.trackId,
				elementId: el.elementId,
				updates: { groupId } as any,
			});
		}
	}
}

function ungroupSelection() {
	const selected = allElements.value.filter((el) => el.selected && el.groupId);
	for (const el of selected) {
		if (el.type === "text") {
			editor.timeline.updateTextElement({
				trackId: el.trackId,
				elementId: el.elementId,
				updates: { groupId: null } as any,
			});
		} else {
			editor.timeline.updateElement({
				trackId: el.trackId,
				elementId: el.elementId,
				updates: { groupId: null } as any,
			});
		}
	}
}

const groupedLayers = computed(() => {
	const groups: Array<{ trackId: string; trackName: string; locked: boolean; layers: LayerRow[] }> = [];
	for (const el of allElements.value) {
		const existing = groups.find((g) => g.trackId === el.trackId);
		if (existing) {
			existing.layers.push(el);
		} else {
			groups.push({
				trackId: el.trackId,
				trackName: el.trackName,
				locked: el.locked,
				layers: [el],
			});
		}
	}
	return groups;
});

function splitTrackLayers(layers: LayerRow[]) {
	const ungrouped = layers.filter((l) => !l.groupId);
	const groupIds = [...new Set(layers.filter((l) => l.groupId).map((l) => l.groupId!))];
	const clusters = groupIds.map((groupId) => ({
		groupId,
		layers: layers.filter((l) => l.groupId === groupId),
	}));
	return { ungrouped, clusters };
}

function isGroupCollapsed(groupId: string) {
	return collapsedLayerGroups.value.has(groupId);
}

function toggleLayerGroupCollapse(groupId: string) {
	const next = new Set(collapsedLayerGroups.value);
	if (next.has(groupId)) next.delete(groupId);
	else next.add(groupId);
	collapsedLayerGroups.value = next;
}

function displayTrackLayers(layers: LayerRow[]) {
	const { ungrouped, clusters } = splitTrackLayers(layers);
	const out: Array<
		{ kind: "group-header"; groupId: string; count: number } | { kind: "layer"; layer: LayerRow }
	> = [];
	for (const layer of ungrouped) {
		out.push({ kind: "layer", layer });
	}
	for (const cluster of clusters) {
		out.push({ kind: "group-header", groupId: cluster.groupId, count: cluster.layers.length });
		if (!isGroupCollapsed(cluster.groupId)) {
			for (const layer of cluster.layers) {
				out.push({ kind: "layer", layer });
			}
		}
	}
	return out;
}

const selectedLayer = computed(() => allElements.value.find((el) => el.selected) ?? null);

function getTypeIcon(type: string) {
	switch (type) {
		case "text":
			return Type;
		case "image":
			return ImageIcon;
		case "video":
			return Film;
		case "sticker":
			return Smile;
		case "effect":
			return Wand2;
		default:
			return Layers;
	}
}

function getTypeColor(type: string) {
	switch (type) {
		case "text":
			return "text-blue-400";
		case "image":
			return "text-emerald-400";
		case "video":
			return "text-purple-400";
		case "sticker":
			return "text-amber-400";
		case "effect":
			return "text-pink-400";
		default:
			return "text-zinc-400";
	}
}

function handleSelect(trackId: string, elementId: string) {
	selectElement({ trackId, elementId });
}

function handleDelete(trackId: string, elementId: string) {
	editor.timeline.deleteElements({ elements: [{ trackId, elementId }] });
}

function handleToggleVisibility(trackId: string, elementId: string) {
	editor.timeline.toggleElementsVisibility({ elements: [{ trackId, elementId }] });
}

function handleToggleLock(trackId: string) {
	editor.timeline.toggleTrackLock({ trackId });
}

function handleDuplicate(trackId: string, elementId: string) {
	editor.timeline.duplicateElements({ elements: [{ trackId, elementId }] });
}

function handleMove(trackId: string, direction: "up" | "down", elementId?: string) {
	const tracks = editor.timeline.getTracks();
	const trackIndex = tracks.findIndex((t) => t.id === trackId);
	if (trackIndex < 0) return;

	// Panel top = higher track index; "up" in UI increases track index
	const newIndex = direction === "up" ? trackIndex + 1 : trackIndex - 1;
	if (newIndex < 0 || newIndex >= tracks.length) return;

	const sourceTrack = tracks[trackIndex];
	if (!sourceTrack) return;

	// Single-element track: reorder the whole track (typical image-mode stack)
	if (!elementId || sourceTrack.elements.length <= 1) {
		editor.timeline.reorderTrack({ trackId, newIndex });
		return;
	}

	// Multi-element track: lift this element onto its own track at the target index
	const element = sourceTrack.elements.find((el) => el.id === elementId);
	if (!element) {
		editor.timeline.reorderTrack({ trackId, newIndex });
		return;
	}

	const newTrackId = `track_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	editor.timeline.moveElement({
		sourceTrackId: trackId,
		targetTrackId: newTrackId,
		elementId,
		newStartTime: element.startTime,
		createTrack: { type: sourceTrack.type, index: newIndex },
	});
}

function startRename(el: LayerRow) {
	renamingId.value = el.elementId;
	renameValue.value = el.name;
}

function commitRename(trackId: string, elementId: string, type: string) {
	const name = renameValue.value.trim();
	if (name) {
		if (type === "text") {
			editor.timeline.updateTextElement({
				trackId,
				elementId,
				updates: { name } as any,
			});
		} else {
			editor.timeline.updateElement({
				trackId,
				elementId,
				updates: { name } as any,
			});
		}
	}
	renamingId.value = null;
}

function setOpacity(trackId: string, elementId: string, type: string, opacity: number) {
	if (type === "text") {
		editor.timeline.updateTextElement({
			trackId,
			elementId,
			updates: { opacity },
		});
	} else {
		editor.timeline.updateElement({
			trackId,
			elementId,
			updates: { opacity } as any,
		});
	}
}

function setBlendMode(trackId: string, elementId: string, type: string, blendMode: BlendMode) {
	if (type === "text") {
		editor.timeline.updateTextElement({
			trackId,
			elementId,
			updates: { blendMode },
		});
	} else {
		editor.timeline.updateElement({
			trackId,
			elementId,
			updates: { blendMode } as any,
		});
	}
}
</script>

<template>
	<div class="flex h-full flex-col">
		<!-- Header -->
		<div class="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
			<div class="flex items-center gap-1.5">
				<Layers class="size-3.5 text-zinc-500" />
				<span class="text-[11px] font-medium text-zinc-400 uppercase tracking-wider">Layers</span>
			</div>
			<div class="flex items-center gap-1">
				<button
					type="button"
					class="rounded px-1.5 py-0.5 text-[9px] text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
					title="Group selected layers"
					@click="createGroupFromSelection"
				>
					Group
				</button>
				<button
					type="button"
					class="rounded px-1.5 py-0.5 text-[9px] text-zinc-500 hover:bg-white/5 hover:text-zinc-300"
					title="Ungroup selected layers"
					@click="ungroupSelection"
				>
					Ungroup
				</button>
				<span class="text-[10px] text-zinc-600">{{ allElements.length }}</span>
			</div>
		</div>

		<!-- Layer list -->
		<div class="flex-1 overflow-y-auto">
			<div v-if="allElements.length === 0" class="flex flex-col items-center justify-center py-10 px-4">
				<Layers class="size-8 text-zinc-700 mb-2" :stroke-width="1" />
				<p class="text-[11px] text-zinc-600 text-center">No layers yet</p>
				<p class="text-[10px] text-zinc-700 text-center mt-0.5">Add text, images, or stickers from the left panel</p>
			</div>

			<div v-else class="py-1">
				<div v-for="group in groupedLayers" :key="group.trackId" class="mb-1">
					<div class="flex items-center gap-1 px-2 py-1 text-[9px] uppercase tracking-wider text-zinc-600">
						<span class="truncate">{{ group.trackName }}</span>
						<span
							v-if="group.layers.some((l) => l.groupId)"
							class="rounded bg-blue-500/20 px-1 text-[8px] text-blue-300"
						>G</span>
						<button
							type="button"
							class="ml-auto rounded p-0.5 hover:text-zinc-300"
							:title="group.locked ? 'Unlock group' : 'Lock group'"
							@click="handleToggleLock(group.trackId)"
						>
							<Lock v-if="group.locked" class="size-2.5" />
							<Unlock v-else class="size-2.5" />
						</button>
					</div>
					<template v-for="item in displayTrackLayers(group.layers)" :key="item.kind === 'layer' ? item.layer.elementId : `hdr-${item.groupId}`">
						<button
							v-if="item.kind === 'group-header'"
							type="button"
							class="flex w-full items-center gap-1 px-2 py-1 text-left text-[10px] text-blue-300/90 hover:bg-white/[0.03]"
							@click="toggleLayerGroupCollapse(item.groupId)"
						>
							<ChevronRight v-if="isGroupCollapsed(item.groupId)" class="size-3 shrink-0" />
							<ChevronDown v-else class="size-3 shrink-0" />
							<span class="truncate">Group · {{ item.count }} layers</span>
						</button>
						<div
							v-else
							:class="[
								'group flex w-full items-center gap-1.5 px-2 py-[5px] text-left transition-colors',
								item.layer.selected
									? 'bg-blue-500/10 border-l-2 border-blue-500'
									: 'border-l-2 border-transparent hover:bg-white/[0.03]',
								item.layer.hidden ? 'opacity-50' : '',
							]"
						>
					<button
						type="button"
						class="shrink-0 rounded p-0.5 text-zinc-600 hover:text-zinc-300"
						:title="item.layer.hidden ? 'Show' : 'Hide'"
						@click.stop="handleToggleVisibility(item.layer.trackId, item.layer.elementId)"
					>
						<EyeOff v-if="item.layer.hidden" class="size-3" />
						<Eye v-else class="size-3" />
					</button>
					<button
						type="button"
						class="shrink-0 rounded p-0.5 text-zinc-600 hover:text-zinc-300"
						:title="item.layer.locked ? 'Unlock' : 'Lock'"
						@click.stop="handleToggleElementLock(item.layer.trackId, item.layer.elementId, item.layer.type, item.layer.locked)"
					>
						<Lock v-if="item.layer.locked" class="size-3" />
						<Unlock v-else class="size-3" />
					</button>

					<button
						type="button"
						class="flex min-w-0 flex-1 items-center gap-1.5"
						@click="handleSelect(item.layer.trackId, item.layer.elementId)"
						@dblclick="startRename(item.layer)"
					>
						<component
							:is="getTypeIcon(item.layer.type)"
							:class="['size-3.5 shrink-0', item.layer.selected ? 'text-blue-400' : getTypeColor(item.layer.type)]"
						/>
						<input
							v-if="renamingId === item.layer.elementId"
							v-model="renameValue"
							class="min-w-0 flex-1 rounded bg-zinc-800 px-1 text-[11px] text-zinc-100 outline-none"
							@click.stop
							@keydown.enter="commitRename(item.layer.trackId, item.layer.elementId, item.layer.type)"
							@keydown.escape="renamingId = null"
							@blur="commitRename(item.layer.trackId, item.layer.elementId, item.layer.type)"
						/>
						<span
							v-else
							:class="[
								'min-w-0 flex-1 truncate text-[11px]',
								item.layer.selected ? 'text-zinc-200' : 'text-zinc-400',
							]"
						>
							{{ item.layer.name }}
						</span>
					</button>

					<div class="hidden shrink-0 items-center gap-0.5 group-hover:flex">
						<button
							type="button"
							class="rounded p-0.5 text-zinc-600 hover:text-zinc-300"
							title="Move up"
							@click.stop="handleMove(item.layer.trackId, 'up', item.layer.elementId)"
						>
							<ChevronUp class="size-3" />
						</button>
						<button
							type="button"
							class="rounded p-0.5 text-zinc-600 hover:text-zinc-300"
							title="Move down"
							@click.stop="handleMove(item.layer.trackId, 'down', item.layer.elementId)"
						>
							<ChevronDown class="size-3" />
						</button>
						<button
							type="button"
							class="rounded p-0.5 text-zinc-600 hover:text-zinc-300"
							title="Duplicate"
							@click.stop="handleDuplicate(item.layer.trackId, item.layer.elementId)"
						>
							<Copy class="size-3" />
						</button>
						<button
							type="button"
							class="rounded p-0.5 text-zinc-600 hover:text-red-400"
							title="Delete"
							@click.stop="handleDelete(item.layer.trackId, item.layer.elementId)"
						>
							<Trash2 class="size-3" />
						</button>
						</div>
					</div>
					</template>
				</div>
			</div>
		</div>

		<!-- Selected layer properties -->
		<div
			v-if="selectedLayer"
			class="space-y-2 border-t border-white/[0.06] px-3 py-2"
		>
			<div class="flex items-center justify-between gap-2">
				<span class="text-[10px] text-zinc-500 uppercase tracking-wider">Opacity</span>
				<span class="text-[10px] tabular-nums text-zinc-400">{{ Math.round(selectedLayer.opacity * 100) }}%</span>
			</div>
			<input
				type="range"
				min="0"
				max="1"
				step="0.01"
				:value="selectedLayer.opacity"
				class="w-full accent-blue-500"
				@input="setOpacity(selectedLayer.trackId, selectedLayer.elementId, selectedLayer.type, Number(($event.target as HTMLInputElement).value))"
			/>
			<div class="flex items-center justify-between gap-2">
				<span class="text-[10px] text-zinc-500 uppercase tracking-wider">Blend</span>
				<select
					class="max-w-[140px] rounded border border-white/10 bg-zinc-900 px-1.5 py-1 text-[10px] text-zinc-300 outline-none"
					:value="selectedLayer.blendMode"
					@change="setBlendMode(selectedLayer.trackId, selectedLayer.elementId, selectedLayer.type, ($event.target as HTMLSelectElement).value as BlendMode)"
				>
					<option v-for="mode in BLEND_MODES" :key="mode" :value="mode">
						{{ mode }}
					</option>
				</select>
			</div>
		</div>
	</div>
</template>
