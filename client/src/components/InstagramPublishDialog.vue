<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="instagram-dialog__overlay" @click.self="$emit('close')">
        <Transition name="dialog" appear>
          <div v-if="open" class="instagram-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="instagram-dialog__accent"></div>

            <!-- Header -->
            <div class="instagram-dialog__header">
              <button
                class="instagram-dialog__close"
                @click="$emit('close')"
                :disabled="publishing"
                title="Close"
              >
                <X :size="18" />
              </button>
              <div class="instagram-dialog__icon">
                <Instagram :size="24" />
              </div>
              <h2 class="instagram-dialog__title">Publish to Instagram</h2>
              <p class="instagram-dialog__subtitle">Share this clip to your connected Instagram account</p>
            </div>

            <!-- Content -->
            <div class="instagram-dialog__content">
              <form @submit.prevent="publish" class="instagram-dialog__form">
                <!-- Media Preview -->
                <div class="instagram-dialog__field">
                  <label class="instagram-dialog__label">Media Preview</label>
                  <div class="instagram-dialog__preview">
                    <img v-if="thumbnailUrl" :src="thumbnailUrl" alt="Media preview" class="instagram-dialog__preview-img" />
                    <div v-else class="instagram-dialog__preview-empty">
                      <FileVideo :size="32" />
                    </div>
                    <div class="instagram-dialog__preview-badge">
                      {{ mediaType || 'Video' }}
                    </div>
                  </div>
                </div>

                <!-- Instagram Account -->
                <div class="instagram-dialog__field">
                  <label for="account" class="instagram-dialog__label">Instagram Account *</label>
                  <div class="instagram-dialog__select-wrapper">
                    <select
                      id="account"
                      v-model="selectedAccountValue"
                      class="instagram-dialog__select"
                      :disabled="publishing || loadingAccounts"
                    >
                      <option value="" disabled>Select an account</option>
                      <optgroup v-if="orgAccounts.length > 0" :label="currentOrgName + ' Accounts'">
                        <option v-for="account in orgAccounts" :key="`org-${account.id}`" :value="`org:${account.id}`">
                          @{{ account.username }}
                        </option>
                      </optgroup>
                      <optgroup v-if="showPersonalAccounts && personalAccounts.length > 0" label="My Personal Accounts">
                        <option v-for="account in personalAccounts" :key="`user-${account.id}`" :value="`user:${account.id}`">
                          @{{ account.username }}
                        </option>
                      </optgroup>
                    </select>
                    <ChevronDown class="instagram-dialog__select-icon" :size="16" />
                  </div>
                  <p v-if="allAccounts.length === 0 && !loadingAccounts" class="instagram-dialog__field-hint instagram-dialog__field-hint--warning">
                    No Instagram accounts available. Connect a personal account or ask an admin to assign you an organization account.
                  </p>
                </div>

                <!-- Creator Profile -->
                <div v-if="creatorProfiles.length > 0" class="instagram-dialog__field">
                  <label for="creator" class="instagram-dialog__label">
                    Creator Profile
                    <span class="instagram-dialog__label-hint">(optional)</span>
                  </label>
                  <div class="instagram-dialog__select-wrapper">
                    <select
                      id="creator"
                      v-model="selectedCreatorProfileId"
                      class="instagram-dialog__select"
                      :disabled="publishing"
                    >
                      <option value="">None</option>
                      <option v-for="profile in creatorProfiles" :key="profile.id" :value="String(profile.id)">
                        {{ profile.name }}
                      </option>
                    </select>
                    <ChevronDown class="instagram-dialog__select-icon" :size="16" />
                  </div>
                  <p class="instagram-dialog__field-hint">Associate this post with a creator profile for tracking</p>
                </div>

                <!-- Caption -->
                <div class="instagram-dialog__field">
                  <label for="caption" class="instagram-dialog__label">Caption</label>
                  <textarea
                    id="caption"
                    v-model="caption"
                    :disabled="publishing"
                    rows="4"
                    maxlength="2200"
                    placeholder="Write a caption for your post..."
                    class="instagram-dialog__input instagram-dialog__textarea"
                  ></textarea>
                  <div class="instagram-dialog__caption-info">
                    <p v-if="hashtagCount > 30" class="instagram-dialog__field-hint instagram-dialog__field-hint--error">
                      Too many hashtags ({{ hashtagCount }}/30)
                    </p>
                    <p class="instagram-dialog__field-hint" style="margin-left: auto">
                      {{ caption.length }} / 2,200
                    </p>
                  </div>
                </div>

                <!-- Scheduling -->
                <div v-if="schedulingEnabled" class="instagram-dialog__field">
                  <div class="instagram-dialog__toggle-row">
                    <label class="instagram-dialog__label">Schedule for later</label>
                    <button
                      type="button"
                      @click="isScheduled = !isScheduled"
                      :class="['instagram-dialog__toggle', { 'instagram-dialog__toggle--active': isScheduled }]"
                      :disabled="publishing"
                    >
                      <span :class="['instagram-dialog__toggle-thumb', { 'instagram-dialog__toggle-thumb--active': isScheduled }]" />
                    </button>
                  </div>

                  <div v-if="isScheduled" class="instagram-dialog__schedule-fields">
                    <div class="instagram-dialog__schedule-row">
                      <div class="instagram-dialog__field" style="flex: 1">
                        <label for="scheduleDate" class="instagram-dialog__label-sm">Date</label>
                        <input
                          id="scheduleDate"
                          type="date"
                          v-model="scheduleDate"
                          :min="minDate"
                          :disabled="publishing"
                          class="instagram-dialog__input"
                        />
                      </div>
                      <div class="instagram-dialog__field" style="flex: 1">
                        <label for="scheduleTime" class="instagram-dialog__label-sm">Time</label>
                        <CustomTimePicker
                          v-model="scheduleTime"
                          :disabled="publishing"
                        />
                      </div>
                    </div>
                    <p v-if="scheduledDateTime" class="instagram-dialog__field-hint" style="display: flex; align-items: center; gap: 0.375rem">
                      <Calendar :size="14" />
                      Will be published {{ formatScheduleTime(scheduledDateTime) }}
                    </p>
                    <p v-if="scheduleError" class="instagram-dialog__field-hint instagram-dialog__field-hint--error">
                      {{ scheduleError }}
                    </p>
                  </div>
                </div>

                <!-- Error Display -->
                <div v-if="error" class="instagram-dialog__alert instagram-dialog__alert--error">
                  <AlertCircle :size="16" />
                  <p class="instagram-dialog__alert-text">{{ error }}</p>
                </div>
              </form>
            </div>

            <!-- Footer -->
            <div class="instagram-dialog__footer">
              <button
                @click="$emit('close')"
                :disabled="publishing"
                class="instagram-dialog__btn instagram-dialog__btn--secondary"
              >
                Cancel
              </button>
              <button
                @click="publish"
                :disabled="!canPublish || publishing"
                class="instagram-dialog__btn instagram-dialog__btn--primary"
              >
                <Loader2 v-if="publishing" :size="16" class="instagram-dialog__spinner" />
                <Calendar v-else-if="isScheduled" :size="16" />
                <Instagram v-else :size="16" />
                {{ publishing ? (isScheduled ? 'Scheduling...' : 'Publishing...') : (isScheduled ? 'Schedule' : 'Publish Now') }}
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
  import { Instagram, FileVideo, Loader2, ChevronDown, Calendar, X, AlertCircle } from 'lucide-vue-next';
  import CustomTimePicker from '@/components/CustomTimePicker.vue';
  import { useToast } from '@/composables/useToast';
  import { getMyAssignedAccounts, listSocialAccounts, publishPost, type SocialAccount } from '@/services/socialAccountsApi';
  import { listUserInstagramAccounts, publishToUserInstagram, type UserInstagramAccount } from '@/services/userInstagramApi';
  import { schedulePost } from '@/services/schedulingApi';
  import api from '@/services/api';

  interface CreatorProfile {
    id: number;
    name: string;
  }

  const props = withDefaults(
    defineProps<{
      open: boolean;
      mediaUrl: string;
      thumbnailUrl?: string;
      mediaType?: 'image' | 'video' | 'reel';
      clipId?: string;
      schedulingEnabled?: boolean;
      organizationId?: string | number;
      organizationName?: string;
      isAdmin?: boolean;
      creatorProfiles?: CreatorProfile[];
      campaignId?: number;
    }>(),
    { isAdmin: false, schedulingEnabled: true, creatorProfiles: () => [] }
  );

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'published', post: any): void;
  }>();

  const { showToast } = useToast();

  const loadingAccounts = ref(true);
  const orgAccounts = ref<SocialAccount[]>([]);
  const personalAccounts = ref<UserInstagramAccount[]>([]);
  const allowPersonalInstagram = ref(true);
  const selectedAccountValue = ref('');
  const selectedCreatorProfileId = ref('');
  const caption = ref('');
  const publishing = ref(false);
  const error = ref<string | null>(null);
  const isScheduled = ref(false);
  const scheduleDate = ref('');
  const scheduleTime = ref('');
  const scheduleError = ref<string | null>(null);

  const currentOrgName = computed(() => props.organizationName || 'Organization');
  const showPersonalAccounts = computed(() => !props.organizationId || allowPersonalInstagram.value);
  const allAccounts = computed(() => [...orgAccounts.value, ...(showPersonalAccounts.value ? personalAccounts.value : [])]);
  const selectedAccountType = computed(() => (selectedAccountValue.value ? (selectedAccountValue.value.split(':')[0] as 'org' | 'user') : null));
  const selectedAccountId = computed(() => (selectedAccountValue.value ? parseInt(selectedAccountValue.value.split(':')[1]) : null));
  const hashtagCount = computed(() => (caption.value.match(/#\w+/g) || []).length);
  const minDate = computed(() => new Date().toISOString().split('T')[0]);
  const scheduledDateTime = computed(() => {
    if (!scheduleDate.value || !scheduleTime.value) return null;
    const dt = new Date(`${scheduleDate.value}T${scheduleTime.value}`);
    return isNaN(dt.getTime()) ? null : dt;
  });
  const canPublish = computed(
    () =>
      !!selectedAccountValue.value &&
      !!props.mediaUrl &&
      hashtagCount.value <= 30 &&
      (!isScheduled.value || (scheduledDateTime.value && !scheduleError.value))
  );

  watch([scheduleDate, scheduleTime], () => {
    if (!isScheduled.value || !scheduledDateTime.value) {
      scheduleError.value = null;
      return;
    }
    const minTime = new Date(Date.now() + 5 * 60 * 1000);
    scheduleError.value = scheduledDateTime.value < minTime ? 'Schedule time must be at least 5 minutes in the future' : null;
  });

  function formatScheduleTime(date: Date): string {
    const diffMs = date.getTime() - Date.now();
    const diffMins = Math.round(diffMs / 60000);
    const diffHours = Math.round(diffMs / 3600000);
    const diffDays = Math.round(diffMs / 86400000);
    let relative = diffMins < 60 ? `in ${diffMins} minutes` : diffHours < 24 ? `in ${diffHours} hours` : `in ${diffDays} days`;
    return `${relative} (${date.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })})`;
  }

  watch(
    () => props.open,
    async (isOpen) => {
      if (isOpen) {
        await loadAccounts();
        error.value = null;
      }
    },
    { immediate: true }
  );

  async function loadAccounts() {
    loadingAccounts.value = true;
    try {
      if (props.organizationId) {
        try {
          const orgRes = await api.get(`/organizations/${props.organizationId}`);
          if (orgRes.data.success) {
            allowPersonalInstagram.value = orgRes.data.organization.allow_personal_instagram ?? true;
          }
        } catch {}
        const res = props.isAdmin ? await listSocialAccounts(props.organizationId) : await getMyAssignedAccounts(props.organizationId);
        if (res.success) {
          orgAccounts.value = res.accounts.filter((a) => a.is_active && a.platform === 'instagram');
        }
      }
      const pRes = await listUserInstagramAccounts();
      if (pRes.success) {
        personalAccounts.value = pRes.accounts.filter((a) => a.is_active);
      }
      if (orgAccounts.value.length > 0) {
        selectedAccountValue.value = `org:${orgAccounts.value[0].id}`;
      } else if (showPersonalAccounts.value && personalAccounts.value.length > 0) {
        selectedAccountValue.value = `user:${personalAccounts.value[0].id}`;
      }
    } finally {
      loadingAccounts.value = false;
    }
  }

  async function publish() {
    if (!canPublish.value || !selectedAccountId.value) return;
    publishing.value = true;
    error.value = null;
    try {
      let response;
      if (isScheduled.value && scheduledDateTime.value) {
        const data: any = {
          platform: 'instagram',
          media_url: props.mediaUrl,
          caption: caption.value,
          media_type: props.mediaType || 'reel',
          thumbnail_url: props.thumbnailUrl,
          scheduled_at: scheduledDateTime.value.toISOString(),
          clip_id: props.clipId,
        };
        if (selectedAccountType.value === 'org' && props.organizationId) {
          data.organization_id = Number(props.organizationId);
          data.social_account_id = selectedAccountId.value;
          data.creator_profile_id = selectedCreatorProfileId.value ? parseInt(selectedCreatorProfileId.value) : undefined;
          data.campaign_id = props.campaignId;
        } else {
          data.user_social_account_id = selectedAccountId.value;
          data.creator_profile_id = selectedCreatorProfileId.value ? parseInt(selectedCreatorProfileId.value) : undefined;
          data.campaign_id = props.campaignId;
        }
        response = await schedulePost(data);
        if (response.success) {
          showToast(`Post scheduled for ${formatScheduleTime(scheduledDateTime.value)}`, 'success', 'social');
          emit('published', response.post);
          emit('close');
          resetForm();
        } else {
          error.value = response.error || 'Failed to schedule';
          showToast(response.error || 'Failed to schedule', 'error', 'social');
        }
      } else {
        if (selectedAccountType.value === 'org' && props.organizationId) {
          response = await publishPost(props.organizationId, {
            social_account_id: selectedAccountId.value,
            creator_profile_id: selectedCreatorProfileId.value ? parseInt(selectedCreatorProfileId.value) : undefined,
            media_url: props.mediaUrl,
            caption: caption.value,
            media_type: props.mediaType || 'reel',
            thumbnail_url: props.thumbnailUrl,
          });
        } else {
          response = await publishToUserInstagram({
            account_id: selectedAccountId.value,
            media_url: props.mediaUrl,
            caption: caption.value,
            media_type: props.mediaType || 'reel',
            thumbnail_url: props.thumbnailUrl,
            creator_profile_id: selectedCreatorProfileId.value ? parseInt(selectedCreatorProfileId.value) : undefined,
            campaign_id: props.campaignId,
          });
        }
        if (response.success) {
          showToast('Post is being published to Instagram', 'success', 'social');
          emit('published', response.post);
          emit('close');
          resetForm();
        } else {
          error.value = response.error || 'Failed to publish';
          showToast(response.error || 'Failed to publish', 'error', 'social');
        }
      }
    } catch (err) {
      console.error('Failed to publish:', err);
      error.value = 'Failed to publish post. Please try again.';
      showToast('Failed to publish', 'error', 'social');
    } finally {
      publishing.value = false;
    }
  }

  function resetForm() {
    selectedAccountValue.value = '';
    selectedCreatorProfileId.value = '';
    caption.value = '';
    isScheduled.value = false;
    scheduleDate.value = '';
    scheduleTime.value = '';
    scheduleError.value = null;
  }
</script>

<style scoped>
  /* ===== Overlay ===== */
  .instagram-dialog__overlay {
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
  .instagram-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 520px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  /* ===== Accent Bar ===== */
  .instagram-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
    flex-shrink: 0;
  }

  /* ===== Header ===== */
  .instagram-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .instagram-dialog__close {
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

  .instagram-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .instagram-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .instagram-dialog__icon {
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

  .instagram-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .instagram-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  /* ===== Content Area ===== */
  .instagram-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .instagram-dialog__content::-webkit-scrollbar {
    width: 6px;
  }

  .instagram-dialog__content::-webkit-scrollbar-track {
    background: transparent;
  }

  .instagram-dialog__content::-webkit-scrollbar-thumb {
    background-color: rgba(255, 255, 255, 0.15);
    border-radius: 3px;
  }

  /* ===== Form ===== */
  .instagram-dialog__form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  /* ===== Form Field ===== */
  .instagram-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .instagram-dialog__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .instagram-dialog__label-sm {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
  }

  .instagram-dialog__label-hint {
    color: var(--sidebar-text-muted);
    font-weight: 400;
    font-size: 0.8125rem;
  }

  .instagram-dialog__field-hint {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    opacity: 0.8;
  }

  .instagram-dialog__field-hint--warning {
    color: #fbbf24;
    opacity: 1;
  }

  .instagram-dialog__field-hint--error {
    color: #f87171;
    opacity: 1;
  }

  .instagram-dialog__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .instagram-dialog__input::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .instagram-dialog__input:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .instagram-dialog__textarea {
    resize: none;
    min-height: 100px;
  }

  /* ===== Preview ===== */
  .instagram-dialog__preview {
    position: relative;
    width: 100%;
    max-height: 400px;
    border-radius: 8px;
    overflow: hidden;
    background-color: rgba(0, 0, 0, 0.3);
    border: 1px solid var(--sidebar-border);
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .instagram-dialog__preview-img {
    max-width: 100%;
    max-height: 400px;
    width: auto;
    height: auto;
    object-fit: contain;
  }

  .instagram-dialog__preview-empty {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--sidebar-text-muted);
    opacity: 0.3;
  }

  .instagram-dialog__preview-badge {
    position: absolute;
    bottom: 0.5rem;
    right: 0.5rem;
    padding: 0.25rem 0.5rem;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    color: white;
  }

  /* ===== Select ===== */
  .instagram-dialog__select-wrapper {
    position: relative;
  }

  .instagram-dialog__select {
    width: 100%;
    padding: 0.75rem 2.5rem 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    cursor: pointer;
    transition: all 150ms ease;
    appearance: none;
  }

  .instagram-dialog__select:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .instagram-dialog__select:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .instagram-dialog__select option {
    background-color: var(--sidebar-surface);
    color: var(--sidebar-text);
  }

  .instagram-dialog__select-icon {
    position: absolute;
    right: 1rem;
    top: 50%;
    transform: translateY(-50%);
    color: var(--sidebar-text-muted);
    pointer-events: none;
  }

  /* ===== Caption Info ===== */
  .instagram-dialog__caption-info {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  /* ===== Toggle ===== */
  .instagram-dialog__toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .instagram-dialog__toggle {
    position: relative;
    display: inline-flex;
    height: 24px;
    width: 44px;
    align-items: center;
    border-radius: 9999px;
    background-color: rgba(255, 255, 255, 0.1);
    border: 1px solid var(--sidebar-border);
    cursor: pointer;
    transition: all 150ms ease;
  }

  .instagram-dialog__toggle:hover:not(:disabled) {
    background-color: rgba(255, 255, 255, 0.15);
  }

  .instagram-dialog__toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .instagram-dialog__toggle--active {
    background-color: var(--sidebar-accent);
    border-color: var(--sidebar-accent);
  }

  .instagram-dialog__toggle-thumb {
    display: inline-block;
    height: 16px;
    width: 16px;
    border-radius: 9999px;
    background-color: white;
    transform: translateX(4px);
    transition: transform 150ms ease;
  }

  .instagram-dialog__toggle-thumb--active {
    transform: translateX(24px);
  }

  /* ===== Schedule Fields ===== */
  .instagram-dialog__schedule-fields {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding-top: 0.5rem;
  }

  .instagram-dialog__schedule-row {
    display: flex;
    gap: 0.75rem;
  }

  /* ===== Alert Box ===== */
  .instagram-dialog__alert {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.875rem;
    border-radius: 8px;
  }

  .instagram-dialog__alert--error {
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: #f87171;
  }

  .instagram-dialog__alert-text {
    font-size: 0.8125rem;
    line-height: 1.5;
    margin: 0;
  }

  /* ===== Footer ===== */
  .instagram-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
  .instagram-dialog__btn {
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

  .instagram-dialog__btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .instagram-dialog__btn--secondary {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .instagram-dialog__btn--secondary:hover:not(:disabled) {
    background-color: var(--sidebar-active);
    border-color: rgba(255, 255, 255, 0.1);
  }

  .instagram-dialog__btn--primary {
    background: linear-gradient(135deg, var(--sidebar-accent) 0%, #0891b2 100%);
    color: white;
  }

  .instagram-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .instagram-dialog__spinner {
    animation: spin 0.8s linear infinite;
  }

  /* ===== Transitions ===== */
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
