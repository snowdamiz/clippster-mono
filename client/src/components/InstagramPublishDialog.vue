<template>
  <PublishDialogShell
    :open="open"
    title="Publish to Instagram"
    description="Share this clip to your connected Instagram account"
    :icon="Instagram"
    :busy="publishing"
    :can-submit="!!canPublish"
    :submit-label="isScheduled ? 'Schedule' : 'Publish now'"
    :busy-label="isScheduled ? 'Scheduling…' : 'Publishing…'"
    :submit-icon="isScheduled ? CalendarClock : Instagram"
    :error="error"
    @close="$emit('close')"
    @submit="publish"
  >
    <PublishMediaSummary :thumbnail-url="thumbnailUrl" :title="mediaLabel" :meta="['Instagram']" />

    <Field label="Instagram account" for="ig-account" required>
      <PublishAccountSelect
        id="ig-account"
        v-model="selectedAccountValue"
        :groups="accountGroups"
        :loading="loadingAccounts"
        :disabled="publishing"
        empty-text="No Instagram accounts available. Connect a personal account or ask an admin to assign you an organization account."
      />
    </Field>

    <PublishCreatorProfileField
      v-if="creatorProfiles.length > 0"
      id="ig-creator"
      v-model="selectedCreatorProfileId"
      :profiles="creatorProfiles"
      :disabled="publishing"
    />

    <PublishCaptionField
      id="ig-caption"
      v-model="caption"
      :maxlength="2200"
      :rows="4"
      placeholder="Write a caption for your post…"
      :disabled="publishing"
      :error="hashtagCount > 30 ? `Too many hashtags (${hashtagCount}/30)` : null"
    />

    <PublishScheduleField
      v-if="schedulingEnabled"
      v-model:enabled="isScheduled"
      v-model:date="scheduleDate"
      v-model:time="scheduleTime"
      :min-date="minDate"
      :summary="scheduleSummary"
      :error="scheduleError"
      :disabled="publishing"
      id-prefix="ig"
    />
  </PublishDialogShell>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { CalendarClock, Instagram } from 'lucide-vue-next';
  import { Field } from '@/components/ui/field';
  import PublishDialogShell from '@/components/publish/PublishDialogShell.vue';
  import PublishMediaSummary from '@/components/publish/PublishMediaSummary.vue';
  import PublishAccountSelect from '@/components/publish/PublishAccountSelect.vue';
  import PublishCreatorProfileField from '@/components/publish/PublishCreatorProfileField.vue';
  import PublishCaptionField from '@/components/publish/PublishCaptionField.vue';
  import PublishScheduleField from '@/components/publish/PublishScheduleField.vue';
  import { usePublishSchedule } from '@/components/publish/usePublishSchedule';
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
  const { isScheduled, scheduleDate, scheduleTime, scheduleError, minDate, scheduledDateTime, scheduleSummary, formatScheduleTime } =
    usePublishSchedule();

  const loadingAccounts = ref(true);
  const orgAccounts = ref<SocialAccount[]>([]);
  const personalAccounts = ref<UserInstagramAccount[]>([]);
  const allowPersonalInstagram = ref(true);
  const selectedAccountValue = ref('');
  const selectedCreatorProfileId = ref('');
  const caption = ref('');
  const publishing = ref(false);
  const error = ref<string | null>(null);

  const currentOrgName = computed(() => props.organizationName || 'Organization');
  const mediaLabel = computed(() => (props.mediaType === 'image' ? 'Image' : props.mediaType === 'reel' ? 'Reel' : 'Video'));
  const showPersonalAccounts = computed(() => !props.organizationId || allowPersonalInstagram.value);
  const allAccounts = computed(() => [...orgAccounts.value, ...(showPersonalAccounts.value ? personalAccounts.value : [])]);
  const accountGroups = computed(() => [
    { label: `${currentOrgName.value} accounts`, prefix: 'org' as const, accounts: orgAccounts.value },
    { label: 'My personal accounts', prefix: 'user' as const, accounts: showPersonalAccounts.value ? personalAccounts.value : [] },
  ]);
  const selectedAccountType = computed(() => (selectedAccountValue.value ? (selectedAccountValue.value.split(':')[0] as 'org' | 'user') : null));
  const selectedAccountId = computed(() => (selectedAccountValue.value ? parseInt(selectedAccountValue.value.split(':')[1]) : null));
  const hashtagCount = computed(() => (caption.value.match(/#\w+/g) || []).length);
  const canPublish = computed(
    () =>
      !!selectedAccountValue.value &&
      !!props.mediaUrl &&
      hashtagCount.value <= 30 &&
      (!isScheduled.value || (scheduledDateTime.value && !scheduleError.value))
  );

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
