<script setup lang="ts">
import { ref, watch, computed, onMounted, onUnmounted } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { useElementSelection } from "../../../composables/timeline/element/useElementSelection";
import type { AudioElement } from "../../../types/timeline";
import type { AudioEffect } from "../../../types/audio-effects";
import { AUDIO_EFFECT_PRESETS, AUDIO_EFFECT_CATEGORIES, getAudioEffectPreset } from "../../../constants/audio-effect-constants";
import { generateUUID } from "../../../utils/id";
import { useClipVolumeInspector } from "../../../composables/panels/useClipVolumeInspector";
import { Headphones, Trash2, Gauge, Wand2, Eye, EyeOff, X, ChevronDown, ChevronUp, Plus, Diamond } from "lucide-vue-next";
import KeyframeEditorPanel from "../KeyframeEditorPanel.vue";
import ElementTimingFields from "./ElementTimingFields.vue";
import { useRafBatchedUpdate } from "../../../composables/useRafBatchedUpdate";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionHeader } from "@/components/ui/section-header";
import InspectorSection from "../shared/InspectorSection.vue";
import InspectorField from "../shared/InspectorField.vue";
import InspectorTabRail from "../shared/InspectorTabRail.vue";
import SliderField from "../shared/SliderField.vue";
import NumberBox from "../shared/NumberBox.vue";
import OptionChip from "../shared/OptionChip.vue";

const props = defineProps<{
	element: AudioElement;
	trackId: string;
}>();

type TopTab = "audio" | "speed" | "keyframes";
const activeTab = ref<TopTab>("audio");
const topTabs: { id: TopTab; label: string; icon: typeof Headphones }[] = [
	{ id: "audio", label: "Audio", icon: Headphones },
	{ id: "speed", label: "Speed", icon: Gauge },
	{ id: "keyframes", label: "Keyframes", icon: Diamond },
];

type AudioParamField = { key: string; label: string; min: number; max: number; step?: number };

/** Slider parameters per audio effect type (beyond the shared Mix slider). */
const AUDIO_EFFECT_PARAM_FIELDS: Record<string, AudioParamField[]> = {
	eq: [
		{ key: "lowGain", label: "Low", min: -12, max: 12, step: 0.5 },
		{ key: "midGain", label: "Mid", min: -12, max: 12, step: 0.5 },
		{ key: "highGain", label: "High", min: -12, max: 12, step: 0.5 },
	],
	compressor: [
		{ key: "threshold", label: "Threshold", min: -60, max: 0 },
		{ key: "ratio", label: "Ratio", min: 1, max: 20, step: 0.5 },
	],
	reverb: [
		{ key: "decay", label: "Decay", min: 0.1, max: 10, step: 0.1 },
		{ key: "damping", label: "Damping", min: 0, max: 100 },
	],
	delay: [
		{ key: "time", label: "Time", min: 0, max: 2000, step: 10 },
		{ key: "feedback", label: "Feedback", min: 0, max: 90 },
	],
	lowpass: [
		{ key: "frequency", label: "Frequency", min: 20, max: 20000, step: 10 },
		{ key: "resonance", label: "Resonance", min: 0, max: 20, step: 0.5 },
	],
	highpass: [
		{ key: "frequency", label: "Frequency", min: 20, max: 20000, step: 10 },
		{ key: "resonance", label: "Resonance", min: 0, max: 20, step: 0.5 },
	],
	bandpass: [
		{ key: "frequency", label: "Frequency", min: 20, max: 20000, step: 10 },
		{ key: "bandwidth", label: "Bandwidth", min: 0.1, max: 10, step: 0.1 },
	],
	noisegate: [{ key: "threshold", label: "Threshold", min: -80, max: 0 }],
	pitchShift: [{ key: "semitones", label: "Semitones", min: -12, max: 12 }],
	chorus: [
		{ key: "rate", label: "Rate", min: 0.1, max: 10, step: 0.1 },
		{ key: "depth", label: "Depth", min: 0, max: 100 },
	],
	tremolo: [
		{ key: "rate", label: "Rate", min: 0.5, max: 20, step: 0.5 },
		{ key: "depth", label: "Depth", min: 0, max: 100 },
	],
	distortion: [
		{ key: "drive", label: "Drive", min: 0, max: 100 },
		{ key: "tone", label: "Tone", min: 0, max: 100 },
	],
};

function audioParamValue(effect: AudioEffect, key: string): number {
	return (effect as unknown as Record<string, number>)[key];
}

const { editor } = useEditor({
	subscribe: {
		playback: false,
		timeline: false,
		scenes: false,
		project: false,
		media: false,
		selection: false,
	},
});
const { selectedElements } = useElementSelection();

function isRangeInputTarget(target: EventTarget | null): boolean {
	return target instanceof HTMLInputElement && target.type === "range";
}

function handleRangePointerDown(event: PointerEvent) {
	if (isRangeInputTarget(event.target)) {
		editor.setInteractiveDrag(true);
	}
}

function stopRangeInteraction() {
	flushUpdate();
	editor.setInteractiveDrag(false);
}

onMounted(() => {
	window.addEventListener("pointerup", stopRangeInteraction);
	window.addEventListener("pointercancel", stopRangeInteraction);
});

onUnmounted(() => {
	window.removeEventListener("pointerup", stopRangeInteraction);
	window.removeEventListener("pointercancel", stopRangeInteraction);
	stopRangeInteraction();
});

const fadeInInput = ref((props.element.fadeIn ?? 0).toFixed(1));
const fadeOutInput = ref((props.element.fadeOut ?? 0).toFixed(1));

watch(() => props.element.fadeIn, (v) => { fadeInInput.value = (v ?? 0).toFixed(1); });
watch(() => props.element.fadeOut, (v) => { fadeOutInput.value = (v ?? 0).toFixed(1); });

const speedTicks = [0.5, 1, 2, 3, 4, 5, 8, 10];
const currentSpeed = computed(() => props.element.speed ?? 1);
const speedInput = ref(currentSpeed.value.toFixed(2));
const isDraggingSpeed = ref(false);

watch(() => props.element.speed, (v) => { speedInput.value = (v ?? 1).toFixed(2); });

function clampSpeed(speed: number) {
	return Math.round(Math.max(0.1, Math.min(10, speed)) * 10) / 10;
}

function commitSpeed(speed: number) {
	const clamped = clampSpeed(speed);
	speedInput.value = clamped.toFixed(2);
	editor.timeline.changeElementSpeed({
		trackId: props.trackId,
		elementId: props.element.id,
		speed: clamped,
	});
}

function changeSpeed(speed: number) {
	const clamped = clampSpeed(speed);
	speedInput.value = clamped.toFixed(2);
	if (!isDraggingSpeed.value) commitSpeed(clamped);
}

function onSpeedPointerDown() { isDraggingSpeed.value = true; }
function onSpeedPointerUp(e: PointerEvent) {
	isDraggingSpeed.value = false;
	commitSpeed(Number((e.target as HTMLInputElement).value) / 10);
}

function handleSpeedInput(value: string) {
	speedInput.value = value;
}

function handleSpeedBlur() {
	const parsed = parseFloat(speedInput.value);
	const val = Number.isNaN(parsed) ? (props.element.speed ?? 1) : Math.max(0.1, Math.min(10, parsed));
	commitSpeed(val);
}

function commitUpdate(updates: Record<string, unknown>) {
	editor.timeline.updateElement({
		trackId: props.trackId,
		elementId: props.element.id,
		updates,
	});
}

const { update, flush: flushUpdate } = useRafBatchedUpdate(commitUpdate);

const clipVolume = useClipVolumeInspector({
	elementId: props.element.id,
	getLinearGain: () => props.element.volume ?? 1,
	setLinearGain: (gain: number) => update({ volume: gain }),
});

function clamp(value: number, min: number, max: number) {
	return Math.min(max, Math.max(min, value));
}

function updatePan(value: number) {
	update({ pan: Math.round(value * 100) / 100 });
}

function handleFadeIn(value: string) {
	fadeInInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) update({ fadeIn: clamp(parsed, 0, props.element.duration / 2) });
}
function handleFadeOut(value: string) {
	fadeOutInput.value = value;
	const parsed = parseFloat(value);
	if (!Number.isNaN(parsed)) update({ fadeOut: clamp(parsed, 0, props.element.duration / 2) });
}

// --- Audio Effects ---
const audioEffects = computed(() => props.element.audioEffects ?? []);
const showAudioEffects = ref(audioEffects.value.length > 0);
const showAddEffect = ref(false);

watch(() => props.element.audioEffects, (v) => {
	if (v && v.length > 0) showAudioEffects.value = true;
});

function addAudioEffect(type: string) {
	const preset = getAudioEffectPreset(type);
	if (!preset) return;
	const newEffect: AudioEffect = {
		...preset.defaults,
		id: generateUUID(),
	} as AudioEffect;
	update({ audioEffects: [...audioEffects.value, newEffect] });
	showAddEffect.value = false;
}

function toggleAudioEffect(effectId: string) {
	const updated = audioEffects.value.map((e) =>
		e.id === effectId ? { ...e, enabled: !e.enabled } : e,
	);
	update({ audioEffects: updated });
}

function removeAudioEffect(effectId: string) {
	const updated = audioEffects.value.filter((e) => e.id !== effectId);
	update({ audioEffects: updated });
}

function updateAudioEffectParam(effectId: string, key: string, value: number | string) {
	const updated = audioEffects.value.map((e) =>
		e.id === effectId ? { ...e, [key]: value } : e,
	);
	update({ audioEffects: updated });
}

function getAudioEffectLabel(type: string): string {
	return getAudioEffectPreset(type)?.label ?? type;
}

function handleDelete() {
	editor.timeline.deleteElements({
		elements: selectedElements.value.length > 0
			? selectedElements.value
			: [{ trackId: props.trackId, elementId: props.element.id }],
	});
}

</script>

<template>
	<div class="flex h-full min-h-0 flex-row" @pointerdown.capture="handleRangePointerDown">
		<div class="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
			<div :key="activeTab" class="min-h-0 flex-1 animate-enter overflow-x-hidden overflow-y-auto">
				<!-- ══════ Audio tab ══════ -->
				<template v-if="activeTab === 'audio'">
					<InspectorSection title="Basic">
						<InspectorField label="Name">
							<p class="truncate text-xs text-fg" :title="element.name">{{ element.name }}</p>
						</InspectorField>
						<ElementTimingFields :element="element" :track-id="trackId" />
					</InspectorSection>

					<InspectorSection title="Audio">
						<!-- Volume (linear gain persisted; dB UI) -->
						<InspectorField label="Volume">
							<template #actions>
								<span class="text-2xs text-fg-subtle" title="Linear gain 1 = 0 dB">1 = 0 dB</span>
							</template>
							<div class="flex items-center gap-2">
								<input
									type="range"
									:value="clipVolume.sliderStep"
									min="0"
									:max="clipVolume.sliderMax"
									step="1"
									aria-label="Volume"
									class="min-w-0 flex-1"
									@pointerdown="clipVolume.onSliderPointerDown"
									@input="clipVolume.onSliderInput"
								/>
								<NumberBox
									type="text"
									:value="clipVolume.dbField"
									align="center"
									aria-label="Volume in decibels"
									class="w-[84px] shrink-0 pr-0"
									@input="clipVolume.onDbFieldInput"
									@commit="clipVolume.onDbFieldBlur"
								>
									<template #trailing>
										<div class="flex h-full w-4 shrink-0 flex-col border-l border-line">
											<button
												type="button"
												class="flex h-1/2 items-center justify-center text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
												title="Increase volume by 0.1 dB"
												aria-label="Increase volume by 0.1 dB"
												@mousedown.prevent
												@click="clipVolume.nudgeDb(1)"
											>
												<ChevronUp class="size-2.5" />
											</button>
											<button
												type="button"
												class="flex h-1/2 items-center justify-center border-t border-line text-fg-subtle transition-colors hover:bg-surface-hover hover:text-fg"
												title="Decrease volume by 0.1 dB"
												aria-label="Decrease volume by 0.1 dB"
												@mousedown.prevent
												@click="clipVolume.nudgeDb(-1)"
											>
												<ChevronDown class="size-2.5" />
											</button>
										</div>
									</template>
								</NumberBox>
							</div>
						</InspectorField>

						<div class="border-t border-line-subtle pt-3">
							<SliderField
								label="Pan"
								:model-value="(element.pan ?? 0) * 100"
								:min="-100"
								:max="100"
								:step="1"
								:readout="(element.pan ?? 0) === 0 ? 'C' : (element.pan ?? 0) > 0 ? `R${Math.round(Math.abs(element.pan ?? 0) * 100)}` : `L${Math.round(Math.abs(element.pan ?? 0) * 100)}`"
								@slide="(v) => updatePan(v / 100)"
							>
								<template #actions>
									<Button variant="ghost" size="xs" class="-my-1" title="Center pan" @click="updatePan(0)">Center</Button>
								</template>
							</SliderField>
						</div>

						<InspectorField inline label="Mute" class="border-t border-line-subtle pt-3">
							<div class="flex-1" />
							<Switch :model-value="!!element.muted" aria-label="Mute clip" @update:model-value="(val: boolean) => update({ muted: val })" />
						</InspectorField>

						<div class="grid grid-cols-2 gap-3 border-t border-line-subtle pt-3">
							<SliderField
								label="Fade in"
								:model-value="(element.fadeIn ?? 0) * 10"
								:min="0"
								:max="30"
								:step="1"
								:readout="`${(element.fadeIn ?? 0).toFixed(1)}s`"
								@slide="(v) => handleFadeIn((v / 10).toFixed(1))"
							/>
							<SliderField
								label="Fade out"
								:model-value="(element.fadeOut ?? 0) * 10"
								:min="0"
								:max="30"
								:step="1"
								:readout="`${(element.fadeOut ?? 0).toFixed(1)}s`"
								@slide="(v) => handleFadeOut((v / 10).toFixed(1))"
							/>
						</div>
					</InspectorSection>

					<!-- Audio effects -->
					<InspectorSection
						title="Audio effects"
						collapsible
						:open="showAudioEffects"
						@update:open="(v) => (showAudioEffects = v)"
					>
						<template v-if="audioEffects.length > 0" #meta>
							<Badge variant="neutral" class="tabular">{{ audioEffects.length }}</Badge>
						</template>

						<Button
							:variant="showAddEffect ? 'subtle' : 'secondary'"
							size="sm"
							block
							:aria-expanded="showAddEffect"
							@click="showAddEffect = !showAddEffect"
						>
							<Plus />
							Add effect
						</Button>

						<!-- Effect picker -->
						<div v-if="showAddEffect" class="space-y-3 rounded-lg border border-line-subtle bg-surface-raised p-2.5">
							<div v-for="cat in AUDIO_EFFECT_CATEGORIES" :key="cat.key" class="space-y-1.5">
								<SectionHeader :title="cat.label" variant="eyebrow" class="min-h-0" />
								<div class="flex flex-wrap gap-1">
									<OptionChip
										v-for="preset in AUDIO_EFFECT_PRESETS.filter(p => p.category === cat.key)"
										:key="preset.type"
										:title="preset.description"
										@click="addAudioEffect(preset.type)"
									>
										{{ preset.label }}
									</OptionChip>
								</div>
							</div>
						</div>

						<!-- Applied effects list -->
						<div v-if="audioEffects.length === 0 && !showAddEffect" class="rounded-lg border border-dashed border-line">
							<EmptyState size="sm" :icon="Wand2" title="No audio effects applied" class="py-5" />
						</div>

						<div
							v-for="effect in audioEffects"
							:key="effect.id"
							class="overflow-hidden rounded-lg border border-line-subtle bg-surface-raised"
						>
							<div class="flex h-8 items-center gap-1 pl-2.5 pr-1">
								<span class="min-w-0 flex-1 truncate text-xs font-medium" :class="effect.enabled ? 'text-fg' : 'text-fg-subtle'">
									{{ getAudioEffectLabel(effect.type) }}
								</span>
								<Button
									variant="ghost"
									size="icon-xs"
									:title="effect.enabled ? 'Disable effect' : 'Enable effect'"
									:aria-label="effect.enabled ? 'Disable effect' : 'Enable effect'"
									@click="toggleAudioEffect(effect.id)"
								>
									<component :is="effect.enabled ? Eye : EyeOff" />
								</Button>
								<Button
									variant="ghost"
									size="icon-xs"
									class="hover:bg-danger-soft hover:text-danger"
									title="Remove effect"
									aria-label="Remove effect"
									@click="removeAudioEffect(effect.id)"
								>
									<X />
								</Button>
							</div>

							<div v-if="effect.enabled" class="space-y-1.5 border-t border-line-subtle px-2.5 py-2">
								<SliderField
									inline
									label="Mix"
									:model-value="effect.mix"
									:min="0"
									:max="100"
									@update:model-value="(v) => updateAudioEffectParam(effect.id, 'mix', v)"
								/>
								<SliderField
									v-for="param in AUDIO_EFFECT_PARAM_FIELDS[effect.type] ?? []"
									:key="param.key"
									inline
									:label="param.label"
									:model-value="audioParamValue(effect, param.key)"
									:min="param.min"
									:max="param.max"
									:step="param.step ?? 1"
									@update:model-value="(v) => updateAudioEffectParam(effect.id, param.key, v)"
								/>
							</div>
						</div>
					</InspectorSection>

					<InspectorSection flush>
						<Button variant="destructive-soft" size="sm" block @click="handleDelete">
							<Trash2 />
							Delete audio
						</Button>
					</InspectorSection>
				</template>

				<!-- ══════ Speed tab ══════ -->
				<InspectorSection v-else-if="activeTab === 'speed'" title="Speed" flush>
					<div class="flex items-center gap-2">
						<div class="relative min-w-0 flex-1">
							<input
								type="range"
								:value="currentSpeed * 10"
								min="1"
								max="100"
								step="1"
								aria-label="Playback speed"
								class="w-full"
								@pointerdown="onSpeedPointerDown"
								@pointerup="onSpeedPointerUp"
								@input="(e) => changeSpeed(Number((e.target as HTMLInputElement).value) / 10)"
							/>
							<!-- Tick marks -->
							<div class="pointer-events-none absolute inset-x-0 top-1/2 flex h-0 items-center">
								<div
									v-for="tick in speedTicks"
									:key="tick"
									class="absolute h-2 w-px bg-line-strong"
									:style="{ left: `${((tick * 10 - 1) / 99) * 100}%` }"
								/>
							</div>
						</div>
						<NumberBox
							type="text"
							:value="speedInput"
							suffix="x"
							align="center"
							aria-label="Playback speed"
							class="w-[72px] shrink-0"
							@input="handleSpeedInput"
							@commit="handleSpeedBlur"
						/>
					</div>
				</InspectorSection>

				<!-- ══════ Keyframes tab ══════ -->
				<KeyframeEditorPanel v-else-if="activeTab === 'keyframes'" :track-id="trackId" :element="element" />
			</div>
		</div>

		<InspectorTabRail v-model="activeTab" :tabs="topTabs" />
	</div>
</template>
