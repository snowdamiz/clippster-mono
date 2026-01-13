<template>
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="isOpen" class="campaign-dialog__overlay" @click.self="isOpen = false">
        <Transition name="dialog" appear>
          <div class="campaign-dialog campaign-dialog--lg">
            <!-- Accent Bar -->
            <div class="campaign-dialog__accent" />

            <!-- Header -->
            <div class="campaign-dialog__header">
              <button class="campaign-dialog__close" @click="isOpen = false" title="Close">
                <X :size="18" />
              </button>
              <div class="campaign-dialog__icon">
                <Megaphone :size="24" />
              </div>
              <h2 class="campaign-dialog__title">
                {{ campaign?.title || 'Campaign Details' }}
              </h2>
              <p v-if="campaign?.organization" class="campaign-dialog__subtitle">by {{ campaign.organization.name }}</p>
            </div>

            <!-- Content -->
            <div class="campaign-dialog__content">
              <!-- Loading State -->
              <div v-if="loading" class="campaign-dialog__loading">
                <Loader2 class="campaign-dialog__spinner" :size="32" />
                <span>Loading campaign details...</span>
              </div>

              <template v-else-if="campaignDetails">
                <!-- Cover Image -->
                <div v-if="campaignDetails.cover_image_url" class="campaign-dialog__cover">
                  <img :src="campaignDetails.cover_image_url" alt="Campaign cover" />
                  <div class="campaign-dialog__cover-overlay" />
                </div>

                <!-- Description Section -->
                <div v-if="campaignDetails.description" class="campaign-dialog__section">
                  <h3 class="campaign-dialog__section-title">About this campaign</h3>
                  <p class="campaign-dialog__description">{{ campaignDetails.description }}</p>
                </div>

                <!-- Creator Profiles Section -->
                <div
                  v-if="campaignDetails.creator_profiles && campaignDetails.creator_profiles.length > 0"
                  class="campaign-dialog__section"
                >
                  <h3 class="campaign-dialog__section-title">Streamers to Clip</h3>
                  <div class="campaign-dialog__creators">
                    <div
                      v-for="profile in campaignDetails.creator_profiles"
                      :key="profile.id"
                      class="campaign-dialog__creator"
                    >
                      <div class="campaign-dialog__creator-avatar">
                        <img
                          v-if="profile.profile_image_url"
                          :src="profile.profile_image_url"
                          :alt="profile.name"
                          class="campaign-dialog__creator-img"
                        />
                        <div v-else class="campaign-dialog__creator-fallback">
                          {{ profile.name?.charAt(0) }}
                        </div>
                      </div>
                      <div class="campaign-dialog__creator-info">
                        <div class="campaign-dialog__creator-name">{{ profile.name }}</div>
                        <div
                          v-if="profile.platform_links && profile.platform_links.length > 0"
                          class="campaign-dialog__creator-links"
                        >
                          <a
                            v-for="link in profile.platform_links"
                            :key="link.id"
                            :href="getStreamerUrl(link.platform, link.platform_id)"
                            target="_blank"
                            rel="noopener noreferrer"
                            class="campaign-dialog__creator-link"
                            :title="`View on ${getPlatformDisplayName(link.platform)}`"
                            @click.stop
                          >
                            <component :is="getStreamerPlatformIcon(link.platform)" :size="12" />
                            <span>{{ link.display_name || link.platform_id }}</span>
                            <ExternalLink :size="10" class="campaign-dialog__creator-link-external" />
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Stats Grid -->
                <div class="campaign-dialog__stats-grid">
                  <div class="campaign-dialog__stat campaign-dialog__stat--primary">
                    <div class="campaign-dialog__stat-icon">
                      <DollarSign :size="16" />
                    </div>
                    <div class="campaign-dialog__stat-content">
                      <div class="campaign-dialog__stat-value">${{ formatCpm(campaignDetails.cpm) }}</div>
                      <div class="campaign-dialog__stat-label">per 1K views</div>
                    </div>
                  </div>
                  <div class="campaign-dialog__stat">
                    <div class="campaign-dialog__stat-icon">
                      <Eye :size="16" />
                    </div>
                    <div class="campaign-dialog__stat-content">
                      <div class="campaign-dialog__stat-value">
                        {{ campaignDetails.min_views_for_payment.toLocaleString() }}
                      </div>
                      <div class="campaign-dialog__stat-label">min views</div>
                    </div>
                  </div>
                  <div class="campaign-dialog__stat">
                    <div class="campaign-dialog__stat-icon">
                      <Banknote :size="16" />
                    </div>
                    <div class="campaign-dialog__stat-content">
                      <div class="campaign-dialog__stat-value">${{ formatBudget(campaignDetails.budget) }}</div>
                      <div class="campaign-dialog__stat-label">total budget</div>
                    </div>
                  </div>
                  <div class="campaign-dialog__stat">
                    <div class="campaign-dialog__stat-icon">
                      <Users :size="16" />
                    </div>
                    <div class="campaign-dialog__stat-content">
                      <div class="campaign-dialog__stat-value">{{ stats?.participants_count || 0 }}</div>
                      <div class="campaign-dialog__stat-label">clippers</div>
                    </div>
                  </div>
                </div>

                <!-- Platforms & Payment Methods Row -->
                <div class="campaign-dialog__row">
                  <!-- Platforms Section -->
                  <div class="campaign-dialog__section campaign-dialog__section--flex">
                    <h3 class="campaign-dialog__section-title">Platforms</h3>
                    <div class="campaign-dialog__tags">
                      <div
                        v-for="platform in campaignDetails.allowed_platforms"
                        :key="platform"
                        class="campaign-dialog__tag"
                      >
                        <component :is="getPlatformIcon(platform)" class="campaign-dialog__tag-icon" />
                        <span>{{ getPlatformDisplayName(platform) }}</span>
                      </div>
                    </div>
                  </div>

                  <!-- Payment Methods Section -->
                  <div class="campaign-dialog__section campaign-dialog__section--flex">
                    <h3 class="campaign-dialog__section-title">Payments</h3>
                    <div class="campaign-dialog__tags">
                      <div v-for="method in campaignDetails.payment_methods" :key="method" class="campaign-dialog__tag">
                        <Wallet class="campaign-dialog__tag-icon" />
                        <span>{{ getPaymentMethodDisplayName(method) }}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Join Type Info Card -->
                <div class="campaign-dialog__feature-card">
                  <div class="campaign-dialog__feature-icon">
                    <UserPlus v-if="campaignDetails.join_type === 'open'" :size="16" />
                    <ClipboardCheck v-else :size="16" />
                  </div>
                  <div class="campaign-dialog__feature-content">
                    <div class="campaign-dialog__feature-header">
                      <div class="campaign-dialog__feature-text">
                        <span class="campaign-dialog__feature-title">
                          {{ campaignDetails.join_type === 'open' ? 'Open Campaign' : 'Application Required' }}
                        </span>
                        <span class="campaign-dialog__feature-desc">
                          {{
                            campaignDetails.join_type === 'open'
                              ? 'Anyone can join and start submitting clips immediately'
                              : 'You need to apply and be approved before submitting'
                          }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Participation Status -->
                <div v-if="participation" class="campaign-dialog__status-card">
                  <CheckCircle class="campaign-dialog__status-icon" />
                  <span class="campaign-dialog__status-text">
                    {{
                      participation.status === 'approved'
                        ? 'You are a member of this campaign'
                        : participation.status === 'pending'
                          ? 'Your application is pending review'
                          : 'Status: ' + participation.status
                    }}
                  </span>
                </div>
              </template>
            </div>

            <!-- Footer -->
            <div class="campaign-dialog__footer">
              <button class="campaign-dialog__btn campaign-dialog__btn--secondary" @click="isOpen = false">
                Close
              </button>

              <template v-if="!participation && campaignDetails">
                <button
                  v-if="campaignDetails.join_type === 'open'"
                  class="campaign-dialog__btn campaign-dialog__btn--primary"
                  :disabled="joining"
                  @click="joinCampaign"
                >
                  <Loader2 v-if="joining" :size="16" class="campaign-dialog__btn-spinner" />
                  <UserPlus v-else :size="16" />
                  <span>Join Campaign</span>
                </button>
                <button
                  v-else
                  class="campaign-dialog__btn campaign-dialog__btn--primary"
                  :disabled="joining"
                  @click="handleApplyClick"
                >
                  <ClipboardCheck :size="16" />
                  <span>Apply to Join</span>
                </button>
              </template>

              <button
                v-else-if="participation?.status === 'approved'"
                class="campaign-dialog__btn campaign-dialog__btn--primary"
                @click="showSubmitForm = true"
              >
                <Upload :size="16" />
                <span>Submit Clip</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- Application Form Dialog -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showApplicationForm" class="campaign-dialog__overlay" @click.self="showApplicationForm = false">
        <Transition name="dialog" appear>
          <div class="campaign-dialog">
            <div class="campaign-dialog__accent" />
            <div class="campaign-dialog__header">
              <button class="campaign-dialog__close" @click="showApplicationForm = false" title="Close">
                <X :size="18" />
              </button>
              <div class="campaign-dialog__icon">
                <ClipboardCheck :size="24" />
              </div>
              <h2 class="campaign-dialog__title">Apply to Campaign</h2>
              <p class="campaign-dialog__subtitle">Tell the campaign owner why you'd like to join</p>
            </div>

            <div class="campaign-dialog__content">
              <div class="campaign-dialog__field">
                <label class="campaign-dialog__label">
                  Application Note
                  <span class="campaign-dialog__label-hint">(optional)</span>
                </label>
                <textarea
                  v-model="applicationNote"
                  rows="4"
                  placeholder="Share your experience, follower count, or why you're a good fit..."
                  class="campaign-dialog__textarea"
                />
              </div>
            </div>

            <div class="campaign-dialog__footer">
              <button class="campaign-dialog__btn campaign-dialog__btn--secondary" @click="showApplicationForm = false">
                Cancel
              </button>
              <button
                class="campaign-dialog__btn campaign-dialog__btn--primary"
                :disabled="joining"
                @click="submitApplication"
              >
                <Loader2 v-if="joining" :size="16" class="campaign-dialog__btn-spinner" />
                <span>{{ joining ? 'Submitting...' : 'Submit Application' }}</span>
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>

  <!-- Submit Clip Dialog -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="showSubmitForm" class="campaign-dialog__overlay" @click.self="showSubmitForm = false">
        <Transition name="dialog" appear>
          <div class="campaign-dialog">
            <div class="campaign-dialog__accent" />
            <div class="campaign-dialog__header">
              <button class="campaign-dialog__close" @click="showSubmitForm = false" title="Close">
                <X :size="18" />
              </button>
              <div class="campaign-dialog__icon">
                <Upload :size="24" />
              </div>
              <h2 class="campaign-dialog__title">Submit Clip</h2>
              <p class="campaign-dialog__subtitle">Paste the URL of your posted clip</p>
            </div>

            <div class="campaign-dialog__content">
              <div class="campaign-dialog__field">
                <label class="campaign-dialog__label">Clip URL</label>
                <input
                  v-model="clipUrl"
                  type="text"
                  placeholder="https://tiktok.com/@user/video/..."
                  class="campaign-dialog__input"
                />
                <p v-if="detectedPlatform" class="campaign-dialog__field-hint">
                  <CheckCircle :size="12" class="campaign-dialog__field-hint-icon" />
                  Detected: {{ getPlatformDisplayName(detectedPlatform) }}
                </p>
              </div>
            </div>

            <div class="campaign-dialog__footer">
              <button class="campaign-dialog__btn campaign-dialog__btn--secondary" @click="showSubmitForm = false">
                Cancel
              </button>
              <button
                class="campaign-dialog__btn campaign-dialog__btn--primary"
                :disabled="submitting || !clipUrl"
                @click="submitClipToServer"
              >
                <Loader2 v-if="submitting" :size="16" class="campaign-dialog__btn-spinner" />
                <Upload v-else :size="16" />
                <span>{{ submitting ? 'Submitting...' : 'Submit Clip' }}</span>
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
    X,
    DollarSign,
    Eye,
    Banknote,
    Users,
    ExternalLink,
    Radio,
    Tv,
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

  const getStreamerPlatformIcon = (platform: string) => {
    const icons: Record<string, typeof Radio> = {
      kick: Tv,
      pumpfun: Radio,
      twitch: Tv,
      youtube: Youtube,
    };
    return icons[platform] || Globe;
  };

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

<style scoped>
  /* ===== Dialog Overlay ===== */
  .campaign-dialog__overlay {
    position: fixed;
    inset: 0;
    background-color: rgba(0, 0, 0, 0.7);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 60;
  }

  /* ===== Dialog Container ===== */
  .campaign-dialog {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    width: 100%;
    max-width: 440px;
    margin: 1rem;
    max-height: 85vh;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
  }

  .campaign-dialog--lg {
    max-width: 520px;
  }

  /* ===== Accent Bar ===== */
  .campaign-dialog__accent {
    height: 3px;
    flex-shrink: 0;
    background: linear-gradient(90deg, var(--sidebar-accent), rgba(6, 182, 212, 0.5));
  }

  /* ===== Header ===== */
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
    margin-bottom: 0.875rem;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
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

  /* ===== Content ===== */
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

  /* ===== Loading State ===== */
  .campaign-dialog__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem 1rem;
    gap: 1rem;
    color: var(--sidebar-text-muted);
    font-size: 0.875rem;
  }

  .campaign-dialog__spinner {
    animation: spin 1s linear infinite;
    color: var(--sidebar-accent);
  }

  /* ===== Cover Image ===== */
  .campaign-dialog__cover {
    position: relative;
    height: 120px;
    border-radius: 10px;
    overflow: hidden;
    margin-bottom: 1.25rem;
  }

  .campaign-dialog__cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .campaign-dialog__cover-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.4) 0%, transparent 50%);
  }

  /* ===== Sections ===== */
  .campaign-dialog__section {
    margin-bottom: 1.25rem;
  }

  .campaign-dialog__section:last-child {
    margin-bottom: 0;
  }

  .campaign-dialog__section--flex {
    flex: 1;
    min-width: 0;
  }

  .campaign-dialog__section-title {
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.5rem;
  }

  .campaign-dialog__description {
    font-size: 0.8125rem;
    color: var(--sidebar-text);
    line-height: 1.6;
    margin: 0;
    white-space: pre-wrap;
    opacity: 0.9;
  }

  /* ===== Creator Profiles ===== */
  .campaign-dialog__creators {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .campaign-dialog__creator {
    display: flex;
    align-items: flex-start;
    gap: 0.75rem;
    padding: 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .campaign-dialog__creator-avatar {
    width: 40px;
    height: 40px;
    border-radius: 50%;
    overflow: hidden;
    flex-shrink: 0;
    background-color: rgba(255, 255, 255, 0.05);
  }

  .campaign-dialog__creator-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .campaign-dialog__creator-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 1rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .campaign-dialog__creator-info {
    flex: 1;
    min-width: 0;
  }

  .campaign-dialog__creator-name {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin-bottom: 0.375rem;
  }

  .campaign-dialog__creator-links {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .campaign-dialog__creator-link {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem;
    background-color: rgba(255, 255, 255, 0.05);
    border: 1px solid var(--sidebar-border);
    border-radius: 4px;
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    text-decoration: none;
    transition: all 150ms ease;
  }

  .campaign-dialog__creator-link:hover {
    background-color: rgba(6, 182, 212, 0.1);
    border-color: rgba(6, 182, 212, 0.3);
    color: var(--sidebar-accent);
  }

  .campaign-dialog__creator-link-external {
    opacity: 0.5;
  }

  .campaign-dialog__creator-link:hover .campaign-dialog__creator-link-external {
    opacity: 1;
  }

  /* ===== Row Layout ===== */
  .campaign-dialog__row {
    display: flex;
    gap: 1.5rem;
    margin-bottom: 1.25rem;
  }

  /* ===== Stats Grid ===== */
  .campaign-dialog__stats-grid {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 0.625rem;
    margin-bottom: 1.25rem;
  }

  .campaign-dialog__stat {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    padding: 0.875rem 1rem;
  }

  .campaign-dialog__stat--primary {
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.1) 0%, rgba(6, 182, 212, 0.05) 100%);
    border-color: rgba(6, 182, 212, 0.2);
  }

  .campaign-dialog__stat--primary .campaign-dialog__stat-value {
    color: var(--sidebar-accent);
  }

  .campaign-dialog__stat--primary .campaign-dialog__stat-icon {
    background-color: rgba(6, 182, 212, 0.2);
    color: var(--sidebar-accent);
  }

  .campaign-dialog__stat-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    flex-shrink: 0;
    background-color: rgba(255, 255, 255, 0.05);
    color: var(--sidebar-text-muted);
  }

  .campaign-dialog__stat-content {
    flex: 1;
    min-width: 0;
  }

  .campaign-dialog__stat-value {
    font-size: 1rem;
    font-weight: 700;
    color: var(--sidebar-text);
    line-height: 1.2;
  }

  .campaign-dialog__stat-label {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin-top: 0.125rem;
  }

  /* ===== Tags ===== */
  .campaign-dialog__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.375rem;
  }

  .campaign-dialog__tag {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .campaign-dialog__tag-icon {
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
  }

  /* ===== Feature Card ===== */
  .campaign-dialog__feature-card {
    display: flex;
    align-items: flex-start;
    gap: 0.875rem;
    padding: 1rem;
    background-color: rgba(6, 182, 212, 0.05);
    border: 1px solid rgba(6, 182, 212, 0.15);
    border-radius: 10px;
    margin-bottom: 1.25rem;
  }

  .campaign-dialog__feature-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 8px;
    flex-shrink: 0;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .campaign-dialog__feature-content {
    flex: 1;
    min-width: 0;
  }

  .campaign-dialog__feature-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 1rem;
  }

  .campaign-dialog__feature-text {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
  }

  .campaign-dialog__feature-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .campaign-dialog__feature-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    line-height: 1.4;
  }

  /* ===== Status Card ===== */
  .campaign-dialog__status-card {
    display: flex;
    align-items: center;
    gap: 0.625rem;
    padding: 0.875rem 1rem;
    background-color: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.2);
    border-radius: 10px;
  }

  .campaign-dialog__status-icon {
    width: 18px;
    height: 18px;
    color: #10b981;
    flex-shrink: 0;
  }

  .campaign-dialog__status-text {
    font-size: 0.8125rem;
    font-weight: 500;
    color: #10b981;
  }

  /* ===== Form Fields ===== */
  .campaign-dialog__field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .campaign-dialog__label {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.8125rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .campaign-dialog__label-hint {
    color: var(--sidebar-text-muted);
    font-weight: 400;
    font-size: 0.8125rem;
  }

  .campaign-dialog__input,
  .campaign-dialog__textarea {
    width: 100%;
    padding: 0.75rem 1rem;
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    transition: all 150ms ease;
    font-family: inherit;
  }

  .campaign-dialog__input::placeholder,
  .campaign-dialog__textarea::placeholder {
    color: var(--sidebar-text-muted);
    opacity: 0.6;
  }

  .campaign-dialog__input:focus,
  .campaign-dialog__textarea:focus {
    outline: none;
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.15);
  }

  .campaign-dialog__textarea {
    resize: none;
    min-height: 100px;
  }

  .campaign-dialog__field-hint {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.75rem;
    color: #10b981;
    margin: 0.25rem 0 0;
  }

  .campaign-dialog__field-hint-icon {
    flex-shrink: 0;
  }

  /* ===== Footer ===== */
  .campaign-dialog__footer {
    display: flex;
    gap: 0.625rem;
    padding: 1.25rem 1.5rem;
    border-top: 1px solid var(--sidebar-border);
  }

  /* ===== Buttons ===== */
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
    color: white;
  }

  .campaign-dialog__btn--primary:hover:not(:disabled) {
    opacity: 0.9;
  }

  .campaign-dialog__btn-spinner {
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

  /* ===== Responsive ===== */
  @media (max-width: 480px) {
    .campaign-dialog__stats-grid {
      grid-template-columns: 1fr;
    }

    .campaign-dialog__row {
      flex-direction: column;
      gap: 1rem;
    }
  }
</style>
