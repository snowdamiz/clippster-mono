<template>
  <PublishDialogShell
    :open="open"
    title="Publish to YouTube"
    description="Share this clip to your connected YouTube account"
    :icon="Youtube"
    :busy="publishing"
    :can-submit="!!canPublish"
    :submit-label="isScheduled ? 'Schedule' : 'Publish now'"
    :busy-label="isScheduled ? 'Scheduling…' : 'Publishing…'"
    :submit-icon="isScheduled ? CalendarClock : Youtube"
    :error="error"
    @close="$emit('close')"
    @submit="publish"
  >
    <PublishMediaSummary :thumbnail-url="thumbnailUrl" :title="mediaLabel" :meta="['YouTube Shorts']" />

    <Field label="YouTube account" for="yt-account" required>
      <PublishAccountSelect
        id="yt-account"
        v-model="selectedAccountValue"
        :groups="accountGroups"
        :loading="loadingAccounts"
        :disabled="publishing"
        empty-text="No YouTube accounts available. Connect a personal account or ask an admin to assign you an organization account."
      />
    </Field>

    <PublishCreatorProfileField
      v-if="creatorProfiles.length > 0"
      id="yt-creator"
      v-model="selectedCreatorProfileId"
      :profiles="creatorProfiles"
      :disabled="publishing"
    />

    <Field label="Title" for="yt-title" required>
      <template #label-end>
        <span class="tabular text-xs text-fg-subtle">{{ title.length }} / 100</span>
      </template>
      <Input id="yt-title" v-model="title" :disabled="publishing" maxlength="100" placeholder="Enter video title…" />
    </Field>

    <PublishCaptionField
      id="yt-caption"
      v-model="caption"
      label="Description"
      :maxlength="5000"
      :rows="4"
      placeholder="Write a description for your YouTube Short…"
      :disabled="publishing"
    />

    <div class="grid grid-cols-2 gap-3">
      <Field label="Privacy" for="yt-privacy" hint="Control who can see your video">
        <Select v-model="privacy" :disabled="publishing">
          <SelectTrigger id="yt-privacy">
            <SelectValue />
          </SelectTrigger>
          <SelectContent class="min-w-[var(--reka-select-trigger-width)]">
            <SelectItem value="public">Public</SelectItem>
            <SelectItem value="unlisted">Unlisted</SelectItem>
            <SelectItem value="private">Private</SelectItem>
          </SelectContent>
        </Select>
      </Field>
      <Field label="Made for kids" for="yt-kids" hint="Required by YouTube">
        <div class="flex h-[var(--control-md)] items-center">
          <Switch id="yt-kids" v-model="madeForKids" :disabled="publishing" />
        </div>
      </Field>
    </div>

    <PublishScheduleField
      v-if="schedulingEnabled"
      v-model:enabled="isScheduled"
      v-model:date="scheduleDate"
      v-model:time="scheduleTime"
      :min-date="minDate"
      :summary="scheduleSummary"
      :error="scheduleError"
      :disabled="publishing"
      id-prefix="yt"
    />
  </PublishDialogShell>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { CalendarClock, Youtube } from 'lucide-vue-next';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
  import { Switch } from '@/components/ui/switch';
  import PublishDialogShell from '@/components/publish/PublishDialogShell.vue';
  import PublishMediaSummary from '@/components/publish/PublishMediaSummary.vue';
  import PublishAccountSelect from '@/components/publish/PublishAccountSelect.vue';
  import PublishCreatorProfileField from '@/components/publish/PublishCreatorProfileField.vue';
  import PublishCaptionField from '@/components/publish/PublishCaptionField.vue';
  import PublishScheduleField from '@/components/publish/PublishScheduleField.vue';
  import { usePublishSchedule } from '@/components/publish/usePublishSchedule';
  import { useToast } from '@/composables/useToast';
  import { getMyAssignedAccounts, listSocialAccounts, publishPost, type SocialAccount } from '@/services/socialAccountsApi';
  import { listUserYoutubeAccounts, publishToUserYoutube, type UserYoutubeAccount } from '@/services/userYoutubeApi';
  import { schedulePost } from '@/services/schedulingApi';
  import api from '@/services/api';

  interface CreatorProfile { id: number; name: string; }

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

  const emit = defineEmits<{ (e: 'close'): void; (e: 'published', post: any): void; }>();
  const { showToast } = useToast();
  const { isScheduled, scheduleDate, scheduleTime, scheduleError, minDate, scheduledDateTime, scheduleSummary, formatScheduleTime } =
    usePublishSchedule();

  const loadingAccounts = ref(true);
  const orgAccounts = ref<SocialAccount[]>([]);
  const personalAccounts = ref<UserYoutubeAccount[]>([]);
  const allowPersonal = ref(true);
  const selectedAccountValue = ref('');
  const selectedCreatorProfileId = ref('');
  const title = ref('');
  const caption = ref('');
  const privacy = ref<'public' | 'unlisted' | 'private'>('public');
  const madeForKids = ref(false);
  const publishing = ref(false);
  const error = ref<string | null>(null);

  const currentOrgName = computed(() => props.organizationName || 'Organization');
  const mediaLabel = computed(() => (props.mediaType === 'image' ? 'Image' : props.mediaType === 'reel' ? 'Reel' : 'Video'));
  const showPersonalAccounts = computed(() => !props.organizationId || allowPersonal.value);
  const allAccounts = computed(() => [...orgAccounts.value, ...(showPersonalAccounts.value ? personalAccounts.value : [])]);
  const accountGroups = computed(() => [
    { label: `${currentOrgName.value} accounts`, prefix: 'org' as const, accounts: orgAccounts.value },
    { label: 'My personal accounts', prefix: 'user' as const, accounts: showPersonalAccounts.value ? personalAccounts.value : [] },
  ]);
  const selectedAccountType = computed(() => (selectedAccountValue.value ? (selectedAccountValue.value.split(':')[0] as 'org' | 'user') : null));
  const selectedAccountId = computed(() => (selectedAccountValue.value ? parseInt(selectedAccountValue.value.split(':')[1]) : null));
  const canPublish = computed(() =>
    !!selectedAccountValue.value && !!props.mediaUrl && !!title.value.trim() &&
    (!isScheduled.value || (scheduledDateTime.value && !scheduleError.value))
  );

  watch(() => props.open, async (isOpen) => { if (isOpen) { await loadAccounts(); error.value = null; } }, { immediate: true });

  async function loadAccounts() {
    loadingAccounts.value = true;
    try {
      if (props.organizationId) {
        try {
          const orgRes = await api.get(`/organizations/${props.organizationId}`);
          if (orgRes.data.success) { allowPersonal.value = orgRes.data.organization.allow_personal_instagram ?? true; }
        } catch {}
        const res = props.isAdmin ? await listSocialAccounts(props.organizationId) : await getMyAssignedAccounts(props.organizationId);
        if (res.success) { orgAccounts.value = res.accounts.filter((a) => a.is_active && a.platform === 'youtube'); }
      }
      const pRes = await listUserYoutubeAccounts();
      if (pRes.success) { personalAccounts.value = pRes.accounts.filter((a) => a.is_active); }
      if (orgAccounts.value.length > 0) { selectedAccountValue.value = `org:${orgAccounts.value[0].id}`; }
      else if (showPersonalAccounts.value && personalAccounts.value.length > 0) { selectedAccountValue.value = `user:${personalAccounts.value[0].id}`; }
    } finally { loadingAccounts.value = false; }
  }

  async function publish() {
    if (!canPublish.value || !selectedAccountId.value) return;
    publishing.value = true;
    error.value = null;
    try {
      let response;
      if (isScheduled.value && scheduledDateTime.value) {
        const data: any = {
          platform: 'youtube', media_url: props.mediaUrl, caption: caption.value,
          media_type: props.mediaType || 'video', thumbnail_url: props.thumbnailUrl,
          scheduled_at: scheduledDateTime.value.toISOString(), clip_id: props.clipId,
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
          emit('published', response.post); emit('close'); resetForm();
        } else { error.value = response.error || 'Failed to schedule'; showToast(response.error || 'Failed to schedule', 'error', 'social'); }
      } else {
        if (selectedAccountType.value === 'org' && props.organizationId) {
          response = await publishPost(props.organizationId, {
            social_account_id: selectedAccountId.value,
            creator_profile_id: selectedCreatorProfileId.value ? parseInt(selectedCreatorProfileId.value) : undefined,
            media_url: props.mediaUrl,
            title: title.value,
            caption: caption.value,
            privacy: privacy.value,
            made_for_kids: madeForKids.value,
            media_type: props.mediaType || 'video',
            thumbnail_url: props.thumbnailUrl,
          });
        } else {
          response = await publishToUserYoutube({
            account_id: selectedAccountId.value,
            media_url: props.mediaUrl,
            title: title.value,
            caption: caption.value,
            privacy: privacy.value,
            made_for_kids: madeForKids.value,
            media_type: props.mediaType || 'video',
            thumbnail_url: props.thumbnailUrl,
            creator_profile_id: selectedCreatorProfileId.value ? parseInt(selectedCreatorProfileId.value) : undefined,
            campaign_id: props.campaignId,
          });
        }
        if (response.success) {
          showToast('Post is being published to YouTube', 'success', 'social');
          emit('published', response.post); emit('close'); resetForm();
        } else { error.value = response.error || 'Failed to publish'; showToast(response.error || 'Failed to publish', 'error', 'social'); }
      }
    } catch (err) {
      console.error('Failed to publish:', err);
      error.value = 'Failed to publish post. Please try again.';
      showToast('Failed to publish', 'error', 'social');
    } finally { publishing.value = false; }
  }

  function resetForm() {
    selectedAccountValue.value = ''; selectedCreatorProfileId.value = ''; title.value = ''; caption.value = '';
    privacy.value = 'public'; madeForKids.value = false;
    isScheduled.value = false; scheduleDate.value = ''; scheduleTime.value = ''; scheduleError.value = null;
  }
</script>
