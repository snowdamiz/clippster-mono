<template>
  <PageLayout
    title="Analytics"
    description="Track key user actions and events"
    :icon="BarChart3"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Analytics' }]"
  >
    <template #actions>
      <Button variant="ghost" size="icon-sm" title="Refresh analytics" :disabled="loading" @click="fetchAnalyticsStats">
        <RefreshCw :class="{ 'animate-spin': loading }" />
      </Button>
    </template>

    <div class="flex flex-col gap-4 px-5 py-4">
      <!-- Totals -->
      <StatGrid :count="3">
        <StatCard label="Today" :value="formatNumber(totals.today)" :icon="Clock" :loading="loading && !analyticsStats" />
        <StatCard
          label="This week"
          :value="formatNumber(totals.this_week)"
          :icon="CalendarDays"
          :loading="loading && !analyticsStats"
        />
        <StatCard label="All time" :value="formatNumber(totals.total)" :icon="Activity" :loading="loading && !analyticsStats" />
      </StatGrid>

      <!-- Per-event breakdown -->
      <DataTable
        :columns="columns"
        :rows="rows"
        row-key="key"
        :loading="loading"
        :skeleton-rows="5"
        :empty-icon="BarChart3"
        empty-title="No analytics data available"
        empty-description="Tracked events will show up here once users start taking actions."
      >
        <template #cell-event="{ row }">
          <span class="block truncate font-medium text-fg">{{ row.label }}</span>
        </template>
        <template #cell-today="{ row }">
          <span class="tabular" :class="row.today > 0 ? 'text-fg' : 'text-fg-subtle'">{{ formatNumber(row.today) }}</span>
        </template>
        <template #cell-this_week="{ row }">
          <span class="tabular" :class="row.this_week > 0 ? 'text-fg' : 'text-fg-subtle'">
            {{ formatNumber(row.this_week) }}
          </span>
        </template>
        <template #cell-total="{ row }">
          <span class="tabular font-medium text-fg">{{ formatNumber(row.total) }}</span>
        </template>
        <template #cell-share="{ row }">
          <div class="flex items-center gap-2.5">
            <div class="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-hover">
              <div class="h-full rounded-full bg-[var(--chart-1)]" :style="{ width: `${row.share}%` }" />
            </div>
            <span class="tabular w-10 shrink-0 text-right text-xs text-fg-subtle">{{ row.share.toFixed(0) }}%</span>
          </div>
        </template>
      </DataTable>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { BarChart3, Activity, RefreshCw, Clock, CalendarDays } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Button } from '@/components/ui/button';
  import { StatCard, StatGrid } from '@/components/ui/stat-card';
  import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
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
      clip_detection: 'Clip detection',
      clip_export: 'Clip export',
      vod_download: 'VOD download',
      user_created: 'User created',
      credits_purchased: 'Credits purchased',
      credits_spent: 'Credits spent',
    };
    if (names[eventType]) return names[eventType];
    const text = eventType.replace(/[_-]+/g, ' ').trim();
    return text.charAt(0).toUpperCase() + text.slice(1);
  };

  const formatNumber = (num: number) => new Intl.NumberFormat('en-US').format(num || 0);

  const columns: DataTableColumn[] = [
    { key: 'event', label: 'Event' },
    { key: 'today', label: 'Today', width: '96px', align: 'right' },
    { key: 'this_week', label: 'This week', width: '110px', align: 'right' },
    { key: 'total', label: 'Total', width: '110px', align: 'right' },
    { key: 'share', label: 'Share of total', width: '28%', hideBelow: 'md' },
  ];

  const totals = computed(() => {
    const result = { today: 0, this_week: 0, total: 0 };
    for (const stats of Object.values(analyticsStats.value || {})) {
      result.today += stats.today || 0;
      result.this_week += stats.this_week || 0;
      result.total += stats.total || 0;
    }
    return result;
  });

  const rows = computed(() =>
    Object.entries(analyticsStats.value || {})
      .map(([key, stats]) => ({
        key,
        label: formatEventName(key),
        today: stats.today || 0,
        this_week: stats.this_week || 0,
        total: stats.total || 0,
        share: totals.value.total > 0 ? ((stats.total || 0) / totals.value.total) * 100 : 0,
      }))
      .sort((a, b) => b.total - a.total)
  );

  onMounted(() => {
    fetchAnalyticsStats();
  });
</script>
