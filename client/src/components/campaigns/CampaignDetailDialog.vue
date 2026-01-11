<template>
  <Dialog v-model:open="isOpen">
    <DialogContent class="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
      <DialogHeader>
        <DialogTitle class="flex items-center gap-2">
          <Megaphone class="w-5 h-5 text-primary" />
          {{ campaign?.title || 'Campaign Details' }}
        </DialogTitle>
        <DialogDescription v-if="campaign?.organization">by {{ campaign.organization.name }}</DialogDescription>
      </DialogHeader>

      <div v-if="loading" class="flex items-center justify-center py-12">
        <Loader2 class="w-8 h-8 animate-spin text-primary" />
      </div>

      <div v-else-if="campaignDetails" class="flex-1 overflow-y-auto space-y-6 pr-2">
        <!-- Cover Image -->
        <div v-if="campaignDetails.cover_image_url" class="relative h-40 rounded-lg overflow-hidden">
          <img :src="campaignDetails.cover_image_url" class="w-full h-full object-cover" />
        </div>

        <!-- Description -->
        <div v-if="campaignDetails.description" class="space-y-2">
          <h4 class="text-sm font-medium text-foreground">About this campaign</h4>
          <p class="text-sm text-muted-foreground whitespace-pre-wrap">{{ campaignDetails.description }}</p>
        </div>

        <!-- Stats Grid -->
        <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div class="bg-muted/30 rounded-lg p-3 text-center">
            <div class="text-lg font-bold text-green-500">${{ formatCpm(campaignDetails.cpm) }}</div>
            <div class="text-[11px] text-muted-foreground">per 1K views</div>
          </div>
          <div class="bg-muted/30 rounded-lg p-3 text-center">
            <div class="text-lg font-bold text-foreground">
              {{ campaignDetails.min_views_for_payment.toLocaleString() }}
            </div>
            <div class="text-[11px] text-muted-foreground">min views</div>
          </div>
          <div class="bg-muted/30 rounded-lg p-3 text-center">
            <div class="text-lg font-bold text-foreground">${{ formatBudget(campaignDetails.budget) }}</div>
            <div class="text-[11px] text-muted-foreground">total budget</div>
          </div>
          <div class="bg-muted/30 rounded-lg p-3 text-center">
            <div class="text-lg font-bold text-foreground">{{ stats?.participants_count || 0 }}</div>
            <div class="text-[11px] text-muted-foreground">clippers</div>
          </div>
        </div>

        <!-- Platforms -->
        <div class="space-y-2">
          <h4 class="text-sm font-medium text-foreground">Allowed Platforms</h4>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="platform in campaignDetails.allowed_platforms"
              :key="platform"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-lg text-sm font-medium"
            >
              <component :is="getPlatformIcon(platform)" class="w-4 h-4" />
              {{ getPlatformDisplayName(platform) }}
            </div>
          </div>
        </div>

        <!-- Payment Methods -->
        <div class="space-y-2">
          <h4 class="text-sm font-medium text-foreground">Payment Methods</h4>
          <div class="flex flex-wrap gap-2">
            <div
              v-for="method in campaignDetails.payment_methods"
              :key="method"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted/50 rounded-lg text-sm font-medium"
            >
              <Wallet class="w-4 h-4" />
              {{ getPaymentMethodDisplayName(method) }}
            </div>
          </div>
        </div>

        <!-- Join Type Info -->
        <div class="bg-muted/20 rounded-lg p-4 border border-border/40">
          <div class="flex items-start gap-3">
            <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
              <UserPlus v-if="campaignDetails.join_type === 'open'" class="w-4 h-4 text-primary" />
              <ClipboardCheck v-else class="w-4 h-4 text-primary" />
            </div>
            <div>
              <h4 class="text-sm font-medium text-foreground">
                {{ campaignDetails.join_type === 'open' ? 'Open Campaign' : 'Application Required' }}
              </h4>
              <p class="text-[13px] text-muted-foreground mt-0.5">
                {{
                  campaignDetails.join_type === 'open'
                    ? 'Anyone can join and start submitting clips immediately.'
                    : 'You need to apply and be approved before submitting clips.'
                }}
              </p>
            </div>
          </div>
        </div>

        <!-- Current Participation Status -->
        <div v-if="participation" class="bg-green-500/10 rounded-lg p-4 border border-green-500/20">
          <div class="flex items-center gap-2">
            <CheckCircle class="w-5 h-5 text-green-500" />
            <span class="text-sm font-medium text-green-500">
              {{
                participation.status === 'approved'
                  ? 'You are a member of this campaign'
                  : participation.status === 'pending'
                    ? 'Your application is pending'
                    : 'Status: ' + participation.status
              }}
            </span>
          </div>
        </div>
      </div>

      <DialogFooter class="mt-4">
        <Button variant="outline" @click="isOpen = false">Close</Button>

        <template v-if="!participation && campaignDetails">
          <Button v-if="campaignDetails.join_type === 'open'" @click="joinCampaign" :disabled="joining">
            <Loader2 v-if="joining" class="w-4 h-4 mr-2 animate-spin" />
            <UserPlus v-else class="w-4 h-4 mr-2" />
            Join Campaign
          </Button>
          <Button v-else @click="handleApplyClick" :disabled="joining">
            <ClipboardCheck class="w-4 h-4 mr-2" />
            Apply to Join
          </Button>
        </template>

        <Button v-else-if="participation?.status === 'approved'" @click="showSubmitForm = true">
          <Upload class="w-4 h-4 mr-2" />
          Submit Clip
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Application Form Dialog -->
  <Dialog v-model:open="showApplicationForm">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Apply to Campaign</DialogTitle>
        <DialogDescription>Tell the campaign owner why you'd like to join</DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="application-note">Application Note (optional)</Label>
          <Textarea
            id="application-note"
            v-model="applicationNote"
            placeholder="Share your experience, follower count, or why you're a good fit..."
            class="min-h-[100px]"
          />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showApplicationForm = false">Cancel</Button>
        <Button @click="submitApplication" :disabled="joining">
          <Loader2 v-if="joining" class="w-4 h-4 mr-2 animate-spin" />
          Submit Application
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Submit Clip Dialog -->
  <Dialog v-model:open="showSubmitForm">
    <DialogContent class="max-w-md">
      <DialogHeader>
        <DialogTitle>Submit Clip</DialogTitle>
        <DialogDescription>Paste the URL of your posted clip</DialogDescription>
      </DialogHeader>

      <div class="space-y-4">
        <div class="space-y-2">
          <Label for="clip-url">Clip URL</Label>
          <Input id="clip-url" v-model="clipUrl" placeholder="https://tiktok.com/@user/video/..." />
          <p v-if="detectedPlatform" class="text-xs text-muted-foreground">
            Detected platform: {{ getPlatformDisplayName(detectedPlatform) }}
          </p>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="showSubmitForm = false">Cancel</Button>
        <Button @click="submitClipToServer" :disabled="submitting || !clipUrl">
          <Loader2 v-if="submitting" class="w-4 h-4 mr-2 animate-spin" />
          <Upload v-else class="w-4 h-4 mr-2" />
          Submit Clip
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
  import { ref, computed, watch } from 'vue';
  import {
    Megaphone,
    Loader2,
    UserPlus,
    ClipboardCheck,
    CheckCircle,
    Upload,
    Wallet,
    Music2,
    Instagram,
    Twitter,
    Youtube,
    Globe,
  } from 'lucide-vue-next';
  import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
  } from '@/components/ui/dialog';
  import { Button } from '@/components/ui/button';
  import { Input } from '@/components/ui/input';
  import { Textarea } from '@/components/ui/textarea';
  import { Label } from '@/components/ui/label';
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

  const loading = ref(false);
  const joining = ref(false);
  const submitting = ref(false);
  const campaignDetails = ref<Campaign | null>(null);
  const participation = ref<CampaignParticipation | null>(null);
  const stats = ref<CampaignStats | null>(null);
  const showApplicationForm = ref(false);
  const showSubmitForm = ref(false);
  const applicationNote = ref('');
  const clipUrl = ref('');

  const detectedPlatform = computed(() => {
    if (!clipUrl.value) return null;
    return detectPlatformFromUrl(clipUrl.value);
  });

  const getPlatformIcon = (platform: string) => {
    const icons: Record<string, typeof Music2> = {
      tiktok: Music2,
      instagram: Instagram,
      x: Twitter,
      youtube: Youtube,
    };
    return icons[platform] || Globe;
  };

  const formatCpm = (cpm: string | number) => {
    const value = typeof cpm === 'string' ? parseFloat(cpm) : cpm;
    return value.toFixed(2);
  };

  const formatBudget = (budget: string | number) => {
    const value = typeof budget === 'string' ? parseFloat(budget) : budget;
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
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
          title: 'Application Submitted',
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
          title: 'Clip Submitted',
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
    } catch (error) {
      console.error('Failed to submit clip:', error);
      toast({
        title: 'Error',
        description: 'Failed to submit clip',
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
      participation.value = null;
      stats.value = null;
    }
  });
</script>
