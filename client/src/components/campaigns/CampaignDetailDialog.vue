<template>
  <Modal v-model:open="isOpen" :title="campaign?.title || 'Campaign details'" size="lg" flush>
    <template #header>
      <header class="flex shrink-0 items-start gap-3 px-5 pt-4 pb-3 pr-12">
        <Avatar
          :src="campaignDetails?.cover_image_url ?? campaign?.cover_image_url"
          :name="campaign?.title"
          :icon="Megaphone"
          size="md"
          shape="square"
          class="mt-0.5"
        />
        <div class="min-w-0 flex-1">
          <h2 class="truncate text-[15px] font-semibold leading-6 tracking-[-0.01em] text-fg">
            {{ campaign?.title || 'Campaign details' }}
          </h2>
          <p v-if="headerOrganization" class="mt-0.5 truncate text-sm text-fg-muted">
            by
            <router-link
              v-if="headerOrganization.slug"
              :to="{ path: `/orgs/${headerOrganization.slug}`, query: { from: route.fullPath } }"
              class="text-fg transition-colors hover:text-brand hover:underline"
              @click.stop
            >
              {{ headerOrganization.name }}
            </router-link>
            <span v-else class="text-fg">{{ headerOrganization.name }}</span>
          </p>
        </div>
      </header>
    </template>

    <!-- Loading (first load only; reloads after joining keep the content) -->
    <div v-if="loading && !campaignDetails" class="flex flex-col gap-4 px-5 pt-1 pb-5">
      <div class="grid grid-cols-4 gap-3">
        <div v-for="i in 4" :key="i" class="skeleton h-10" />
      </div>
      <div class="skeleton h-3 w-3/4" />
      <div class="skeleton h-3 w-1/2" />
    </div>

    <div v-else-if="campaignDetails" class="flex animate-enter flex-col gap-5 px-5 pt-1 pb-5">
      <!-- Cover (media well; hidden when the image can't load) -->
      <div
        v-if="campaignDetails.cover_image_url && !coverFailed"
        class="h-36 shrink-0 overflow-hidden rounded-lg border border-line-subtle bg-surface-sunken"
      >
        <img
          :src="campaignDetails.cover_image_url"
          alt="Campaign cover"
          class="size-full object-cover"
          @error="coverFailed = true"
        />
      </div>

      <!-- Participation status -->
      <Alert v-if="participation" :variant="participation.status === 'approved' ? 'success' : 'info'">
        <CheckCircle v-if="participation.status === 'approved'" />
        <Clock v-else />
        <AlertTitle class="mb-0">
          {{
            participation.status === 'approved'
              ? 'You are a member of this campaign'
              : participation.status === 'pending'
                ? 'Your application is pending review'
                : 'Status: ' + participation.status
          }}
        </AlertTitle>
      </Alert>

      <StatGrid size="sm" :items="metrics" />

      <!-- About -->
      <section v-if="campaignDetails.description" class="flex flex-col gap-1.5">
        <SectionHeader title="About this campaign" variant="eyebrow" />
        <p class="whitespace-pre-line text-sm text-fg-muted">{{ campaignDetails.description }}</p>
      </section>

      <!-- Requirements: platforms, payment methods, how to join -->
      <section class="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div class="flex min-w-0 flex-col gap-2">
          <SectionHeader title="Platforms" variant="eyebrow" />
          <ul class="flex flex-wrap gap-x-3 gap-y-1.5 text-sm text-fg">
            <li v-for="platform in campaignDetails.allowed_platforms" :key="platform" class="flex items-center gap-1.5">
              <PlatformLogo :platform="platform" size="xs" />
              {{ getPlatformDisplayName(platform) }}
            </li>
          </ul>
        </div>
        <div class="flex min-w-0 flex-col gap-2">
          <SectionHeader title="Payments" variant="eyebrow" />
          <ul class="flex flex-wrap gap-x-3 gap-y-1.5 text-sm text-fg">
            <li v-for="method in campaignDetails.payment_methods" :key="method" class="flex items-center gap-1.5">
              <Wallet class="size-3.5 text-fg-subtle" />
              {{ getPaymentMethodDisplayName(method) }}
            </li>
          </ul>
        </div>
        <div class="flex min-w-0 flex-col gap-2">
          <SectionHeader title="Joining" variant="eyebrow" />
          <div class="min-w-0">
            <p class="flex items-center gap-1.5 text-sm text-fg">
              <component
                :is="campaignDetails.join_type === 'open' ? UserPlus : ClipboardCheck"
                class="size-3.5 text-fg-subtle"
              />
              {{ campaignDetails.join_type === 'open' ? 'Open campaign' : 'Application required' }}
            </p>
            <p class="mt-0.5 text-xs text-fg-muted">
              {{
                campaignDetails.join_type === 'open'
                  ? 'Anyone can join and start submitting clips immediately.'
                  : 'You need to apply and be approved before submitting.'
              }}
            </p>
          </div>
        </div>
      </section>

      <!-- Streamers to clip -->
      <section v-if="campaignDetails.creator_profiles && campaignDetails.creator_profiles.length > 0" class="flex flex-col gap-2">
        <SectionHeader title="Streamers to clip" variant="eyebrow" />
        <div class="flex flex-col divide-y divide-line-subtle rounded-lg border border-line-subtle bg-surface">
          <div
            v-for="profile in campaignDetails.creator_profiles"
            :key="profile.id"
            class="flex min-w-0 items-center gap-3 px-3 py-2"
          >
            <Avatar :src="profile.profile_image_url" :name="profile.name" size="md" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-fg">{{ profile.name }}</p>
              <div v-if="profile.platform_links && profile.platform_links.length > 0" class="mt-1 flex flex-wrap gap-1">
                <a
                  v-for="link in profile.platform_links"
                  :key="link.id"
                  :href="getStreamerUrl(link.platform, link.platform_id)"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="inline-flex h-6 max-w-full items-center gap-1.5 rounded-md bg-surface-hover px-1.5 text-xs text-fg-muted transition-colors hover:bg-surface-active hover:text-fg"
                  :title="`View on ${platformName(link.platform)}`"
                  @click.stop
                >
                  <PlatformLogo :platform="link.platform" size="xs" />
                  <span class="truncate">{{ link.display_name || link.platform_id }}</span>
                  <ExternalLink class="size-3 shrink-0 opacity-60" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>

      <CampaignResourcesPanel :resources="campaignDetails.resources || []" />
    </div>

    <template #footer>
      <Button variant="ghost" @click="isOpen = false">Close</Button>

      <template v-if="!participation && campaignDetails">
        <Button v-if="campaignDetails.join_type === 'open'" variant="primary" :loading="joining" @click="joinCampaign">
          <UserPlus v-if="!joining" />
          Join campaign
        </Button>
        <Button v-else variant="primary" :disabled="joining" @click="handleApplyClick">
          <ClipboardCheck />
          Apply to join
        </Button>
      </template>

      <Button v-else-if="participation?.status === 'approved'" variant="primary" @click="showSubmitForm = true">
        <Upload />
        Submit clip
      </Button>
    </template>
  </Modal>

  <!-- Application form -->
  <Modal
    v-model:open="showApplicationForm"
    title="Apply to campaign"
    description="Tell the campaign owner why you'd like to join."
    :icon="ClipboardCheck"
    size="md"
  >
    <Field label="Application note" hint="Optional">
      <Textarea
        v-model="applicationNote"
        rows="4"
        placeholder="Share your experience, follower count, or why you're a good fit…"
      />
    </Field>

    <template #footer>
      <Button variant="ghost" @click="showApplicationForm = false">Cancel</Button>
      <Button variant="primary" :loading="joining" @click="submitApplication">
        {{ joining ? 'Submitting…' : 'Submit application' }}
      </Button>
    </template>
  </Modal>

  <!-- Submit clip -->
  <Modal
    v-model:open="showSubmitForm"
    title="Submit clip"
    description="Paste the URL of your posted clip."
    :icon="Upload"
    size="md"
  >
    <Field label="Clip URL">
      <Input v-model="clipUrl" type="text" placeholder="https://tiktok.com/@user/video/..." />
      <p v-if="detectedPlatform" class="flex items-center gap-1.5 text-xs text-success">
        <CheckCircle class="size-3.5" />
        Detected: {{ getPlatformDisplayName(detectedPlatform) }}
      </p>
    </Field>

    <template #footer>
      <Button variant="ghost" @click="showSubmitForm = false">Cancel</Button>
      <Button variant="primary" :loading="submitting" :disabled="!clipUrl" @click="submitClipToServer">
        <Upload v-if="!submitting" />
        {{ submitting ? 'Submitting…' : 'Submit clip' }}
      </Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import { useRoute } from 'vue-router';
  import {
    Megaphone,
    UserPlus,
    ClipboardCheck,
    CheckCircle,
    Clock,
    Upload,
    Wallet,
    ExternalLink,
  } from 'lucide-vue-next';
  import {
    getCampaign,
    applyToCampaign,
    submitClip,
    type Campaign,
    type CampaignParticipation,
    type CampaignStats,
    getPlatformDisplayName,
    detectPlatformFromUrl,
  } from '@/services/campaignApi';
  import { getPaymentMethodDisplayName } from '@/services/clipperProfileApi';
  import CampaignResourcesPanel from '@/components/campaigns/CampaignResourcesPanel.vue';
  import { StatGrid, type StatItem } from '@/components/ui/stat-card';
  import { formatBudget, payout } from '@/components/campaigns/campaignDisplay';
  import { Avatar } from '@/components/ui/avatar';
  import { PlatformLogo } from '@/components/ui/platform-logo';
  import { platformName } from '@/components/directory/platformName';
  import { Alert, AlertTitle } from '@/components/ui/alert';
  import { Button } from '@/components/ui/button';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SectionHeader } from '@/components/ui/section-header';
  import { Textarea } from '@/components/ui/textarea';
  import { useToast } from '@/composables/useToast';
  import { useAuthStore } from '@/stores/auth';

  const props = defineProps<{
    campaign: Campaign | null;
  }>();

  const emit = defineEmits<{
    (e: 'joined'): void;
    (e: 'requireAuth'): void;
  }>();

  const isOpen = defineModel<boolean>('open', { default: false });

  const { toast } = useToast();
  const authStore = useAuthStore();
  const route = useRoute();

  const loading = ref(false);
  const joining = ref(false);
  const submitting = ref(false);
  const campaignDetails = ref<Campaign | null>(null);
  const coverFailed = ref(false);
  const participation = ref<CampaignParticipation | null>(null);
  const stats = ref<CampaignStats | null>(null);
  const showApplicationForm = ref(false);
  const showSubmitForm = ref(false);
  const applicationNote = ref('');
  const clipUrl = ref('');

  const headerOrganization = computed(
    () => campaignDetails.value?.organization ?? props.campaign?.organization ?? null
  );

  const detectedPlatform = computed(() => {
    if (!clipUrl.value) return null;
    return detectPlatformFromUrl(clipUrl.value);
  });

  const metrics = computed<StatItem[]>(() => {
    const c = campaignDetails.value;
    if (!c) return [];
    const pay = payout(c);
    return [
      { label: 'Payout', value: pay.value, hint: pay.unit },
      { label: 'Min views', value: c.min_views_for_payment.toLocaleString() },
      { label: 'Total budget', value: `$${formatBudget(c.budget)}` },
      { label: 'Clippers', value: stats.value?.participants_count || 0 },
    ];
  });

  const getStreamerUrl = (platform: string, platformId: string) => {
    switch (platform) {
      case 'kick':
        return `https://kick.com/${platformId}`;
      case 'pumpfun':
        return `https://pump.fun/coin/${platformId}`;
      case 'twitch':
        return `https://twitch.tv/${platformId}`;
      case 'youtube':
        return `https://youtube.com/@${platformId}`;
      default:
        return '#';
    }
  };

  const loadCampaignDetails = async () => {
    if (!props.campaign) return;

    loading.value = true;
    try {
      const response = await getCampaign(props.campaign.id);
      if (response.success && response.campaign) {
        campaignDetails.value = response.campaign;
        participation.value = response.participation || null;
        stats.value = response.stats || null;
      }
    } catch (error) {
      console.error('Failed to load campaign details:', error);
      toast({
        title: 'Error',
        description: 'Failed to load campaign details',
      });
    } finally {
      loading.value = false;
    }
  };

  const joinCampaign = async () => {
    if (!campaignDetails.value) return;

    // Check if user is authenticated
    if (!authStore.isAuthenticated) {
      emit('requireAuth');
      return;
    }

    joining.value = true;
    try {
      const response = await applyToCampaign(campaignDetails.value.id);
      if (response.success) {
        toast({
          title: 'Success',
          description: 'You have joined the campaign!',
        });
        emit('joined');
        await loadCampaignDetails();
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Failed to join campaign',
        });
      }
    } catch (error) {
      console.error('Failed to join campaign:', error);
      toast({
        title: 'Error',
        description: 'Failed to join campaign',
      });
    } finally {
      joining.value = false;
    }
  };

  const handleApplyClick = () => {
    // Check if user is authenticated before showing application form
    if (!authStore.isAuthenticated) {
      emit('requireAuth');
      return;
    }
    showApplicationForm.value = true;
  };

  const submitApplication = async () => {
    if (!campaignDetails.value) return;

    joining.value = true;
    try {
      const response = await applyToCampaign(campaignDetails.value.id, applicationNote.value);
      if (response.success) {
        toast({
          title: 'Application submitted',
          description: 'Your application is pending review',
        });
        showApplicationForm.value = false;
        applicationNote.value = '';
        await loadCampaignDetails();
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Failed to submit application',
        });
      }
    } catch (error) {
      console.error('Failed to submit application:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit application',
      });
    } finally {
      joining.value = false;
    }
  };

  const submitClipToServer = async () => {
    if (!campaignDetails.value || !clipUrl.value) return;

    submitting.value = true;
    try {
      const response = await submitClip(campaignDetails.value.id, clipUrl.value, detectedPlatform.value || undefined);
      if (response.success) {
        toast({
          title: 'Clip submitted',
          description: 'Your clip is pending review',
        });
        showSubmitForm.value = false;
        clipUrl.value = '';
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Failed to submit clip',
        });
      }
    } catch (error: any) {
      console.error('Failed to submit clip:', error);
      // Extract error message from axios error response
      let errorMessage = 'Failed to submit clip';
      if (error?.response?.data?.error) {
        const apiError = error.response.data.error;
        // Handle changeset errors (e.g., {clip_url: ["has already been submitted"]})
        if (typeof apiError === 'object' && apiError.clip_url) {
          errorMessage = `This clip ${apiError.clip_url[0] || 'has already been submitted'}`;
        } else if (typeof apiError === 'string') {
          errorMessage = apiError;
        }
      }
      toast({
        title: 'Error',
        description: errorMessage,
      });
    } finally {
      submitting.value = false;
    }
  };

  watch(
    () => props.campaign,
    (newCampaign) => {
      if (newCampaign && isOpen.value) {
        loadCampaignDetails();
      }
    },
    { immediate: true }
  );

  watch(isOpen, (open) => {
    if (open && props.campaign) {
      loadCampaignDetails();
    } else if (!open) {
      campaignDetails.value = null;
      coverFailed.value = false;
      participation.value = null;
      stats.value = null;
    }
  });
</script>
