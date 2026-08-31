<script setup lang="ts">
import { computed, inject, onUnmounted, ref, type Ref } from "vue";
import {
	MousePointer2,
	Square,
	Circle,
	Crop,
	Paintbrush,
	Pencil,
	Eraser,
	PaintBucket,
	Pipette,
	Type,
	Shapes,
	Hand,
	ZoomIn,
	ArrowLeftRight,
	ImagePlus,
	Lasso,
	WandSparkles,
	Blend,
	Stamp,
	Wand2,
	Scissors,
	Sparkles,
	Hexagon,
	Bandage,
} from "lucide-vue-next";
import {
	IMAGE_TOOL_FLYouts,
	type ImageToolFlyoutSlot,
	type ImageToolDef,
} from "../constants/image-tool-flyouts";
import { useImageEditorTools } from "../composables/useImageEditorTools";
import type { PixelToolId } from "../types/image-document";

const { activeTool, activateTool, fillColor, strokeColor, getSlotVisibleTool, flyoutLastTool } =
	useImageEditorTools();
const setImageDockTab = inject<(tab: string) => void>("setImageDockTab");
const imageDockTab = inject<Ref<string>>("imageDockTab");
const isPlaceOpen = computed(() => imageDockTab?.value === "media");

const ICONS: Record<string, any> = {
	move: MousePointer2,
	"marquee-rect": Square,
	"marquee-ellipse": Circle,
	lasso: Lasso,
	"polygonal-lasso": Hexagon,
	"magic-wand": WandSparkles,
	crop: Crop,
	brush: Paintbrush,
	pencil: Pencil,
	eraser: Eraser,
	"background-eraser": Scissors,
	"magic-eraser": Sparkles,
	fill: PaintBucket,
	gradient: Blend,
	clone: Stamp,
	heal: Wand2,
	"spot-heal": Bandage,
	eyedropper: Pipette,
	text: Type,
	shape: Shapes,
	"shape-rect": Square,
	"shape-ellipse": Circle,
	hand: Hand,
	zoom: ZoomIn,
};

const openFlyoutId = ref<string | null>(null);
const flyoutAnchor = ref<{ top: number; left: number } | null>(null);
let holdTimer: ReturnType<typeof setTimeout> | null = null;
let hoverTimer: ReturnType<typeof setTimeout> | null = null;
let suppressClick = false;

const sectionedSlots = computed(() => {
	const sections: Array<{ section: string; slots: ImageToolFlyoutSlot[] }> = [];
	for (const slot of IMAGE_TOOL_FLYouts) {
		const last = sections[sections.length - 1];
		if (!last || last.section !== slot.section) {
			sections.push({ section: slot.section, slots: [slot] });
		} else {
			last.slots.push(slot);
		}
	}
	return sections;
});

const openSlot = computed(() =>
	openFlyoutId.value ? IMAGE_TOOL_FLYouts.find((s) => s.id === openFlyoutId.value) ?? null : null,
);

function visibleToolId(slot: ImageToolFlyoutSlot): PixelToolId {
	void flyoutLastTool.value;
	return getSlotVisibleTool(slot.id);
}

function slotIsActive(slot: ImageToolFlyoutSlot): boolean {
	return slot.tools.some((t) => t.id === activeTool.value);
}

function clearTimers() {
	if (holdTimer) {
		clearTimeout(holdTimer);
		holdTimer = null;
	}
	if (hoverTimer) {
		clearTimeout(hoverTimer);
		hoverTimer = null;
	}
}

function openFlyout(slot: ImageToolFlyoutSlot, el: HTMLElement) {
	const rect = el.getBoundingClientRect();
	flyoutAnchor.value = { top: rect.top, left: rect.right + 4 };
	openFlyoutId.value = slot.id;
}

function closeFlyout() {
	openFlyoutId.value = null;
	flyoutAnchor.value = null;
	clearTimers();
}

function onSlotPointerDown(event: PointerEvent, slot: ImageToolFlyoutSlot) {
	if (event.button === 2) return;
	suppressClick = false;
	clearTimers();
	const el = event.currentTarget as HTMLElement;
	if (slot.tools.length <= 1) return;
	holdTimer = setTimeout(() => {
		suppressClick = true;
		openFlyout(slot, el);
	}, 320);
}

function onSlotPointerUp() {
	if (holdTimer) {
		clearTimeout(holdTimer);
		holdTimer = null;
	}
}

function onSlotClick(slot: ImageToolFlyoutSlot) {
	if (suppressClick) {
		suppressClick = false;
		return;
	}
	activateTool(visibleToolId(slot));
	closeFlyout();
}

function onSlotContextMenu(event: MouseEvent, slot: ImageToolFlyoutSlot) {
	event.preventDefault();
	if (slot.tools.length <= 1) {
		activateTool(visibleToolId(slot));
		return;
	}
	openFlyout(slot, event.currentTarget as HTMLElement);
}

function onSlotPointerEnter(event: PointerEvent, slot: ImageToolFlyoutSlot) {
	clearTimers();
	if (slot.tools.length <= 1) return;
	const el = event.currentTarget as HTMLElement;
	hoverTimer = setTimeout(() => openFlyout(slot, el), 450);
}

function onSlotPointerLeave() {
	if (hoverTimer) {
		clearTimeout(hoverTimer);
		hoverTimer = null;
	}
}

function onFlyoutSelect(tool: ImageToolDef) {
	activateTool(tool.id);
	closeFlyout();
}

function onDocPointerDown(event: PointerEvent) {
	const target = event.target as HTMLElement | null;
	if (target?.closest?.("[data-tool-flyout]") || target?.closest?.("[data-tool-slot]")) return;
	closeFlyout();
}

if (typeof window !== "undefined") {
	window.addEventListener("pointerdown", onDocPointerDown, true);
}
onUnmounted(() => {
	clearTimers();
	if (typeof window !== "undefined") {
		window.removeEventListener("pointerdown", onDocPointerDown, true);
	}
});

function swapColors() {
	const nextFill = strokeColor.value;
	strokeColor.value = fillColor.value;
	fillColor.value = nextFill;
}

function resetColors() {
	fillColor.value = "#ffffff";
	strokeColor.value = "#000000";
}
</script>

<template>
	<div class="relative flex w-10 shrink-0 flex-col items-center border-r border-black/50 bg-[#1e1e1e] py-1.5">
		<template v-for="(section, index) in sectionedSlots" :key="section.section">
			<div v-if="index > 0" class="my-1 h-px w-6 bg-white/10" />
			<div
				v-for="slot in section.slots"
				:key="slot.id"
				data-tool-slot
				class="relative"
				@pointerenter="onSlotPointerEnter($event, slot)"
				@pointerleave="onSlotPointerLeave"
			>
				<button
					type="button"
					:title="`${IMAGE_TOOL_FLYouts.find((s) => s.id === slot.id)?.tools.find((t) => t.id === visibleToolId(slot))?.label ?? slot.id} (${slot.tools[0].shortcut})${slot.tools.length > 1 ? ' · hold / right-click for more' : ''}`"
					:aria-label="visibleToolId(slot)"
					:aria-pressed="slotIsActive(slot)"
					:aria-haspopup="slot.tools.length > 1 ? 'menu' : undefined"
					:aria-expanded="openFlyoutId === slot.id"
					:class="[
						'relative flex size-8 items-center justify-center rounded-sm transition-colors',
						slotIsActive(slot)
							? 'bg-[#4693e0] text-white'
							: 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100',
					]"
					@pointerdown="onSlotPointerDown($event, slot)"
					@pointerup="onSlotPointerUp"
					@pointercancel="onSlotPointerUp"
					@click="onSlotClick(slot)"
					@contextmenu="onSlotContextMenu($event, slot)"
				>
					<component :is="ICONS[visibleToolId(slot)] || MousePointer2" class="size-3.5" />
					<!-- Photoshop-style nested-tools triangle -->
					<span
						v-if="slot.tools.length > 1"
						class="pointer-events-none absolute bottom-0.5 right-0.5 size-0 border-b-[4px] border-l-[4px] border-b-current border-l-transparent opacity-70"
						aria-hidden="true"
					/>
				</button>
			</div>
		</template>

		<div class="my-1 h-px w-6 bg-white/10" />
		<button
			type="button"
			title="Upload images (Media)"
			aria-label="Open media panel"
			:aria-pressed="isPlaceOpen"
			:class="[
				'flex size-8 items-center justify-center rounded-sm transition-colors',
				isPlaceOpen
					? 'bg-[#4693e0] text-white'
					: 'text-zinc-400 hover:bg-white/[0.06] hover:text-zinc-100',
			]"
			@click="setImageDockTab?.(isPlaceOpen ? 'properties' : 'media')"
		>
			<ImagePlus class="size-3.5" />
		</button>

		<div class="mt-auto flex flex-col items-center gap-1 pb-2">
			<div class="relative size-8">
				<button
					type="button"
					class="absolute bottom-0 right-0 size-[14px] rounded-[2px] border border-black/60"
					:style="{ backgroundColor: strokeColor }"
					title="Stroke color"
					@click="swapColors"
				/>
				<input
					v-model="fillColor"
					type="color"
					class="absolute left-0 top-0 size-[18px] cursor-pointer rounded-[2px] border border-black/60 bg-transparent p-0"
					title="Fill color"
				/>
			</div>
			<button
				type="button"
				class="text-[8px] leading-none text-zinc-600 hover:text-zinc-400"
				title="Reset to black and white"
				@click="resetColors"
			>
				D
			</button>
			<button
				type="button"
				class="text-zinc-600 hover:text-zinc-300"
				title="Swap fill and stroke (X)"
				@click="swapColors"
			>
				<ArrowLeftRight class="size-2.5" />
			</button>
		</div>

		<!-- Photoshop-style flyout menu -->
		<Teleport to="body">
			<div
				v-if="openSlot && flyoutAnchor"
				data-tool-flyout
				class="fixed z-[9999] min-w-[220px] overflow-hidden rounded border border-white/15 bg-[#2a2a2e] py-1 shadow-xl shadow-black/50"
				:style="{ top: `${flyoutAnchor.top}px`, left: `${flyoutAnchor.left}px` }"
				role="menu"
				@pointerenter="clearTimers()"
				@pointerleave="closeFlyout"
			>
				<button
					v-for="tool in openSlot.tools"
					:key="tool.id"
					type="button"
					role="menuitem"
					:class="[
						'flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-[12px] transition-colors',
						activeTool === tool.id
							? 'bg-[#4693e0] text-white'
							: 'text-zinc-200 hover:bg-white/10',
					]"
					@click="onFlyoutSelect(tool)"
				>
					<component :is="ICONS[tool.id] || MousePointer2" class="size-3.5 shrink-0 opacity-90" />
					<span class="min-w-0 flex-1 truncate">{{ tool.label }}</span>
					<span class="shrink-0 text-[10px] opacity-60">{{ tool.shortcut }}</span>
				</button>
			</div>
		</Teleport>
	</div>
</template>
