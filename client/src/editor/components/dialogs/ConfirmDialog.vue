<script setup lang="ts">
import { ref, watch } from "vue";
import { X as XIcon, AlertTriangle } from "lucide-vue-next";

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

function handleConfirm() {
	emit("confirm");
	emit("update:open", false);
}

function handleCancel() {
	emit("cancel");
	emit("update:open", false);
}

function handleBackdropClick(event: MouseEvent) {
	if (event.target === event.currentTarget) {
		handleCancel();
	}
}
</script>

<template>
	<Teleport to="body">
		<Transition
			enter-active-class="transition-opacity duration-200"
			enter-from-class="opacity-0"
			enter-to-class="opacity-100"
			leave-active-class="transition-opacity duration-150"
			leave-from-class="opacity-100"
			leave-to-class="opacity-0"
		>
			<div
				v-if="isOpen"
				class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
				@click="handleBackdropClick"
			>
				<Transition
					enter-active-class="transition-all duration-200"
					enter-from-class="opacity-0 scale-95"
					enter-to-class="opacity-100 scale-100"
					leave-active-class="transition-all duration-150"
					leave-from-class="opacity-100 scale-100"
					leave-to-class="opacity-0 scale-95"
				>
					<div
						v-if="isOpen"
						class="relative w-full max-w-md rounded-lg border bg-zinc-900 shadow-2xl"
						:class="{
							'border-red-500/30': variant === 'danger',
							'border-yellow-500/30': variant === 'warning',
							'border-blue-500/30': variant === 'info',
						}"
						@click.stop
					>
						<!-- Header -->
						<div class="flex items-center justify-between border-b border-white/10 px-4 py-3">
							<div class="flex items-center gap-2">
								<AlertTriangle
									class="size-5"
									:class="{
										'text-red-400': variant === 'danger',
										'text-yellow-400': variant === 'warning',
										'text-blue-400': variant === 'info',
									}"
								/>
								<h3 class="text-sm font-semibold text-zinc-100">{{ title }}</h3>
							</div>
							<button
								@click="handleCancel"
								class="rounded p-1 text-zinc-500 transition-colors hover:bg-white/5 hover:text-zinc-300"
							>
								<XIcon class="size-4" />
							</button>
						</div>

						<!-- Content -->
						<div class="px-4 py-4">
							<p class="text-sm leading-relaxed text-zinc-300">{{ message }}</p>
						</div>

						<!-- Actions -->
						<div class="flex items-center justify-end gap-2 border-t border-white/10 px-4 py-3">
							<button
								@click="handleCancel"
								class="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-zinc-300 transition-colors hover:bg-white/10"
							>
								{{ cancelText }}
							</button>
							<button
								@click="handleConfirm"
								class="rounded-md border px-3 py-1.5 text-xs font-medium transition-colors"
								:class="{
									'border-red-500/30 bg-red-500/20 text-red-400 hover:bg-red-500/30': variant === 'danger',
									'border-yellow-500/30 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30': variant === 'warning',
									'border-blue-500/30 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30': variant === 'info',
								}"
							>
								{{ confirmText }}
							</button>
						</div>
					</div>
				</Transition>
			</div>
		</Transition>
	</Teleport>
</template>
