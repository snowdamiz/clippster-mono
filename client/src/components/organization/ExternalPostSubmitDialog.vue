<template>
  <Modal
    :open="open"
    title="Submit post link"
    description="Share a post you've made on your personal account"
    :icon="Link"
    size="md"
    :dismissible="!submitting"
    :hide-close="submitting"
    @close="$emit('close')"
  >
    <form id="external-post-form" class="flex flex-col gap-4" @submit.prevent="submit">
      <!-- Post URL (platform auto-detected) -->
      <Field label="Post URL" for="external-post-url" required :error="urlError">
        <template v-if="detectedPlatform" #label-end>
          <span class="inline-flex items-center gap-1.5 text-xs text-fg-muted">
            <PlatformLogo :platform="detectedPlatform" size="xs" />
            {{ platformDisplayName }}
            <span class="text-fg-subtle">detected</span>
          </span>
        </template>
        <Input
          id="external-post-url"
          v-model="postUrl"
          type="url"
          :disabled="submitting"
          :aria-invalid="!!urlError || undefined"
          placeholder="Paste Instagram, TikTok, YouTube, or X post URL..."
        />
      </Field>

      <!-- Creator Profile -->
      <Field v-if="creatorProfiles.length > 0 && !preselectedCreatorProfileId" for="external-post-creator">
        <template #label>
          Creator profile
          <span class="font-normal text-fg-subtle">(optional)</span>
        </template>
        <CustomDropdown
          id="external-post-creator"
          v-model="creatorProfileId"
          :options="creatorProfileOptions"
          :disabled="submitting"
        />
      </Field>

      <!-- Campaign (optional) -->
      <Field v-if="campaigns.length > 0" for="external-post-campaign">
        <template #label>
          Campaign
          <span class="font-normal text-fg-subtle">(optional)</span>
        </template>
        <CustomDropdown id="external-post-campaign" v-model="campaignId" :options="campaignOptions" :disabled="submitting" />
      </Field>

      <!-- Error Display -->
      <Alert v-if="error" variant="destructive">
        <AlertCircle />
        <AlertDescription class="text-fg">{{ error }}</AlertDescription>
      </Alert>
    </form>

    <template #footer>
      <Button variant="ghost" :disabled="submitting" @click="$emit('close')">Cancel</Button>
      <Button variant="primary" type="submit" form="external-post-form" :disabled="!canSubmit" :loading="submitting">
        <Send v-if="!submitting" />
        {{ submitting ? 'Submitting...' : 'Submit' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { AlertCircle, Link, Send } from 'lucide-vue-next';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Modal } from '@/components/ui/modal';
import { PlatformLogo } from '@/components/ui/platform-logo';
import CustomDropdown from '@/components/CustomDropdown.vue';
import { useToast } from '@/composables/useToast';
import { submitExternalPost } from '@/services/creatorProfileRuntime';

interface CreatorProfile {
  id: number;
  name: string;
}

interface Campaign {
  id: number;
  name: string;
}

const props = defineProps<{
  open: boolean;
  organizationId: string | number;
  creatorProfiles: CreatorProfile[];
  campaigns: Campaign[];
  clipId?: string;
  preselectedCreatorProfileId?: number | string;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'submitted', submission: any): void;
}>();

const { showToast } = useToast();

const postUrl = ref('');
const creatorProfileId = ref('');
const detectedPlatform = ref<string | null>(null);
const campaignId = ref('');
const submitting = ref(false);
const error = ref<string | null>(null);
const urlError = ref<string | null>(null);

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

// Platform display helpers
const platformDisplayName = computed(() => {
  switch (detectedPlatform.value) {
    case 'instagram': return 'Instagram';
    case 'tiktok': return 'TikTok';
    case 'youtube': return 'YouTube';
    case 'twitter': return 'X (Twitter)';
    default: return '';
  }
});

const creatorProfileOptions = computed(() => [
  { label: 'None', value: '' },
  ...props.creatorProfiles.map((profile) => ({ label: profile.name, value: String(profile.id) })),
]);

const campaignOptions = computed(() => [
  { label: 'None', value: '' },
  ...props.campaigns.map((campaign) => ({ label: campaign.name, value: String(campaign.id) })),
]);

const canSubmit = computed(() => {
  return postUrl.value && detectedPlatform.value && !urlError.value;
});

// Reset form when dialog opens
watch(() => props.open, (isOpen) => {
  if (isOpen) {
    resetForm();
  }
});

function resetForm() {
  postUrl.value = '';
  detectedPlatform.value = null;
  // Use preselected creator profile if provided
  creatorProfileId.value = props.preselectedCreatorProfileId ? String(props.preselectedCreatorProfileId) : '';
  campaignId.value = '';
  error.value = null;
  urlError.value = null;
}

async function submit() {
  if (!canSubmit.value) return;

  submitting.value = true;
  error.value = null;

  try {
    const response = await submitExternalPost(props.organizationId, {
      platform: detectedPlatform.value!,
      post_url: postUrl.value,
      creator_profile_id: creatorProfileId.value ? parseInt(creatorProfileId.value) : undefined,
      campaign_id: campaignId.value ? parseInt(campaignId.value) : undefined,
      clip_id: props.clipId,
    });

    if (response.success) {
      showToast('Post submitted successfully', 'success');
      emit('submitted', response.submission);
      emit('close');
    } else {
      error.value = response.error || 'Failed to submit post';
      showToast(response.error || 'Failed to submit', 'error');
    }
  } catch (err) {
    console.error('Failed to submit post:', err);
    error.value = 'Failed to submit post. Please try again.';
    showToast('Failed to submit', 'error');
  } finally {
    submitting.value = false;
  }
}
</script>
