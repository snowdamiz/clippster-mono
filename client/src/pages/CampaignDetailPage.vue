<template>
  <div class="campaign-detail">
    <PageLayout
      :title="campaign?.title || 'Campaign'"
      :description="campaign?.description || 'Campaign details and management'"
      :show-header="true"
      :icon="Megaphone"
      :breadcrumbs="breadcrumbItems"
    >
      <template #firstBreadcrumb>
        <OrganizationBreadcrumb />
      </template>
      <template #actions>
        <button v-if="campaign && isAdmin" class="edit-btn" @click="editCampaign">
          <Pencil class="edit-btn__icon" />
          Edit Campaign
        </button>
      </template>

      <!-- Loading State -->
      <div v-if="loading" class="campaign-detail__loading">
        <div class="skeleton-header"></div>
        <div class="skeleton-tabs"></div>
        <div class="skeleton-content"></div>
      </div>

      <!-- Campaign Content -->
      <div v-else-if="campaign" class="profile-page">
        <!-- Enhanced Campaign Header -->
        <div class="profile-header-card">
          <div class="profile-header-bg"></div>
          <div class="profile-header-content">
            <div class="profile-header-main">
              <div class="profile-avatar-wrapper">
                <div class="profile-avatar">
                  <img
                    v-if="campaign.cover_image_url"
                    :src="campaign.cover_image_url"
                    class="profile-avatar__img"
                  />
                  <Megaphone v-else class="profile-avatar__fallback" />
                </div>
              </div>
              <div class="profile-info">
                <div class="profile-name-row">
                  <h1 class="profile-name">{{ campaign.title }}</h1>
                  <div class="profile-badges">
                    <span class="status-badge" :class="`status-badge--${campaign.status}`">
                      {{ campaign.status.toUpperCase() }}
                    </span>
                    <span v-if="campaign.payment_model === 'per_clip'" class="status-badge status-badge--per-clip">
                      <DollarSign :size="12" />
                      Per Clip
                    </span>
                    <span v-else class="status-badge status-badge--cpm">
                      <TrendingUp :size="12" />
                      CPM
                    </span>
                  </div>
                </div>
                <div class="profile-meta-row">
                  <router-link
                    v-if="campaign.organization"
                    :to="campaign.organization.slug ? `/orgs/${campaign.organization.slug}` : '#'"
                    class="profile-visibility"
                  >
                    <Building2 :size="14" />
                    {{ campaign.organization.name }}
                  </router-link>
                  <span v-if="campaign.starts_at" class="profile-last-active">
                    <Calendar :size="14" />
                    {{ formatDate(campaign.starts_at) }} - {{ campaign.ends_at ? formatDate(campaign.ends_at) : 'Ongoing' }}
                  </span>
                </div>
                <p class="profile-bio">
                  {{ campaign.description || 'No description provided' }}
                </p>
                <div v-if="campaign.allowed_platforms?.length" class="profile-tags">
                  <span v-for="platform in campaign.allowed_platforms" :key="platform" class="profile-tag">
                    {{ getPlatformDisplayName(platform) }}
                  </span>
                </div>
              </div>
            </div>
            <div class="profile-stats-grid">
              <div class="profile-stat-card">
                <div class="profile-stat-card__icon profile-stat-card__icon--purple">
                  <Users :size="18" />
                </div>
                <div class="profile-stat-card__content">
                  <span class="profile-stat-card__value">{{ stats.participants_count || 0 }}</span>
                  <span class="profile-stat-card__label">Participants</span>
                </div>
              </div>
              <div class="profile-stat-card">
                <div class="profile-stat-card__icon profile-stat-card__icon--cyan">
                  <FileVideo :size="18" />
                </div>
                <div class="profile-stat-card__content">
                  <span class="profile-stat-card__value">{{ stats.submissions_count || 0 }}</span>
                  <span class="profile-stat-card__label">Submissions</span>
                </div>
              </div>
              <div class="profile-stat-card">
                <div class="profile-stat-card__icon profile-stat-card__icon--green">
                  <CheckCircle :size="18" />
                </div>
                <div class="profile-stat-card__content">
                  <span class="profile-stat-card__value">{{ stats.verified_count || 0 }}</span>
                  <span class="profile-stat-card__label">Verified</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Budget Progress Card -->
        <div class="ranking-card">
          <div class="ranking-row">
            <div class="ranking-row__header-icon">
              <Wallet />
            </div>
            <div class="ranking-row__header-text">
              <h2 class="ranking-row__title">Budget Usage</h2>
              <p class="ranking-row__subtitle">${{ formatBudget(campaign.spent_budget || 0) }} of ${{ formatBudget(campaign.budget) }} spent</p>
            </div>
            <div class="ranking-row__stats">
              <div class="rank-stat rank-stat--primary">
                <span class="rank-stat__value">{{ getBudgetPercentage().toFixed(0) }}%</span>
                <span class="rank-stat__label">Used</span>
              </div>
              <div class="rank-stat">
                <span class="rank-stat__value">${{ formatBudget(getRemainingBudget()) }}</span>
                <span class="rank-stat__label">Remaining</span>
              </div>
            </div>
          </div>
          <div class="budget-progress">
            <div
              class="budget-progress__fill"
              :style="{ width: getBudgetPercentage() + '%' }"
              :class="{
                'budget-progress__fill--low': getBudgetPercentage() < 50,
                'budget-progress__fill--medium': getBudgetPercentage() >= 50 && getBudgetPercentage() < 80,
                'budget-progress__fill--high': getBudgetPercentage() >= 80,
              }"
            ></div>
          </div>
        </div>

        <!-- Enhanced Tab Navigation -->
        <nav class="tabs-nav">
          <div class="tabs-container">
            <button
              v-for="tab in tabs"
              :key="tab.id"
              class="tab-button"
              :class="{ 'tab-button--active': activeTab === tab.id }"
              @click="activeTab = tab.id"
            >
              <div class="tab-button__icon">
                <component :is="tab.icon" />
              </div>
              <span class="tab-button__label">{{ tab.label }}</span>
            </button>
          </div>
        </nav>

        <!-- Content -->
        <main class="content">
          <!-- Overview Tab -->
          <template v-if="activeTab === 'overview'">
            <div class="overview-section">
              <h2 class="section-title">Campaign Details</h2>
              <div class="details-grid">
                <div class="detail-item">
                  <span class="detail-label">Payment Model</span>
                  <span class="detail-value">{{ campaign.payment_model === 'per_clip' ? 'Pay Per Clip' : 'CPM (Cost Per Mille)' }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">{{ campaign.payment_model === 'per_clip' ? 'Amount Per Clip' : 'CPM Rate' }}</span>
                  <span class="detail-value">${{ campaign.payment_model === 'per_clip' ? formatBudget(campaign.per_clip_amount || 0) : formatCpm(campaign.cpm) }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Min Views for Payment</span>
                  <span class="detail-value">{{ formatViews(campaign.min_views_for_payment) }}</span>
                </div>
                <div v-if="campaign.max_views" class="detail-item">
                  <span class="detail-label">Max Views Cap</span>
                  <span class="detail-value">{{ formatViews(campaign.max_views) }}</span>
                </div>
                <div class="detail-item">
                  <span class="detail-label">Join Type</span>
                  <span class="detail-value">{{ campaign.join_type === 'open' ? 'Open to All' : 'Application Required' }}</span>
                </div>
              </div>
            </div>

            <div class="overview-section">
              <h2 class="section-title">Streamers to Clip</h2>
              <div v-if="!campaign.creator_profile_id && (!campaign.assigned_streamer_ids || campaign.assigned_streamer_ids.length === 0)" class="global-branding-notice">
                <div class="global-branding-notice__icon">
                  <Globe :size="24" />
                </div>
                <div class="global-branding-notice__content">
                  <h3 class="global-branding-notice__title">Any Streamers Qualify</h3>
                  <p class="global-branding-notice__description">
                    This campaign uses global branding. Clippers can create clips from any streamer, and the organization's branding will be applied automatically.
                  </p>
                </div>
              </div>
              <div v-else-if="campaign.creator_profile_id" class="creator-profile-info">
                <p class="text-sm text-gray-400 mb-4">This campaign is assigned to a specific creator profile:</p>
                <div v-if="campaign.creator_profile" class="p-4 bg-gray-800 border border-gray-700 rounded-lg">
                  <div class="flex items-center gap-3">
                    <img v-if="campaign.creator_profile.profile_image_url" :src="campaign.creator_profile.profile_image_url" class="w-12 h-12 rounded-full" />
                    <div>
                      <div class="font-semibold">{{ campaign.creator_profile.name }}</div>
                      <div class="text-sm text-gray-400">Creator Profile</div>
                    </div>
                  </div>
                </div>
                <div v-else class="p-4 bg-gray-800 border border-gray-700 rounded-lg text-center text-gray-400 text-sm">
                  Creator profile assigned
                </div>
              </div>
              <div v-else class="streamers-list">
                <p class="streamers-list__description">Clippers can only create clips from the following streamers:</p>
                <div class="streamers-list__placeholder">
                  {{ campaign.assigned_streamer_ids.length }} streamer(s) assigned
                </div>
              </div>
            </div>
          </template>

          <!-- Submissions Tab -->
          <template v-if="activeTab === 'submissions'">
            <div v-if="loadingSubmissions" class="loading-state">
              <div class="spinner"></div>
              <p>Loading submissions...</p>
            </div>
            <div v-else-if="submissions.length === 0" class="empty-state">
              <FileVideo :size="48" />
              <p>No submissions yet</p>
              <span class="empty-state__hint">Submissions will appear here once participants publish content</span>
            </div>
            <div v-else class="submissions-list">
              <div v-for="submission in submissions" :key="submission.id" class="submission-card">
                <div class="submission-card__header">
                  <div class="submission-card__user">
                    <div class="submission-card__avatar">
                      <img v-if="submission.user?.avatar_url" :src="submission.user.avatar_url" alt="" />
                      <Users v-else :size="16" />
                    </div>
                    <div class="submission-card__user-info">
                      <span class="submission-card__username">{{ submission.user?.username || 'Unknown User' }}</span>
                      <span class="submission-card__platform">{{ getPlatformDisplayName(submission.platform) }}</span>
                    </div>
                  </div>
                  <span class="submission-card__status" :class="`submission-card__status--${submission.status}`">
                    {{ submission.status }}
                  </span>
                </div>
                <div v-if="submission.clip_url" class="submission-card__content">
                  <a :href="submission.clip_url" target="_blank" class="submission-card__link">
                    <ExternalLink :size="14" />
                    View Post
                  </a>
                </div>
                <div v-else class="submission-card__content">
                  <span class="submission-card__pending">URL pending...</span>
                </div>
                <div class="submission-card__stats">
                  <div class="submission-stat">
                    <Eye :size="14" />
                    <span>{{ formatNumber(submission.view_count || 0) }}</span>
                  </div>
                  <div class="submission-stat">
                    <Heart :size="14" />
                    <span>{{ formatNumber(submission.like_count || 0) }}</span>
                  </div>
                  <div class="submission-stat">
                    <MessageCircle :size="14" />
                    <span>{{ formatNumber(submission.comment_count || 0) }}</span>
                  </div>
                  <div class="submission-stat">
                    <Share2 :size="14" />
                    <span>{{ formatNumber(submission.share_count || 0) }}</span>
                  </div>
                </div>
                <div class="submission-card__footer">
                  <span class="submission-card__date">{{ formatDate(submission.inserted_at) }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- Participants Tab -->
          <template v-if="activeTab === 'participants'">
            <div v-if="loadingParticipants" class="loading-state">
              <div class="spinner"></div>
              <p>Loading participants...</p>
            </div>
            <div v-else-if="participants.length === 0" class="empty-state">
              <Users :size="48" />
              <p>No participants yet</p>
              <span class="empty-state__hint">Users who apply to this campaign will appear here</span>
            </div>
            <div v-else class="participants-list">
              <div v-for="participant in participants" :key="participant.id" class="participant-card">
                <div class="participant-card__header">
                  <div class="participant-card__user">
                    <div class="participant-card__avatar">
                      <img 
                        v-if="participant.clipper_profile?.avatar_url" 
                        :src="participant.clipper_profile.avatar_url" 
                        alt=""
                        @error="(e) => { const img = e.target as HTMLImageElement; if (img) img.style.display = 'none'; }"
                      />
                      <Users :size="20" />
                    </div>
                    <div class="participant-card__user-info">
                      <span class="participant-card__username">{{ participant.clipper_profile?.display_name || participant.user?.display_name || participant.user?.email || 'Unknown User' }}</span>
                      <span class="participant-card__email">{{ participant.user?.email }}</span>
                    </div>
                  </div>
                  <span class="participant-card__status" :class="`participant-card__status--${participant.status}`">
                    {{ participant.status }}
                  </span>
                </div>
                <div v-if="participant.clipper_profile" class="participant-card__profile">
                  <div class="participant-card__stat">
                    <FileVideo :size="14" />
                    <span>{{ participant.clipper_profile.total_clips_delivered || 0 }} clips</span>
                  </div>
                  <div class="participant-card__stat">
                    <Eye :size="14" />
                    <span>{{ formatNumber(participant.clipper_profile.total_campaigns_completed || 0) }} campaigns</span>
                  </div>
                </div>
                <div class="participant-card__footer">
                  <span class="participant-card__date">Applied {{ formatDate(participant.inserted_at) }}</span>
                  <div v-if="isAdmin && participant.status === 'pending'" class="participant-card__actions">
                    <button class="participant-action-btn participant-action-btn--approve" @click="approveParticipant(participant.id)">
                      <CheckCircle :size="14" />
                      Approve
                    </button>
                    <button class="participant-action-btn participant-action-btn--reject" @click="rejectParticipant(participant.id)">
                      <XCircle :size="14" />
                      Reject
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </template>

          <!-- Payments Tab -->
          <template v-if="activeTab === 'payments'">
            <div v-if="loadingPayments" class="loading-state">
              <div class="spinner"></div>
              <p>Loading payments...</p>
            </div>
            <div v-else-if="payments.length === 0" class="empty-state">
              <DollarSign :size="48" />
              <p>No payments yet</p>
              <span class="empty-state__hint">Payments for verified submissions will appear here</span>
            </div>
            <div v-else>
              <div class="payments-header">
                <button v-if="isAdmin" class="calculate-payments-btn" @click="calculatePayments">
                  <Calculator :size="16" />
                  Calculate Payments
                </button>
              </div>
              <div class="payments-list">
                <div v-for="payment in payments" :key="payment.id" class="payment-card">
                  <div class="payment-card__header">
                    <div class="payment-card__user">
                      <div class="payment-card__avatar">
                        <img v-if="payment.user?.avatar_url" :src="payment.user.avatar_url" alt="" />
                        <Users v-else :size="16" />
                      </div>
                      <div class="payment-card__user-info">
                        <span class="payment-card__username">{{ payment.user?.username || payment.user?.email || 'Unknown User' }}</span>
                        <span class="payment-card__submission">Submission #{{ payment.submission_id }}</span>
                      </div>
                    </div>
                    <div class="payment-card__amount">
                      <span class="payment-card__amount-value">${{ parseFloat(payment.amount).toFixed(2) }}</span>
                      <span class="payment-card__status" :class="`payment-card__status--${payment.status}`">
                        {{ payment.status }}
                      </span>
                    </div>
                  </div>
                  <div class="payment-card__details">
                    <div class="payment-detail">
                      <span class="payment-detail__label">Views</span>
                      <span class="payment-detail__value">{{ formatNumber(payment.views || 0) }}</span>
                    </div>
                    <div class="payment-detail">
                      <span class="payment-detail__label">Rate</span>
                      <span class="payment-detail__value">${{ parseFloat(payment.rate || 0).toFixed(2) }}</span>
                    </div>
                    <div v-if="payment.paid_at" class="payment-detail">
                      <span class="payment-detail__label">Paid</span>
                      <span class="payment-detail__value">{{ formatDate(payment.paid_at) }}</span>
                    </div>
                  </div>
                  <div v-if="payment.transaction_hash" class="payment-card__transaction">
                    <a :href="`https://solscan.io/tx/${payment.transaction_hash}`" target="_blank" class="payment-card__tx-link">
                      <ExternalLink :size="12" />
                      {{ payment.transaction_hash.substring(0, 8) }}...{{ payment.transaction_hash.substring(payment.transaction_hash.length - 8) }}
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </template>
        </main>
      </div>

      <!-- Error State -->
      <div v-else class="campaign-detail__error">
        <AlertCircle :size="48" />
        <h3>Campaign not found</h3>
        <p>The campaign you're looking for doesn't exist or you don't have access to it.</p>
        <button class="back-btn" @click="$router.back()">Go Back</button>
      </div>
    </PageLayout>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue';
  import { useRoute, useRouter } from 'vue-router';
  import {
    Megaphone,
    Pencil,
    Building2,
    Users,
    FileVideo,
    CheckCircle,
    Wallet,
    DollarSign,
    TrendingUp,
    Calendar,
    AlertCircle,
    Globe,
    Eye,
    Heart,
    MessageCircle,
    Share2,
    ExternalLink,
    XCircle,
    Calculator,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import OrganizationBreadcrumb from '@/components/OrganizationBreadcrumb.vue';
  import { getCampaign, getPlatformDisplayName, type Campaign, type CampaignStats, type CampaignSubmission } from '@/services/campaignApi';
  import { useToast } from '@/composables/useToast';
  import { useAuthStore } from '@/stores/auth';
  import axios from 'axios';

  const route = useRoute();
  const router = useRouter();
  const { toast } = useToast();
  const authStore = useAuthStore();

  const breadcrumbItems = computed(() => {
    const orgId = route.params.id;
    return [
      { label: 'Organizations', path: '/organizations' },
      { label: 'Campaigns', path: orgId ? `/organization/${orgId}/campaigns` : '/organizations' },
      { label: campaign.value?.title || 'Campaign' }
    ];
  });

  const loading = ref(true);
  const campaign = ref<Campaign | null>(null);
  const stats = ref<CampaignStats>({
    participants_count: 0,
    submissions_count: 0,
    verified_count: 0,
    total_views: 0,
    total_paid: '0',
  });
  const activeTab = ref('overview');
  const submissions = ref<CampaignSubmission[]>([]);
  const loadingSubmissions = ref(false);
  const participants = ref<any[]>([]);
  const loadingParticipants = ref(false);
  const payments = ref<any[]>([]);
  const loadingPayments = ref(false);

  const isAdmin = computed(() => {
    // TODO: Check if user is admin of the organization
    return true;
  });

  const tabs = computed(() => [
    { id: 'overview', label: 'Overview', icon: Megaphone },
    { id: 'submissions', label: 'Submissions', icon: FileVideo, count: stats.value.submissions_count },
    { id: 'participants', label: 'Participants', icon: Users, count: stats.value.participants_count },
    { id: 'payments', label: 'Payments', icon: DollarSign },
  ]);

  const formatBudget = (budget: string | number) => {
    const value = typeof budget === 'string' ? parseFloat(budget) : budget;
    if (value >= 1000) {
      return `${(value / 1000).toFixed(1)}K`;
    }
    return value.toFixed(0);
  };

  const formatCpm = (cpm: string | number) => {
    const value = typeof cpm === 'string' ? parseFloat(cpm) : cpm;
    return value.toFixed(2);
  };

  const formatViews = (views: number) => {
    if (views >= 1000000) {
      return `${(views / 1000000).toFixed(1)}M`;
    }
    if (views >= 1000) {
      return `${(views / 1000).toFixed(1)}K`;
    }
    return views.toString();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return `${(num / 1000000).toFixed(1)}M`;
    }
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  const getBudgetPercentage = () => {
    if (!campaign.value) return 0;
    const spent = parseFloat(campaign.value.spent_budget || '0');
    const budget = parseFloat(campaign.value.budget || '0');
    if (budget === 0) return 0;
    return Math.min((spent / budget) * 100, 100);
  };

  const getRemainingBudget = () => {
    if (!campaign.value) return 0;
    const spent = parseFloat(campaign.value.spent_budget || '0');
    const budget = parseFloat(campaign.value.budget || '0');
    return Math.max(budget - spent, 0);
  };

  const editCampaign = () => {
    router.push(`/organizations/${route.params.orgId}/campaigns`);
  };

  const loadCampaign = async () => {
    try {
      loading.value = true;
      const campaignId = parseInt(route.params.campaignId as string, 10);
      
      const response = await getCampaign(campaignId);
      if (response.success && response.campaign) {
        campaign.value = response.campaign;
        // Update stats from API response
        if (response.stats) {
          stats.value = {
            participants_count: response.stats.participants_count || 0,
            submissions_count: response.stats.submissions_count || 0,
            verified_count: response.stats.verified_count || 0,
            total_views: response.stats.total_views || 0,
            total_paid: response.stats.total_paid || '0',
          };
        }
      } else {
        toast({ title: 'Error', description: 'Failed to load campaign' });
      }
    } catch (error) {
      console.error('Failed to load campaign:', error);
      toast({ title: 'Error', description: 'Failed to load campaign' });
    } finally {
      loading.value = false;
    }
  };

  const loadSubmissions = async () => {
    if (!campaign.value) return;
    
    try {
      loadingSubmissions.value = true;
      const orgId = route.params.id as string;
      const campaignId = route.params.campaignId as string;
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/organizations/${orgId}/campaigns/${campaignId}/submissions`,
        { headers: { Authorization: `Bearer ${authStore.token}` } }
      );
      
      if (response.data.success) {
        submissions.value = response.data.submissions || [];
        console.log('[CampaignDetail] Loaded submissions:', submissions.value);
      }
    } catch (error) {
      console.error('Failed to load submissions:', error);
      toast({ title: 'Error', description: 'Failed to load submissions' });
    } finally {
      loadingSubmissions.value = false;
    }
  };

  const loadParticipants = async () => {
    if (!campaign.value) return;
    
    try {
      loadingParticipants.value = true;
      const orgId = route.params.id as string;
      const campaignId = route.params.campaignId as string;
      const apiUrl = `${import.meta.env.VITE_API_URL}/api/organizations/${orgId}/campaigns/${campaignId}/participants`;
      
      console.log('[CampaignDetail] Loading participants from:', apiUrl);
      console.log('[CampaignDetail] Route params:', { orgId, campaignId, allParams: route.params });
      
      const response = await axios.get(
        apiUrl,
        { headers: { Authorization: `Bearer ${authStore.token}` } }
      );
      
      console.log('[CampaignDetail] Participants API response:', response.data);
      
      if (response.data.success) {
        participants.value = response.data.participants || [];
        console.log('[CampaignDetail] Loaded participants:', participants.value);
        // Debug avatar URLs
        participants.value.forEach(p => {
          console.log('[CampaignDetail] Participant:', p.clipper_profile?.display_name, 'Avatar URL:', p.clipper_profile?.avatar_url);
        });
      } else {
        console.error('[CampaignDetail] API returned success: false', response.data);
      }
    } catch (error) {
      console.error('Failed to load participants:', error);
      if (axios.isAxiosError(error)) {
        console.error('Response data:', error.response?.data);
        console.error('Response status:', error.response?.status);
      }
      toast({ title: 'Error', description: 'Failed to load participants' });
    } finally {
      loadingParticipants.value = false;
    }
  };

  const loadPayments = async () => {
    if (!campaign.value) return;
    
    try {
      loadingPayments.value = true;
      const orgId = route.params.id as string;
      const campaignId = route.params.campaignId as string;
      
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/organizations/${orgId}/campaigns/${campaignId}/payments`,
        { headers: { Authorization: `Bearer ${authStore.token}` } }
      );
      
      if (response.data.success) {
        payments.value = response.data.payments || [];
        console.log('[CampaignDetail] Loaded payments:', payments.value);
      }
    } catch (error) {
      console.error('Failed to load payments:', error);
      toast({ title: 'Error', description: 'Failed to load payments' });
    } finally {
      loadingPayments.value = false;
    }
  };

  const approveParticipant = async (participantId: number) => {
    try {
      const orgId = route.params.id as string;
      const campaignId = route.params.campaignId as string;
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/organizations/${orgId}/campaigns/${campaignId}/participants/${participantId}/approve`,
        {},
        { headers: { Authorization: `Bearer ${authStore.token}` } }
      );
      
      if (response.data.success) {
        toast({ title: 'Success', description: 'Participant approved' });
        loadParticipants(); // Reload participants
      }
    } catch (error) {
      console.error('Failed to approve participant:', error);
      toast({ title: 'Error', description: 'Failed to approve participant' });
    }
  };

  const rejectParticipant = async (participantId: number) => {
    try {
      const orgId = route.params.id as string;
      const campaignId = route.params.campaignId as string;
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/organizations/${orgId}/campaigns/${campaignId}/participants/${participantId}/reject`,
        {},
        { headers: { Authorization: `Bearer ${authStore.token}` } }
      );
      
      if (response.data.success) {
        toast({ title: 'Success', description: 'Participant rejected' });
        loadParticipants(); // Reload participants
      }
    } catch (error) {
      console.error('Failed to reject participant:', error);
      toast({ title: 'Error', description: 'Failed to reject participant' });
    }
  };

  const calculatePayments = async () => {
    try {
      const orgId = route.params.id as string;
      const campaignId = route.params.campaignId as string;
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/organizations/${orgId}/campaigns/${campaignId}/calculate-payments`,
        {},
        { headers: { Authorization: `Bearer ${authStore.token}` } }
      );
      
      if (response.data.success) {
        toast({ title: 'Success', description: `Calculated ${response.data.payments_created || 0} payments` });
        loadPayments(); // Reload payments
      }
    } catch (error) {
      console.error('Failed to calculate payments:', error);
      toast({ title: 'Error', description: 'Failed to calculate payments' });
    }
  };

  // Watch for tab changes and load data when switching tabs
  watch(activeTab, (newTab) => {
    if (newTab === 'submissions') {
      loadSubmissions();
    } else if (newTab === 'participants') {
      loadParticipants();
    } else if (newTab === 'payments') {
      loadPayments();
    }
  });

  onMounted(async () => {
    await loadCampaign();
    // Load data for the initial active tab
    if (activeTab.value === 'submissions') {
      loadSubmissions();
    } else if (activeTab.value === 'participants') {
      loadParticipants();
    } else if (activeTab.value === 'payments') {
      loadPayments();
    }
  });
</script>

<style scoped>
/* Base Layout */
.campaign-detail {
  width: 100%;
  min-height: 100%;
}

.profile-page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  padding: 1rem 1.5rem 0 1.5rem;
}

/* Profile Header Card */
.profile-header-card {
  position: relative;
  background: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 16px;
  overflow: hidden;
}

.profile-header-bg {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 120px;
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%);
  opacity: 0.5;
}

.profile-header-content {
  position: relative;
  padding: 2rem 2rem 1.5rem;
}

.profile-header-main {
  display: flex;
  align-items: flex-start;
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.profile-avatar-wrapper {
  position: relative;
  flex-shrink: 0;
}

.profile-avatar {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 20px;
  background: var(--sidebar-hover);
  overflow: hidden;
  border: 3px solid var(--sidebar-surface);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
}

.profile-avatar__img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.profile-avatar__fallback {
  width: 100%;
  height: 100%;
  padding: 20px;
  color: var(--sidebar-text-muted);
}

.profile-info {
  flex: 1;
  min-width: 0;
}

.profile-name-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.profile-name {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.profile-badges {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  flex-wrap: wrap;
}

.status-badge {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

.status-badge--active {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.status-badge--draft {
  background: rgba(156, 163, 175, 0.15);
  color: #9ca3af;
}

.status-badge--completed {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.status-badge--per-clip {
  background: rgba(245, 158, 11, 0.15);
  color: #f59e0b;
}

.status-badge--cpm {
  background: rgba(168, 85, 247, 0.15);
  color: #a855f7;
}

.profile-meta-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 0.75rem;
}

.profile-visibility {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.625rem;
  background: var(--sidebar-hover);
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 500;
  color: var(--sidebar-text-muted);
}

.profile-last-active {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  opacity: 0.8;
}

.profile-bio {
  font-size: 0.9375rem;
  color: var(--sidebar-text-muted);
  margin: 0 0 0.875rem;
  line-height: 1.6;
  max-width: 600px;
}

.profile-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
}

.profile-tag {
  padding: 0.375rem 0.625rem;
  background: rgba(6, 182, 212, 0.12);
  border-radius: 6px;
  font-size: 0.6875rem;
  font-weight: 600;
  color: var(--sidebar-accent);
  transition: all 150ms ease;
}

.profile-tag:hover {
  background: rgba(6, 182, 212, 0.18);
}

/* Profile Stats Grid */
.profile-stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
}

.profile-stat-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem;
  background: var(--sidebar-hover);
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  transition: all 200ms ease;
}

.profile-stat-card:hover {
  border-color: rgba(255, 255, 255, 0.12);
  transform: translateY(-2px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.profile-stat-card__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 12px;
  flex-shrink: 0;
}

.profile-stat-card__icon--purple {
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
  color: #a78bfa;
}

.profile-stat-card__icon--cyan {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.2) 0%, rgba(8, 145, 178, 0.2) 100%);
  color: #06b6d4;
}

.profile-stat-card__icon--green {
  background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(5, 150, 105, 0.2) 100%);
  color: #10b981;
}

.profile-stat-card__content {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.profile-stat-card__value {
  font-size: 1.75rem;
  font-weight: 700;
  color: var(--sidebar-text);
  letter-spacing: -0.02em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
}

.profile-stat-card__label {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  font-weight: 500;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

/* Ranking Card */
.ranking-card {
  background-color: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
  padding: 1rem 1.125rem;
}

.ranking-row {
  display: flex;
  align-items: center;
  gap: 0.875rem;
  margin-bottom: 1rem;
}

.ranking-row__header-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background-color: rgba(245, 158, 11, 0.15);
  color: #fbbf24;
  flex-shrink: 0;
}

.ranking-row__header-icon svg {
  width: 20px;
  height: 20px;
}

.ranking-row__header-text {
  flex: 1;
  min-width: 0;
}

.ranking-row__title {
  font-size: 1.0625rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0;
  letter-spacing: -0.01em;
}

.ranking-row__subtitle {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
  margin: 0.125rem 0 0;
}

.ranking-row__stats {
  display: flex;
  gap: 2rem;
  margin-left: auto;
}

.rank-stat {
  text-align: center;
  min-width: 50px;
}

.rank-stat__value {
  display: block;
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--sidebar-text);
  font-variant-numeric: tabular-nums;
  line-height: 1;
}

.rank-stat--primary .rank-stat__value {
  color: #fbbf24;
}

.rank-stat__label {
  display: block;
  font-size: 0.5625rem;
  color: var(--sidebar-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-top: 0.25rem;
}

/* Budget Progress */
.budget-progress {
  height: 8px;
  background: var(--sidebar-hover);
  border-radius: 4px;
  overflow: hidden;
  margin-top: 0.75rem;
}

.budget-progress__fill {
  height: 100%;
  transition: width 300ms ease;
}

.budget-progress__fill--low {
  background: linear-gradient(90deg, #10b981 0%, #059669 100%);
}

.budget-progress__fill--medium {
  background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
}

.budget-progress__fill--high {
  background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
}

/* Tabs Navigation */
.tabs-nav {
  background: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  padding: 0.5rem;
}

.tabs-container {
  display: flex;
  gap: 0.375rem;
  overflow-x: auto;
  scrollbar-width: none;
}

.tabs-container::-webkit-scrollbar {
  display: none;
}

.tab-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.125rem;
  background: transparent;
  border: none;
  border-radius: 8px;
  font-size: 0.8125rem;
  font-weight: 600;
  color: var(--sidebar-text-muted);
  cursor: pointer;
  transition: all 180ms ease;
  white-space: nowrap;
  position: relative;
}

.tab-button:hover:not(.tab-button--active) {
  background: var(--sidebar-hover);
  color: var(--sidebar-text);
}

.tab-button--active {
  background: linear-gradient(135deg, rgba(6, 182, 212, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%);
  color: var(--sidebar-accent);
  box-shadow: 0 2px 8px rgba(6, 182, 212, 0.2);
}

.tab-button__icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
}

.tab-button__icon svg {
  width: 100%;
  height: 100%;
}

.tab-button__label {
  font-size: inherit;
}

/* Content */
.content {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
  padding-bottom: 4rem;
}

.section-title {
  font-size: 1.125rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0 0 1rem;
}

.overview-section {
  background: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
  padding: 1.5rem;
}

.details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.detail-label {
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.detail-value {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--sidebar-text);
}

/* Loading & Empty States */
.loading-state,
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  gap: 1rem;
  color: var(--sidebar-text-muted);
  background: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 10px;
}

.spinner {
  width: 40px;
  height: 40px;
  border: 3px solid var(--sidebar-border);
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.empty-state__hint {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  opacity: 0.7;
}

/* Edit Button */
.edit-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  height: 32px;
  padding: 0 0.875rem;
  background-color: var(--sidebar-accent);
  color: var(--sidebar-bg);
  font-size: 0.75rem;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 150ms ease;
}

.edit-btn:hover {
  opacity: 0.9;
}

.edit-btn__icon {
  width: 14px;
  height: 14px;
}

/* Global Branding Notice */
.global-branding-notice {
  display: flex;
  align-items: flex-start;
  gap: 1rem;
  padding: 1.5rem;
  background: rgba(59, 130, 246, 0.1);
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 12px;
}

.global-branding-notice__icon {
  width: 48px;
  height: 48px;
  border-radius: 10px;
  background: rgba(59, 130, 246, 0.15);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #3b82f6;
  flex-shrink: 0;
}

.global-branding-notice__content {
  flex: 1;
}

.global-branding-notice__title {
  font-size: 1rem;
  font-weight: 600;
  color: var(--sidebar-text);
  margin: 0 0 0.5rem;
}

.global-branding-notice__description {
  font-size: 0.875rem;
  color: var(--sidebar-text-muted);
  margin: 0;
  line-height: 1.5;
}

/* Submissions List */
.submissions-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.submission-card {
  background: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  overflow: hidden;
  transition: all 200ms ease;
}

.submission-card:hover {
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.submission-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid var(--sidebar-border);
}

.submission-card__user {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.submission-card__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--sidebar-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.submission-card__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.submission-card__avatar svg {
  width: 16px;
  height: 16px;
  color: var(--sidebar-text-muted);
}

.submission-card__user-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.submission-card__username {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sidebar-text);
}

.submission-card__platform {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.submission-card__status {
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.submission-card__status--pending {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}

.submission-card__status--verified {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.submission-card__status--paid {
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
}

.submission-card__status--rejected {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.submission-card__content {
  padding: 1rem;
}

.submission-card__link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.8125rem;
  color: #06b6d4;
  text-decoration: none;
  font-weight: 500;
  transition: opacity 200ms ease;
}

.submission-card__link:hover {
  opacity: 0.8;
}

.submission-card__pending {
  font-size: 0.8125rem;
  color: var(--sidebar-text-muted);
  font-style: italic;
}

.submission-card__stats {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--sidebar-border);
}

.submission-stat {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--sidebar-text-muted);
  font-size: 0.75rem;
  font-weight: 600;
}

.submission-stat svg {
  width: 14px;
  height: 14px;
}

.submission-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--sidebar-border);
}

.submission-card__date {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

/* Participants List */
.participants-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 1rem;
}

.participant-card {
  background: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  overflow: hidden;
  transition: all 200ms ease;
}

.participant-card:hover {
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.participant-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem;
  border-bottom: 1px solid var(--sidebar-border);
}

.participant-card__user {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.participant-card__avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: var(--sidebar-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.participant-card__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.participant-card__avatar svg {
  width: 20px;
  height: 20px;
  color: var(--sidebar-text-muted);
}

.participant-card__user-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.participant-card__username {
  font-size: 0.9375rem;
  font-weight: 600;
  color: var(--sidebar-text);
}

.participant-card__email {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.participant-card__status {
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.participant-card__status--pending {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}

.participant-card__status--approved {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.participant-card__status--rejected {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.participant-card__profile {
  display: flex;
  align-items: center;
  gap: 1.5rem;
  padding: 1rem;
}

.participant-card__stat {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  color: var(--sidebar-text-muted);
  font-size: 0.8125rem;
  font-weight: 600;
}

.participant-card__stat svg {
  width: 14px;
  height: 14px;
}

.participant-card__footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--sidebar-border);
}

.participant-card__date {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.participant-card__actions {
  display: flex;
  gap: 0.5rem;
}

.participant-action-btn {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: opacity 200ms ease;
}

.participant-action-btn:hover {
  opacity: 0.8;
}

.participant-action-btn svg {
  width: 14px;
  height: 14px;
}

.participant-action-btn--approve {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.participant-action-btn--reject {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

/* Payments List */
.payments-header {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.calculate-payments-btn {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.625rem 1rem;
  background: rgba(59, 130, 246, 0.15);
  color: #3b82f6;
  font-size: 0.8125rem;
  font-weight: 600;
  border: 1px solid rgba(59, 130, 246, 0.3);
  border-radius: 8px;
  cursor: pointer;
  transition: all 200ms ease;
}

.calculate-payments-btn:hover {
  background: rgba(59, 130, 246, 0.25);
}

.calculate-payments-btn svg {
  width: 16px;
  height: 16px;
}

.payments-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.payment-card {
  background: var(--sidebar-surface);
  border: 1px solid var(--sidebar-border);
  border-radius: 12px;
  padding: 1rem;
  transition: all 200ms ease;
}

.payment-card:hover {
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.15);
}

.payment-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.payment-card__user {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.payment-card__avatar {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: var(--sidebar-hover);
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
}

.payment-card__avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.payment-card__avatar svg {
  width: 16px;
  height: 16px;
  color: var(--sidebar-text-muted);
}

.payment-card__user-info {
  display: flex;
  flex-direction: column;
  gap: 0.125rem;
}

.payment-card__username {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sidebar-text);
}

.payment-card__submission {
  font-size: 0.75rem;
  color: var(--sidebar-text-muted);
}

.payment-card__amount {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 0.25rem;
}

.payment-card__amount-value {
  font-size: 1.125rem;
  font-weight: 700;
  color: #10b981;
}

.payment-card__status {
  padding: 0.25rem 0.625rem;
  border-radius: 6px;
  font-size: 0.625rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.payment-card__status--pending {
  background: rgba(251, 191, 36, 0.15);
  color: #fbbf24;
}

.payment-card__status--completed {
  background: rgba(16, 185, 129, 0.15);
  color: #10b981;
}

.payment-card__status--failed {
  background: rgba(239, 68, 68, 0.15);
  color: #ef4444;
}

.payment-card__details {
  display: flex;
  gap: 1.5rem;
  padding: 0.75rem 0;
  border-top: 1px solid var(--sidebar-border);
  border-bottom: 1px solid var(--sidebar-border);
  margin-bottom: 0.75rem;
}

.payment-detail {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.payment-detail__label {
  font-size: 0.6875rem;
  color: var(--sidebar-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  font-weight: 600;
}

.payment-detail__value {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--sidebar-text);
}

.payment-card__transaction {
  display: flex;
  align-items: center;
}

.payment-card__tx-link {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  font-size: 0.75rem;
  color: #06b6d4;
  text-decoration: none;
  font-weight: 500;
  transition: opacity 200ms ease;
}

.payment-card__tx-link:hover {
  opacity: 0.8;
}

.payment-card__tx-link svg {
  width: 12px;
  height: 12px;
}
</style>

