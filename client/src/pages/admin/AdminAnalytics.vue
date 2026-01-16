<template>
  <PageLayout
    title="Analytics"
    description="Track key user actions and events"
    :show-header="true"
    :icon="BarChart3"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Analytics' }]"
  >
    <template #actions>
      <button class="admin-analytics__action-btn" :disabled="loading" @click="fetchAnalyticsStats">
        <RefreshCw v-if="!loading" class="admin-analytics__action-icon" />
        <Loader2 v-else class="admin-analytics__action-icon admin-analytics__action-icon--spin" />
        Refresh Analytics
      </button>
    </template>

    <div class="admin-analytics">
      <!-- Page Heading -->
      <div class="admin-analytics__heading">
        <h1 class="admin-analytics__title">Analytics</h1>
        <p class="admin-analytics__subtitle">Track key user actions and events</p>
      </div>

      <!-- Stats Header -->
      <div class="admin-analytics__stats-header">
        <div class="admin-analytics__stats-info">
          <div class="admin-analytics__stats-icon">
            <BarChart3 class="admin-analytics__stats-icon-svg" />
          </div>
          <div>
            <h2 class="admin-analytics__stats-title">Analytics</h2>
            <p class="admin-analytics__stats-desc">Track key user actions and events</p>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="loading" class="admin-analytics__loading">
        <Loader2 class="admin-analytics__loading-icon" />
        <p class="admin-analytics__loading-text">Loading analytics...</p>
      </div>

      <!-- Analytics Cards -->
      <div v-else-if="analyticsStats" class="admin-analytics__grid">
        <div v-for="(stats, eventType) in analyticsStats" :key="eventType" class="admin-analytics__card">
          <div class="admin-analytics__card-header">
            <div class="admin-analytics__card-icon">
              <Activity class="admin-analytics__card-icon-svg" />
            </div>
            <h3 class="admin-analytics__card-title">{{ formatEventName(eventType) }}</h3>
          </div>
          <div class="admin-analytics__card-stats">
            <div class="admin-analytics__stat">
              <p class="admin-analytics__stat-label">Today</p>
              <p class="admin-analytics__stat-value">{{ stats.today }}</p>
            </div>
            <div class="admin-analytics__stat">
              <p class="admin-analytics__stat-label">This Week</p>
              <p class="admin-analytics__stat-value">{{ stats.this_week }}</p>
            </div>
            <div class="admin-analytics__stat admin-analytics__stat--highlight">
              <p class="admin-analytics__stat-label">Total</p>
              <p class="admin-analytics__stat-value admin-analytics__stat-value--highlight">{{ stats.total }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="admin-analytics__empty">
        <div class="admin-analytics__empty-icon">
          <BarChart3 class="admin-analytics__empty-icon-svg" />
        </div>
        <p class="admin-analytics__empty-text">No analytics data available</p>
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { BarChart3, Activity, RefreshCw, Loader2 } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { getAnalyticsStats } from '@/services/analytics';

  const analyticsStats = ref<Record<string, { total: number; today: number; this_week: number }> | null>(null);
  const loading = ref(false);

  const fetchAnalyticsStats = async () => {
    loading.value = true;
    try {
      const stats = await getAnalyticsStats();
      analyticsStats.value = Object.keys(stats).length > 0 ? stats : null;
    } catch (err) {
      console.error('Error fetching analytics stats:', err);
      analyticsStats.value = null;
    } finally {
      loading.value = false;
    }
  };

  const formatEventName = (eventType: string): string => {
    const names: Record<string, string> = {
      clip_detection: 'Clip Detection',
      clip_export: 'Clip Export',
      vod_download: 'VOD Download',
      user_created: 'User Created',
      credits_purchased: 'Credits Purchased',
      credits_spent: 'Credits Spent',
    };
    return names[eventType] || eventType;
  };

  onMounted(() => {
    fetchAnalyticsStats();
  });
</script>

<style scoped>
  .admin-analytics {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  .admin-analytics__heading {
    margin-bottom: 0.5rem;
  }

  .admin-analytics__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.2rem;
    letter-spacing: -0.02em;
  }

  .admin-analytics__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-analytics__action-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    height: 32px;
    padding: 0 0.875rem;
    font-size: 0.75rem;
    font-weight: 600;
    border-radius: 6px;
    cursor: pointer;
    transition: all 150ms ease;
    border: none;
    background-color: var(--sidebar-accent);
    color: var(--sidebar-bg);
  }

  .admin-analytics__action-btn:hover:not(:disabled) {
    opacity: 0.9;
  }
  .admin-analytics__action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-analytics__action-icon {
    width: 14px;
    height: 14px;
  }
  .admin-analytics__action-icon--spin {
    animation: spin 1s linear infinite;
  }

  .admin-analytics__stats-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .admin-analytics__stats-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .admin-analytics__stats-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(20, 184, 166, 0.2) 100%);
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .admin-analytics__stats-icon-svg {
    width: 20px;
    height: 20px;
    color: #34d399;
  }

  .admin-analytics__stats-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }
  .admin-analytics__stats-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-analytics__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
  }

  .admin-analytics__loading-icon {
    width: 32px;
    height: 32px;
    color: #34d399;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  .admin-analytics__loading-text {
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-analytics__grid {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
  }

  @media (min-width: 640px) {
    .admin-analytics__grid {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  @media (min-width: 1024px) {
    .admin-analytics__grid {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .admin-analytics__card {
    padding: 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    transition: background-color 150ms ease;
  }

  .admin-analytics__card:hover {
    background-color: rgba(39, 39, 42, 0.6);
  }

  .admin-analytics__card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .admin-analytics__card-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(20, 184, 166, 0.2) 100%);
    border: 1px solid rgba(16, 185, 129, 0.3);
  }

  .admin-analytics__card-icon-svg {
    width: 16px;
    height: 16px;
    color: #34d399;
  }

  .admin-analytics__card-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
    text-transform: capitalize;
  }

  .admin-analytics__card-stats {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.75rem;
  }

  .admin-analytics__stat {
    padding: 0.625rem;
    background-color: rgba(39, 39, 42, 0.5);
    border-radius: 8px;
  }

  .admin-analytics__stat--highlight {
    background-color: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.2);
  }

  .admin-analytics__stat-label {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0 0 0.25rem;
  }

  .admin-analytics__stat--highlight .admin-analytics__stat-label {
    color: rgba(52, 211, 153, 0.8);
  }

  .admin-analytics__stat-value {
    font-size: 1.25rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
  }

  .admin-analytics__stat-value--highlight {
    color: #34d399;
  }

  .admin-analytics__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    text-align: center;
  }

  .admin-analytics__empty-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(16, 185, 129, 0.2) 0%, rgba(20, 184, 166, 0.2) 100%);
    border: 1px solid rgba(16, 185, 129, 0.3);
    margin-bottom: 1rem;
  }

  .admin-analytics__empty-icon-svg {
    width: 28px;
    height: 28px;
    color: #34d399;
  }

  .admin-analytics__empty-text {
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
