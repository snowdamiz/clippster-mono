<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from "vue";
import type { SocialOverlayPreset } from "../../types/social-overlays";

const props = defineProps<{
	preset: SocialOverlayPreset;
	canvasWidth: number;
	canvasHeight: number;
}>();

const REF_W = 360;
const REF_H = 640;

const containerRef = ref<HTMLElement | null>(null);
const containerW = ref(0);
const containerH = ref(0);

let ro: ResizeObserver | null = null;
onMounted(() => {
	const el = containerRef.value;
	if (!el) return;
	ro = new ResizeObserver((entries) => {
		const r = entries[0]?.contentRect;
		if (r) {
			containerW.value = r.width;
			containerH.value = r.height;
		}
	});
	ro.observe(el);
	containerW.value = el.clientWidth;
	containerH.value = el.clientHeight;
});
onUnmounted(() => ro?.disconnect());

const scale = computed(() => {
	if (!containerW.value || !containerH.value) return 1;
	return containerH.value / REF_H;
});
</script>

<template>
	<div
		ref="containerRef"
		class="social-overlay pointer-events-none absolute inset-0 select-none overflow-hidden"
	>
		<div
			class="absolute left-1/2 top-1/2 origin-center"
			:style="{
				width: REF_W + 'px',
				height: REF_H + 'px',
				transform: `translate(-50%, -50%) scale(${scale})`,
			}"
		>

			<!-- ═══════════════ TikTok ═══════════════ -->
			<template v-if="preset.platform === 'tiktok'">
				<!-- Status bar -->
				<div class="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-2">
					<span class="text-[13px] font-semibold text-white" style="letter-spacing: 0.5px">9:41</span>
					<div class="flex items-center gap-[4px]">
						<svg class="h-[10px] w-auto" viewBox="0 0 17 10.7" fill="white"><rect x="0" y="6.7" width="3" height="4" rx="0.7"/><rect x="4.7" y="4.7" width="3" height="6" rx="0.7"/><rect x="9.3" y="2.7" width="3" height="8" rx="0.7"/><rect x="14" y="0" width="3" height="10.7" rx="0.7"/></svg>
						<svg class="h-[10px] w-auto" viewBox="0 0 15.3 10.7" fill="white"><path d="M7.7.3C10 .3 12 1.3 13.5 3l-5.8 7.7L1.8 3C3.3 1.3 5.3.3 7.7.3z"/></svg>
						<svg class="h-[10px] w-auto" viewBox="0 0 25 11" fill="white"><rect x="0" y="0.5" width="21" height="10" rx="2.2" stroke="white" stroke-width="1" fill="none"/><rect x="1.5" y="2" width="15" height="7" rx="1" fill="white"/><path d="M23 4v3a1.5 1.5 0 000-3z" fill="white" opacity="0.4"/></svg>
					</div>
				</div>

				<!-- Top nav: Explore / Following / For You / Search -->
				<div class="absolute inset-x-0 top-[36px] flex items-center justify-center gap-4">
					<span class="text-[13px] text-white/50">Explore</span>
					<span class="text-[13px] text-white/50">Following</span>
					<div class="flex flex-col items-center">
						<span class="text-[14px] font-bold text-white">For You</span>
						<div class="mt-[2px] h-[2px] w-[24px] rounded-full bg-white" />
					</div>
					<svg class="ml-1 h-[17px] w-[17px]" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="20" y2="20"/></svg>
				</div>

				<!-- Right side action buttons -->
				<div class="absolute right-[8px] bottom-[120px] flex flex-col items-center gap-[14px]">
					<!-- Profile pic -->
					<div class="relative mb-[4px]">
						<div class="h-[38px] w-[38px] rounded-full border-[2px] border-white bg-zinc-600" />
						<div class="absolute -bottom-[6px] left-1/2 -translate-x-1/2 flex h-[16px] w-[16px] items-center justify-center rounded-full bg-[#fe2c55]">
							<span class="text-[11px] font-bold leading-none text-white">+</span>
						</div>
					</div>
					<!-- Heart -->
					<div class="flex flex-col items-center gap-[1px]">
						<svg class="h-[26px] w-[26px]" viewBox="0 0 24 24" fill="white"><path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z"/></svg>
						<span class="text-[10px] font-semibold text-white">2.8M</span>
					</div>
					<!-- Comment -->
					<div class="flex flex-col items-center gap-[1px]">
						<svg class="h-[26px] w-[26px]" viewBox="0 0 24 24" fill="white"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/></svg>
						<span class="text-[10px] font-semibold text-white">28.4K</span>
					</div>
					<!-- Bookmark -->
					<div class="flex flex-col items-center gap-[1px]">
						<svg class="h-[24px] w-[24px]" viewBox="0 0 24 24" fill="white"><path d="M17 3H7c-1.1 0-2 .9-2 2v16l7-3 7 3V5c0-1.1-.9-2-2-2z"/></svg>
						<span class="text-[10px] font-semibold text-white">18.2K</span>
					</div>
					<!-- Share -->
					<div class="flex flex-col items-center gap-[1px]">
						<svg class="h-[24px] w-[24px]" viewBox="0 0 24 24" fill="white"><path d="M15 5l-1.41 1.41L18.17 11H2v2h16.17l-4.59 4.59L15 19l7-7-7-7z"/></svg>
						<span class="text-[10px] font-semibold text-white">Share</span>
					</div>
					<!-- Spinning disc -->
					<div class="mt-[2px] flex h-[30px] w-[30px] items-center justify-center rounded-full border-[6px] border-zinc-700 bg-zinc-900">
						<div class="h-[8px] w-[8px] rounded-full bg-zinc-400" />
					</div>
				</div>

				<!-- Bottom left: username + caption + music -->
				<div class="absolute bottom-[58px] left-[10px] right-[60px] flex flex-col gap-[4px]">
					<span class="text-[13px] font-bold text-white drop-shadow-sm">@your_name</span>
					<span class="text-[11px] leading-[15px] text-white/90 drop-shadow-sm">Here is some description about the video #fyp #viral</span>
					<div class="mt-[1px] flex items-center gap-[5px]">
						<svg class="h-[10px] w-[10px]" viewBox="0 0 24 24" fill="white"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
						<span class="text-[10px] text-white/80">Original sound - your_name</span>
					</div>
				</div>

				<!-- Bottom nav bar -->
				<div class="absolute inset-x-0 bottom-0 flex items-center justify-around bg-black px-[5px] pb-[18px] pt-[6px]">
					<div class="flex flex-col items-center gap-[1px]">
						<svg class="h-[20px] w-[20px]" viewBox="0 0 24 24" fill="white"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
						<span class="text-[9px] font-medium text-white">Home</span>
					</div>
					<div class="flex flex-col items-center gap-[1px]">
						<svg class="h-[20px] w-[20px]" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" opacity="0.5"><circle cx="11" cy="11" r="7"/><line x1="16" y1="16" x2="20" y2="20"/></svg>
						<span class="text-[9px] text-white/50">Discover</span>
					</div>
					<div class="flex items-center justify-center">
						<div class="relative flex h-[26px] w-[40px] items-center justify-center overflow-hidden rounded-[6px]">
							<div class="absolute left-0 h-full w-[20px] rounded-l-[6px] bg-[#25f4ee]" />
							<div class="absolute right-0 h-full w-[20px] rounded-r-[6px] bg-[#fe2c55]" />
							<div class="relative z-10 flex h-[22px] w-[32px] items-center justify-center rounded-[4px] bg-white">
								<span class="text-[17px] font-light leading-none text-black">+</span>
							</div>
						</div>
					</div>
					<div class="flex flex-col items-center gap-[1px]">
						<svg class="h-[20px] w-[20px]" viewBox="0 0 24 24" fill="white" opacity="0.5"><path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
						<span class="text-[9px] text-white/50">Inbox</span>
					</div>
					<div class="flex flex-col items-center gap-[1px]">
						<svg class="h-[20px] w-[20px]" viewBox="0 0 24 24" fill="white" opacity="0.5"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
						<span class="text-[9px] text-white/50">Profile</span>
					</div>
				</div>

				<!-- Home indicator bar -->
				<div class="absolute bottom-[5px] left-1/2 -translate-x-1/2 h-[4px] w-[120px] rounded-full bg-white/60" />
			</template>

			<!-- ═══════════════ Instagram Reels ═══════════════ -->
			<template v-else-if="preset.platform === 'instagram-reels'">
				<!-- Status bar -->
				<div class="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-2">
					<span class="text-[13px] font-semibold text-white" style="letter-spacing: 0.5px">9:41</span>
					<div class="flex items-center gap-[4px]">
						<svg class="h-[10px] w-auto" viewBox="0 0 17 10.7" fill="white"><rect x="0" y="6.7" width="3" height="4" rx="0.7"/><rect x="4.7" y="4.7" width="3" height="6" rx="0.7"/><rect x="9.3" y="2.7" width="3" height="8" rx="0.7"/><rect x="14" y="0" width="3" height="10.7" rx="0.7"/></svg>
						<svg class="h-[10px] w-auto" viewBox="0 0 15.3 10.7" fill="white"><path d="M7.7.3C10 .3 12 1.3 13.5 3l-5.8 7.7L1.8 3C3.3 1.3 5.3.3 7.7.3z"/></svg>
						<svg class="h-[10px] w-auto" viewBox="0 0 25 11" fill="white"><rect x="0" y="0.5" width="21" height="10" rx="2.2" stroke="white" stroke-width="1" fill="none"/><rect x="1.5" y="2" width="15" height="7" rx="1" fill="white"/><path d="M23 4v3a1.5 1.5 0 000-3z" fill="white" opacity="0.4"/></svg>
					</div>
				</div>

				<!-- Top header: Reels + Camera -->
				<div class="absolute inset-x-0 top-[36px] flex items-center justify-between px-[14px]">
					<span class="text-[19px] font-bold text-white">Reels</span>
					<svg class="h-[21px] w-[21px]" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8"><path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2v11z"/><circle cx="12" cy="13" r="4"/></svg>
				</div>

				<!-- Right side action buttons -->
				<div class="absolute right-[10px] bottom-[112px] flex flex-col items-center gap-[16px]">
					<!-- Heart -->
					<div class="flex flex-col items-center gap-[1px]">
						<svg class="h-[24px] w-[24px]" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
						<span class="text-[10px] font-semibold text-white">1.2M</span>
					</div>
					<!-- Comment -->
					<div class="flex flex-col items-center gap-[1px]">
						<svg class="h-[24px] w-[24px]" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/></svg>
						<span class="text-[10px] font-semibold text-white">4,521</span>
					</div>
					<!-- Send -->
					<div class="flex flex-col items-center gap-[1px]">
						<svg class="h-[24px] w-[24px]" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
						<span class="text-[10px] font-semibold text-white">Share</span>
					</div>
					<!-- Three dots (horizontal) -->
					<svg class="h-[18px] w-[18px]" viewBox="0 0 24 24" fill="white"><circle cx="5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="12" r="2"/></svg>
					<!-- Audio album art -->
					<div class="mt-[1px] h-[24px] w-[24px] rounded-[5px] border border-white/30 bg-gradient-to-br from-purple-500 to-pink-500" />
				</div>

				<!-- Bottom left: username + caption + audio -->
				<div class="absolute bottom-[54px] left-[10px] right-[56px] flex flex-col gap-[4px]">
					<div class="flex items-center gap-[6px]">
						<div class="h-[24px] w-[24px] rounded-full bg-zinc-500 border border-white/30" />
						<span class="text-[12px] font-bold text-white">your_name</span>
						<div class="rounded-[3px] border border-white/60 px-[6px] py-[1px]">
							<span class="text-[10px] font-semibold text-white">Follow</span>
						</div>
					</div>
					<span class="text-[11px] leading-[15px] text-white/90 drop-shadow-sm">Caption goes here #reels #viral</span>
					<div class="mt-[1px] flex items-center gap-[5px]">
						<svg class="h-[10px] w-[10px]" viewBox="0 0 24 24" fill="white"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
						<span class="text-[10px] text-white/70">Original audio · your_name</span>
					</div>
				</div>

				<!-- Bottom nav bar -->
				<div class="absolute inset-x-0 bottom-0 flex items-center justify-around bg-black px-[5px] pb-[18px] pt-[6px]">
					<!-- Home -->
					<div class="flex flex-col items-center">
						<svg class="h-[21px] w-[21px]" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" opacity="0.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"/></svg>
					</div>
					<!-- Search -->
					<div class="flex flex-col items-center">
						<svg class="h-[21px] w-[21px]" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.8" opacity="0.5"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="20" y2="20"/></svg>
					</div>
					<!-- Add -->
					<div class="flex flex-col items-center">
						<svg class="h-[24px] w-[24px]" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="4"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
					</div>
					<!-- Reels (active) -->
					<div class="flex flex-col items-center">
						<svg class="h-[21px] w-[21px]" viewBox="0 0 24 24" fill="white"><rect x="2" y="2" width="20" height="20" rx="5"/><path d="M2 8h20M8 2l-3 6M15 2l-3 6M10 12l5 3-5 3v-6z" stroke="black" stroke-width="1.5" fill="none"/></svg>
					</div>
					<!-- Profile -->
					<div class="flex flex-col items-center">
						<div class="h-[21px] w-[21px] rounded-full bg-zinc-500 border-[1.5px] border-white/30" />
					</div>
				</div>

				<!-- Home indicator -->
				<div class="absolute bottom-[5px] left-1/2 -translate-x-1/2 h-[4px] w-[120px] rounded-full bg-white/60" />
			</template>

			<!-- ═══════════════ YouTube Shorts ═══════════════ -->
			<template v-else-if="preset.platform === 'youtube-shorts'">
				<!-- Status bar -->
				<div class="absolute inset-x-0 top-0 flex items-center justify-between px-5 pt-2">
					<span class="text-[13px] font-semibold text-white" style="letter-spacing: 0.5px">9:41</span>
					<div class="flex items-center gap-[4px]">
						<svg class="h-[10px] w-auto" viewBox="0 0 17 10.7" fill="white"><rect x="0" y="6.7" width="3" height="4" rx="0.7"/><rect x="4.7" y="4.7" width="3" height="6" rx="0.7"/><rect x="9.3" y="2.7" width="3" height="8" rx="0.7"/><rect x="14" y="0" width="3" height="10.7" rx="0.7"/></svg>
						<svg class="h-[10px] w-auto" viewBox="0 0 15.3 10.7" fill="white"><path d="M7.7.3C10 .3 12 1.3 13.5 3l-5.8 7.7L1.8 3C3.3 1.3 5.3.3 7.7.3z"/></svg>
						<svg class="h-[10px] w-auto" viewBox="0 0 25 11" fill="white"><rect x="0" y="0.5" width="21" height="10" rx="2.2" stroke="white" stroke-width="1" fill="none"/><rect x="1.5" y="2" width="15" height="7" rx="1" fill="white"/><path d="M23 4v3a1.5 1.5 0 000-3z" fill="white" opacity="0.4"/></svg>
					</div>
				</div>

				<!-- Top bar: Search + more -->
				<div class="absolute right-[10px] top-[36px] flex items-center gap-[14px]">
					<svg class="h-[20px] w-[20px]" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><line x1="16.5" y1="16.5" x2="20" y2="20"/></svg>
					<svg class="h-[20px] w-[20px]" viewBox="0 0 24 24" fill="white"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>
				</div>

				<!-- Right side action buttons -->
				<div class="absolute right-[10px] bottom-[112px] flex flex-col items-center gap-[14px]">
					<!-- Thumbs up -->
					<div class="flex flex-col items-center gap-[1px]">
						<svg class="h-[24px] w-[24px]" viewBox="0 0 24 24" fill="white"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>
						<span class="text-[10px] font-medium text-white">845K</span>
					</div>
					<!-- Thumbs down -->
					<div class="flex flex-col items-center gap-[1px]">
						<svg class="h-[24px] w-[24px]" viewBox="0 0 24 24" fill="white"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>
						<span class="text-[10px] font-medium text-white">Dislike</span>
					</div>
					<!-- Comment -->
					<div class="flex flex-col items-center gap-[1px]">
						<svg class="h-[24px] w-[24px]" viewBox="0 0 24 24" fill="white"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z"/></svg>
						<span class="text-[10px] font-medium text-white">1,234</span>
					</div>
					<!-- Share -->
					<div class="flex flex-col items-center gap-[1px]">
						<svg class="h-[24px] w-[24px]" viewBox="0 0 24 24" fill="white"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" transform="scale(-1,1) translate(-24,0)"/></svg>
						<span class="text-[10px] font-medium text-white">Share</span>
					</div>
					<!-- Remix -->
					<div class="flex flex-col items-center gap-[1px]">
						<svg class="h-[21px] w-[21px]" viewBox="0 0 24 24" fill="white"><path d="M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z"/></svg>
						<span class="text-[10px] font-medium text-white">Remix</span>
					</div>
					<!-- Audio disc -->
					<div class="mt-[2px] flex h-[30px] w-[30px] items-center justify-center rounded-full border-[6px] border-zinc-700 bg-zinc-900">
						<div class="h-[8px] w-[8px] rounded-full bg-zinc-400" />
					</div>
				</div>

				<!-- Bottom left: channel + title + audio -->
				<div class="absolute bottom-[54px] left-[10px] right-[56px] flex flex-col gap-[6px]">
					<div class="flex items-center gap-[6px]">
						<div class="h-[28px] w-[28px] rounded-full bg-zinc-500" />
						<span class="text-[12px] font-bold text-white">@channel_name</span>
						<div class="rounded-full bg-white px-[10px] py-[3px]">
							<span class="text-[10px] font-bold text-black">Subscribe</span>
						</div>
					</div>
					<span class="text-[11px] leading-[15px] text-white drop-shadow-sm">Video title goes here #shorts</span>
					<div class="flex items-center gap-[5px]">
						<svg class="h-[10px] w-[10px]" viewBox="0 0 24 24" fill="white"><path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/></svg>
						<span class="text-[10px] text-white/70">Original sound</span>
					</div>
				</div>

				<!-- Bottom nav bar -->
				<div class="absolute inset-x-0 bottom-0 flex items-center justify-around bg-[#212121] px-[5px] pb-[18px] pt-[6px]">
					<div class="flex flex-col items-center gap-[1px]">
						<svg class="h-[21px] w-[21px]" viewBox="0 0 24 24" fill="white" opacity="0.5"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
						<span class="text-[9px] text-white/50">Home</span>
					</div>
					<div class="flex flex-col items-center gap-[1px]">
						<svg class="h-[21px] w-[21px]" viewBox="0 0 24 24" fill="white"><path d="M10 14.65v-5.3L15 12l-5 2.65zm7.77-4.33c-.77-.32-1.2-.5-1.2-.5L18 9.06c1.84-.96 2.53-3.23 1.56-5.06s-3.24-2.53-5.07-1.56L6 6.94c-1.29.68-2.07 2.04-2 3.49.07 1.42.93 2.67 2.22 3.25.03.01 1.2.5 1.2.5L6 14.94c-1.83.97-2.53 3.24-1.56 5.07.97 1.83 3.24 2.53 5.07 1.56L18 17.06c1.28-.68 2.06-2.04 1.99-3.49-.07-1.42-.94-2.68-2.22-3.25z"/></svg>
						<span class="text-[9px] font-bold text-white">Shorts</span>
					</div>
					<div class="flex items-center justify-center">
						<svg class="h-[28px] w-[28px]" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
					</div>
					<div class="flex flex-col items-center gap-[1px]">
						<svg class="h-[21px] w-[21px]" viewBox="0 0 24 24" fill="white" opacity="0.5"><path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2z"/></svg>
						<span class="text-[9px] text-white/50">Subs</span>
					</div>
					<div class="flex flex-col items-center gap-[1px]">
						<div class="h-[21px] w-[21px] rounded-full bg-zinc-500" />
						<span class="text-[9px] text-white/50">You</span>
					</div>
				</div>

				<!-- Home indicator -->
				<div class="absolute bottom-[5px] left-1/2 -translate-x-1/2 h-[4px] w-[120px] rounded-full bg-white/60" />
			</template>


		</div>
	</div>
</template>

<style scoped>
.social-overlay {
	font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
	-webkit-font-smoothing: antialiased;
}
</style>
