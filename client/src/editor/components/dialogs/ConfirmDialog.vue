<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { AlertTriangle, Info } from "lucide-vue-next";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

interface Props {
	open: boolean;
	title: string;
	message: string;
	confirmText?: string;
	cancelText?: string;
	variant?: "danger" | "warning" | "info";
}

const props = withDefaults(defineProps<Props>(), {
	confirmText: "Confirm",
	cancelText: "Cancel",
	variant: "danger",
});

const emit = defineEmits<{
	confirm: [];
	cancel: [];
	"update:open": [value: boolean];
}>();

const isOpen = ref(props.open);

watch(() => props.open, (newVal) => {
	isOpen.value = newVal;
});

const tone = computed(() => (props.variant === "info" ? "brand" : props.variant));

function handleConfirm() {
	emit("confirm");
	emit("update:open", false);
}

function handleCancel() {
	emit("cancel");
	emit("update:open", false);
}
</script>

<template>
	<Modal
		:open="isOpen"
		:title="title"
		:icon="variant === 'info' ? Info : AlertTriangle"
		:tone="tone"
		size="sm"
		@update:open="(value) => { if (!value) handleCancel(); }"
	>
		<p class="text-sm text-fg-muted">{{ message }}</p>

		<template #footer>
			<Button variant="ghost" @click="handleCancel">{{ cancelText }}</Button>
			<Button :variant="variant === 'danger' ? 'destructive' : 'primary'" @click="handleConfirm">
				{{ confirmText }}
			</Button>
		</template>
	</Modal>
</template>
