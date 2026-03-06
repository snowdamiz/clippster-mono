<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="campaign-dialog__overlay" @click.self="close">
        <Transition name="dialog" appear>
          <div v-if="modelValue" class="campaign-dialog" role="dialog" aria-modal="true">
            <div class="campaign-dialog__accent"></div>

            <div class="campaign-dialog__header">
              <button class="campaign-dialog__close" @click="close" title="Close">
                <X :size="18" />
              </button>
              <div class="campaign-dialog__icon">
                <Edit :size="24" />
              </div>
              <h2 class="campaign-dialog__title">Edit Platform Campaign</h2>
              <p class="campaign-dialog__subtitle">Update campaign details</p>
            </div>

            <div class="campaign-dialog__content">
              <div class="campaign-dialog__field">
                <label class="campaign-dialog__label">Campaign Title</label>
                <input
                  v-model="form.title"
                  type="text"
                  class="campaign-dialog__input"
                  placeholder="Enter campaign title"
                />
              </div>

              <div class="campaign-dialog__field">
                <label class="campaign-dialog__label">Description</label>
                <textarea
                  v-model="form.description"
                  rows="3"
                  class="campaign-dialog__input campaign-dialog__textarea"
                  placeholder="Campaign description"
                ></textarea>
              </div>

              <div class="campaign-dialog__field">
                <label class="campaign-dialog__label">Status</label>
                <div class="relative">
                  <button
                    @click="showStatusDropdown = !showStatusDropdown"
                    class="campaign-dialog__input campaign-dialog__select"
                  >
                    <span>{{ statusLabel }}</span>
                    <ChevronDown
                      :size="16"
                      class="transition-transform"
                      :class="{ 'rotate-180': showStatusDropdown }"
                    />
                  </button>
                  <div v-if="showStatusDropdown" class="campaign-dialog__dropdown">
                    <button
                      v-for="status in statuses"
                      :key="status.value"
                      @click="selectStatus(status.value)"
                      class="campaign-dialog__dropdown-item"
                      :class="{ 'campaign-dialog__dropdown-item--selected': form.status === status.value }"
                    >
                      {{ status.label }}
                    </button>
                  </div>
                </div>
              </div>

              <div class="campaign-dialog__field-row">
                <div class="campaign-dialog__field">
                  <label class="campaign-dialog__label">Start Date</label>
                  <input v-model="form.starts_at" type="datetime-local" class="campaign-dialog__input" />
                </div>
                <div class="campaign-dialog__field">
                  <label class="campaign-dialog__label">End Date</label>
                  <input v-model="form.ends_at" type="datetime-local" class="campaign-dialog__input" />
                </div>
              </div>

              <div v-if="error" class="campaign-dialog__alert campaign-dialog__alert--error">
                <AlertTriangle :size="16" />
                <p>{{ error }}</p>
              </div>
            </div>

            <div class="campaign-dialog__footer">
              <button @click="close" class="campaign-dialog__btn campaign-dialog__btn--secondary">
                Cancel
              </button>
              <button
                @click="updateCampaign"
                :disabled="!canUpdate || isProcessing"
                class="campaign-dialog__btn campaign-dialog__btn--primary"
              >
                <Loader2 v-if="isProcessing" :size="16" class="campaign-dialog__spinner" />
                {{ isProcessing ? 'Updating...' : 'Update Campaign' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { X, Edit, ChevronDown, Loader2, AlertTriangle } from 'lucide-vue-next';
import api from '@/services/api';

interface Campaign {
  id: number;
  title: string;
  description: string;
  status: string;
  starts_at: string;
  ends_at: string;
}

interface Props {
  modelValue: boolean;
  campaign: Campaign | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  updated: [];
}>();

const showStatusDropdown = ref(false);
const isProcessing = ref(false);
const error = ref('');

const statuses = [
  { value: 'draft', label: 'Draft' },
  { value: 'active', label: 'Active' },
  { value: 'paused', label: 'Paused' },
  { value: 'completed', label: 'Completed' }
];

const form = ref({
  title: '',
  description: '',
  status: 'active',
  starts_at: '',
  ends_at: ''
});

const statusLabel = computed(() => {
  const status = statuses.find(s => s.value === form.value.status);
  return status?.label || 'Select status';
});

const canUpdate = computed(() => form.value.title.length >= 3);

function close() {
  if (!isProcessing.value) {
    emit('update:modelValue', false);
  }
}

function selectStatus(status: string) {
  form.value.status = status;
  showStatusDropdown.value = false;
}

async function updateCampaign() {
  if (!canUpdate.value || !props.campaign) return;

  isProcessing.value = true;
  error.value = '';

  try {
    await api.put(`/admin/platform-campaigns/${props.campaign.id}`, form.value);
    emit('updated');
    emit('update:modelValue', false);
  } catch (err: any) {
    console.error('Failed to update campaign:', err);
    error.value = err.response?.data?.error || err.message || 'Failed to update campaign';
  } finally {
    isProcessing.value = false;
  }
}

watch(() => props.campaign, (campaign) => {
  if (campaign) {
    form.value = {
      title: campaign.title || '',
      description: campaign.description || '',
      status: campaign.status || 'active',
      starts_at: campaign.starts_at || '',
      ends_at: campaign.ends_at || ''
    };
  }
}, { immediate: true });
</script>

<style scoped>
.campaign-dialog__overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.campaign-dialog {
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  width: 100%;
  max-width: 500px;
  margin: 1rem;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.campaign-dialog__accent {
  height: 3px;
  background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  flex-shrink: 0;
}

.campaign-dialog__header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1.5rem 1rem;
  text-align: center;
}

.campaign-dialog__close {
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

.campaign-dialog__close:hover {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.campaign-dialog__icon {
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

.campaign-dialog__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.02em;
}

.campaign-dialog__subtitle {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0.25rem 0 0;
}

.campaign-dialog__content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 1.5rem 1.5rem;
}

.campaign-dialog__content::-webkit-scrollbar {
  width: 6px;
}

.campaign-dialog__content::-webkit-scrollbar-track {
  background: transparent;
}

.campaign-dialog__content::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.campaign-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.campaign-dialog__field-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1rem;
  margin-bottom: 1rem;
}

.campaign-dialog__label {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
}

.campaign-dialog__input {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  color: var(--sidebar-text);
  transition: all 150ms ease;
}

.campaign-dialog__input::placeholder {
  color: var(--sidebar-text-muted);
  opacity: 0.6;
}

.campaign-dialog__input:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
}

.campaign-dialog__textarea {
  resize: vertical;
  min-height: 80px;
}

.campaign-dialog__select {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
}

.campaign-dialog__select:hover {
  border-color: rgba(255, 255, 255, 0.1);
}

.campaign-dialog__dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  overflow: hidden;
  z-index: 10;
}

.campaign-dialog__dropdown-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 0.625rem 0.75rem;
  font-size: 0.875rem;
  color: var(--sidebar-text);
  transition: background-color 150ms ease;
  border: none;
  background: transparent;
  cursor: pointer;
}

.campaign-dialog__dropdown-item:hover {
  background-color: var(--sidebar-hover);
}

.campaign-dialog__dropdown-item--selected {
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
}

.campaign-dialog__alert {
  display: flex;
  align-items: flex-start;
  gap: 0.75rem;
  padding: 0.875rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.campaign-dialog__alert--error {
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #f87171;
}

.campaign-dialog__footer {
  display: flex;
  gap: 0.625rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--sidebar-border);
}

.campaign-dialog__btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  font-weight: 600;
  border-radius: 8px;
  border: none;
  cursor: pointer;
  transition: all 150ms ease;
}

.campaign-dialog__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.campaign-dialog__btn--secondary {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
  border: 1px solid var(--sidebar-border);
}

.campaign-dialog__btn--secondary:hover:not(:disabled) {
  background-color: var(--sidebar-active);
  border-color: rgba(255, 255, 255, 0.1);
}

.campaign-dialog__btn--primary {
  background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
  color: #000;
}

.campaign-dialog__btn--primary:hover:not(:disabled) {
  opacity: 0.9;
}

.campaign-dialog__spinner {
  animation: spin 0.8s linear infinite;
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

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
