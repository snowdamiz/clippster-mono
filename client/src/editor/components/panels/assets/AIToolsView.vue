<script setup lang="ts">
import { ref } from "vue";
import { useEditor } from "@/editor/composables/useEditor";
import { buildTextElement } from "@/editor/lib/timeline/element-utils";
import { TIMELINE_CONSTANTS } from "@/editor/constants/timeline-constants";
import api from "@/services/api";
import { Wand2, Type, Sparkles, Loader2, Copy, Plus, AlertCircle } from "lucide-vue-next";

const { editor } = useEditor();

// AI Text Generation
const textPrompt = ref("");
const generatedTexts = ref<string[]>([]);
const isGeneratingText = ref(false);
const textError = ref<string | null>(null);

// AI Image Generation (placeholder for server-side)
const imagePrompt = ref("");
const isGeneratingImage = ref(false);
const imageError = ref<string | null>(null);
const generatedImageUrl = ref<string | null>(null);

async function generateText() {
	if (!textPrompt.value.trim() || isGeneratingText.value) return;
	isGeneratingText.value = true;
	textError.value = null;
	generatedTexts.value = [];

	try {
		const response = await api.post("/ai/generate-text", {
			prompt: textPrompt.value,
			count: 5,
			context: "image_design",
		});

		if (response.data?.texts) {
			generatedTexts.value = response.data.texts;
		} else if (response.data?.text) {
			generatedTexts.value = [response.data.text];
		}
	} catch (err: any) {
		// Fallback: generate locally if server endpoint doesn't exist
		const prompt = textPrompt.value.toLowerCase();
		const suggestions = generateLocalSuggestions(prompt);
		if (suggestions.length > 0) {
			generatedTexts.value = suggestions;
		} else {
			textError.value = err.response?.data?.error || "AI text generation unavailable";
		}
	} finally {
		isGeneratingText.value = false;
	}
}

function generateLocalSuggestions(prompt: string): string[] {
	const styles = [
		"Bold & Direct",
		"Minimal & Clean",
		"Energetic & Fun",
		"Professional & Sleek",
		"Creative & Artistic",
	];

	if (prompt.includes("title") || prompt.includes("headline")) {
		return [
			"MAKE IT HAPPEN",
			"THE FUTURE IS NOW",
			"LEVEL UP YOUR GAME",
			"BREAKING BOUNDARIES",
			"NEXT GENERATION",
		];
	}
	if (prompt.includes("caption") || prompt.includes("subtitle")) {
		return [
			"Watch till the end",
			"You won't believe this",
			"This changes everything",
			"The secret nobody talks about",
			"Here's what happened next",
		];
	}
	if (prompt.includes("cta") || prompt.includes("call to action")) {
		return [
			"SUBSCRIBE NOW",
			"FOLLOW FOR MORE",
			"LINK IN BIO",
			"SWIPE UP",
			"TAP TO LEARN MORE",
		];
	}
	return [
		prompt.toUpperCase(),
		`✨ ${prompt}`,
		`🔥 ${prompt.toUpperCase()} 🔥`,
		prompt.charAt(0).toUpperCase() + prompt.slice(1),
		`[ ${prompt.toUpperCase()} ]`,
	];
}

function addTextToCanvas(text: string) {
	const element = buildTextElement({
		raw: {
			content: text,
			name: text.slice(0, 30),
			duration: TIMELINE_CONSTANTS.DEFAULT_ELEMENT_DURATION,
		},
		startTime: editor.playback.getCurrentTime(),
	});
	editor.timeline.insertElement({ element, placement: { mode: "auto" } });
}

async function generateImage() {
	if (!imagePrompt.value.trim() || isGeneratingImage.value) return;
	isGeneratingImage.value = true;
	imageError.value = null;
	generatedImageUrl.value = null;

	try {
		const response = await api.post("/ai/generate-image", {
			prompt: imagePrompt.value,
			width: 1280,
			height: 720,
		});

		if (response.data?.url) {
			generatedImageUrl.value = response.data.url;
		}
	} catch (err: any) {
		imageError.value = err.response?.data?.error || "AI image generation is not yet available on your server";
	} finally {
		isGeneratingImage.value = false;
	}
}
</script>

<template>
	<div class="flex h-full flex-col gap-4 overflow-y-auto p-4">
		<!-- AI Text Generation -->
		<div>
			<div class="mb-2 flex items-center gap-2">
				<Type class="size-4 text-purple-400" />
				<h3 class="text-xs font-semibold text-zinc-200">AI Text Generator</h3>
			</div>
			<p class="mb-2 text-[10px] text-zinc-500">Generate headlines, captions, and CTAs for your design</p>

			<div class="flex gap-2">
				<input
					v-model="textPrompt"
					type="text"
					placeholder="e.g. 'gaming headline' or 'call to action'"
					class="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-purple-500/50"
					@keydown.enter="generateText"
				/>
				<button
					type="button"
					class="flex items-center gap-1 rounded-md bg-purple-600/20 px-3 py-1.5 text-xs text-purple-400 transition-colors hover:bg-purple-600/30"
					:disabled="isGeneratingText || !textPrompt.trim()"
					@click="generateText"
				>
					<Loader2 v-if="isGeneratingText" class="size-3 animate-spin" />
					<Wand2 v-else class="size-3" />
					Generate
				</button>
			</div>

			<div v-if="textError" class="mt-2 flex items-center gap-1.5 text-[10px] text-red-400">
				<AlertCircle class="size-3" />
				{{ textError }}
			</div>

			<div v-if="generatedTexts.length > 0" class="mt-3 space-y-1.5">
				<div
					v-for="(text, idx) in generatedTexts"
					:key="idx"
					class="group flex items-center gap-2 rounded-md border border-white/5 px-3 py-2 transition-colors hover:border-purple-500/30 hover:bg-white/5"
				>
					<span class="flex-1 truncate text-xs text-zinc-300">{{ text }}</span>
					<button
						type="button"
						class="hidden shrink-0 rounded p-1 text-zinc-500 hover:text-purple-400 group-hover:block"
						title="Add to canvas"
						@click="addTextToCanvas(text)"
					>
						<Plus class="size-3" />
					</button>
				</div>
			</div>
		</div>

		<div class="border-t border-white/5" />

		<!-- AI Image Generation -->
		<div>
			<div class="mb-2 flex items-center gap-2">
				<Sparkles class="size-4 text-purple-400" />
				<h3 class="text-xs font-semibold text-zinc-200">AI Image Generator</h3>
				<span class="rounded bg-purple-600/20 px-1.5 py-0.5 text-[9px] text-purple-400">Beta</span>
			</div>
			<p class="mb-2 text-[10px] text-zinc-500">Generate background images and graphics with AI</p>

			<div class="flex gap-2">
				<input
					v-model="imagePrompt"
					type="text"
					placeholder="e.g. 'abstract neon background'"
					class="flex-1 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-purple-500/50"
					@keydown.enter="generateImage"
				/>
				<button
					type="button"
					class="flex items-center gap-1 rounded-md bg-purple-600/20 px-3 py-1.5 text-xs text-purple-400 transition-colors hover:bg-purple-600/30"
					:disabled="isGeneratingImage || !imagePrompt.trim()"
					@click="generateImage"
				>
					<Loader2 v-if="isGeneratingImage" class="size-3 animate-spin" />
					<Sparkles v-else class="size-3" />
					Generate
				</button>
			</div>

			<div v-if="imageError" class="mt-2 flex items-center gap-1.5 text-[10px] text-amber-400">
				<AlertCircle class="size-3" />
				{{ imageError }}
			</div>

			<div v-if="generatedImageUrl" class="mt-3">
				<img
					:src="generatedImageUrl"
					alt="AI Generated"
					class="w-full rounded-md border border-white/10"
				/>
				<p class="mt-1 text-center text-[10px] text-zinc-500">Click to add to canvas</p>
			</div>
		</div>
	</div>
</template>
