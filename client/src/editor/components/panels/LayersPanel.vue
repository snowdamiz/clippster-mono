<script setup lang="ts">
import { computed, ref } from "vue";
import { useEditor } from "../../composables/useEditor";
import { useElementSelection } from "../../composables/timeline/element/useElementSelection";
import { useImageMode } from "../../composables/useImageMode";
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
	Group,
	Ungroup,
} from "lucide-vue-next";
import PanelHeader from "../chrome/PanelHeader.vue";
import ToolbarButton from "../chrome/ToolbarButton.vue";
import InspectorSelect from "./shared/InspectorSelect.vue";
import NumberBox from "./shared/NumberBox.vue";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

const { editor, version } = useEditor();
const { selectedElements, selectElement } = useElementSelection();
const { isImageMode } = useImageMode();

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

const BLEND_MODE_OPTIONS = BLEND_MODES.map((mode) => ({
	value: mode,
	label: mode.charAt(0).toUpperCase() + mode.slice(1).replace("-", " "),
}));

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

const displayLayerGroups = computed(() => {
	if (!isImageMode.value) return groupedLayers.value;
	return [
		{
			trackId: "_stack",
			trackName: "",
			locked: false,
			layers: allElements.value,
		},
	];
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
const canGroup = computed(() => allElements.value.filter((el) => el.selected).length >= 2);
const canUngroup = computed(() => allElements.value.some((el) => el.selected && el.groupId));

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
			return "text-[var(--track-text)]";
		case "image":
		case "video":
			return "text-[var(--track-video)]";
		case "sticker":
			return "text-[var(--track-sticker)]";
		default:
			return "text-fg-subtle";
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

/** Opacity box commit (blur / Enter): only writes when the value changed, like a native `change`. */
function commitSelectedOpacity(raw: string) {
	const layer = selectedLayer.value;
	if (!layer || raw === String(Math.round(layer.opacity * 100))) return;
	setOpacity(layer.trackId, layer.elementId, layer.type, Math.min(1, Math.max(0, Number(raw) / 100)));
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
	<div class="flex h-full min-h-0 flex-col">
		<PanelHeader title="Layers">
			<ToolbarButton label="Group selected layers" :disabled="!canGroup" @click="createGroupFromSelection">
				<Group />
			</ToolbarButton>
			<ToolbarButton label="Ungroup selected layers" :disabled="!canUngroup" @click="ungroupSelection">
				<Ungroup />
			</ToolbarButton>
		</PanelHeader>

		<!-- Selected layer: blend mode + opacity -->
		<div
			v-if="selectedLayer"
			class="flex shrink-0 items-center gap-2 border-b border-line-subtle px-2 py-2"
		>
			<InspectorSelect
				:model-value="selectedLayer.blendMode"
				:options="BLEND_MODE_OPTIONS"
				aria-label="Blend mode"
				title="Blend mode"
				class="flex-1"
				@update:model-value="(v) => setBlendMode(selectedLayer!.trackId, selectedLayer!.elementId, selectedLayer!.type, v as BlendMode)"
			/>
			<NumberBox
				prefix="Opacity"
				suffix="%"
				:value="Math.round(selectedLayer.opacity * 100)"
				:min="0"
				:max="100"
				aria-label="Layer opacity"
				class="w-[116px] shrink-0"
				@commit="commitSelectedOpacity"
			/>
		</div>

		<div class="min-h-0 flex-1 overflow-y-auto">
			<EmptyState
				v-if="allElements.length === 0"
				size="sm"
				:icon="Layers"
				title="No layers"
				description="Use the Type, Shape, or Place tools"
			/>

			<div v-else class="p-1">
				<div v-for="group in displayLayerGroups" :key="group.trackId">
					<div
						v-if="group.trackName"
						class="flex h-7 items-center gap-1.5 pl-2 pr-0.5"
					>
						<span class="eyebrow truncate">{{ group.trackName }}</span>
						<Badge v-if="group.layers.some((l) => l.groupId)" variant="neutral">Grouped</Badge>
						<Button
							variant="ghost"
							size="icon-xs"
							class="ml-auto"
							:title="group.locked ? 'Unlock group' : 'Lock group'"
							:aria-label="group.locked ? 'Unlock group' : 'Lock group'"
							@click="handleToggleLock(group.trackId)"
						>
							<Lock v-if="group.locked" />
							<Unlock v-else />
						</Button>
					</div>
					<template v-for="item in displayTrackLayers(group.layers)" :key="item.kind === 'layer' ? item.layer.elementId : `hdr-${item.groupId}`">
						<button
							v-if="item.kind === 'group-header'"
							type="button"
							class="flex h-7 w-full items-center gap-1.5 rounded-md px-2 text-left text-xs text-fg-muted transition-colors hover:bg-surface-hover hover:text-fg"
							:aria-expanded="!isGroupCollapsed(item.groupId)"
							@click="toggleLayerGroupCollapse(item.groupId)"
						>
							<ChevronRight v-if="isGroupCollapsed(item.groupId)" class="size-3.5 shrink-0 text-fg-subtle" />
							<ChevronDown v-else class="size-3.5 shrink-0 text-fg-subtle" />
							<Group class="size-3.5 shrink-0 text-fg-subtle" />
							<span class="truncate">Group · {{ item.count }} layers</span>
						</button>
						<div
							v-else
							:class="[
								'group/row flex h-8 w-full items-center gap-0.5 rounded-md pl-0.5 pr-1 transition-colors',
								item.layer.selected ? 'bg-brand-soft' : 'hover:bg-surface-hover',
								item.layer.hidden ? 'opacity-50' : '',
							]"
						>
							<Button
								variant="ghost"
								size="icon-xs"
								:title="item.layer.hidden ? 'Show' : 'Hide'"
								:aria-label="item.layer.hidden ? 'Show layer' : 'Hide layer'"
								@click.stop="handleToggleVisibility(item.layer.trackId, item.layer.elementId)"
							>
								<EyeOff v-if="item.layer.hidden" />
								<Eye v-else />
							</Button>
							<Button
								variant="ghost"
								size="icon-xs"
								:class="item.layer.locked && 'text-fg'"
								:title="item.layer.locked ? 'Unlock' : 'Lock'"
								:aria-label="item.layer.locked ? 'Unlock layer' : 'Lock layer'"
								@click.stop="handleToggleElementLock(item.layer.trackId, item.layer.elementId, item.layer.type, item.layer.locked)"
							>
								<Lock v-if="item.layer.locked" />
								<Unlock v-else />
							</Button>

							<button
								type="button"
								class="flex h-full min-w-0 flex-1 items-center gap-2 pl-1 text-left focus-visible:outline-none"
								@click="handleSelect(item.layer.trackId, item.layer.elementId)"
								@dblclick="startRename(item.layer)"
							>
								<component
									:is="getTypeIcon(item.layer.type)"
									:class="['size-3.5 shrink-0', item.layer.selected ? 'text-brand' : getTypeColor(item.layer.type)]"
								/>
								<input
									v-if="renamingId === item.layer.elementId"
									v-model="renameValue"
									aria-label="Layer name"
									class="h-6 min-w-0 flex-1 rounded border border-brand-line bg-surface-raised px-1.5 text-xs text-fg outline-none"
									@click.stop
									@keydown.enter="commitRename(item.layer.trackId, item.layer.elementId, item.layer.type)"
									@keydown.escape="renamingId = null"
									@blur="commitRename(item.layer.trackId, item.layer.elementId, item.layer.type)"
								/>
								<span
									v-else
									:class="[
										'min-w-0 flex-1 truncate text-xs',
										item.layer.selected ? 'font-medium text-brand' : 'text-fg',
									]"
								>
									{{ item.layer.name }}
								</span>
							</button>

							<div class="hidden shrink-0 items-center group-hover/row:flex group-focus-within/row:flex">
								<Button
									variant="ghost"
									size="icon-xs"
									title="Move up"
									aria-label="Move layer up"
									@click.stop="handleMove(item.layer.trackId, 'up', item.layer.elementId)"
								>
									<ChevronUp />
								</Button>
								<Button
									variant="ghost"
									size="icon-xs"
									title="Move down"
									aria-label="Move layer down"
									@click.stop="handleMove(item.layer.trackId, 'down', item.layer.elementId)"
								>
									<ChevronDown />
								</Button>
								<Button
									variant="ghost"
									size="icon-xs"
									title="Duplicate"
									aria-label="Duplicate layer"
									@click.stop="handleDuplicate(item.layer.trackId, item.layer.elementId)"
								>
									<Copy />
								</Button>
								<Button
									variant="ghost"
									size="icon-xs"
									class="hover:bg-danger-soft hover:text-danger"
									title="Delete"
									aria-label="Delete layer"
									@click.stop="handleDelete(item.layer.trackId, item.layer.elementId)"
								>
									<Trash2 />
								</Button>
							</div>
						</div>
					</template>
				</div>
			</div>
		</div>
	</div>
</template>
