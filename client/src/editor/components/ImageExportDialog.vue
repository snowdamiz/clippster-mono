<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { Check, Download, Loader2, RotateCcw, X } from "lucide-vue-next";
import {
	useImageMode,
	type ImageExportFormat,
} from "../composables/useImageMode";
import { useEditor } from "../composables/useEditor";

const props = defineProps<{
	open: boolean;
}>();

const emit = defineEmits<{
	close: [];
	exported: [path: string | null];
}>();

const { exportAndSave } = useImageMode();
const { editor, version } = useEditor({
	subscribe: {
		project: true,
		playback: false,
		timeline: false,
		scenes: false,
		media: false,
		selection: false,
	},
});

type ExportDestination = "library" | "library_and_disk" | "disk";

const format = ref<ImageExportFormat>("png");
const destination = ref<ExportDestination>("library_and_disk");
const isExporting = ref(false);
const error = ref<string | null>(null);
const successPath = ref<string | null>(null);
const successMessage = ref("");

const formatOptions: { value: ImageExportFormat; label: string; hint: string }[] = [
	{ value: "png", label: "PNG", hint: "Lossless quality with transparency support" },
	{ value: "jpg", label: "JPEG", hint: "Smaller files — best for photos without transparency" },
	{ value: "webp", label: "WebP", hint: "Modern format — smaller than PNG with good quality" },
];

const destinationOptions: { value: ExportDestination; label: string; hint: string }[] = [
	{
		value: "library",
		label: "Save to Images",
		hint: "Add to your Clippster Image gallery only",
	},
	{
		value: "library_and_disk",
		label: "Save and Export",
		hint: "Save to Image gallery and download a local file",
	},
	{
		value: "disk",
		label: "Export",
		hint: "Download a local file only — skip the Image gallery",
	},
];

const formatHint = computed(
	() => formatOptions.find((o) => o.value === format.value)?.hint ?? "",
);

const destinationHint = computed(
	() => destinationOptions.find((o) => o.value === destination.value)?.hint ?? "",
);

const destinationBadge = computed(
	() => destinationOptions.find((o) => o.value === destination.value)?.label ?? "",
);

const exportButtonLabel = computed(() => {
	switch (destination.value) {
		case "library":
			return "Save to Images";
		case "library_and_disk":
			return "Save and Export";
		default:
			return "Export Image";
	}
});

const projectName = computed(() => {
	void version.value;
	return editor.project.getActiveOrNull()?.metadata.name || "Untitled Design";
});

const canvasLabel = computed(() => {
	void version.value;
	const size = editor.project.getActiveOrNull()?.settings.canvasSize;
	if (!size) return "";
	return `${size.width} × ${size.height}`;
});

watch(
	() => props.open,
	(open) => {
		if (open) {
			error.value = null;
			successPath.value = null;
			successMessage.value = "";
			isExporting.value = false;
		}
	},
);

function close() {
	if (isExporting.value) return;
	emit("close");
}

async function handleExport() {
	if (isExporting.value) return;
	isExporting.value = true;
	error.value = null;
	successPath.value = null;
	successMessage.value = "";

	try {
		const path = await exportAndSave(format.value, projectName.value, {
			destination: destination.value,
			preferDiskDialog: destination.value !== "library",
		});
		if (!path) {
			// User cancelled the save dialog
			return;
		}
		successPath.value = path;
		successMessage.value =
			destination.value === "library"
				? "Saved to your Image gallery"
				: destination.value === "library_and_disk"
					? "Saved to Image gallery and exported"
					: "Image exported";
		emit("exported", path);
	} catch (e) {
		console.error("[ImageExportDialog] Export failed:", e);
		error.value = e instanceof Error ? e.message : "Export failed";
	} finally {
		isExporting.value = false;
	}
}
</script>

<template>
	<Teleport to="body">
		<Transition name="modal">
			<div v-if="open" class="export-dialog__overlay" @click.self="close">
				<Transition name="dialog" appear>
					<div class="export-dialog">
						<div class="export-dialog__accent" />

						<div class="export-dialog__header">
							<button
								type="button"
								class="export-dialog__close"
								title="Close"
								:disabled="isExporting"
								@click="close"
							>
								<X :size="18" />
							</button>
							<div class="export-dialog__icon">
								<Download :size="24" />
							</div>
							<h2 class="export-dialog__title">Export Image</h2>
							<p class="export-dialog__subtitle">
								{{ projectName }}
								<span v-if="canvasLabel"> · {{ canvasLabel }}</span>
							</p>
						</div>

						<div class="export-dialog__content">
							<!-- Success -->
							<div v-if="successPath && !isExporting" class="export-dialog__step-content">
								<div class="export-dialog__success-section">
									<div class="export-dialog__success-header">
										<div class="export-dialog__success-icon">
											<Check :size="32" />
										</div>
										<h3 class="export-dialog__success-title">Export Complete!</h3>
										<p class="export-dialog__success-subtitle">
											{{ successMessage || "Your image has been saved" }}
										</p>
									</div>
									<div class="export-dialog__success-path">
										<span class="export-dialog__success-path-label">Saved to</span>
										<span class="export-dialog__success-path-value" :title="successPath">
											{{ successPath }}
										</span>
									</div>
									<div class="export-dialog__success-actions">
										<button
											type="button"
											class="export-dialog__success-btn export-dialog__success-btn--primary"
											@click="handleExport"
										>
											<Download :size="16" />
											Save Again
										</button>
										<button type="button" class="export-dialog__success-btn" @click="close">
											Close
										</button>
									</div>
								</div>
							</div>

							<!-- Error -->
							<div v-else-if="error && !isExporting" class="export-dialog__step-content">
								<div class="export-dialog__error-section">
									<div class="export-dialog__error-header">
										<div class="export-dialog__error-icon">
											<X :size="20" />
										</div>
										<h3 class="export-dialog__error-title">Export Failed</h3>
									</div>
									<p class="export-dialog__error-message">{{ error }}</p>
									<div class="export-dialog__error-actions">
										<button
											type="button"
											class="export-dialog__error-btn export-dialog__error-btn--retry"
											@click="handleExport"
										>
											<RotateCcw :size="14" />
											Retry Export
										</button>
									</div>
								</div>
							</div>

							<!-- Exporting -->
							<div v-else-if="isExporting" class="export-dialog__step-content">
								<div class="export-dialog__step-header">
									<h3 class="export-dialog__step-title">Exporting Image</h3>
									<p class="export-dialog__step-subtitle">
										Rendering your canvas at full resolution
									</p>
								</div>
								<div class="export-dialog__progress-section">
									<div class="export-dialog__progress-header">
										<span class="export-dialog__progress-label">Progress</span>
										<span class="export-dialog__progress-value">…</span>
									</div>
									<div class="export-dialog__progress-bar">
										<div class="export-dialog__progress-fill export-dialog__progress-fill--indeterminate" />
									</div>
									<p class="export-dialog__progress-hint">
										{{
											destination === "library"
												? "Saving to your Image gallery…"
												: destination === "library_and_disk"
													? "Saving to gallery and opening save dialog…"
													: "Preparing image and opening save dialog…"
										}}
									</p>
								</div>
							</div>

							<!-- Settings -->
							<div v-else class="export-dialog__step-content">
								<div class="export-dialog__step-header">
									<h3 class="export-dialog__step-title">Export Settings</h3>
									<p class="export-dialog__step-subtitle">
										Choose a file type and where to save
									</p>
								</div>

								<div class="export-dialog__export-settings">
									<div class="export-dialog__setting-group">
										<div class="export-dialog__setting-header">
											<label class="export-dialog__setting-label">Output Format</label>
											<span class="export-dialog__setting-badge">{{ format.toUpperCase() }}</span>
										</div>
										<div class="export-dialog__setting-buttons">
											<button
												v-for="opt in formatOptions"
												:key="opt.value"
												type="button"
												class="export-dialog__setting-btn"
												:class="{ 'export-dialog__setting-btn--active': format === opt.value }"
												@click="format = opt.value"
											>
												{{ opt.label }}
											</button>
										</div>
										<p class="export-dialog__setting-hint">{{ formatHint }}</p>
									</div>

									<div class="export-dialog__setting-group">
										<div class="export-dialog__setting-header">
											<label class="export-dialog__setting-label">Destination</label>
											<span class="export-dialog__setting-badge">{{ destinationBadge }}</span>
										</div>
										<div class="export-dialog__setting-buttons">
											<button
												v-for="opt in destinationOptions"
												:key="opt.value"
												type="button"
												class="export-dialog__setting-btn"
												:class="{ 'export-dialog__setting-btn--active': destination === opt.value }"
												@click="destination = opt.value"
											>
												{{ opt.label }}
											</button>
										</div>
										<p class="export-dialog__setting-hint">{{ destinationHint }}</p>
									</div>
								</div>
							</div>
						</div>

						<div class="export-dialog__footer">
							<div class="export-dialog__footer-left">
								<button
									v-if="!isExporting"
									type="button"
									class="export-dialog__btn export-dialog__btn--back"
									@click="close"
								>
									{{ successPath || error ? "Close" : "Cancel" }}
								</button>
							</div>
							<div class="export-dialog__footer-right">
								<button
									v-if="!isExporting && !error && !successPath"
									type="button"
									class="export-dialog__btn export-dialog__btn--primary"
									@click="handleExport"
								>
									<Download :size="16" />
									{{ exportButtonLabel }}
								</button>
								<button
									v-else-if="isExporting"
									type="button"
									class="export-dialog__btn export-dialog__btn--primary"
									disabled
								>
									<Loader2 :size="16" class="export-dialog__spin" />
									Exporting…
								</button>
							</div>
						</div>
					</div>
				</Transition>
			</div>
		</Transition>
	</Teleport>
</template>

<style scoped>
.export-dialog__overlay {
	position: fixed;
	inset: 0;
	background-color: rgba(0, 0, 0, 0.7);
	backdrop-filter: blur(4px);
	display: flex;
	align-items: center;
	justify-content: center;
	z-index: 10000;
}

.export-dialog {
	background-color: var(--sidebar-surface);
	border: 1px solid var(--sidebar-border);
	border-radius: 12px;
	width: 100%;
	max-width: 600px;
	margin: 1rem;
	max-height: 90vh;
	display: flex;
	flex-direction: column;
	overflow: hidden;
	box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
}

.export-dialog__accent {
	height: 3px;
	background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
	flex-shrink: 0;
}

.export-dialog__header {
	position: relative;
	display: flex;
	flex-direction: column;
	align-items: center;
	padding: 1.5rem 1.5rem 1rem;
	text-align: center;
}

.export-dialog__close {
	position: absolute;
	top: 1rem;
	right: 1rem;
	width: 32px;
	height: 32px;
	display: flex;
	align-items: center;
	justify-content: center;
	background: transparent;
	border: none;
	border-radius: 6px;
	color: var(--sidebar-text-muted);
	cursor: pointer;
	transition: all 150ms ease;
}

.export-dialog__close:hover {
	background-color: var(--sidebar-hover);
	color: var(--sidebar-text);
}

.export-dialog__close:disabled {
	opacity: 0.3;
	cursor: not-allowed;
}

.export-dialog__icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 52px;
	height: 52px;
	border-radius: 12px;
	background-color: rgba(6, 182, 212, 0.15);
	color: var(--sidebar-accent);
	margin-bottom: 0.875rem;
}

.export-dialog__title {
	font-size: 1.25rem;
	font-weight: 700;
	color: var(--sidebar-text);
	margin: 0;
	letter-spacing: -0.02em;
}

.export-dialog__subtitle {
	font-size: 0.8125rem;
	color: var(--sidebar-text-muted);
	margin: 0.25rem 0 0;
}

.export-dialog__content {
	flex: 1;
	overflow-y: auto;
	padding: 0;
}

.export-dialog__step-content {
	display: flex;
	flex-direction: column;
	gap: 1rem;
	padding: 1.5rem;
}

.export-dialog__step-header {
	text-align: center;
	margin-bottom: 0.5rem;
}

.export-dialog__step-title {
	font-size: 1rem;
	font-weight: 600;
	color: var(--sidebar-text);
	margin: 0 0 0.25rem;
}

.export-dialog__step-subtitle {
	font-size: 0.875rem;
	color: var(--sidebar-text-muted);
	margin: 0;
}

.export-dialog__export-settings {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.export-dialog__setting-group {
	background-color: rgba(255, 255, 255, 0.03);
	border: 1px solid var(--sidebar-border);
	border-radius: 10px;
	padding: 1rem;
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.export-dialog__setting-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.export-dialog__setting-label {
	font-size: 0.875rem;
	font-weight: 600;
	color: var(--sidebar-text);
}

.export-dialog__setting-badge {
	font-size: 0.75rem;
	font-family: monospace;
	color: var(--sidebar-accent);
	background-color: rgba(6, 182, 212, 0.1);
	padding: 0.25rem 0.5rem;
	border-radius: 4px;
	text-transform: capitalize;
}

.export-dialog__setting-buttons {
	display: flex;
	gap: 0.5rem;
}

.export-dialog__setting-btn {
	flex: 1;
	padding: 0.625rem 1rem;
	font-size: 0.875rem;
	font-weight: 500;
	border-radius: 8px;
	border: 1px solid var(--sidebar-border);
	background-color: rgba(255, 255, 255, 0.05);
	color: var(--sidebar-text-muted);
	cursor: pointer;
	transition: all 150ms ease;
	display: flex;
	align-items: center;
	justify-content: center;
}

.export-dialog__setting-btn:hover {
	background-color: rgba(255, 255, 255, 0.08);
	color: var(--sidebar-text);
}

.export-dialog__setting-btn--active {
	background-color: var(--sidebar-accent);
	color: white;
	border-color: var(--sidebar-accent);
	box-shadow: 0 2px 8px rgba(6, 182, 212, 0.2);
}

.export-dialog__setting-hint {
	font-size: 0.6875rem;
	color: var(--sidebar-text-muted);
	line-height: 1.4;
	margin: 0;
}

.export-dialog__progress-section {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	padding: 0.875rem;
	border-radius: 10px;
	border: 1px solid var(--sidebar-border);
	background-color: rgba(255, 255, 255, 0.03);
}

.export-dialog__progress-header {
	display: flex;
	align-items: center;
	justify-content: space-between;
}

.export-dialog__progress-label {
	font-size: 0.8125rem;
	color: var(--sidebar-text-muted);
}

.export-dialog__progress-value {
	font-size: 0.8125rem;
	font-weight: 600;
	color: var(--sidebar-accent);
}

.export-dialog__progress-bar {
	height: 6px;
	border-radius: 999px;
	background-color: rgba(255, 255, 255, 0.08);
	overflow: hidden;
}

.export-dialog__progress-fill {
	height: 100%;
	border-radius: 999px;
	background: linear-gradient(90deg, var(--sidebar-accent), #0891b2);
	transition: width 200ms ease;
}

.export-dialog__progress-fill--indeterminate {
	width: 40%;
	animation: export-indeterminate 1.2s ease-in-out infinite;
}

@keyframes export-indeterminate {
	0% {
		transform: translateX(-120%);
	}
	100% {
		transform: translateX(280%);
	}
}

.export-dialog__progress-hint {
	font-size: 0.75rem;
	color: var(--sidebar-text-muted);
	margin: 0;
}

.export-dialog__error-section {
	display: flex;
	flex-direction: column;
	gap: 0.75rem;
}

.export-dialog__error-header {
	display: flex;
	align-items: center;
	gap: 0.75rem;
}

.export-dialog__error-icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 36px;
	height: 36px;
	border-radius: 8px;
	background-color: rgba(239, 68, 68, 0.15);
	color: #ef4444;
}

.export-dialog__error-title {
	font-size: 0.9375rem;
	font-weight: 600;
	color: var(--sidebar-text);
	margin: 0;
}

.export-dialog__error-message {
	font-size: 0.8125rem;
	color: var(--sidebar-text-muted);
	margin: 0;
	line-height: 1.45;
	word-break: break-word;
}

.export-dialog__error-actions {
	display: flex;
	gap: 0.5rem;
}

.export-dialog__error-btn {
	display: flex;
	align-items: center;
	gap: 0.375rem;
	padding: 0.5rem 0.875rem;
	font-size: 0.8125rem;
	font-weight: 600;
	border-radius: 8px;
	border: 1px solid var(--sidebar-border);
	background: transparent;
	color: var(--sidebar-text-muted);
	cursor: pointer;
	transition: all 150ms ease;
}

.export-dialog__error-btn:hover {
	background-color: var(--sidebar-hover);
	color: var(--sidebar-text);
}

.export-dialog__error-btn--retry {
	border-color: var(--sidebar-accent);
	background-color: rgba(6, 182, 212, 0.12);
	color: var(--sidebar-accent);
}

.export-dialog__error-btn--retry:hover {
	opacity: 0.9;
}

.export-dialog__success-section {
	display: flex;
	flex-direction: column;
	gap: 1rem;
	align-items: center;
	text-align: center;
}

.export-dialog__success-header {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 0.5rem;
}

.export-dialog__success-icon {
	display: flex;
	align-items: center;
	justify-content: center;
	width: 64px;
	height: 64px;
	border-radius: 16px;
	background-color: rgba(16, 185, 129, 0.15);
	color: #10b981;
	margin-bottom: 0.25rem;
}

.export-dialog__success-title {
	font-size: 1.125rem;
	font-weight: 700;
	color: var(--sidebar-text);
	margin: 0;
}

.export-dialog__success-subtitle {
	font-size: 0.8125rem;
	color: var(--sidebar-text-muted);
	margin: 0;
}

.export-dialog__success-path {
	width: 100%;
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
	padding: 0.75rem;
	border-radius: 8px;
	border: 1px solid var(--sidebar-border);
	background-color: rgba(255, 255, 255, 0.03);
	text-align: left;
}

.export-dialog__success-path-label {
	font-size: 0.6875rem;
	font-weight: 600;
	text-transform: uppercase;
	letter-spacing: 0.04em;
	color: var(--sidebar-text-muted);
}

.export-dialog__success-path-value {
	font-size: 0.75rem;
	color: var(--sidebar-text);
	word-break: break-all;
}

.export-dialog__success-actions {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	width: 100%;
}

.export-dialog__success-btn {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	width: 100%;
	padding: 0.625rem 1rem;
	font-size: 0.875rem;
	font-weight: 600;
	border-radius: 8px;
	border: 1px solid var(--sidebar-border);
	background: transparent;
	color: var(--sidebar-text);
	cursor: pointer;
	transition: all 150ms ease;
}

.export-dialog__success-btn:hover {
	background-color: var(--sidebar-hover);
}

.export-dialog__success-btn--primary {
	border: none;
	background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
	color: white;
}

.export-dialog__success-btn--primary:hover {
	opacity: 0.9;
}

.export-dialog__footer {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.75rem;
	padding: 1rem 1.5rem;
	border-top: 1px solid var(--sidebar-border);
}

.export-dialog__footer-left,
.export-dialog__footer-right {
	flex: 1;
}

.export-dialog__footer-right {
	display: flex;
	justify-content: flex-end;
}

.export-dialog__btn {
	display: flex;
	align-items: center;
	justify-content: center;
	gap: 0.5rem;
	padding: 0.625rem 1.25rem;
	font-size: 0.875rem;
	font-weight: 600;
	border-radius: 8px;
	border: none;
	cursor: pointer;
	transition: all 150ms ease;
}

.export-dialog__btn:disabled {
	opacity: 0.6;
	cursor: not-allowed;
}

.export-dialog__btn--back {
	background: transparent;
	color: var(--sidebar-text-muted);
	padding: 0.5rem 1rem;
}

.export-dialog__btn--back:hover {
	color: var(--sidebar-text);
}

.export-dialog__btn--primary {
	background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
	color: white;
}

.export-dialog__btn--primary:hover:not(:disabled) {
	opacity: 0.9;
}

.export-dialog__spin {
	animation: export-spin 0.8s linear infinite;
}

@keyframes export-spin {
	to {
		transform: rotate(360deg);
	}
}

.modal-enter-active,
.modal-leave-active {
	transition: opacity 200ms ease;
}

.modal-enter-from,
.modal-leave-to {
	opacity: 0;
}

.dialog-enter-active {
	transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1);
}

.dialog-leave-active {
	transition: all 150ms ease-in;
}

.dialog-enter-from {
	opacity: 0;
	transform: scale(0.96) translateY(8px);
}

.dialog-leave-to {
	opacity: 0;
	transform: scale(0.98);
}
</style>
