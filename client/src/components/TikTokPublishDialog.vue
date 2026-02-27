<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="tt-dialog__overlay" @click.self="$emit('close')">
        <Transition name="dialog" appear>
          <div v-if="open" class="tt-dialog" role="dialog" aria-modal="true">
            <!-- Accent bar -->
            <div class="tt-dialog__accent"></div>

            <!-- Header -->
            <div class="tt-dialog__header">
              <button
                class="tt-dialog__close"
                @click="$emit('close')"
                :disabled="publishing"
                title="Close"
              >
                <X :size="18" />
              </button>
              <div class="tt-dialog__icon">
                <TikTokLogo :size="24" />
              </div>
              <h2 class="tt-dialog__title">Publish to TikTok</h2>
              <p class="tt-dialog__subtitle">Share this clip to your connected TikTok account</p>
            </div>

            <!-- Content -->
            <div class="tt-dialog__content">
              <form @submit.prevent="publish" class="tt-dialog__form">
                <!-- Media Preview -->
                <div class="tt-dialog__field">
                  <label class="tt-dialog__label">Media Preview</label>
                  <div class="tt-dialog__preview">
                    <img v-if="thumbnailUrl" :src="thumbnailUrl" alt="Media preview" class="tt-dialog__preview-img" />
                    <div v-else class="tt-dialog__preview-empty">
                      <FileVideo :size="32" />
                    </div>
                    <div class="tt-dialog__preview-badge">
                      {{ mediaType || 'Video' }}
                    </div>
                  </div>
                </div>

                <!-- TikTok Account -->
                <div class="tt-dialog__field">
                  <label for="account" class="tt-dialog__label">TikTok Account *</label>
                  <div class="tt-dialog__select-wrapper">
                    <select
                      id="account"
                      v-model="selectedAccountValue"
                      class="tt-dialog__select"
                      :disabled="publishing || loadingAccounts"
                    >
                      <option value="" disabled>Select an account</option>
                      <optgroup v-if="orgAccounts.length > 0" :label="currentOrgName + ' Accounts'">
                        <option v-for="account in orgAccounts" :key="`org-${account.id}`" :value="`org:${account.id}`">
                          @{{ account.username }}
                        </option>
                      </optgroup>
                    </select>
                    <ChevronDown class="tt-dialog__select-icon" :size="16" />
                  </div>
                  <p v-if="orgAccounts.length === 0 && !loadingAccounts" class="tt-dialog__field-hint tt-dialog__field-hint--warning">
                    No TikTok accounts available. Ask an admin to connect a TikTok account.
                  </p>
                </div>

                <!-- Creator Profile -->
                <div v-if="creatorProfiles.length > 0" class="tt-dialog__field">
                  <label for="creator" class="tt-dialog__label">
                    Creator Profile
                    <span class="tt-dialog__label-hint">(optional)</span>
                  </label>
                  <div class="tt-dialog__select-wrapper">
                    <select
                      id="creator"
                      v-model="selectedCreatorProfileId"
                      class="tt-dialog__select"
                      :disabled="publishing"
                    >
                      <option value="">None</option>
                      <option v-for="profile in creatorProfiles" :key="profile.id" :value="String(profile.id)">
                        {{ profile.name }}
                      </option>
                    </select>
                    <ChevronDown class="tt-dialog__select-icon" :size="16" />
                  </div>
                </div>

                <!-- Caption -->
                <div class="tt-dialog__field">
                  <label for="caption" class="tt-dialog__label">Caption</label>
                  <textarea
                    id="caption"
                    v-model="caption"
                    :disabled="publishing"
                    rows="3"
                    maxlength="2200"
                    placeholder="Write a caption for your TikTok..."
                    class="tt-dialog__input tt-dialog__textarea"
                  ></textarea>
                  <div class="tt-dialog__caption-info">
                    <p class="tt-dialog__field-hint" style="margin-left: auto">
                      {{ caption.length }} / 2,200
                    </p>
                  </div>
                </div>

                <!-- TikTok Settings -->
                <div class="tt-dialog__field">
                  <label class="tt-dialog__label">Privacy</label>
                  <div class="tt-dialog__select-wrapper">
                    <select v-model="privacyLevel" class="tt-dialog__select" :disabled="publishing">
                      <option value="public">Public</option>
                      <option value="friends">Friends only</option>
                      <option value="self">Only me</option>
                    </select>
                    <ChevronDown class="tt-dialog__select-icon" :size="16" />
                  </div>
                </div>

                <!-- Interaction toggles -->
                <div class="tt-dialog__field">
                  <label class="tt-dialog__label">Interactions</label>
                  <div class="tt-dialog__toggles">
                    <div class="tt-dialog__toggle-row">
                      <span class="tt-dialog__toggle-label">Allow comments</span>
                      <button
                        type="button"
                        @click="allowComment = !allowComment"
                        :class="['tt-dialog__toggle', { 'tt-dialog__toggle--active': allowComment }]"
                        :disabled="publishing"
                      >
                        <span :class="['tt-dialog__toggle-thumb', { 'tt-dialog__toggle-thumb--active': allowComment }]" />
                      </button>
                    </div>
                    <div class="tt-dialog__toggle-row">
                      <span class="tt-dialog__toggle-label">Allow duets</span>
                      <button
                        type="button"
                        @click="allowDuet = !allowDuet"
                        :class="['tt-dialog__toggle', { 'tt-dialog__toggle--active': allowDuet }]"
                        :disabled="publishing"
                      >
                        <span :class="['tt-dialog__toggle-thumb', { 'tt-dialog__toggle-thumb--active': allowDuet }]" />
                      </button>
                    </div>
                    <div class="tt-dialog__toggle-row">
                      <span class="tt-dialog__toggle-label">Allow stitches</span>
                      <button
                        type="button"
                        @click="allowStitch = !allowStitch"
                        :class="['tt-dialog__toggle', { 'tt-dialog__toggle--active': allowStitch }]"
                        :disabled="publishing"
                      >
                        <span :class="['tt-dialog__toggle-thumb', { 'tt-dialog__toggle-thumb--active': allowStitch }]" />
                      </button>
                    </div>
                    <div class="tt-dialog__toggle-row">
                      <span class="tt-dialog__toggle-label">AI-generated content</span>
                      <button
                        type="button"
                        @click="isAiGenerated = !isAiGenerated"
                        :class="['tt-dialog__toggle', { 'tt-dialog__toggle--active': isAiGenerated }]"
                        :disabled="publishing"
                      >
                        <span :class="['tt-dialog__toggle-thumb', { 'tt-dialog__toggle-thumb--active': isAiGenerated }]" />
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Scheduling -->
                <div v-if="schedulingEnabled" class="tt-dialog__field">
                  <div class="tt-dialog__toggle-row">
                    <label class="tt-dialog__label">Schedule for later</label>
                    <button
                      type="button"
                      @click="isScheduled = !isScheduled"
                      :class="['tt-dialog__toggle', { 'tt-dialog__toggle--active': isScheduled }]"
                      :disabled="publishing"
                    >
                      <span :class="['tt-dialog__toggle-thumb', { 'tt-dialog__toggle-thumb--active': isScheduled }]" />
                    </button>
                  </div>

                  <div v-if="isScheduled" class="tt-dialog__schedule-fields">
                    <div class="tt-dialog__schedule-row">
                      <div class="tt-dialog__field" style="flex: 1">
                        <label for="scheduleDate" class="tt-dialog__label-sm">Date</label>
                        <input
                          id="scheduleDate"
                          type="date"
                          v-model="scheduleDate"
                          :min="minDate"
                          :disabled="publishing"
                          class="tt-dialog__input"
                        />
                      </div>
                      <div class="tt-dialog__field" style="flex: 1">
                        <label for="scheduleTime" class="tt-dialog__label-sm">Time</label>
                        <input
                          id="scheduleTime"
                          type="time"
                          v-model="scheduleTime"
                          :disabled="publishing"
                          class="tt-dialog__input"
                        />
                      </div>
                    </div>
                    <p v-if="scheduledDateTime" class="tt-dialog__field-hint" style="display: flex; align-items: center; gap: 0.375rem">
                      <Calendar :size="14" />
                      Will be published {{ formatScheduleTime(scheduledDateTime) }}
                    </p>
                    <p v-if="scheduleError" class="tt-dialog__field-hint tt-dialog__field-hint--error">
                      {{ scheduleError }}
                    </p>
                  </div>
                </div>

                <!-- Error Display -->
                <div v-if="error" class="tt-dialog__alert tt-dialog__alert--error">
                  <AlertCircle :size="16" />
                  <p class="tt-dialog__alert-text">{{ error }}</p>
                </div>
              </form>
            </div>

            <!-- Footer -->
            <div class="tt-dialog__footer">
              <button
                @click="$emit('close')"
                :disabled="publishing"
                class="tt-dialog__btn tt-dialog__btn--secondary"
              >
                Cancel
              </button>
              <button
                @click="publish"
                :disabled="!canPublish || publishing"
                class="tt-dialog__btn tt-dialog__btn--primary"
              >
                <Loader2 v-if="publishing" :size="16" class="tt-dialog__spinner" />
                <Calendar v-else-if="isScheduled" :size="16" />
                <TikTokLogo v-else :size="16" />
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
  import { FileVideo, Loader2, ChevronDown, Calendar, X, AlertCircle } from 'lucide-vue-next';
  import TikTokLogo from '@/components/icons/TikTokLogo.vue';
  import { useToast } from '@/composables/useToast';
  import { getMyAssignedAccounts, listSocialAccounts, type SocialAccount } from '@/services/socialAccountsApi';
  import { createPost } from '@/services/postForMeApi';
  import { schedulePost } from '@/services/schedulingApi';

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
  const selectedAccountValue = ref('');
  const selectedCreatorProfileId = ref('');
  const caption = ref('');
  const publishing = ref(false);
  const error = ref<string | null>(null);
  const isScheduled = ref(false);
  const scheduleDate = ref('');
  const scheduleTime = ref('');
  const scheduleError = ref<string | null>(null);

  // TikTok-specific settings
  const privacyLevel = ref('public');
  const allowComment = ref(true);
  const allowDuet = ref(true);
  const allowStitch = ref(true);
  const isAiGenerated = ref(false);

  const currentOrgName = computed(() => props.organizationName || 'Organization');
  const selectedAccountType = computed(() => (selectedAccountValue.value ? (selectedAccountValue.value.split(':')[0] as 'org') : null));
  const selectedAccountId = computed(() => (selectedAccountValue.value ? parseInt(selectedAccountValue.value.split(':')[1]) : null));
  const selectedAccount = computed(() => orgAccounts.value.find(a => a.id === selectedAccountId.value));
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
        const res = props.isAdmin ? await listSocialAccounts(props.organizationId) : await getMyAssignedAccounts(props.organizationId);
        if (res.success) {
          orgAccounts.value = res.accounts.filter((a) => a.is_active && a.platform === 'tiktok');
        }
      }
      if (orgAccounts.value.length > 0) {
        selectedAccountValue.value = `org:${orgAccounts.value[0].id}`;
      }
    } finally {
      loadingAccounts.value = false;
    }
  }

  async function publish() {
    if (!canPublish.value || !selectedAccountId.value || !selectedAccount.value) return;
    publishing.value = true;
    error.value = null;
    try {
      if (isScheduled.value && scheduledDateTime.value) {
        const data: any = {
          platform: 'tiktok',
          media_url: props.mediaUrl,
          caption: caption.value,
          media_type: props.mediaType || 'video',
          thumbnail_url: props.thumbnailUrl,
          scheduled_at: scheduledDateTime.value.toISOString(),
          clip_id: props.clipId,
          organization_id: props.organizationId ? Number(props.organizationId) : undefined,
          social_account_id: selectedAccountId.value,
          creator_profile_id: selectedCreatorProfileId.value ? parseInt(selectedCreatorProfileId.value) : undefined,
          campaign_id: props.campaignId,
        };
        const response = await schedulePost(data);
        if (response.success) {
          showToast(`TikTok post scheduled for ${formatScheduleTime(scheduledDateTime.value)}`, 'success', 'social');
          emit('published', response.post);
          emit('close');
          resetForm();
        } else {
          error.value = response.error || 'Failed to schedule';
          showToast(response.error || 'Failed to schedule', 'error', 'social');
        }
      } else {
        const account = selectedAccount.value as any;
        const pfmAccountId = account.pfm_account_id;

        if (!pfmAccountId) {
          error.value = 'This TikTok account is not connected via Post for Me. Please reconnect.';
          return;
        }

        const response = await createPost({
          social_account_ids: [pfmAccountId],
          media_url: props.mediaUrl,
          text: caption.value,
          platform: 'tiktok',
          media_type: props.mediaType || 'video',
          thumbnail_url: props.thumbnailUrl,
          organization_id: props.organizationId,
          social_account_id: selectedAccountId.value,
          creator_profile_id: selectedCreatorProfileId.value ? parseInt(selectedCreatorProfileId.value) : undefined,
          campaign_id: props.campaignId,
          tiktok_config: {
            privacy_level: privacyLevel.value as any,
            allow_comment: allowComment.value,
            allow_duet: allowDuet.value,
            allow_stitch: allowStitch.value,
            is_ai_generated: isAiGenerated.value,
          },
        });

        if (response.success) {
          showToast('Post is being published to TikTok', 'success', 'social');
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
    privacyLevel.value = 'public';
    allowComment.value = true;
    allowDuet.value = true;
    allowStitch.value = true;
    isAiGenerated.value = false;
  }
</script>

<style scoped>
  .tt-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10000;
  }

  .tt-dialog {
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

  .tt-dialog__accent {
    height: 3px;
    background: linear-gradient(90deg, #25f4ee, #fe2c55);
    flex-shrink: 0;
  }

  .tt-dialog__header {
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 1.5rem 1.5rem 1rem;
    text-align: center;
  }

  .tt-dialog__close {
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

  .tt-dialog__close:hover:not(:disabled) {
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .tt-dialog__close:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .tt-dialog__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 52px;
    height: 52px;
    border-radius: 12px;
    background: linear-gradient(135deg, rgba(37, 244, 238, 0.15), rgba(254, 44, 85, 0.15));
    color: #25f4ee;
    margin-bottom: 0.875rem;
  }

  .tt-dialog__title {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .tt-dialog__subtitle {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    margin: 0.25rem 0 0;
  }

  .tt-dialog__content {
    flex: 1;
    overflow-y: auto;
    padding: 0.5rem 1.5rem 1.5rem;
  }

  .tt-dialog__content::-webkit-scrollbar { width: 6px; }
  .tt-dialog__content::-webkit-scrollbar-track { background: transparent; }
  .tt-dialog__content::-webkit-scrollbar-thumb { background-color: rgba(255, 255, 255, 0.15); border-radius: 3px; }

  .tt-dialog__form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .tt-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .tt-dialog__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .tt-dialog__label-sm {
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
  }

  .tt-dialog__label-hint {
    color: var(--sidebar-text-muted);
    font-weight: 400;
    font-size: 0.8125rem;
  }

  .tt-dialog__field-hint {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    opacity: 0.8;
  }

  .tt-dialog__field-hint--warning { color: #fbbf24; opacity: 1; }
  .tt-dialog__field-hint--error { color: #f87171; opacity: 1; }

  .tt-dialog__input {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .tt-dialog__input::placeholder { color: var(--sidebar-text-muted); opacity: 0.6; }
  .tt-dialog__input:focus { outline: none; border-color: #25f4ee; box-shadow: 0 0 0 2px rgba(37, 244, 238, 0.15); }

  .tt-dialog__textarea { resize: none; min-height: 80px; }

  .tt-dialog__preview {
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

  .tt-dialog__preview-img { max-width: 100%; max-height: 400px; width: auto; height: auto; object-fit: contain; }
  .tt-dialog__preview-empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--sidebar-text-muted); opacity: 0.3; }
  .tt-dialog__preview-badge { position: absolute; bottom: 0.5rem; right: 0.5rem; padding: 0.25rem 0.5rem; background-color: rgba(0, 0, 0, 0.7); backdrop-filter: blur(4px); border-radius: 4px; font-size: 0.75rem; font-weight: 500; color: white; }

  .tt-dialog__select-wrapper { position: relative; }
  .tt-dialog__select {
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

  .tt-dialog__select:focus { outline: none; border-color: #25f4ee; box-shadow: 0 0 0 2px rgba(37, 244, 238, 0.15); }
  .tt-dialog__select:disabled { opacity: 0.5; cursor: not-allowed; }
  .tt-dialog__select option { background-color: var(--sidebar-surface); color: var(--sidebar-text); }
  .tt-dialog__select-icon { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); color: var(--sidebar-text-muted); pointer-events: none; }

  .tt-dialog__caption-info { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }

  .tt-dialog__toggles {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .tt-dialog__toggle-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .tt-dialog__toggle-label {
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
  }

  .tt-dialog__toggle {
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

  .tt-dialog__toggle:hover:not(:disabled) { background-color: rgba(255, 255, 255, 0.15); }
  .tt-dialog__toggle:disabled { opacity: 0.5; cursor: not-allowed; }
  .tt-dialog__toggle--active { background-color: #25f4ee; border-color: #25f4ee; }

  .tt-dialog__toggle-thumb {
    display: inline-block;
    height: 16px;
    width: 16px;
    border-radius: 9999px;
    background-color: white;
    transform: translateX(4px);
    transition: transform 150ms ease;
  }

  .tt-dialog__toggle-thumb--active { transform: translateX(24px); }

  .tt-dialog__schedule-fields { display: flex; flex-direction: column; gap: 0.75rem; padding-top: 0.5rem; }
  .tt-dialog__schedule-row { display: flex; gap: 0.75rem; }

  .tt-dialog__alert { display: flex; align-items: flex-start; gap: 0.75rem; padding: 0.875rem; border-radius: 8px; }
  .tt-dialog__alert--error { background-color: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.2); color: #f87171; }
  .tt-dialog__alert-text { font-size: 0.8125rem; line-height: 1.5; margin: 0; }

  .tt-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  .tt-dialog__btn {
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

  .tt-dialog__btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .tt-dialog__btn--secondary { background-color: var(--sidebar-hover); color: var(--sidebar-text); border: 1px solid var(--sidebar-border); }
  .tt-dialog__btn--secondary:hover:not(:disabled) { background-color: var(--sidebar-active); border-color: rgba(255, 255, 255, 0.1); }
  .tt-dialog__btn--primary { background: linear-gradient(135deg, #25f4ee 0%, #fe2c55 100%); color: white; }
  .tt-dialog__btn--primary:hover:not(:disabled) { opacity: 0.9; }

  .tt-dialog__spinner { animation: spin 0.8s linear infinite; }

  .modal-enter-active, .modal-leave-active { transition: opacity 200ms ease; }
  .modal-enter-from, .modal-leave-to { opacity: 0; }
  .dialog-enter-active { transition: all 200ms cubic-bezier(0.16, 1, 0.3, 1); }
  .dialog-leave-active { transition: all 150ms ease-in; }
  .dialog-enter-from { opacity: 0; transform: scale(0.96) translateY(8px); }
  .dialog-leave-to { opacity: 0; transform: scale(0.98); }

  @keyframes spin { to { transform: rotate(360deg); } }
</style>
