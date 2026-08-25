<template>
  <div class="campaigns">
    <PageLayout
      title="Campaigns"
      description="Browse clipping campaigns and earn money by posting clips"
      :show-header="true"
      :icon="Megaphone"
    >
      <template #actions>
        <div class="campaigns-search">
          <Search class="campaigns-search__icon" />
          <Input v-model="searchQuery" class="campaigns-search__input" placeholder="Search campaigns..." />
        </div>
      </template>

      <div
        class="campaigns__content"
        :class="{ 'campaigns__content--empty': !loading && (needsAuth || filteredCampaigns.length === 0) }"
      >
        <!-- Page Heading -->
        <div v-if="!loading && filteredCampaigns.length > 0" class="campaigns__heading">
          <h1 class="campaigns__title">Clipping Campaigns</h1>
          <p class="campaigns__subtitle">Join campaigns from creators and brands to earn money by posting clips</p>
        </div>

        <!-- Loading State -->
        <div v-if="loading" class="campaigns__loading">
          <div class="campaigns__loading-header">
            <div class="campaigns-skeleton campaigns-skeleton--heading"></div>
            <div class="campaigns-skeleton campaigns-skeleton--subheading"></div>
          </div>
          <div class="campaigns__grid">
            <div v-for="i in 6" :key="i" class="campaign-card campaign-card--skeleton">
              <div class="campaign-card__inner">
                <div class="campaign-card__cover campaign-card__cover--skeleton"></div>
                <div class="campaign-card__body">
                  <div class="campaigns-skeleton campaigns-skeleton--title"></div>
                  <div class="campaigns-skeleton campaigns-skeleton--text"></div>
                  <div class="campaigns-skeleton campaigns-skeleton--badges"></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Auth Required State -->
        <div v-else-if="needsAuth" class="campaigns__empty">
          <div class="campaigns__empty-icon-wrapper">
            <Megaphone class="campaigns__empty-icon" />
          </div>
          <h3 class="campaigns__empty-title">Sign in to browse campaigns</h3>
          <p class="campaigns__empty-description">
            Create an account or sign in to discover clipping campaigns and start earning
          </p>
        </div>

        <!-- Empty State -->
        <div v-else-if="filteredCampaigns.length === 0" class="campaigns__empty">
          <div class="campaigns__empty-icon-wrapper">
            <Megaphone class="campaigns__empty-icon" />
          </div>
          <h3 class="campaigns__empty-title">No campaigns found</h3>
          <p class="campaigns__empty-description">
            {{ searchQuery ? 'Try adjusting your search query' : 'Check back later for new clipping campaigns' }}
          </p>
        </div>

        <!-- Campaigns Grid -->
        <template v-else>
          <!-- Section Header -->
          <div class="campaigns__section-header">
            <div class="campaigns__section-header-left">
              <div class="campaigns__section-icon">
                <Sparkles />
              </div>
              <div class="campaigns__section-text">
                <h2 class="campaigns__section-title">Active Campaigns</h2>
                <p class="campaigns__section-subtitle">{{ filteredCampaigns.length }} campaigns available</p>
              </div>
            </div>
          </div>

          <div class="campaigns__grid">
            <div
              v-for="campaign in filteredCampaigns"
              :key="campaign.id"
              class="campaign-card"
              @click="viewCampaign(campaign)"
            >
              <div class="campaign-card__inner">
                <!-- Cover Image -->
                <div
                  class="campaign-card__cover"
                  :class="{ 'campaign-card__cover--fallback': !campaign.cover_image_url }"
                >
                  <img
                    v-if="campaign.cover_image_url"
                    :src="campaign.cover_image_url"
                    class="campaign-card__cover-img"
                    @error="(e: Event) => ((e.target as HTMLImageElement).style.display = 'none')"
                  />
                  <div v-else class="campaign-card__cover-placeholder">
                    <div class="campaign-card__cover-icon-wrap">
                      <Megaphone class="campaign-card__cover-icon" />
                    </div>
                  </div>

                  <!-- Organization Badge or Platform Badge -->
                  <div v-if="campaign.is_platform_campaign" class="campaign-card__org-badge campaign-card__org-badge--platform">
                    <Sparkles class="campaign-card__org-icon" />
                    <span class="campaign-card__org-name">Clippster Campaign</span>
                  </div>
                  <router-link
                    v-else-if="campaign.organization?.slug"
                    :to="{ path: `/orgs/${campaign.organization.slug}`, query: { from: $route.fullPath } }"
                    class="campaign-card__org-badge"
                    @click.stop
                  >
                    <img
                      v-if="campaign.organization.logo_url"
                      :src="campaign.organization.logo_url"
                      class="campaign-card__org-logo"
                    />
                    <Building2 v-else class="campaign-card__org-icon" />
                    <span class="campaign-card__org-name">{{ campaign.organization.name }}</span>
                  </router-link>
                  <div
                    v-else-if="campaign.organization"
                    class="campaign-card__org-badge campaign-card__org-badge--static"
                  >
                    <img
                      v-if="campaign.organization.logo_url"
                      :src="campaign.organization.logo_url"
                      class="campaign-card__org-logo"
                    />
                    <Building2 v-else class="campaign-card__org-icon" />
                    <span class="campaign-card__org-name">{{ campaign.organization.name }}</span>
                  </div>

                  <!-- CPM Badge -->
                  <div class="campaign-card__cpm-badge">
                    <span class="campaign-card__cpm-value">${{ formatCpm(campaign.cpm) }}</span>
                    <span class="campaign-card__cpm-unit">/1K views</span>
                  </div>
                </div>

                <!-- Content -->
                <div class="campaign-card__body">
                  <div class="campaign-card__header">
                    <div class="campaign-card__title-row">
                      <h3 class="campaign-card__title">{{ campaign.title }}</h3>
                      <!-- Platforms -->
                      <div class="campaign-card__platforms">
                        <div
                          v-for="platform in campaign.allowed_platforms"
                          :key="platform"
                          class="campaign-card__platform"
                          :class="getPlatformClass(platform)"
                          :title="getPlatformDisplayName(platform)"
                        >
                          <component :is="getPlatformIcon(platform)" class="campaign-card__platform-icon" />
                        </div>
                      </div>
                    </div>
                    <p v-if="campaign.description" class="campaign-card__description">
                      {{ campaign.description }}
                    </p>
                  </div>

                  <!-- Campaign Dates -->
                  <div v-if="campaign.starts_at || campaign.ends_at" class="campaign-card__dates">
                    <Calendar class="campaign-card__dates-icon" />
                    <div class="campaign-card__dates-text">
                      <template v-if="campaign.starts_at">{{ formatDate(campaign.starts_at) }}</template>
                      <template v-if="campaign.starts_at && campaign.ends_at"> – </template>
                      <template v-if="campaign.ends_at">{{ formatDate(campaign.ends_at) }}</template>
                    </div>
                    <div v-if="campaign.ends_at && getDaysRemaining(campaign) !== null" class="campaign-card__days-remaining">
                      <Clock class="campaign-card__days-icon" />
                      <span v-if="getDaysRemaining(campaign)! > 0">{{ getDaysRemaining(campaign) }}d left</span>
                      <span v-else>Ending today</span>
                    </div>
                  </div>

                  <!-- Creator Profiles or Global Branding -->
                  <div
                    v-if="isGlobalBrandingCampaign(campaign)"
                    class="campaign-card__creators campaign-card__creators--global"
                  >
                    <Globe class="campaign-card__global-icon" />
                    <span class="campaign-card__global-text">Any streamer eligible</span>
                  </div>
                  <div
                    v-else-if="campaign.creator_profiles && campaign.creator_profiles.length > 0"
                    class="campaign-card__creators"
                  >
                    <span class="campaign-card__creators-label">Creators:</span>
                    <div class="campaign-card__creators-avatars">
                      <div
                        v-for="(profile, idx) in campaign.creator_profiles.slice(0, 4)"
                        :key="profile.id"
                        class="campaign-card__creator-avatar"
                        :title="profile.name"
                      >
                        <img
                          v-if="profile.profile_image_url"
                          :src="profile.profile_image_url"
                          class="campaign-card__creator-img"
                        />
                        <div v-else class="campaign-card__creator-fallback">
                          {{ profile.name?.charAt(0) }}
                        </div>
                      </div>
                      <div
                        v-if="campaign.creator_profiles.length > 4"
                        class="campaign-card__creator-avatar campaign-card__creator-avatar--more"
                      >
                        +{{ campaign.creator_profiles.length - 4 }}
                      </div>
                    </div>
                  </div>

                  <!-- Stats Footer -->
                  <div class="campaign-card__footer">
                    <div class="campaign-card__stat">
                      <Users class="campaign-card__stat-icon" />
                      <span>{{ campaign.participants_count || 0 }} clippers</span>
                    </div>
                  </div>

                  <!-- Budget Progress -->
                  <div class="campaign-card__budget">
                    <div class="campaign-card__budget-header">
                      <Wallet class="campaign-card__budget-icon" />
                      <span class="campaign-card__budget-text">
                        ${{ formatBudget(campaign.spent_budget || 0) }} / ${{ formatBudget(campaign.budget) }}
                      </span>
                    </div>
                    <div class="campaign-card__budget-bar">
                      <div
                        class="campaign-card__budget-fill"
                        :style="{ width: getBudgetPercentage(campaign) + '%' }"
                        :class="{
                          'campaign-card__budget-fill--low': getBudgetPercentage(campaign) < 50,
                          'campaign-card__budget-fill--medium': getBudgetPercentage(campaign) >= 50 && getBudgetPercentage(campaign) < 80,
                          'campaign-card__budget-fill--high': getBudgetPercentage(campaign) >= 80,
                        }"
                      ></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </PageLayout>

    <!-- Campaign Detail Dialog -->
    <CampaignDetailDialog
      v-model:open="showDetailDialog"
      :campaign="selectedCampaign"
      @joined="onCampaignJoined"
      @require-auth="showAuthModal = true"
    />

    <!-- Authentication Modal -->
    <AuthModal v-model="showAuthModal" />
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, watch } from 'vue';
  import {
    Megaphone,
    Search,
    Building2,
    Users,
    Music2,
    Instagram,
    Twitter,
    Youtube,
    Globe,
    Sparkles,
    Wallet,
    Calendar,
    Clock,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Input } from '@/components/ui/input';
  import CampaignDetailDialog from '@/components/campaigns/CampaignDetailDialog.vue';
  import AuthModal from '@/components/AuthModal.vue';
  import { listActiveCampaigns, type Campaign, getPlatformDisplayName } from '@/services/campaignApi';
  import { useToast } from '@/composables/useToast';
  import { useAuthStore } from '@/stores/auth';
  import { formatDate } from '@/utils/dateTimeUtils';

  const { toast } = useToast();
  const authStore = useAuthStore();

  const loading = ref(true);
  const campaigns = ref<Campaign[]>([]);
  const searchQuery = ref('');
  const showDetailDialog = ref(false);
  const selectedCampaign = ref<Campaign | null>(null);
  const showAuthModal = ref(false);
  const needsAuth = ref(false);

  const filteredCampaigns = computed(() => {
    if (!searchQuery.value) return campaigns.value;

    const query = searchQuery.value.toLowerCase();
    return campaigns.value.filter(
      (c) =>
        c.title.toLowerCase().includes(query) ||
        c.description?.toLowerCase().includes(query) ||
        c.organization?.name.toLowerCase().includes(query)
    );
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

  const getPlatformClass = (platform: string) => {
    const classes: Record<string, string> = {
      tiktok: 'campaign-card__platform--tiktok',
      instagram: 'campaign-card__platform--instagram',
      x: 'campaign-card__platform--x',
      youtube: 'campaign-card__platform--youtube',
    };
    return classes[platform] || '';
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

  const getBudgetPercentage = (campaign: Campaign) => {
    const spent = typeof campaign.spent_budget === 'string' ? parseFloat(campaign.spent_budget) : campaign.spent_budget || 0;
    const budget = typeof campaign.budget === 'string' ? parseFloat(campaign.budget) : campaign.budget || 0;
    if (budget === 0) return 0;
    return Math.min((spent / budget) * 100, 100);
  };

  const getDaysRemaining = (campaign: Campaign) => {
    if (!campaign.ends_at) return null;
    const now = new Date();
    const endDate = new Date(campaign.ends_at);
    const diffMs = endDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / 86400000);
    return diffDays;
  };

  // Check if campaign uses global branding (no specific creator, but has branding profile)
  const isGlobalBrandingCampaign = (campaign: Campaign) => {
    return campaign.creator_profile_id === null && campaign.branding_profile_id !== null;
  };

  const viewCampaign = (campaign: Campaign) => {
    selectedCampaign.value = campaign;
    showDetailDialog.value = true;
  };

  const onCampaignJoined = () => {
    toast({
      title: 'Joined Campaign',
      description: 'You can now submit clips to this campaign',
    });
    loadCampaigns();
  };

  const loadCampaigns = async () => {
    loading.value = true;
    try {
      const response = await listActiveCampaigns();
      if (response.success) {
        campaigns.value = response.campaigns;
      }
    } catch (error) {
      console.error('Failed to load campaigns:', error);
      toast({
        title: 'Error',
        description: 'Failed to load campaigns',
        type: 'error',
      });
    } finally {
      loading.value = false;
    }
  };

  // Watch for authentication changes to load campaigns after user logs in
  watch(
    () => authStore.isAuthenticated,
    (isAuth) => {
      if (isAuth && needsAuth.value) {
        needsAuth.value = false;
        loadCampaigns();
      }
    }
  );

  onMounted(() => {
    // Check if user is authenticated before loading campaigns
    if (!authStore.isAuthenticated) {
      needsAuth.value = true;
      loading.value = false;
    } else {
      loadCampaigns();
    }
  });
</script>

<style scoped>
  /* ===== Page Container ===== */
  .campaigns {
    width: 100%;
    min-height: 100%;
  }

  .campaigns__content {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
    flex: 1;
  }

  .campaigns__content--empty {
    justify-content: center;
    align-items: center;
  }

  /* ===== Page Heading ===== */
  .campaigns__heading {
    margin-bottom: 0.5rem;
  }

  .campaigns__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.2rem;
    letter-spacing: -0.02em;
  }

  .campaigns__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.5;
  }

  /* ===== Search Bar ===== */
  .campaigns-search {
    position: relative;
    width: 280px;
  }

  .campaigns-search__icon {
    position: absolute;
    left: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    width: 14px;
    height: 14px;
    color: var(--sidebar-text-muted);
    pointer-events: none;
  }

  .campaigns-search__input {
    height: 34px;
    padding-left: 2.25rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.75rem;
    color: var(--sidebar-text);
    transition: all 150ms ease;
  }

  .campaigns-search__input:hover {
    border-color: rgba(255, 255, 255, 0.15);
  }

  .campaigns-search__input:focus {
    border-color: var(--sidebar-accent);
    box-shadow: 0 0 0 2px rgba(6, 182, 212, 0.1);
  }

  /* ===== Section Header ===== */
  .campaigns__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .campaigns__section-header-left {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .campaigns__section-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background-color: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .campaigns__section-icon svg {
    width: 20px;
    height: 20px;
  }

  .campaigns__section-title {
    font-size: 1.0625rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
  }

  .campaigns__section-subtitle {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.125rem 0 0;
  }

  /* ===== Grid Layout ===== */
  .campaigns__grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
  }

  @media (min-width: 768px) {
    .campaigns__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1200px) {
    .campaigns__grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  /* ===== Campaign Card ===== */
  .campaign-card {
    position: relative;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    transition:
      border-color 180ms ease,
      box-shadow 180ms ease;
  }

  .campaign-card:hover {
    border-color: rgba(255, 255, 255, 0.1);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
  }

  .campaign-card__inner {
    display: flex;
    flex-direction: column;
    height: 100%;
  }

  /* Cover Image */
  .campaign-card__cover {
    position: relative;
    height: 120px;
    overflow: hidden;
    background-color: var(--sidebar-hover);
  }

  .campaign-card__cover::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(0, 0, 0, 0.5) 0%, transparent 50%);
    pointer-events: none;
  }

  .campaign-card__cover--fallback {
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.08) 0%, rgba(6, 182, 212, 0.02) 100%);
  }

  .campaign-card__cover--fallback::after {
    background: none;
  }

  .campaign-card__cover-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    transition: transform 400ms ease;
  }

  .campaign-card:hover .campaign-card__cover-img {
    transform: scale(1.04);
  }

  .campaign-card__cover-placeholder {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .campaign-card__cover-icon-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 44px;
    height: 44px;
    border-radius: 10px;
    background-color: rgba(255, 255, 255, 0.04);
    border: 1px solid rgba(255, 255, 255, 0.06);
  }

  .campaign-card__cover-icon {
    width: 20px;
    height: 20px;
    color: var(--sidebar-text-muted);
    opacity: 0.4;
  }

  /* Organization Badge */
  .campaign-card__org-badge {
    position: absolute;
    bottom: 0.625rem;
    left: 0.625rem;
    z-index: 2;
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.25rem 0.5rem 0.25rem 0.25rem;
    background-color: rgba(0, 0, 0, 0.65);
    backdrop-filter: blur(8px);
    border-radius: 6px;
    text-decoration: none;
    color: inherit;
    cursor: pointer;
  }

  .campaign-card__org-badge--static {
    cursor: default;
  }

  .campaign-card__org-badge--platform {
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.9) 0%, rgba(16, 185, 129, 0.9) 100%);
    border: 1px solid rgba(255, 255, 255, 0.2);
  }

  .campaign-card__org-badge--platform .campaign-card__org-icon {
    color: rgba(255, 255, 255, 1);
  }

  .campaign-card__org-badge--platform .campaign-card__org-name {
    color: rgba(255, 255, 255, 1);
    font-weight: 600;
  }

  .campaign-card__org-logo {
    width: 18px;
    height: 18px;
    border-radius: 4px;
    object-fit: cover;
  }

  .campaign-card__org-icon {
    width: 14px;
    height: 14px;
    color: rgba(255, 255, 255, 0.6);
    margin-left: 0.125rem;
  }

  .campaign-card__org-name {
    font-size: 0.6875rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    max-width: 110px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  /* CPM Badge */
  .campaign-card__cpm-badge {
    position: absolute;
    top: 0.625rem;
    right: 0.625rem;
    z-index: 2;
    display: flex;
    align-items: baseline;
    gap: 0.125rem;
    padding: 0.3125rem 0.5rem;
    background-color: #10b981;
    border-radius: 5px;
  }

  .campaign-card__cpm-value {
    font-size: 0.8125rem;
    font-weight: 700;
    color: white;
    letter-spacing: -0.02em;
  }

  .campaign-card__cpm-unit {
    font-size: 0.5625rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.8);
  }

  /* Card Body */
  .campaign-card__body {
    padding: 0.875rem 1rem 1rem;
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
    flex: 1;
  }

  .campaign-card__header {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .campaign-card__title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.5rem;
  }

  .campaign-card__title {
    font-size: 0.9375rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    letter-spacing: -0.01em;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    transition: color 150ms ease;
    flex: 1;
    min-width: 0;
  }

  .campaign-card:hover .campaign-card__title {
    color: var(--sidebar-accent);
  }

  .campaign-card__description {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    line-height: 1.45;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }

  /* Campaign Dates */
  .campaign-card__dates {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 0.625rem;
    background-color: rgba(255, 255, 255, 0.03);
    border-radius: 6px;
    margin-top: 0.25rem;
  }

  .campaign-card__dates-icon {
    width: 13px;
    height: 13px;
    color: var(--sidebar-accent);
    flex-shrink: 0;
  }

  .campaign-card__dates-text {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    flex: 1;
    min-width: 0;
  }

  .campaign-card__days-remaining {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.1875rem 0.5rem;
    background-color: rgba(6, 182, 212, 0.15);
    border-radius: 4px;
    font-size: 0.625rem;
    font-weight: 600;
    color: var(--sidebar-accent);
    white-space: nowrap;
  }

  .campaign-card__days-icon {
    width: 11px;
    height: 11px;
  }

  /* Creators */
  .campaign-card__creators {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding-top: 0.25rem;
  }

  .campaign-card__creators-label {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .campaign-card__creators-avatars {
    display: flex;
    align-items: center;
  }

  .campaign-card__creator-avatar {
    width: 22px;
    height: 22px;
    border-radius: 50%;
    border: 1.5px solid var(--sidebar-surface);
    overflow: hidden;
    margin-left: -6px;
    background-color: var(--sidebar-hover);
    transition: transform 150ms ease;
  }

  .campaign-card__creator-avatar:first-child {
    margin-left: 0;
  }

  .campaign-card:hover .campaign-card__creator-avatar {
    transform: translateX(1px);
  }

  .campaign-card:hover .campaign-card__creator-avatar:first-child {
    transform: none;
  }

  .campaign-card__creator-img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }

  .campaign-card__creator-fallback {
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 0.5625rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    background-color: rgba(255, 255, 255, 0.05);
  }

  .campaign-card__creator-avatar--more {
    font-size: 0.5rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: rgba(255, 255, 255, 0.06);
  }

  /* Global Branding Indicator */
  .campaign-card__creators--global {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.375rem 0.625rem;
    background: linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%);
    border: 1px solid rgba(6, 182, 212, 0.2);
    border-radius: 6px;
  }

  .campaign-card__global-icon {
    width: 14px;
    height: 14px;
    color: var(--sidebar-accent);
  }

  .campaign-card__global-text {
    font-size: 0.6875rem;
    font-weight: 500;
    color: var(--sidebar-accent);
  }

  /* Platforms */
  .campaign-card__platforms {
    display: flex;
    flex-wrap: nowrap;
    gap: 0.375rem;
    flex-shrink: 0;
  }

  .campaign-card__platform {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    background-color: rgba(255, 255, 255, 0.04);
    border-radius: 5px;
    transition: background-color 150ms ease;
  }

  .campaign-card:hover .campaign-card__platform {
    background-color: rgba(255, 255, 255, 0.06);
  }

  .campaign-card__platform-icon {
    width: 13px;
    height: 13px;
    flex-shrink: 0;
  }

  .campaign-card__platform--tiktok {
    color: #fff;
  }

  .campaign-card__platform--tiktok .campaign-card__platform-icon {
    opacity: 1;
  }

  .campaign-card__platform--instagram {
    color: #e1306c;
  }

  .campaign-card__platform--x {
    color: var(--sidebar-text);
  }

  .campaign-card__platform--youtube {
    color: #ff4444;
  }

  /* Footer Stats */
  .campaign-card__footer {
    display: flex;
    align-items: center;
    gap: 0.875rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    margin-top: auto;
  }

  .campaign-card__stat {
    display: flex;
    align-items: center;
    gap: 0.3125rem;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .campaign-card__stat-icon {
    width: 13px;
    height: 13px;
    opacity: 0.5;
  }

  /* Budget Progress */
  .campaign-card__budget {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding-top: 0.75rem;
    border-top: 1px solid rgba(255, 255, 255, 0.05);
    margin-top: 0.75rem;
  }

  .campaign-card__budget-header {
    display: flex;
    align-items: center;
    gap: 0.375rem;
  }

  .campaign-card__budget-icon {
    width: 13px;
    height: 13px;
    color: var(--sidebar-text-muted);
    opacity: 0.7;
  }

  .campaign-card__budget-text {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    font-weight: 500;
  }

  .campaign-card__budget-bar {
    width: 100%;
    height: 5px;
    background-color: rgba(255, 255, 255, 0.05);
    border-radius: 3px;
    overflow: hidden;
    border: 1px solid rgba(255, 255, 255, 0.08);
  }

  .campaign-card__budget-fill {
    height: 100%;
    border-radius: 2px;
    transition: width 400ms cubic-bezier(0.4, 0, 0.2, 1), background-color 200ms ease;
  }

  .campaign-card__budget-fill--low {
    background: linear-gradient(90deg, #10b981 0%, #059669 100%);
    box-shadow: 0 0 6px rgba(16, 185, 129, 0.3);
  }

  .campaign-card__budget-fill--medium {
    background: linear-gradient(90deg, #f59e0b 0%, #d97706 100%);
    box-shadow: 0 0 6px rgba(245, 158, 11, 0.3);
  }

  .campaign-card__budget-fill--high {
    background: linear-gradient(90deg, #ef4444 0%, #dc2626 100%);
    box-shadow: 0 0 6px rgba(239, 68, 68, 0.3);
  }

  /* ===== Empty State ===== */
  .campaigns__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
  }

  .campaigns__empty-icon-wrapper {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 72px;
    height: 72px;
    background-color: var(--sidebar-hover);
    border-radius: 16px;
    margin-bottom: 1.5rem;
  }

  .campaigns__empty-icon {
    width: 36px;
    height: 36px;
    color: var(--sidebar-text-muted);
  }

  .campaigns__empty-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .campaigns__empty-description {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
    max-width: 320px;
    line-height: 1.5;
  }

  .campaigns__signin-btn {
    margin-top: 1.25rem;
    padding: 0.75rem 2rem;
    background-color: var(--sidebar-accent);
    color: white;
    font-size: 0.875rem;
    font-weight: 600;
    border: none;
    border-radius: 8px;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .campaigns__signin-btn:hover {
    opacity: 0.9;
    transform: translateY(-1px);
  }

  /* ===== Loading State ===== */
  .campaigns__loading {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
  }

  .campaigns__loading-header {
    display: flex;
    flex-direction: column;
    gap: 0.625rem;
  }

  .campaign-card--skeleton {
    pointer-events: none;
  }

  .campaign-card--skeleton .campaign-card__cover {
    height: 120px;
  }

  .campaign-card--skeleton .campaign-card__cover::after {
    display: none;
  }

  .campaign-card__cover--skeleton {
    background-color: var(--sidebar-hover);
    animation: pulse 1.5s infinite ease-in-out;
  }

  .campaigns-skeleton {
    background-color: var(--sidebar-hover);
    animation: pulse 1.5s infinite ease-in-out;
    border-radius: 4px;
  }

  .campaigns-skeleton--heading {
    height: 28px;
    width: 220px;
  }

  .campaigns-skeleton--subheading {
    height: 16px;
    width: 360px;
  }

  .campaigns-skeleton--title {
    height: 16px;
    width: 70%;
  }

  .campaigns-skeleton--text {
    height: 12px;
    width: 90%;
    margin-top: 0.375rem;
  }

  .campaigns-skeleton--badges {
    height: 18px;
    width: 60%;
    margin-top: 0.5rem;
  }

  /* ===== Animations ===== */
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
</style>
