<template>
  <PageLayout
    title="Beta codes"
    description="Generate and manage beta access codes"
    :icon="KeyRound"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Beta codes' }]"
  >
    <template #actions>
      <Button variant="ghost" size="icon-sm" title="Refresh codes" :disabled="loading" @click="fetchBetaCodes">
        <RefreshCw :class="{ 'animate-spin': loading }" />
      </Button>
    </template>

    <template #toolbar>
      <AdminFilterBar :count="betaCodes.length" count-label="code">
        <span class="text-xs text-fg-muted">Generate</span>
        <Input
          v-model.number="generateCodeCount"
          type="number"
          min="1"
          max="100"
          class="h-[var(--control-sm)] w-16 text-xs"
          aria-label="Number of codes"
        />
        <Button variant="primary" size="sm" :loading="generatingCodes" :disabled="generatingCodes" @click="handleGenerateCodes">
          <Plus v-if="!generatingCodes" />
          Generate codes
        </Button>
        <template #end>
          <Button v-if="availableBetaCodes.length > 0" variant="ghost" size="sm" @click="copyAllAvailableCodes">
            <Copy />
            Copy available
          </Button>
        </template>
      </AdminFilterBar>
    </template>

    <div class="flex flex-col gap-4 px-5 py-4">
      <StatGrid :count="3">
        <StatCard label="Total codes" :value="betaCodeStats.total" :icon="KeyRound" :loading="loading && !betaCodes.length" />
        <StatCard
          label="Available"
          :value="betaCodeStats.available"
          :icon="CheckCircle"
          tone="success"
          :loading="loading && !betaCodes.length"
        />
        <StatCard label="Used" :value="betaCodeStats.used" :icon="XCircle" :loading="loading && !betaCodes.length" />
      </StatGrid>

      <Alert v-if="error" variant="destructive">
        <AlertTriangle />
        <AlertDescription>{{ error }}</AlertDescription>
      </Alert>

      <DataTable :columns="columns" :rows="betaCodes" row-key="id" :loading="loading">
        <template #cell-code="{ row: code }">
          <code class="block truncate font-mono text-sm font-medium text-fg">{{ code.code }}</code>
        </template>
        <template #cell-status="{ row: code }">
          <Badge :variant="code.used ? 'neutral' : 'success'">{{ code.used ? 'Used' : 'Available' }}</Badge>
          <p v-if="code.used && code.used_at" class="mt-0.5 truncate text-2xs text-fg-subtle" :title="formatDate(code.used_at)">
            {{ formatShortDate(code.used_at) }}
          </p>
        </template>
        <template #cell-assigned="{ row: code }">
          <span v-if="code.assigned_email" class="block truncate text-fg" :title="code.assigned_email">
            {{ code.assigned_email }}
          </span>
          <span v-else class="text-fg-subtle">—</span>
        </template>
        <template #cell-verified="{ row: code }">
          <template v-if="code.verified_at">
            <p class="truncate text-xs text-fg-muted" :title="formatDate(code.verified_at)">{{ formatShortDate(code.verified_at) }}</p>
            <p v-if="code.verified_from_ip" class="truncate font-mono text-2xs text-fg-subtle">{{ code.verified_from_ip }}</p>
          </template>
          <span v-else class="text-fg-subtle">—</span>
        </template>
        <template #cell-created="{ row: code }">
          <span class="truncate text-xs text-fg-muted" :title="formatDate(code.created_at)">{{ formatShortDate(code.created_at) }}</span>
        </template>
        <template #actions="{ row: code }">
          <Button
            v-if="!code.used"
            variant="ghost"
            size="icon-sm"
            :title="copiedCodeId === code.id ? 'Copied!' : `Copy ${code.code}`"
            @click="copyBetaCode(code.code, code.id)"
          >
            <Check v-if="copiedCodeId === code.id" class="text-success" />
            <Copy v-else />
          </Button>
        </template>
        <template #empty>
          <EmptyState size="sm" :icon="KeyRound" title="No beta codes generated yet">
            <Button variant="secondary" size="sm" :disabled="generatingCodes" @click="handleGenerateCodes">
              <Plus />
              Generate codes
            </Button>
          </EmptyState>
        </template>
      </DataTable>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { formatDate as formatShortDate, formatDateTime } from '@/utils/dateTimeUtils';
  import {
    KeyRound,
    RefreshCw,
    CheckCircle,
    XCircle,
    Plus,
    Copy,
    Check,
    AlertTriangle,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { EmptyState } from '@/components/ui/empty-state';
  import { Input } from '@/components/ui/input';
  import { StatCard, StatGrid } from '@/components/ui/stat-card';
  import { DataTable, type DataTableColumn } from '@/components/ui/data-table';
  import { AdminFilterBar } from '@/components/admin/shared';
  import { generateCodes, listCodes, type BetaCode, type BetaCodeStats } from '@/services/betaCodes';

  const betaCodes = ref<BetaCode[]>([]);
  const betaCodeStats = ref<BetaCodeStats>({ total: 0, used: 0, available: 0 });
  const loading = ref(false);
  const generatingCodes = ref(false);
  const generateCodeCount = ref(10);
  const error = ref<string | null>(null);
  const copiedCodeId = ref<number | null>(null);

  const columns: DataTableColumn[] = [
    { key: 'code', label: 'Code', width: '140px' },
    { key: 'status', label: 'Status', width: '120px' },
    { key: 'assigned', label: 'Assigned to' },
    { key: 'verified', label: 'Verified', width: '136px', hideBelow: 'md' },
    { key: 'created', label: 'Created', width: '120px', hideBelow: 'lg' },
  ];

  const availableBetaCodes = computed(() => betaCodes.value.filter((code) => !code.used));

  const fetchBetaCodes = async () => {
    loading.value = true;
    error.value = null;
    try {
      const result = await listCodes();
      if (result.success) {
        betaCodes.value = result.codes;
        betaCodeStats.value = result.stats;
      } else {
        error.value = result.error || 'Failed to load beta codes';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      loading.value = false;
    }
  };

  const handleGenerateCodes = async () => {
    if (generateCodeCount.value < 1 || generateCodeCount.value > 100) {
      error.value = 'Please enter a number between 1 and 100';
      return;
    }
    generatingCodes.value = true;
    error.value = null;
    try {
      const result = await generateCodes(generateCodeCount.value);
      if (result.success) {
        await fetchBetaCodes();
      } else {
        error.value = result.error || 'Failed to generate codes';
      }
    } catch (err) {
      error.value = err instanceof Error ? err.message : 'Unknown error occurred';
    } finally {
      generatingCodes.value = false;
    }
  };

  const copyBetaCode = async (code: string, codeId: number) => {
    try {
      await navigator.clipboard.writeText(code);
      copiedCodeId.value = codeId;
      setTimeout(() => {
        copiedCodeId.value = null;
      }, 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const copyAllAvailableCodes = async () => {
    const availableCodes = betaCodes.value
      .filter((code) => !code.used)
      .map((code) => code.code)
      .join('\n');
    if (!availableCodes) {
      error.value = 'No available codes to copy';
      return;
    }
    try {
      await navigator.clipboard.writeText(availableCodes);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const formatWalletAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    try {
      return formatDateTime(dateString);
    } catch {
      return 'Invalid date';
    }
  };

  onMounted(() => {
    fetchBetaCodes();
  });
</script>
