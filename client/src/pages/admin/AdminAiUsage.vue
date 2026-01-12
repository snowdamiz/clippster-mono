<template>
  <PageLayout
    title="AI Usage"
    description="Monitor AI service consumption and performance"
    :show-header="true"
    :icon="Activity"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'AI Usage' }]"
  >
    <template #actions>
      <button class="admin-ai__action-btn" @click="fetchAiStats">
        <RefreshCw class="admin-ai__action-icon" />
        Refresh Stats
      </button>
    </template>

    <div class="admin-ai">
      <!-- Page Heading -->
      <div class="admin-ai__heading">
        <h1 class="admin-ai__title">AI Usage Stats</h1>
        <p class="admin-ai__subtitle">Monitor AI service consumption and performance</p>
      </div>

      <!-- Stats Header -->
      <div class="admin-ai__stats-header">
        <div class="admin-ai__stats-icon">
          <Activity class="admin-ai__stats-icon-svg" />
        </div>
        <div>
          <h2 class="admin-ai__stats-title">AI Usage Stats</h2>
          <p class="admin-ai__stats-desc">Monitor AI service consumption and performance</p>
        </div>
      </div>

      <!-- Stats Cards -->
      <div v-if="aiStats" class="admin-ai__cards">
        <div class="admin-ai__card">
          <div class="admin-ai__card-header">
            <div class="admin-ai__card-icon admin-ai__card-icon--blue">
              <Activity class="admin-ai__card-icon-svg" />
            </div>
            <h3 class="admin-ai__card-label">Total Tokens</h3>
          </div>
          <p class="admin-ai__card-value">{{ formatNumber(aiStats.stats.total_tokens) }}</p>
        </div>
        <div class="admin-ai__card">
          <div class="admin-ai__card-header">
            <div class="admin-ai__card-icon admin-ai__card-icon--green">
              <Activity class="admin-ai__card-icon-svg" />
            </div>
            <h3 class="admin-ai__card-label">Total Duration</h3>
          </div>
          <p class="admin-ai__card-value">{{ formatDuration(aiStats.stats.total_duration) }}</p>
        </div>
        <div class="admin-ai__card">
          <div class="admin-ai__card-header">
            <div class="admin-ai__card-icon admin-ai__card-icon--purple">
              <Layers class="admin-ai__card-icon-svg" />
            </div>
            <h3 class="admin-ai__card-label">Active Providers</h3>
          </div>
          <p class="admin-ai__card-value">{{ aiStats.stats.provider_stats.length }}</p>
        </div>
      </div>

      <!-- Breakdown Section -->
      <div v-if="aiStats" class="admin-ai__breakdown">
        <!-- Models Breakdown -->
        <div class="admin-ai__breakdown-card">
          <div class="admin-ai__breakdown-header">
            <h3 class="admin-ai__breakdown-title">Usage by Model</h3>
          </div>
          <div class="admin-ai__breakdown-scroll">
            <table class="admin-ai__breakdown-table">
              <thead>
                <tr>
                  <th class="admin-ai__breakdown-th">Model</th>
                  <th class="admin-ai__breakdown-th admin-ai__breakdown-th--right">Requests</th>
                  <th class="admin-ai__breakdown-th admin-ai__breakdown-th--right">Tokens</th>
                  <th class="admin-ai__breakdown-th admin-ai__breakdown-th--right">Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="aiStats.stats.model_stats.length === 0">
                  <td colspan="4" class="admin-ai__breakdown-empty">No usage data available</td>
                </tr>
                <tr v-for="stat in aiStats.stats.model_stats" :key="stat.model" class="admin-ai__breakdown-row">
                  <td class="admin-ai__breakdown-td">
                    <div class="admin-ai__breakdown-model">
                      <span class="admin-ai__breakdown-model-name">{{ stat.model }}</span>
                      <span class="admin-ai__breakdown-model-provider">{{ stat.provider }}</span>
                    </div>
                  </td>
                  <td class="admin-ai__breakdown-td admin-ai__breakdown-td--right">{{ formatNumber(stat.count) }}</td>
                  <td class="admin-ai__breakdown-td admin-ai__breakdown-td--right">
                    {{ stat.total_tokens ? formatNumber(stat.total_tokens) : '-' }}
                  </td>
                  <td class="admin-ai__breakdown-td admin-ai__breakdown-td--right">
                    {{
                      stat.total_duration && parseFloat(stat.total_duration) > 0
                        ? formatDuration(stat.total_duration)
                        : '-'
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Operations Breakdown -->
        <div class="admin-ai__breakdown-card">
          <div class="admin-ai__breakdown-header">
            <h3 class="admin-ai__breakdown-title">Usage by Operation</h3>
          </div>
          <div class="admin-ai__breakdown-scroll">
            <table class="admin-ai__breakdown-table">
              <thead>
                <tr>
                  <th class="admin-ai__breakdown-th">Operation</th>
                  <th class="admin-ai__breakdown-th admin-ai__breakdown-th--right">Requests</th>
                  <th class="admin-ai__breakdown-th admin-ai__breakdown-th--right">Tokens</th>
                  <th class="admin-ai__breakdown-th admin-ai__breakdown-th--right">Duration</th>
                </tr>
              </thead>
              <tbody>
                <tr v-if="aiStats.stats.operation_stats.length === 0">
                  <td colspan="4" class="admin-ai__breakdown-empty">No usage data available</td>
                </tr>
                <tr v-for="stat in aiStats.stats.operation_stats" :key="stat.operation" class="admin-ai__breakdown-row">
                  <td class="admin-ai__breakdown-td admin-ai__breakdown-td--capitalize">
                    {{ stat.operation.replace(/_/g, ' ') }}
                  </td>
                  <td class="admin-ai__breakdown-td admin-ai__breakdown-td--right">{{ formatNumber(stat.count) }}</td>
                  <td class="admin-ai__breakdown-td admin-ai__breakdown-td--right">
                    {{ stat.total_tokens ? formatNumber(stat.total_tokens) : '-' }}
                  </td>
                  <td class="admin-ai__breakdown-td admin-ai__breakdown-td--right">
                    {{
                      stat.total_duration && parseFloat(stat.total_duration) > 0
                        ? formatDuration(stat.total_duration)
                        : '-'
                    }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Recent Logs Table -->
      <div v-if="aiStats && aiStats.recent_logs.length > 0" class="admin-ai__logs">
        <div class="admin-ai__logs-header">
          <h3 class="admin-ai__logs-title">Recent Activity</h3>
        </div>
        <div class="admin-ai__logs-scroll">
          <table class="admin-ai__logs-table">
            <thead>
              <tr>
                <th class="admin-ai__logs-th">Time</th>
                <th class="admin-ai__logs-th">User</th>
                <th class="admin-ai__logs-th">Operation</th>
                <th class="admin-ai__logs-th">Provider/Model</th>
                <th class="admin-ai__logs-th">Usage</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="log in aiStats.recent_logs" :key="log.id" class="admin-ai__logs-row">
                <td class="admin-ai__logs-td">{{ formatDate(log.created_at) }}</td>
                <td class="admin-ai__logs-td">
                  <code class="admin-ai__logs-wallet">{{ formatWalletAddress(log.user_wallet) }}</code>
                </td>
                <td class="admin-ai__logs-td">
                  <span class="admin-ai__logs-operation">{{ log.operation }}</span>
                </td>
                <td class="admin-ai__logs-td">
                  <div class="admin-ai__logs-provider">
                    <span class="admin-ai__logs-provider-name">{{ log.provider }}</span>
                    <span class="admin-ai__logs-provider-model">{{ log.model }}</span>
                  </div>
                </td>
                <td class="admin-ai__logs-td">
                  <div v-if="log.tokens" class="admin-ai__logs-usage">{{ formatNumber(log.tokens) }} tokens</div>
                  <div v-if="log.duration" class="admin-ai__logs-duration">{{ formatDuration(log.duration) }}</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, onMounted } from 'vue';
  import { Activity, RefreshCw, Layers } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import api from '@/services/api';

  interface AiUsageStats {
    stats: {
      total_tokens: number;
      total_duration: string;
      provider_stats: Array<{ provider: string; count: number; total_tokens: number; total_duration: string }>;
      model_stats: Array<{
        provider: string;
        model: string;
        count: number;
        total_tokens: number;
        total_duration: string;
      }>;
      operation_stats: Array<{ operation: string; count: number; total_tokens: number; total_duration: string }>;
    };
    recent_logs: Array<{
      id: number;
      user_wallet: string;
      project_id: string;
      provider: string;
      model: string;
      tokens: number;
      duration: string;
      operation: string;
      created_at: string;
    }>;
  }

  const aiStats = ref<AiUsageStats | null>(null);

  const fetchAiStats = async () => {
    try {
      const response = await api.get('/admin/ai-usage');
      if (response.data.success) {
        aiStats.value = response.data;
      }
    } catch (err) {
      console.error('Error fetching AI stats:', err);
    }
  };

  const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num || 0);

  const formatDuration = (seconds: string | number) => {
    const secs = Number(seconds) || 0;
    if (secs < 60) return `${secs.toFixed(1)}s`;
    const mins = Math.floor(secs / 60);
    const remainingSecs = (secs % 60).toFixed(0);
    return `${mins}m ${remainingSecs}s`;
  };

  const formatWalletAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  };

  onMounted(() => {
    fetchAiStats();
  });
</script>

<style scoped>
  .admin-ai {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  .admin-ai__heading {
    margin-bottom: 0.5rem;
  }

  .admin-ai__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.375rem;
    letter-spacing: -0.02em;
  }

  .admin-ai__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-ai__action-btn {
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

  .admin-ai__action-btn:hover {
    opacity: 0.9;
  }

  .admin-ai__action-icon {
    width: 14px;
    height: 14px;
  }

  .admin-ai__stats-header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .admin-ai__stats-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(99, 102, 241, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
    border: 1px solid rgba(99, 102, 241, 0.3);
  }

  .admin-ai__stats-icon-svg {
    width: 20px;
    height: 20px;
    color: #818cf8;
  }

  .admin-ai__stats-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }
  .admin-ai__stats-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-ai__cards {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
  }

  @media (min-width: 768px) {
    .admin-ai__cards {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .admin-ai__card {
    padding: 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .admin-ai__card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .admin-ai__card-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .admin-ai__card-icon--blue {
    background: linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(6, 182, 212, 0.2) 100%);
    border: 1px solid rgba(59, 130, 246, 0.3);
  }
  .admin-ai__card-icon--blue .admin-ai__card-icon-svg {
    color: #60a5fa;
  }

  .admin-ai__card-icon--green {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%);
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
  .admin-ai__card-icon--green .admin-ai__card-icon-svg {
    color: #34d399;
  }

  .admin-ai__card-icon--purple {
    background: linear-gradient(135deg, rgba(168, 85, 247, 0.2) 0%, rgba(236, 72, 153, 0.2) 100%);
    border: 1px solid rgba(168, 85, 247, 0.3);
  }
  .admin-ai__card-icon--purple .admin-ai__card-icon-svg {
    color: #c084fc;
  }

  .admin-ai__card-icon-svg {
    width: 16px;
    height: 16px;
  }

  .admin-ai__card-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-ai__card-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
  }

  .admin-ai__breakdown {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
  }

  @media (min-width: 1024px) {
    .admin-ai__breakdown {
      grid-template-columns: repeat(2, 1fr);
    }
  }

  .admin-ai__breakdown-card {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
  }

  .admin-ai__breakdown-header {
    padding: 0.75rem 1rem;
    background-color: rgba(24, 24, 27, 0.8);
    border-bottom: 1px solid var(--sidebar-border);
  }

  .admin-ai__breakdown-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .admin-ai__breakdown-scroll {
    overflow-x: auto;
  }

  .admin-ai__breakdown-table {
    width: 100%;
    border-collapse: collapse;
  }

  .admin-ai__breakdown-th {
    padding: 0.625rem 1rem;
    text-align: left;
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    background-color: rgba(24, 24, 27, 0.6);
  }

  .admin-ai__breakdown-th--right {
    text-align: right;
  }

  .admin-ai__breakdown-row {
    transition: background-color 150ms ease;
  }
  .admin-ai__breakdown-row:hover {
    background-color: rgba(39, 39, 42, 0.3);
  }

  .admin-ai__breakdown-td {
    padding: 0.625rem 1rem;
    font-size: 0.875rem;
    font-family: monospace;
    color: var(--sidebar-text);
  }

  .admin-ai__breakdown-td--right {
    text-align: right;
  }
  .admin-ai__breakdown-td--capitalize {
    text-transform: capitalize;
    font-weight: 500;
    font-family: inherit;
  }

  .admin-ai__breakdown-empty {
    padding: 1rem;
    text-align: center;
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
  }

  .admin-ai__breakdown-model {
    display: flex;
    flex-direction: column;
  }
  .admin-ai__breakdown-model-name {
    font-weight: 500;
    color: var(--sidebar-text);
    font-family: inherit;
  }
  .admin-ai__breakdown-model-provider {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    text-transform: capitalize;
    font-family: inherit;
  }

  .admin-ai__logs {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
  }

  .admin-ai__logs-header {
    padding: 0.875rem 1.25rem;
    background-color: rgba(24, 24, 27, 0.8);
    border-bottom: 1px solid var(--sidebar-border);
  }

  .admin-ai__logs-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }

  .admin-ai__logs-scroll {
    overflow-x: auto;
  }

  .admin-ai__logs-table {
    width: 100%;
    border-collapse: collapse;
  }

  .admin-ai__logs-th {
    padding: 0.75rem 1.25rem;
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
    background-color: rgba(24, 24, 27, 0.6);
  }

  .admin-ai__logs-row {
    transition: background-color 150ms ease;
  }
  .admin-ai__logs-row:hover {
    background-color: rgba(39, 39, 42, 0.3);
  }

  .admin-ai__logs-td {
    padding: 1rem 1.25rem;
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    white-space: nowrap;
  }

  .admin-ai__logs-wallet {
    font-size: 0.75rem;
    background-color: var(--sidebar-hover);
    padding: 0.375rem 0.625rem;
    border-radius: 8px;
    font-family: monospace;
    color: var(--sidebar-text);
  }

  .admin-ai__logs-operation {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.625rem;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 500;
    background-color: rgba(59, 130, 246, 0.2);
    color: #93c5fd;
    border: 1px solid rgba(59, 130, 246, 0.3);
  }

  .admin-ai__logs-provider {
    display: flex;
    flex-direction: column;
  }
  .admin-ai__logs-provider-name {
    font-weight: 500;
    color: var(--sidebar-text);
    text-transform: capitalize;
  }
  .admin-ai__logs-provider-model {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .admin-ai__logs-usage {
    font-size: 0.875rem;
    color: var(--sidebar-text);
  }
  .admin-ai__logs-duration {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }
</style>
