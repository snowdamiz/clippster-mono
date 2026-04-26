<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useEditor } from "../../composables/useEditor";
import type { KeyframableProperty, KeyframeInterpolation, Keyframe, ElementKeyframes } from "../../types/keyframes";
import type { TimelineElement, TimelineTrack } from "../../types/timeline";
import { Trash2, X } from "lucide-vue-next";

const props = defineProps<{
	elementId: string;
	offset: number;
	anchorRect: DOMRect;
}>();

const emit = defineEmits<{
	(e: "close"): void;
}>();

const { editor, version } = useEditor();

const EASING_OPTIONS: { id: KeyframeInterpolation; label: string }[] = [
	{ id: "linear", label: "Linear" },
	{ id: "ease-in", label: "Ease In" },
	{ id: "ease-out", label: "Ease Out" },
	{ id: "ease-in-out", label: "Ease In-Out" },
	{ id: "hold", label: "Hold" },
	{ id: "ease-in-cubic", label: "Cubic In" },
	{ id: "ease-out-cubic", label: "Cubic Out" },
	{ id: "ease-in-out-cubic", label: "Cubic In-Out" },
	{ id: "ease-out-bounce", label: "Bounce" },
	{ id: "spring", label: "Spring" },
];

const PROPERTY_LABELS: Record<KeyframableProperty, string> = {
	opacity: "Opacity",
	scale: "Scale",
	positionX: "Position X",
	positionY: "Position Y",
	rotation: "Rotation",
	volume: "Volume",
	speed: "Speed",
};

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
			class="w-56 rounded-lg border border-white/10 bg-[#1e1e22] shadow-2xl shadow-black/50"
		>
			<!-- Header -->
			<div class="flex items-center justify-between border-b border-white/10 px-3 py-1.5">
				<span class="text-[11px] font-medium text-yellow-400">
					Keyframe @ {{ (offset * 100).toFixed(0) }}%
				</span>
				<div class="flex items-center gap-1">
					<button
						class="flex size-5 items-center justify-center rounded text-zinc-500 hover:bg-red-500/10 hover:text-red-400"
						title="Delete all at this offset"
						@click="deleteAllAtOffset"
					>
						<Trash2 class="size-3" />
					</button>
					<button
						class="flex size-5 items-center justify-center rounded text-zinc-500 hover:bg-white/10 hover:text-zinc-300"
						@click="emit('close')"
					>
						<X class="size-3" />
					</button>
				</div>
			</div>

			<!-- Keyframe entries -->
			<div class="max-h-48 overflow-y-auto p-2 space-y-2">
				<div v-if="keyframesAtOffset.length === 0" class="py-2 text-center">
					<p class="text-[10px] text-zinc-600">No keyframes at this offset</p>
				</div>

				<div
					v-for="{ property, keyframe } in keyframesAtOffset"
					:key="keyframe.id"
					class="space-y-1 rounded-md border border-white/5 bg-white/[0.02] p-2"
				>
					<div class="flex items-center justify-between">
						<span class="text-[10px] font-medium text-zinc-300">{{ PROPERTY_LABELS[property] }}</span>
						<button
							class="flex size-4 items-center justify-center rounded text-zinc-600 hover:bg-red-500/10 hover:text-red-400"
							@click="deleteKeyframe(property, keyframe.id)"
						>
							<Trash2 class="size-2.5" />
						</button>
					</div>

					<!-- Value -->
					<div class="flex items-center gap-1.5">
						<label class="w-10 text-[9px] text-zinc-500">Value</label>
						<input
							type="number"
							:value="keyframe.value"
							step="0.01"
							class="h-5 flex-1 rounded border border-white/10 bg-white/5 px-1.5 text-[10px] text-zinc-300 outline-none focus:border-yellow-500/30"
							@change="(e) => updateValue(property, keyframe.id, Number((e.target as HTMLInputElement).value))"
						/>
					</div>

					<!-- Easing -->
					<div class="flex items-center gap-1.5">
						<label class="w-10 text-[9px] text-zinc-500">Easing</label>
						<select
							:value="keyframe.interpolation"
							class="h-5 flex-1 rounded border border-white/10 bg-white/5 px-1 text-[10px] text-zinc-300 outline-none focus:border-yellow-500/30"
							@change="(e) => updateEasing(property, keyframe.id, (e.target as HTMLSelectElement).value as KeyframeInterpolation)"
						>
							<option
								v-for="opt in EASING_OPTIONS"
								:key="opt.id"
								:value="opt.id"
								class="bg-[#1e1e22]"
							>
								{{ opt.label }}
							</option>
						</select>
					</div>
				</div>
			</div>
		</div>
	</Teleport>
</template>
