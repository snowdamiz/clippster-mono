<script setup lang="ts">
/**
 * Result block for the export dialogs: a status icon, a title and a message,
 * with optional extra content (saved path, actions) in the default slot.
 */
import { computed } from "vue";
import { AlertTriangle, Check } from "lucide-vue-next";
import { IconTile } from "@/components/ui/icon-tile";

const props = defineProps<{
	status: "success" | "error";
	title: string;
	message?: string;
}>();

const icon = computed(() => (props.status === "success" ? Check : AlertTriangle));
</script>

<template>
	<div class="flex flex-col gap-4">
		<div class="flex items-start gap-3">
			<IconTile :icon="icon" :tone="status === 'success' ? 'success' : 'danger'" size="md" />
			<div class="min-w-0 flex-1">
				<h3 class="text-sm font-semibold text-fg">{{ title }}</h3>
				<p
					v-if="message"
					:class="[
						'mt-0.5 text-sm',
						status === 'error'
							? 'max-h-40 overflow-y-auto whitespace-pre-wrap break-words font-mono text-xs text-fg-muted'
							: 'text-fg-muted',
					]"
				>
					{{ message }}
				</p>
			</div>
		</div>
		<slot />
	</div>
</template>
