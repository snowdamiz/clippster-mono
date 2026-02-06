<script setup lang="ts">
import { ref } from "vue";
import { useEditor } from "../../../composables/useEditor";
import { DEFAULT_TEXT_ELEMENT } from "../../../constants/text-constants";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-vue-next";

const { editor } = useEditor();

const selectedLanguage = ref("auto");
const isProcessing = ref(false);
const processingStep = ref("");
const error = ref<string | null>(null);

const languages = [
	{ code: "auto", name: "Auto detect" },
	{ code: "en", name: "English" },
	{ code: "es", name: "Spanish" },
	{ code: "fr", name: "French" },
	{ code: "de", name: "German" },
	{ code: "it", name: "Italian" },
	{ code: "pt", name: "Portuguese" },
	{ code: "ja", name: "Japanese" },
	{ code: "ko", name: "Korean" },
	{ code: "zh", name: "Chinese" },
	{ code: "ar", name: "Arabic" },
	{ code: "hi", name: "Hindi" },
	{ code: "ru", name: "Russian" },
];

async function handleGenerateTranscript() {
	try {
		isProcessing.value = true;
		error.value = null;
		processingStep.value = "Extracting audio...";

		// TODO: Integrate with transcription service when available
		// For now, this is a placeholder that shows the UI flow
		processingStep.value = "Transcription service not yet connected";
		await new Promise((resolve) => setTimeout(resolve, 1000));

		error.value = "Transcription service is not yet connected. This feature will be available after the export pipeline is integrated.";
	} catch (err) {
		console.error("Transcription failed:", err);
		error.value = err instanceof Error ? err.message : "An unexpected error occurred";
	} finally {
		isProcessing.value = false;
		processingStep.value = "";
	}
}
</script>

<template>
	<div class="flex h-full flex-col justify-between p-5">
		<!-- Language selector -->
		<div class="space-y-1.5">
			<label class="text-zinc-500 text-xs">Language</label>
			<select
				v-model="selectedLanguage"
				class="h-8 w-full rounded-md border border-white/10 bg-white/5 px-3 text-xs text-zinc-200"
			>
				<option v-for="lang in languages" :key="lang.code" :value="lang.code">
					{{ lang.name }}
				</option>
			</select>
		</div>

		<!-- Action area -->
		<div class="flex flex-col gap-4">
			<div
				v-if="error"
				class="rounded-md border border-red-500/20 bg-red-500/10 p-3"
			>
				<p class="text-red-400 text-sm">{{ error }}</p>
			</div>

			<Button
				class="w-full"
				:disabled="isProcessing"
				@click="handleGenerateTranscript"
			>
				<Loader2 v-if="isProcessing" class="mr-1 size-4 animate-spin" />
				{{ isProcessing ? processingStep : 'Generate transcript' }}
			</Button>
		</div>
	</div>
</template>
