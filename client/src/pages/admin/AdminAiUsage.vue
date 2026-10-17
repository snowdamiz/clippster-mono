<template>
  <PageLayout
    title="AI usage"
    description="Monitor AI service consumption and performance"
    :icon="Activity"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'AI usage' }]"
  >
    <template #actions>
      <Button variant="ghost" size="icon-sm" title="Refresh stats" :disabled="loading" @click="fetchAiStats">
        <RefreshCw :class="{ 'animate-spin': loading }" />
      </Button>
    </template>

    <div class="flex flex-col gap-4 px-5 py-4">
      <!-- Totals -->
      <StatGrid :count="4">
        <StatCard
          label="Total tokens"
          :value="formatNumber(aiStats?.stats.total_tokens || 0)"
          :icon="Coins"
          :loading="loading && !aiStats"
        />
        <StatCard
          label="Total duration"
          :value="formatDuration(aiStats?.stats.total_duration || 0)"
          :icon="Timer"
          :loading="loading && !aiStats"
        />
        <StatCard label="Requests" :value="formatNumber(totalRequests)" :icon="Activity" :loading="loading && !aiStats" />
        <StatCard
          label="Active providers"
          :value="aiStats?.stats.provider_stats.length || 0"
          :icon="Layers"
          :loading="loading && !aiStats"
        />
      </StatGrid>

      <div v-if="aiStats" class="flex animate-enter flex-col gap-4">
        <!-- Provider split -->
        <SectionCard
          v-if="providerShares.length > 0"
          title="Requests by provider"
          :count="aiStats.stats.provider_stats.length"
          :icon="Layers"
          body-class="flex flex-col gap-3 py-3.5"
        >
          <div class="flex h-2 w-full gap-0.5 overflow-hidden rounded-full bg-surface-hover">
            <div
              v-for="share in providerShares"
              :key="share.provider"
              class="h-full first:rounded-l-full last:rounded-r-full"
              :style="{ width: `${share.percent}%`, backgroundColor: share.color }"
              :title="`${formatProvider(share.provider)}: ${share.percent.toFixed(1)}%`"
            />
          </div>
          <ul class="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-x-6 gap-y-2">
            <li v-for="share in providerShares" :key="share.provider" class="flex min-w-0 items-center gap-2 text-sm">
              <span class="size-2 shrink-0 rounded-full" :style="{ backgroundColor: share.color }" />
              <span class="min-w-0 flex-1 truncate text-fg">{{ formatProvider(share.provider) }}</span>
              <span class="tabular shrink-0 text-xs text-fg-muted">{{ formatNumber(share.count) }}</span>
              <span class="tabular w-10 shrink-0 text-right text-xs text-fg-subtle">{{ share.percent.toFixed(0) }}%</span>
            </li>
          </ul>
        </SectionCard>

        <!-- Breakdown -->
        <SectionCard
          :title="breakdownView === 'model' ? 'Usage by model' : 'Usage by operation'"
          :count="breakdownView === 'model' ? aiStats.stats.model_stats.length : aiStats.stats.operation_stats.length"
          :icon="breakdownView === 'model' ? Cpu : Workflow"
          flush
        >
          <template #actions>
            <SegmentedControl v-model="breakdownView" :options="breakdownOptions" size="sm" />
          </template>

          <div :key="breakdownView" class="animate-enter">
            <DataTable
              v-if="breakdownView === 'model'"
              bare
              :columns="modelColumns"
              :rows="aiStats.stats.model_stats"
              :row-key="(stat) => `${stat.provider}:${stat.model}`"
              :empty-icon="Cpu"
              empty-title="No usage data available"
            >
              <template #cell-name="{ row: stat }">
                <span class="block truncate font-medium text-fg">{{ stat.model }}</span>
              </template>
              <template #cell-provider="{ row: stat }">
                <span class="block truncate text-fg-muted">{{ formatProvider(stat.provider) }}</span>
              </template>
              <template #cell-count="{ row: stat }">
                <span class="tabular">{{ formatNumber(stat.count) }}</span>
              </template>
              <template #cell-tokens="{ row: stat }">
                <span class="tabular" :class="stat.total_tokens ? 'text-fg' : 'text-fg-subtle'">
                  {{ stat.total_tokens ? formatNumber(stat.total_tokens) : '—' }}
                </span>
              </template>
              <template #cell-duration="{ row: stat }">
                <span class="tabular whitespace-nowrap" :class="hasDuration(stat.total_duration) ? 'text-fg' : 'text-fg-subtle'">
                  {{ hasDuration(stat.total_duration) ? formatDuration(stat.total_duration) : '—' }}
                </span>
              </template>
            </DataTable>

            <DataTable
              v-else
              bare
              :columns="operationColumns"
              :rows="aiStats.stats.operation_stats"
              row-key="operation"
              :empty-icon="Workflow"
              empty-title="No usage data available"
            >
              <template #cell-name="{ row: stat }">
                <span class="block truncate font-medium text-fg">{{ formatOperation(stat.operation) }}</span>
              </template>
              <template #cell-count="{ row: stat }">
                <span class="tabular">{{ formatNumber(stat.count) }}</span>
              </template>
              <template #cell-tokens="{ row: stat }">
                <span class="tabular" :class="stat.total_tokens ? 'text-fg' : 'text-fg-subtle'">
                  {{ stat.total_tokens ? formatNumber(stat.total_tokens) : '—' }}
                </span>
              </template>
              <template #cell-duration="{ row: stat }">
                <span class="tabular whitespace-nowrap" :class="hasDuration(stat.total_duration) ? 'text-fg' : 'text-fg-subtle'">
                  {{ hasDuration(stat.total_duration) ? formatDuration(stat.total_duration) : '—' }}
                </span>
              </template>
            </DataTable>
          </div>
        </SectionCard>

        <!-- Recent activity -->
        <SectionCard
          v-if="aiStats.recent_logs.length > 0"
          title="Recent activity"
          :count="aiStats.recent_logs.length"
          :icon="History"
          flush
        >
          <DataTable bare :columns="logColumns" :rows="aiStats.recent_logs" row-key="id">
            <template #cell-time="{ row: log }">
              <span class="tabular block truncate text-fg">{{ formatDay(log.created_at) }}</span>
              <span class="tabular block truncate text-xs text-fg-subtle">{{ formatClock(log.created_at) }}</span>
            </template>
            <template #cell-user="{ row: log }">
              <code class="block truncate font-mono text-xs text-fg-muted" :title="log.user_wallet">
                {{ formatWalletAddress(log.user_wallet) || '—' }}
              </code>
            </template>
            <template #cell-operation="{ row: log }">
              <Badge variant="neutral" class="max-w-full">
                <span class="truncate">{{ formatOperation(log.operation) }}</span>
              </Badge>
            </template>
            <template #cell-model="{ row: log }">
              <span class="block truncate text-fg">{{ log.model }}</span>
              <span class="block truncate text-xs text-fg-subtle">{{ formatProvider(log.provider) }}</span>
            </template>
            <template #cell-usage="{ row: log }">
              <span v-if="log.tokens" class="tabular block truncate text-fg">{{ formatNumber(log.tokens) }} tokens</span>
              <span v-if="log.duration" class="tabular block truncate text-xs text-fg-subtle">
                {{ formatDuration(log.duration) }}
              </span>
              <span v-if="!log.tokens && !log.duration" class="text-fg-subtle">—</span>
            </template>
          </DataTable>
        </SectionCard>
      </div>

      <!-- Nothing loaded -->
      <EmptyState
        v-else-if="!loading"
        :icon="Activity"
        title="No AI usage data"
        description="Usage stats could not be loaded. Try refreshing."
      >
        <Button variant="secondary" @click="fetchAiStats">Try again</Button>
      </EmptyState>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { formatDate as formatDay, formatTime as formatClock } from '@/utils/dateTimeUtils';
  import { Activity, RefreshCw, Layers, Coins, Timer, Cpu, Workflow, History } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import { StatCard, StatGrid } from '@/components/ui/stat-card';
  import { SectionCard } from '@/components/ui/section-card';
  import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
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
  const loading = ref(false);

  const fetchAiStats = async () => {
    loading.value = true;
    try {
      const response = await api.get('/admin/ai-usage');
      if (response.data.success) {
        aiStats.value = response.data;
      }
    } catch (err) {
      console.error('Error fetching AI stats:', err);
    } finally {
      loading.value = false;
    }
  };

  const CHART_COLORS = ['var(--chart-1)', 'var(--chart-2)', 'var(--chart-3)', 'var(--chart-4)', 'var(--chart-5)'];

  const totalRequests = computed(() =>
    (aiStats.value?.stats.provider_stats || []).reduce((sum, stat) => sum + (stat.count || 0), 0)
  );

  const providerShares = computed(() => {
    const total = totalRequests.value;
    if (!aiStats.value || total === 0) return [];
    return [...aiStats.value.stats.provider_stats]
      .sort((a, b) => (b.count || 0) - (a.count || 0))
      .map((stat, index) => ({
        provider: stat.provider,
        count: stat.count || 0,
        percent: ((stat.count || 0) / total) * 100,
        color: CHART_COLORS[index % CHART_COLORS.length],
      }));
  });

  const breakdownView = ref<'model' | 'operation'>('model');
  const breakdownOptions: SegmentedOption<'model' | 'operation'>[] = [
    { value: 'model', label: 'By model' },
    { value: 'operation', label: 'By operation' },
  ];

  const modelColumns: DataTableColumn[] = [
    { key: 'name', label: 'Model' },
    { key: 'provider', label: 'Provider', width: '140px', hideBelow: 'md' },
    { key: 'count', label: 'Requests', width: '100px', align: 'right' },
    { key: 'tokens', label: 'Tokens', width: '120px', align: 'right' },
    { key: 'duration', label: 'Duration', width: '110px', align: 'right' },
  ];

  const operationColumns: DataTableColumn[] = [
    { key: 'name', label: 'Operation' },
    { key: 'count', label: 'Requests', width: '100px', align: 'right' },
    { key: 'tokens', label: 'Tokens', width: '120px', align: 'right' },
    { key: 'duration', label: 'Duration', width: '110px', align: 'right' },
  ];

  const PROVIDER_NAMES: Record<string, string> = {
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    deepgram: 'Deepgram',
    replicate: 'Replicate',
    google: 'Google',
    gemini: 'Gemini',
    elevenlabs: 'ElevenLabs',
    fal: 'fal',
  };

  const formatProvider = (provider: string) => {
    if (!provider) return '—';
    return PROVIDER_NAMES[provider.toLowerCase()] || provider.charAt(0).toUpperCase() + provider.slice(1);
  };

  const logColumns: DataTableColumn[] = [
    { key: 'time', label: 'Time', width: '120px' },
    { key: 'user', label: 'User', width: '120px', hideBelow: 'md' },
    { key: 'operation', label: 'Operation', width: '160px' },
    { key: 'model', label: 'Model' },
    { key: 'usage', label: 'Usage', width: '120px', align: 'right' },
  ];

  const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num || 0);

  const formatDuration = (seconds: string | number) => {
    const secs = Number(seconds) || 0;
    if (secs < 60) return `${secs.toFixed(1)}s`;
    const mins = Math.floor(secs / 60);
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    const remainingSecs = (secs % 60).toFixed(0);
    return `${mins}m ${remainingSecs}s`;
  };

  const hasDuration = (value: string | number | null | undefined) => !!value && parseFloat(String(value)) > 0;

  const formatOperation = (operation: string) => {
    const text = (operation || '').replace(/_/g, ' ').trim().replace(/\bai\b/gi, 'AI');
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const formatWalletAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  onMounted(() => {
    fetchAiStats();
  });
</script>
