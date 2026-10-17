<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useEditor } from "../../composables/useEditor";
import type { KeyframableProperty, KeyframeInterpolation, Keyframe, ElementKeyframes } from "../../types/keyframes";
import {
	formatKeyframeDisplayValue,
	parseKeyframeDisplayValue,
} from "../../lib/keyframe-property-defaults";
import {
	KEYFRAME_EASING_OPTIONS,
	getKeyframePropertyLabel,
} from "../../lib/keyframe-editor-properties";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Trash2, X } from "lucide-vue-next";

const props = defineProps<{
	elementId: string;
	offset: number;
	anchorRect: DOMRect;
}>();

const emit = defineEmits<{
	(e: "close"): void;
}>();

const { editor, version } = useEditor({
	subscribe: {
		timeline: true,
		playback: false,
		scenes: false,
		project: false,
		media: false,
		selection: false,
	},
});

const EASING_OPTIONS = KEYFRAME_EASING_OPTIONS;

// Find element and track
const elementData = computed(() => {
	void version.value;
	const tracks = editor.timeline.getTracks();
	for (const track of tracks) {
		const el = track.elements.find((e) => e.id === props.elementId);
		if (el) return { element: el, track };
	}
	return null;
});

// Get all keyframes at this offset across all property tracks
const keyframesAtOffset = computed(() => {
	const data = elementData.value;
	if (!data) return [];
	const kf = data.element.keyframes;
	if (!kf) return [];

	const results: { property: KeyframableProperty; keyframe: Keyframe }[] = [];
	for (const [prop, track] of Object.entries(kf.tracks)) {
		if (!track) continue;
		const match = track.keyframes.find((k) => Math.abs(k.offset - props.offset) < 0.001);
		if (match) {
			results.push({ property: prop as KeyframableProperty, keyframe: match });
		}
	}
	return results;
});

// Position popup above the anchor
const popupStyle = computed(() => {
	const r = props.anchorRect;
	return {
		position: "fixed" as const,
		left: `${r.left + r.width / 2}px`,
		top: `${r.top - 8}px`,
		transform: "translate(-50%, -100%)",
		zIndex: 9999,
	};
});

function displayValue(property: KeyframableProperty, value: number): string {
	return formatKeyframeDisplayValue(property, value);
}

function valueStep(property: KeyframableProperty): string {
	return property === "scale" || property === "opacity" ? "1" : "0.01";
}

function onValueChange(property: KeyframableProperty, keyframeId: string, raw: number) {
	updateValue(property, keyframeId, parseKeyframeDisplayValue(property, raw));
}

function updateValue(property: KeyframableProperty, keyframeId: string, value: number) {
	const data = elementData.value;
	if (!data) return;
	const existing = data.element.keyframes;
	if (!existing) return;

	const track = existing.tracks[property];
	if (!track) return;

	const updatedKfs = track.keyframes.map((k) =>
		k.id === keyframeId ? { ...k, value } : k,
	);

	const updatedKeyframes: ElementKeyframes = {
		...existing,
		tracks: { ...existing.tracks, [property]: { ...track, keyframes: updatedKfs } },
	};

	editor.timeline.updateElementKeyframes({
		trackId: data.track.id,
		elementId: data.element.id,
		keyframes: updatedKeyframes,
	});
}

function updateEasing(property: KeyframableProperty, keyframeId: string, interpolation: KeyframeInterpolation) {
	const data = elementData.value;
	if (!data) return;
	const existing = data.element.keyframes;
	if (!existing) return;

	const track = existing.tracks[property];
	if (!track) return;

	const updatedKfs = track.keyframes.map((k) =>
		k.id === keyframeId ? { ...k, interpolation } : k,
	);

	const updatedKeyframes: ElementKeyframes = {
		...existing,
		tracks: { ...existing.tracks, [property]: { ...track, keyframes: updatedKfs } },
	};

	editor.timeline.updateElementKeyframes({
		trackId: data.track.id,
		elementId: data.element.id,
		keyframes: updatedKeyframes,
	});
}

function deleteKeyframe(property: KeyframableProperty, keyframeId: string) {
	const data = elementData.value;
	if (!data) return;
	const existing = data.element.keyframes;
	if (!existing) return;

	const track = existing.tracks[property];
	if (!track) return;

	const filtered = track.keyframes.filter((k) => k.id !== keyframeId);

	const updatedKeyframes: ElementKeyframes = {
		...existing,
		tracks: { ...existing.tracks, [property]: { ...track, keyframes: filtered } },
	};

	editor.timeline.updateElementKeyframes({
		trackId: data.track.id,
		elementId: data.element.id,
		keyframes: updatedKeyframes,
	});

	// Close if no more keyframes at this offset
	if (keyframesAtOffset.value.length <= 1) {
		emit("close");
	}
}

function deleteAllAtOffset() {
	const data = elementData.value;
	if (!data) return;
	const existing = data.element.keyframes;
	if (!existing) return;

	const updatedTracks = { ...existing.tracks };
	for (const [prop, track] of Object.entries(updatedTracks)) {
		if (!track) continue;
		updatedTracks[prop as KeyframableProperty] = {
			...track,
			keyframes: track.keyframes.filter((k) => Math.abs(k.offset - props.offset) > 0.001),
		};
	}

	const updatedKeyframes: ElementKeyframes = { ...existing, tracks: updatedTracks };
	editor.timeline.updateElementKeyframes({
		trackId: data.track.id,
		elementId: data.element.id,
		keyframes: updatedKeyframes,
	});
	emit("close");
}

// Close on outside click
function onClickOutside(ev: MouseEvent) {
	const popup = document.getElementById("keyframe-popup");
	if (popup && !popup.contains(ev.target as Node)) {
		emit("close");
	}
}

onMounted(() => {
	setTimeout(() => document.addEventListener("mousedown", onClickOutside), 0);
});
onUnmounted(() => {
	document.removeEventListener("mousedown", onClickOutside);
});
</script>

<template>
	<Teleport to="body">
		<div
			id="keyframe-popup"
			:style="popupStyle"
			class="z-[10060] w-60 rounded-lg bg-surface-raised shadow-[var(--shadow-md)]"
		>
			<!-- Header -->
			<div class="flex h-9 items-center justify-between border-b border-line-subtle pl-3 pr-1.5">
				<span class="flex items-center gap-1.5 text-xs font-medium text-fg">
					<svg width="9" height="9" viewBox="0 0 12 12" aria-hidden="true"><polygon points="6,0 12,6 6,12 0,6" fill="#facc15" /></svg>
					Keyframe at <span class="tabular">{{ (offset * 100).toFixed(0) }}%</span>
				</span>
				<div class="flex items-center gap-1">
					<button
						class="grid size-6 place-items-center rounded text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger"
						title="Delete all at this offset"
						aria-label="Delete all keyframes at this offset"
						@click="deleteAllAtOffset"
					>
						<Trash2 class="size-3" />
					</button>
					<button
						class="grid size-6 place-items-center rounded text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
						aria-label="Close"
						@click="emit('close')"
					>
						<X class="size-3" />
					</button>
				</div>
			</div>

			<!-- Keyframe entries -->
			<div class="max-h-48 overflow-y-auto p-2 space-y-2">
				<div v-if="keyframesAtOffset.length === 0" class="py-2 text-center">
					<p class="text-xs text-fg-subtle">No keyframes at this offset</p>
				</div>

				<div
					v-for="{ property, keyframe } in keyframesAtOffset"
					:key="keyframe.id"
					class="space-y-1.5 rounded-md border border-line-subtle bg-surface p-2"
				>
					<div class="flex items-center justify-between">
						<span class="text-xs font-medium text-fg">{{ getKeyframePropertyLabel(property) }}</span>
						<button
							class="grid size-5 place-items-center rounded text-fg-subtle transition-colors hover:bg-danger-soft hover:text-danger"
							aria-label="Delete keyframe"
							@click="deleteKeyframe(property, keyframe.id)"
						>
							<Trash2 class="size-2.5" />
						</button>
					</div>

					<!-- Value -->
					<div class="flex items-center gap-1.5">
						<label class="w-12 text-2xs text-fg-subtle">Value{{ property === 'scale' ? ' %' : property === 'opacity' ? ' %' : '' }}</label>
						<input
							type="number"
							:value="displayValue(property, keyframe.value)"
							:step="valueStep(property)"
							class="tabular h-6 min-w-0 flex-1 rounded-md border border-line bg-surface-raised px-1.5 text-xs text-fg outline-none transition-colors hover:border-line-strong focus:border-brand-line"
							@change="(e) => onValueChange(property, keyframe.id, Number((e.target as HTMLInputElement).value))"
						/>
					</div>

					<!-- Easing -->
					<div class="flex items-center gap-1.5">
						<label class="w-12 text-2xs text-fg-subtle">Easing</label>
						<Select
							:model-value="keyframe.interpolation"
							@update:model-value="(v) => updateEasing(property, keyframe.id, v as KeyframeInterpolation)"
						>
							<SelectTrigger class="h-6 min-w-0 flex-1 px-1.5 text-xs">
								<SelectValue />
							</SelectTrigger>
							<SelectContent class="max-h-[250px]">
								<SelectItem
									v-for="opt in EASING_OPTIONS"
									:key="opt.id"
									:value="opt.id"
									class="text-xs"
								>
									{{ opt.label }}
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>
			</div>
		</div>
	</Teleport>
</template>
