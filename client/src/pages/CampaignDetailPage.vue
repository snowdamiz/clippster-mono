<template>
  <div class="campaign-detail">
    <PageLayout
      :title="campaign?.title || 'Campaign'"
      :description="campaign?.description || 'Campaign details and management'"
      :show-header="true"
      :icon="Megaphone"
    >
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
      <div v-else-if="campaign" class="campaign-page">
        <!-- Enhanced Campaign Header -->
        <div class="campaign-header-card">
          <div class="campaign-header-bg" :style="campaign.cover_image_url ? { backgroundImage: `url(${campaign.cover_image_url})` } : {}"></div>
          <div class="campaign-header-content">
            <div class="campaign-header-main">
              <div class="campaign-avatar-wrapper">
                <div class="campaign-avatar">
                  <img
                    v-if="campaign.cover_image_url"
                    :src="campaign.cover_image_url"
                    class="campaign-avatar__img"
                  />
                  <Megaphone v-else class="campaign-avatar__fallback" />
                </div>
              </div>
              <div class="campaign-info">
                <div class="campaign-name-row">
                  <h1 class="campaign-name">{{ campaign.title }}</h1>
                  <div class="campaign-badges">
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
                <div class="campaign-meta-row">
                  <span v-if="campaign.organization" class="campaign-org">
                    <Building2 :size="14" />
                    {{ campaign.organization.name }}
                  </span>
                  <span v-if="campaign.starts_at" class="campaign-dates">
                    <Calendar :size="14" />
                    {{ formatDate(campaign.starts_at) }} - {{ campaign.ends_at ? formatDate(campaign.ends_at) : 'Ongoing' }}
                  </span>
                </div>
                <p class="campaign-bio">
                  {{ campaign.description || 'No description provided' }}
                </p>
                <div v-if="campaign.allowed_platforms?.length" class="campaign-platforms">
                  <span v-for="platform in campaign.allowed_platforms" :key="platform" class="campaign-platform-tag">
                    {{ getPlatformDisplayName(platform) }}
                  </span>
                </div>
              </div>
            </div>
            <div class="campaign-stats-grid">
              <div class="campaign-stat-card">
                <div class="campaign-stat-card__icon campaign-stat-card__icon--purple">
                  <Users :size="18" />
                </div>
                <div class="campaign-stat-card__content">
                  <span class="campaign-stat-card__value">{{ stats.participants_count || 0 }}</span>
                  <span class="campaign-stat-card__label">Participants</span>
                </div>
              </div>
              <div class="campaign-stat-card">
                <div class="campaign-stat-card__icon campaign-stat-card__icon--cyan">
                  <FileVideo :size="18" />
                </div>
                <div class="campaign-stat-card__content">
                  <span class="campaign-stat-card__value">{{ stats.submissions_count || 0 }}</span>
                  <span class="campaign-stat-card__label">Submissions</span>
                </div>
              </div>
              <div class="campaign-stat-card">
                <div class="campaign-stat-card__icon campaign-stat-card__icon--green">
                  <CheckCircle :size="18" />
                </div>
                <div class="campaign-stat-card__content">
                  <span class="campaign-stat-card__value">{{ stats.verified_count || 0 }}</span>
                  <span class="campaign-stat-card__label">Verified</span>
                </div>
              </div>
              <div class="campaign-stat-card">
                <div class="campaign-stat-card__icon campaign-stat-card__icon--orange">
                  <Wallet :size="18" />
                </div>
                <div class="campaign-stat-card__content">
                  <span class="campaign-stat-card__value">${{ formatBudget(campaign.spent_budget || 0) }}</span>
                  <span class="campaign-stat-card__label">Spent</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Budget Progress Bar -->
        <div class="budget-card">
          <div class="budget-card__header">
            <div class="budget-card__title">
              <Wallet :size="18" />
              <span>Budget Usage</span>
            </div>
            <span class="budget-card__amount">
              ${{ formatBudget(campaign.spent_budget || 0) }} / ${{ formatBudget(campaign.budget) }}
            </span>
          </div>
          <div class="budget-card__bar">
            <div
              class="budget-card__fill"
              :style="{ width: getBudgetPercentage() + '%' }"
              :class="{
                'budget-card__fill--low': getBudgetPercentage() < 50,
                'budget-card__fill--medium': getBudgetPercentage() >= 50 && getBudgetPercentage() < 80,
                'budget-card__fill--high': getBudgetPercentage() >= 80,
              }"
            ></div>
          </div>
          <div class="budget-card__footer">
            <span class="budget-card__remaining">
              ${{ formatBudget(getRemainingBudget()) }} remaining
            </span>
            <span class="budget-card__percentage">
              {{ getBudgetPercentage().toFixed(1) }}% used
            </span>
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
              <span v-if="tab.count !== undefined" class="tab-button__count">{{ tab.count }}</span>
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
                <div class="detail-item">
                  <span class="detail-label">Join Type</span>
                  <span class="detail-value">{{ campaign.join_type === 'open' ? 'Open to All' : 'Application Required' }}</span>
                </div>
              </div>
            </div>
          </template>

          <!-- Submissions Tab -->
          <template v-if="activeTab === 'submissions'">
            <div class="submissions-placeholder">
              <FileVideo :size="48" />
              <p>Submissions management coming soon</p>
            </div>
          </template>

          <!-- Participants Tab -->
          <template v-if="activeTab === 'participants'">
            <div class="participants-placeholder">
              <Users :size="48" />
              <p>Participants list coming soon</p>
            </div>
          </template>

          <!-- Payments Tab -->
          <template v-if="activeTab === 'payments'">
            <div class="payments-placeholder">
              <DollarSign :size="48" />
              <p>Payments management coming soon</p>
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
  import { ref, computed, onMounted } from 'vue';
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
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { getCampaign, getPlatformDisplayName, type Campaign, type CampaignStats } from '@/services/campaignApi';
  import { useToast } from '@/composables/useToast';
  import { useAuthStore } from '@/stores/auth';

  const route = useRoute();
  const router = useRouter();
  const { toast } = useToast();
  const authStore = useAuthStore();

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
        // TODO: Load stats from separate API endpoint when available
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

  onMounted(() => {
    loadCampaign();
  });
</script>

<style scoped>
  /* Base Layout */
  .campaign-detail {
    width: 100%;
    min-height: 100%;
  }

  .campaign-page {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  /* Loading & Error States */
  .campaign-detail__loading,
  .campaign-detail__error {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    gap: 1rem;
    color: var(--sidebar-text-muted);
  }

  .campaign-detail__error h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .back-btn {
    margin-top: 1rem;
    padding: 0.625rem 1.25rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .back-btn:hover {
    background: var(--sidebar-active);
  }

  /* Header Card */
  .campaign-header-card {
    position: relative;
    background: var(--sidebar-bg);
    border: 1px solid var(--sidebar-border);
    border-radius: 16px;
    overflow: hidden;
  }

  .campaign-header-bg {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    height: 120px;
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(147, 51, 234, 0.1) 100%);
    background-size: cover;
    background-position: center;
    filter: blur(8px);
    opacity: 0.3;
  }

  .campaign-header-content {
    position: relative;
    padding: 2rem;
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .campaign-header-main {
    display: flex;
    gap: 1.5rem;
    align-items: flex-start;
  }

  .campaign-avatar-wrapper {
    flex-shrink: 0;
  }

  .campaign-avatar {
    position: relative;
    width: 96px;
    height: 96px;
    border-radius: 16px;
    background: var(--sidebar-hover);
    border: 3px solid var(--sidebar-bg);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .campaign-avatar__img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .campaign-avatar__fallback {
    width: 48px;
    height: 48px;
    color: var(--sidebar-text-muted);
  }

  .campaign-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .campaign-name-row {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }

  .campaign-name {
    font-size: 1.75rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.02em;
  }

  .campaign-badges {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .status-badge {
    display: inline-flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.25rem 0.625rem;
    border-radius: 6px;
    font-size: 0.6875rem;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .status-badge--active {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .status-badge--draft {
    background: rgba(156, 163, 175, 0.15);
    color: #9ca3af;
    border: 1px solid rgba(156, 163, 175, 0.3);
  }

  .status-badge--paused {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .status-badge--completed {
    background: rgba(59, 130, 246, 0.15);
    color: #3b82f6;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .status-badge--per-clip,
  .status-badge--cpm {
    background: rgba(147, 51, 234, 0.15);
    color: #9333ea;
    border: 1px solid rgba(147, 51, 234, 0.3);
  }

  .campaign-meta-row {
    display: flex;
    align-items: center;
    gap: 1rem;
    flex-wrap: wrap;
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
  }

  .campaign-org,
  .campaign-dates {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .campaign-bio {
    font-size: 0.9375rem;
    line-height: 1.6;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .campaign-platforms {
    display: flex;
    gap: 0.5rem;
    flex-wrap: wrap;
  }

  .campaign-platform-tag {
    padding: 0.25rem 0.625rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    font-size: 0.75rem;
    font-weight: 500;
    color: var(--sidebar-text);
  }

  /* Stats Grid */
  .campaign-stats-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: 1rem;
  }

  .campaign-stat-card {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
  }

  .campaign-stat-card__icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .campaign-stat-card__icon--purple {
    background: rgba(147, 51, 234, 0.15);
    color: #9333ea;
  }

  .campaign-stat-card__icon--cyan {
    background: rgba(6, 182, 212, 0.15);
    color: #06b6d4;
  }

  .campaign-stat-card__icon--green {
    background: rgba(16, 185, 129, 0.15);
    color: #10b981;
  }

  .campaign-stat-card__icon--orange {
    background: rgba(245, 158, 11, 0.15);
    color: #f59e0b;
  }

  .campaign-stat-card__content {
    display: flex;
    flex-direction: column;
  }

  .campaign-stat-card__value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    line-height: 1.2;
  }

  .campaign-stat-card__label {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  /* Budget Card */
  .budget-card {
    background: var(--sidebar-bg);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .budget-card__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .budget-card__title {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .budget-card__amount {
    font-size: 1rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .budget-card__bar {
    width: 100%;
    height: 8px;
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 4px;
    overflow: hidden;
    border: 1px solid var(--sidebar-border);
  }

  .budget-card__fill {
    height: 100%;
    border-radius: 3px;
    transition: width 400ms cubic-bezier(0.4, 0, 0.2, 1);
  }

  .budget-card__fill--low {
    background: linear-gradient(90deg, #10b981 0%, #059669 100%);
  }

  .budget-card__fill--medium {
    background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
  }

  .budget-card__fill--high {
    background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
  }

  .budget-card__footer {
    display: flex;
    justify-content: space-between;
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
  }

  /* Tabs */
  .tabs-nav {
    background: var(--sidebar-bg);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    padding: 0.5rem;
  }

  .tabs-container {
    display: flex;
    gap: 0.5rem;
  }

  .tab-button {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.75rem 1rem;
    background: transparent;
    border: none;
    border-radius: 8px;
    color: var(--sidebar-text-muted);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .tab-button:hover {
    background: var(--sidebar-hover);
    color: var(--sidebar-text);
  }

  .tab-button--active {
    background: var(--sidebar-active);
    color: var(--sidebar-text);
  }

  .tab-button__icon {
    width: 18px;
    height: 18px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .tab-button__count {
    padding: 0.125rem 0.5rem;
    background: var(--sidebar-hover);
    border-radius: 12px;
    font-size: 0.75rem;
    font-weight: 600;
  }

  .tab-button--active .tab-button__count {
    background: var(--sidebar-bg);
  }

  /* Content */
  .content {
    background: var(--sidebar-bg);
    border: 1px solid var(--sidebar-border);
    border-radius: 12px;
    padding: 2rem;
  }

  .section-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 1.5rem;
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
    font-size: 0.8125rem;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }

  .detail-value {
    font-size: 1rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  /* Placeholder States */
  .submissions-placeholder,
  .participants-placeholder,
  .payments-placeholder {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 4rem 2rem;
    gap: 1rem;
    color: var(--sidebar-text-muted);
  }

  .edit-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 1.25rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .edit-btn:hover {
    background: var(--sidebar-active);
  }

  .edit-btn__icon {
    width: 16px;
    height: 16px;
  }
</style>
