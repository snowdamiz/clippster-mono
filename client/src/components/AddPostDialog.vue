<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="modelValue" class="add-post-dialog__overlay" @click.self="close">
        <Transition name="dialog" appear>
          <div v-if="modelValue" class="add-post-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="add-post-dialog__accent"></div>

            <!-- Header -->
            <div class="add-post-dialog__header">
              <button class="add-post-dialog__close" @click="close" :disabled="submitting" title="Close">
                <X :size="18" />
              </button>
              <div class="add-post-dialog__icon">
                <Link :size="24" />
              </div>
              <h2 class="add-post-dialog__title">Add Post</h2>
              <p class="add-post-dialog__subtitle">Track a post you've published externally</p>
            </div>

            <!-- Content -->
            <div class="add-post-dialog__content">
              <!-- Post URL -->
              <div class="add-post-dialog__field">
                <label class="add-post-dialog__label">Post URL *</label>
                <input
                  v-model="postUrl"
                  type="url"
                  :disabled="submitting"
                  placeholder="Paste Instagram, TikTok, YouTube, or X post URL..."
                  class="add-post-dialog__input"
                />
                <div v-if="detectedPlatform" class="add-post-dialog__platform-badge-row">
                  <span class="add-post-dialog__platform-badge" :class="platformBadgeClass">
                    <component :is="platformIcon" :size="12" />
                    {{ platformDisplayName }}
                  </span>
                  <span class="add-post-dialog__platform-detected">detected</span>
                </div>
                <p v-if="urlError" class="add-post-dialog__url-error">{{ urlError }}</p>
              </div>

              <!-- Creator Profile -->
              <div class="add-post-dialog__field">
                <label class="add-post-dialog__label">Creator Profile (Optional)</label>
                <div class="add-post-dialog__field-note">
                  Select if this post was made for a specific creator
                </div>
                <div class="relative">
                  <button
                    @click="showCreatorDropdown = !showCreatorDropdown"
                    class="add-post-dialog__input add-post-dialog__select"
                    :disabled="submitting || loadingCreators"
                    type="button"
                  >
                    <span class="truncate">
                      <template v-if="loadingCreators">Loading creators...</template>
                      <template v-else-if="selectedCreatorId">
                        {{ selectedCreatorLabel }}
                      </template>
                      <template v-else>None (personal post)</template>
                    </span>
                    <ChevronDown
                      class="add-post-dialog__chevron"
                      :class="{ 'rotate-180': showCreatorDropdown }"
                    />
                  </button>

                  <div v-if="showCreatorDropdown && !loadingCreators" class="add-post-dialog__dropdown">
                    <button
                      @click="selectCreator('')"
                      class="add-post-dialog__dropdown-item"
                      :class="{ 'add-post-dialog__dropdown-item--selected': !selectedCreatorId }"
                      type="button"
                    >
                      <span class="add-post-dialog__dropdown-item-name">None (personal post)</span>
                    </button>
                    <div v-if="myCreators.length" class="add-post-dialog__dropdown-group-label">My Creators</div>
                    <button
                      v-for="creator in myCreators"
                      :key="creator.id"
                      @click="selectCreator(creator.id)"
                      class="add-post-dialog__dropdown-item"
                      :class="{ 'add-post-dialog__dropdown-item--selected': selectedCreatorId === creator.id }"
                      type="button"
                    >
                      <div class="add-post-dialog__dropdown-item-avatar">
                        <img v-if="creator.profile_image_url" :src="creator.profile_image_url" />
                        <User v-else :size="14" />
                      </div>
                      <div class="add-post-dialog__dropdown-item-info">
                        <span class="add-post-dialog__dropdown-item-name">{{ creator.name }}</span>
                        <span v-if="creator.org_name" class="add-post-dialog__dropdown-item-org">{{ creator.org_name }}</span>
                      </div>
                    </button>
                    <div v-if="!myCreators.length" class="add-post-dialog__dropdown-empty">
                      No creator profiles found
                    </div>
                  </div>
                </div>
              </div>

              <!-- Error -->
              <div v-if="error" class="add-post-dialog__alert add-post-dialog__alert--error">
                <p class="text-xs">{{ error }}</p>
              </div>
            </div>

            <!-- Footer -->
            <div class="add-post-dialog__footer">
              <button
                @click="close"
                :disabled="submitting"
                class="add-post-dialog__btn add-post-dialog__btn--secondary"
                type="button"
              >
                Cancel
              </button>
              <button
                @click="submit"
                :disabled="!canSubmit || submitting"
                class="add-post-dialog__btn add-post-dialog__btn--primary"
                type="button"
              >
                <Loader2 v-if="submitting" :size="16" class="add-post-dialog__spinner" />
                {{ submitting ? 'Submitting...' : 'Add Post' }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { X, Link, ChevronDown, Loader2, User, Instagram, Youtube } from 'lucide-vue-next';
import { submitPersonalExternalPost } from '@/services/schedulingApi';
import { getUserAssignedCreatorProfiles } from '@/services/organizationProfilesApi';
import { useToast } from '@/composables/useToast';

interface CreatorOption {
  id: string;
  name: string;
  profile_image_url: string | null;
  org_name?: string;
  server_id?: number;
}

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  submitted: [submission: any];
}>();

const { showToast } = useToast();

const postUrl = ref('');
const detectedPlatform = ref<string | null>(null);
const urlError = ref<string | null>(null);
const selectedCreatorId = ref('');
const showCreatorDropdown = ref(false);
const submitting = ref(false);
const error = ref<string | null>(null);
const loadingCreators = ref(false);
const myCreators = ref<CreatorOption[]>([]);

// Auto-detect platform from URL
watch(postUrl, () => {
  if (!postUrl.value) {
    detectedPlatform.value = null;
    urlError.value = null;
    return;
  }

  const url = postUrl.value.toLowerCase();

  if (url.includes('instagram.com') || url.includes('instagr.am')) {
    detectedPlatform.value = 'instagram';
    urlError.value = null;
  } else if (url.includes('tiktok.com') || url.includes('vm.tiktok.com')) {
    detectedPlatform.value = 'tiktok';
    urlError.value = null;
  } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
    detectedPlatform.value = 'youtube';
    urlError.value = null;
  } else if (url.includes('twitter.com') || url.includes('x.com')) {
    detectedPlatform.value = 'twitter';
    urlError.value = null;
  } else {
    detectedPlatform.value = null;
    urlError.value = 'URL must be from Instagram, TikTok, YouTube, or X';
  }
});

const platformDisplayName = computed(() => {
  switch (detectedPlatform.value) {
    case 'instagram': return 'Instagram';
    case 'tiktok': return 'TikTok';
    case 'youtube': return 'YouTube';
    case 'twitter': return 'X (Twitter)';
    default: return '';
  }
});

const platformIcon = computed(() => {
  switch (detectedPlatform.value) {
    case 'instagram': return Instagram;
    case 'youtube': return Youtube;
    default: return Link;
  }
});

const platformBadgeClass = computed(() => {
  switch (detectedPlatform.value) {
    case 'instagram': return 'add-post-dialog__platform-badge--instagram';
    case 'tiktok': return 'add-post-dialog__platform-badge--tiktok';
    case 'youtube': return 'add-post-dialog__platform-badge--youtube';
    case 'twitter': return 'add-post-dialog__platform-badge--twitter';
    default: return '';
  }
});

const selectedCreatorLabel = computed(() => {
  const creator = myCreators.value.find((c) => c.id === selectedCreatorId.value);
  return creator ? creator.name : '';
});

const canSubmit = computed(() => {
  return postUrl.value && detectedPlatform.value && !urlError.value;
});

function selectCreator(id: string) {
  selectedCreatorId.value = id;
  showCreatorDropdown.value = false;
}

function handleClickOutside(event: Event) {
  const target = event.target as HTMLElement;
  if (!target.closest('.relative')) {
    showCreatorDropdown.value = false;
  }
}

async function loadCreators() {
  loadingCreators.value = true;
  try {
    const res = await getUserAssignedCreatorProfiles();
    if (res.success) {
      myCreators.value = res.profiles.map((p) => ({
        id: `org-${p.id}`,
        name: p.name,
        profile_image_url: p.profile_image_url ?? null,
        org_name: (p as any).organization?.name,
        server_id: p.id,
      }));
    }
  } catch (e) {
    console.error('[AddPostDialog] Failed to load creators:', e);
  } finally {
    loadingCreators.value = false;
  }
}

function resetForm() {
  postUrl.value = '';
  detectedPlatform.value = null;
  urlError.value = null;
  selectedCreatorId.value = '';
  showCreatorDropdown.value = false;
  error.value = null;
}

function close() {
  if (!submitting.value) {
    emit('update:modelValue', false);
  }
}

async function submit() {
  if (!canSubmit.value) return;

  submitting.value = true;
  error.value = null;

  try {
    // Resolve server_id from selected creator
    let creatorProfileId: number | undefined;
    if (selectedCreatorId.value) {
      const creator = myCreators.value.find((c) => c.id === selectedCreatorId.value);
      creatorProfileId = creator?.server_id;
    }

    const response = await submitPersonalExternalPost({
      platform: detectedPlatform.value!,
      post_url: postUrl.value,
      creator_profile_id: creatorProfileId,
    });

    if (response.success) {
      showToast('Post added successfully', 'success');
      emit('submitted', response.submission);
      emit('update:modelValue', false);
    } else {
      error.value = response.error || 'Failed to add post';
    }
  } catch (err: any) {
    console.error('[AddPostDialog] Failed to submit:', err);
    error.value = err?.response?.data?.error || 'Failed to add post. Please try again.';
  } finally {
    submitting.value = false;
  }
}

watch(
  () => props.modelValue,
  (isOpen) => {
    if (isOpen) {
      resetForm();
      loadCreators();
    }
  }
);

onMounted(() => {
  document.addEventListener('click', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside);
});
</script>

<style scoped>
/* ===== Overlay ===== */
.add-post-dialog__overlay {
  position: fixed;
  inset: 0;
  background-color: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(4px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

/* ===== Dialog Container ===== */
.add-post-dialog {
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  width: 100%;
  max-width: 480px;
  margin: 1rem;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ===== Accent Bar ===== */
.add-post-dialog__accent {
  height: 3px;
  background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  flex-shrink: 0;
}

/* ===== Header ===== */
.add-post-dialog__header {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1.5rem 1rem;
  text-align: center;
}

.add-post-dialog__close {
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

.add-post-dialog__close:hover:not(:disabled) {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.add-post-dialog__close:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.add-post-dialog__icon {
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

.add-post-dialog__title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.02em;
}

.add-post-dialog__subtitle {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  margin: 0.25rem 0 0;
}

/* ===== Content Area ===== */
.add-post-dialog__content {
  flex: 1;
  overflow-y: auto;
  padding: 0.5rem 1.5rem 1.5rem;
}

.add-post-dialog__content::-webkit-scrollbar {
  width: 6px;
}

.add-post-dialog__content::-webkit-scrollbar-track {
  background: transparent;
}

.add-post-dialog__content::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

/* ===== Form Field ===== */
.add-post-dialog__field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.add-post-dialog__label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--sidebar-text);
}

.add-post-dialog__field-note {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin-top: -0.25rem;
}

.add-post-dialog__input {
  width: 100%;
  padding: 0.75rem 1rem;
  font-size: 0.875rem;
  background-color: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  color: var(--sidebar-text);
  transition: all 150ms ease;
}

.add-post-dialog__input::placeholder {
  color: var(--sidebar-text-muted);
  opacity: 0.6;
}

.add-post-dialog__input:focus {
  outline: none;
  border-color: var(--sidebar-accent);
  box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
}

.add-post-dialog__input:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.add-post-dialog__select {
  display: flex;
  align-items: center;
  justify-content: space-between;
  cursor: pointer;
  text-align: left;
}

.add-post-dialog__select:hover:not(:disabled) {
  border-color: rgba(255, 255, 255, 0.1);
}

.add-post-dialog__chevron {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--sidebar-text-muted);
  transition: transform 150ms ease;
}

/* ===== Platform Badge ===== */
.add-post-dialog__platform-badge-row {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.add-post-dialog__platform-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.75rem;
  font-weight: 500;
  border: 1px solid transparent;
}

.add-post-dialog__platform-badge--instagram {
  background-color: rgba(236, 72, 153, 0.15);
  color: #f472b6;
  border-color: rgba(236, 72, 153, 0.3);
}

.add-post-dialog__platform-badge--tiktok {
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
  border-color: rgba(6, 182, 212, 0.3);
}

.add-post-dialog__platform-badge--youtube {
  background-color: rgba(239, 68, 68, 0.15);
  color: #f87171;
  border-color: rgba(239, 68, 68, 0.3);
}

.add-post-dialog__platform-badge--twitter {
  background-color: rgba(59, 130, 246, 0.15);
  color: #60a5fa;
  border-color: rgba(59, 130, 246, 0.3);
}

.add-post-dialog__platform-detected {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.add-post-dialog__url-error {
  font-size: 0.75rem;
  color: #f87171;
  margin: 0;
}

/* ===== Dropdown ===== */
.add-post-dialog__dropdown {
  position: absolute;
  top: calc(100% + 0.5rem);
  left: 0;
  right: 0;
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 8px;
  overflow: hidden;
  z-index: 10;
  max-height: 14rem;
  overflow-y: auto;
}

.add-post-dialog__dropdown::-webkit-scrollbar {
  width: 6px;
}

.add-post-dialog__dropdown::-webkit-scrollbar-track {
  background: transparent;
}

.add-post-dialog__dropdown::-webkit-scrollbar-thumb {
  background-color: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.add-post-dialog__dropdown-group-label {
  padding: 0.375rem 0.75rem 0.25rem;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--sidebar-text-muted);
  opacity: 0.7;
}

.add-post-dialog__dropdown-item {
  display: flex;
  align-items: center;
  gap: 0.625rem;
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

.add-post-dialog__dropdown-item:hover {
  background-color: var(--sidebar-hover);
}

.add-post-dialog__dropdown-item--selected {
  background-color: rgba(6, 182, 212, 0.15);
  color: var(--sidebar-accent);
}

.add-post-dialog__dropdown-item-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background-color: var(--sidebar-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
  color: var(--sidebar-text-muted);
}

.add-post-dialog__dropdown-item-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.add-post-dialog__dropdown-item-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
  min-width: 0;
}

.add-post-dialog__dropdown-item-name {
  font-size: 0.875rem;
  font-weight: 500;
  color: inherit;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.add-post-dialog__dropdown-item-org {
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.add-post-dialog__dropdown-empty {
  padding: 0.75rem;
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  text-align: center;
}

/* ===== Alert ===== */
.add-post-dialog__alert {
  padding: 0.875rem;
  border-radius: 8px;
  margin-bottom: 1rem;
}

.add-post-dialog__alert--error {
  background-color: rgba(239, 68, 68, 0.1);
  border: 1px solid rgba(239, 68, 68, 0.2);
  color: #f87171;
}

/* ===== Footer ===== */
.add-post-dialog__footer {
  display: flex;
  gap: 0.625rem;
  padding: 1.25rem 1.5rem;
  border-top: 1px solid var(--sidebar-border);
}

/* ===== Buttons ===== */
.add-post-dialog__btn {
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

.add-post-dialog__btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.add-post-dialog__btn--secondary {
  background-color: var(--sidebar-hover);
  color: var(--sidebar-text);
  border: 1px solid var(--sidebar-border);
}

.add-post-dialog__btn--secondary:hover:not(:disabled) {
  background-color: var(--sidebar-active);
  border-color: rgba(255, 255, 255, 0.1);
}

.add-post-dialog__btn--primary {
  background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
  color: #000;
}

.add-post-dialog__btn--primary:hover:not(:disabled) {
  filter: brightness(1.1);
}

.add-post-dialog__spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ===== Transitions ===== */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.25s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

.dialog-enter-active {
  transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
}

.dialog-leave-active {
  transition: all 0.2s ease-in;
}

.dialog-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.dialog-leave-to {
  opacity: 0;
  transform: scale(0.98);
}
</style>
