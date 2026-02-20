<script setup lang="ts">
import { ref, computed } from "vue";
import { X, Instagram, Twitter, Youtube, Monitor } from "lucide-vue-next";

const props = defineProps<{
	visible: boolean;
}>();

const emit = defineEmits<{
	(e: "close"): void;
}>();

type Platform = "instagram_post" | "instagram_story" | "twitter" | "youtube" | "tiktok";

const activePlatform = ref<Platform>("instagram_post");

const platforms: { id: Platform; label: string; icon: any; aspect: string; safeZone: { top: number; bottom: number; left: number; right: number } }[] = [
	{
		id: "instagram_post",
		label: "IG Post",
		icon: Instagram,
		aspect: "1:1",
		safeZone: { top: 0, bottom: 0, left: 0, right: 0 },
	},
	{
		id: "instagram_story",
		label: "IG Story",
		icon: Instagram,
		aspect: "9:16",
		safeZone: { top: 14, bottom: 20, left: 4, right: 4 },
	},
	{
		id: "twitter",
		label: "Twitter",
		icon: Twitter,
		aspect: "16:9",
		safeZone: { top: 0, bottom: 0, left: 0, right: 0 },
	},
	{
		id: "youtube",
		label: "YouTube",
		icon: Youtube,
		aspect: "16:9",
		safeZone: { top: 0, bottom: 10, left: 0, right: 0 },
	},
	{
		id: "tiktok",
		label: "TikTok",
		icon: Monitor,
		aspect: "9:16",
		safeZone: { top: 10, bottom: 22, left: 4, right: 15 },
	},
];

const activePlatformConfig = computed(() => platforms.find((p) => p.id === activePlatform.value)!);

const safeZoneStyle = computed(() => {
	const sz = activePlatformConfig.value.safeZone;
	return {
		top: `${sz.top}%`,
		bottom: `${sz.bottom}%`,
		left: `${sz.left}%`,
		right: `${sz.right}%`,
	};
});

const hasSafeZone = computed(() => {
	const sz = activePlatformConfig.value.safeZone;
	return sz.top > 0 || sz.bottom > 0 || sz.left > 0 || sz.right > 0;
});
</script>

<template>
	<div v-if="visible" class="absolute inset-0 z-30 pointer-events-none">
		<!-- Safe zone overlay -->
		<div v-if="hasSafeZone" class="absolute inset-0">
			<!-- Top unsafe area -->
			<div
				class="absolute left-0 right-0 top-0 bg-red-500/10 border-b border-dashed border-red-500/40"
				:style="{ height: safeZoneStyle.top }"
			/>
			<!-- Bottom unsafe area -->
			<div
				class="absolute left-0 right-0 bottom-0 bg-red-500/10 border-t border-dashed border-red-500/40"
				:style="{ height: safeZoneStyle.bottom }"
			/>
			<!-- Left unsafe area -->
			<div
				class="absolute left-0 top-0 bottom-0 bg-red-500/10 border-r border-dashed border-red-500/40"
				:style="{ width: safeZoneStyle.left, top: safeZoneStyle.top, bottom: safeZoneStyle.bottom }"
			/>
			<!-- Right unsafe area -->
			<div
				class="absolute right-0 top-0 bottom-0 bg-red-500/10 border-l border-dashed border-red-500/40"
				:style="{ width: safeZoneStyle.right, top: safeZoneStyle.top, bottom: safeZoneStyle.bottom }"
			/>
		</div>

		<!-- Platform info badge -->
		<div class="absolute top-2 left-2 flex items-center gap-1.5 rounded bg-black/70 px-2 py-1 text-[10px] text-zinc-300 pointer-events-auto">
			<component :is="activePlatformConfig.icon" class="size-3" />
			<span>{{ activePlatformConfig.label }}</span>
			<span class="text-zinc-500">{{ activePlatformConfig.aspect }}</span>
		</div>

		<!-- Platform selector -->
		<div class="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-lg bg-black/70 p-1 pointer-events-auto">
			<button
				v-for="p in platforms"
				:key="p.id"
				type="button"
				class="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] transition-colors"
				:class="activePlatform === p.id ? 'bg-purple-600/40 text-purple-300' : 'text-zinc-500 hover:text-zinc-300'"
				@click="activePlatform = p.id"
			>
				<component :is="p.icon" class="size-3" />
				{{ p.label }}
			</button>
		</div>

		<!-- Close button -->
		<button
			type="button"
			class="absolute top-2 right-2 rounded bg-black/70 p-1 text-zinc-400 hover:text-white pointer-events-auto"
			@click="emit('close')"
		>
			<X class="size-3.5" />
		</button>

		<!-- Safe zone label -->
		<div v-if="hasSafeZone" class="absolute top-2 left-1/2 -translate-x-1/2 rounded bg-black/70 px-2 py-0.5 text-[9px] text-amber-400 pointer-events-auto">
			Safe zone guide — keep important content inside
		</div>
	</div>
</template>
