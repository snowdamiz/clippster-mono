<template>
  <PageLayout
    title="Beta Codes"
    description="Generate and manage beta access codes"
    :show-header="true"
    :icon="KeyRound"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Beta Codes' }]"
  >
    <template #actions>
      <button class="admin-beta__action-btn" :disabled="loading" @click="fetchBetaCodes">
        <RefreshCw v-if="!loading" class="admin-beta__action-icon" />
        <Loader2 v-else class="admin-beta__action-icon admin-beta__action-icon--spin" />
        Refresh Codes
      </button>
    </template>

    <div class="admin-beta">
      <!-- Page Heading -->
      <div class="admin-beta__heading">
        <h1 class="admin-beta__title">Beta Codes</h1>
        <p class="admin-beta__subtitle">Generate and manage beta access codes</p>
      </div>

      <!-- Stats Cards -->
      <div class="admin-beta__cards">
        <div class="admin-beta__card">
          <div class="admin-beta__card-header">
            <div class="admin-beta__card-icon admin-beta__card-icon--amber">
              <KeyRound class="admin-beta__card-icon-svg" />
            </div>
            <h3 class="admin-beta__card-label">Total Codes</h3>
          </div>
          <p class="admin-beta__card-value">{{ betaCodeStats.total }}</p>
        </div>
        <div class="admin-beta__card">
          <div class="admin-beta__card-header">
            <div class="admin-beta__card-icon admin-beta__card-icon--green">
              <CheckCircle class="admin-beta__card-icon-svg" />
            </div>
            <h3 class="admin-beta__card-label">Available</h3>
          </div>
          <p class="admin-beta__card-value admin-beta__card-value--green">{{ betaCodeStats.available }}</p>
        </div>
        <div class="admin-beta__card">
          <div class="admin-beta__card-header">
            <div class="admin-beta__card-icon admin-beta__card-icon--amber">
              <XCircle class="admin-beta__card-icon-svg" />
            </div>
            <h3 class="admin-beta__card-label">Used</h3>
          </div>
          <p class="admin-beta__card-value admin-beta__card-value--amber">{{ betaCodeStats.used }}</p>
        </div>
      </div>

      <!-- Generate Codes Section -->
      <div class="admin-beta__generate">
        <div class="admin-beta__generate-info">
          <div class="admin-beta__generate-icon">
            <KeyRound class="admin-beta__generate-icon-svg" />
          </div>
          <div>
            <h2 class="admin-beta__generate-title">Generate Beta Codes</h2>
            <p class="admin-beta__generate-desc">Create new codes for beta testers</p>
          </div>
        </div>
        <div class="admin-beta__generate-actions">
          <input
            v-model.number="generateCodeCount"
            type="number"
            min="1"
            max="100"
            class="admin-beta__generate-input"
          />
          <button class="admin-beta__generate-btn" :disabled="generatingCodes" @click="handleGenerateCodes">
            <Loader2 v-if="generatingCodes" class="admin-beta__generate-btn-icon admin-beta__generate-btn-icon--spin" />
            <Plus v-else class="admin-beta__generate-btn-icon" />
            Generate
          </button>
          <button v-if="availableBetaCodes.length > 0" class="admin-beta__copy-all-btn" @click="copyAllAvailableCodes">
            <Copy class="admin-beta__copy-all-icon" />
            Copy All
          </button>
        </div>
      </div>

      <!-- Error Display -->
      <div v-if="error" class="admin-beta__error">
        <AlertTriangle class="admin-beta__error-icon" />
        <p class="admin-beta__error-text">{{ error }}</p>
      </div>

      <!-- Loading State -->
      <div v-if="loading && !betaCodes.length" class="admin-beta__loading">
        <Loader2 class="admin-beta__loading-icon" />
        <p class="admin-beta__loading-text">Loading beta codes...</p>
      </div>

      <!-- Beta Codes Table -->
      <div v-else-if="betaCodes.length > 0" class="admin-beta__table-wrapper">
        <div class="admin-beta__table-scroll">
          <table class="admin-beta__table">
            <thead class="admin-beta__thead">
              <tr>
                <th class="admin-beta__th">Code</th>
                <th class="admin-beta__th">Status</th>
                <th class="admin-beta__th">Used By</th>
                <th class="admin-beta__th">Created</th>
                <th class="admin-beta__th">Actions</th>
              </tr>
            </thead>
            <tbody class="admin-beta__tbody">
              <tr v-for="code in betaCodes" :key="code.id" class="admin-beta__row">
                <td class="admin-beta__td">
                  <code class="admin-beta__code">{{ code.code }}</code>
                </td>
                <td class="admin-beta__td">
                  <span v-if="code.used" class="admin-beta__status admin-beta__status--used">
                    <XCircle class="admin-beta__status-icon" />
                    Used
                  </span>
                  <span v-else class="admin-beta__status admin-beta__status--available">
                    <CheckCircle class="admin-beta__status-icon" />
                    Available
                  </span>
                </td>
                <td class="admin-beta__td">
                  <template v-if="code.used_by">
                    <span v-if="code.used_by.email" class="admin-beta__user">{{ code.used_by.email }}</span>
                    <code v-else-if="code.used_by.wallet_address" class="admin-beta__wallet">
                      {{ formatWalletAddress(code.used_by.wallet_address) }}
                    </code>
                    <span v-else class="admin-beta__user">User #{{ code.used_by.id }}</span>
                  </template>
                  <span v-else class="admin-beta__no-user">-</span>
                </td>
                <td class="admin-beta__td">
                  <span class="admin-beta__date">{{ formatDate(code.created_at) }}</span>
                </td>
                <td class="admin-beta__td">
                  <button v-if="!code.used" class="admin-beta__copy-btn" @click="copyBetaCode(code.code, code.id)">
                    <Check
                      v-if="copiedCodeId === code.id"
                      class="admin-beta__copy-icon admin-beta__copy-icon--success"
                    />
                    <Copy v-else class="admin-beta__copy-icon" />
                    {{ copiedCodeId === code.id ? 'Copied!' : 'Copy' }}
                  </button>
                  <span v-else class="admin-beta__used-at">
                    Used {{ code.used_at ? formatDate(code.used_at) : '' }}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Empty State -->
      <div v-else class="admin-beta__empty">
        <div class="admin-beta__empty-icon">
          <KeyRound class="admin-beta__empty-icon-svg" />
        </div>
        <p class="admin-beta__empty-text">No beta codes generated yet</p>
        <button class="admin-beta__empty-btn" :disabled="generatingCodes" @click="handleGenerateCodes">
          Generate Your First Codes
        </button>
      </div>
    </div>
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import { formatDateTime } from '@/utils/dateTimeUtils';
  import {
    KeyRound,
    RefreshCw,
    Loader2,
    CheckCircle,
    XCircle,
    Plus,
    Copy,
    Check,
    AlertTriangle,
  } from 'lucide-vue-next';
  import PageLayout from '@/components/PageLayout.vue';
  import { generateCodes, listCodes, type BetaCode, type BetaCodeStats } from '@/services/betaCodes';

  const betaCodes = ref<BetaCode[]>([]);
  const betaCodeStats = ref<BetaCodeStats>({ total: 0, used: 0, available: 0 });
  const loading = ref(false);
  const generatingCodes = ref(false);
  const generateCodeCount = ref(10);
  const error = ref<string | null>(null);
  const copiedCodeId = ref<number | null>(null);

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

<style scoped>
  .admin-beta {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1400px;
    margin: 0 auto;
    width: 100%;
  }

  .admin-beta__heading {
    margin-bottom: 0.5rem;
  }

  .admin-beta__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.2rem;
    letter-spacing: -0.02em;
  }

  .admin-beta__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-beta__action-btn {
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

  .admin-beta__action-btn:hover:not(:disabled) {
    opacity: 0.9;
  }
  .admin-beta__action-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-beta__action-icon {
    width: 14px;
    height: 14px;
  }
  .admin-beta__action-icon--spin {
    animation: spin 1s linear infinite;
  }

  .admin-beta__cards {
    display: grid;
    grid-template-columns: repeat(1, 1fr);
    gap: 1rem;
  }

  @media (min-width: 768px) {
    .admin-beta__cards {
      grid-template-columns: repeat(3, 1fr);
    }
  }

  .admin-beta__card {
    padding: 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .admin-beta__card-header {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    margin-bottom: 0.5rem;
  }

  .admin-beta__card-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .admin-beta__card-icon--amber {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(249, 115, 22, 0.2) 100%);
    border: 1px solid rgba(245, 158, 11, 0.3);
  }
  .admin-beta__card-icon--amber .admin-beta__card-icon-svg {
    color: #fbbf24;
  }

  .admin-beta__card-icon--green {
    background: linear-gradient(135deg, rgba(34, 197, 94, 0.2) 0%, rgba(16, 185, 129, 0.2) 100%);
    border: 1px solid rgba(34, 197, 94, 0.3);
  }
  .admin-beta__card-icon--green .admin-beta__card-icon-svg {
    color: #34d399;
  }

  .admin-beta__card-icon-svg {
    width: 16px;
    height: 16px;
  }

  .admin-beta__card-label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-beta__card-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0;
  }
  .admin-beta__card-value--green {
    color: #34d399;
  }
  .admin-beta__card-value--amber {
    color: #fbbf24;
  }

  .admin-beta__generate {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  @media (min-width: 640px) {
    .admin-beta__generate {
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
  }

  .admin-beta__generate-info {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .admin-beta__generate-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(249, 115, 22, 0.2) 100%);
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .admin-beta__generate-icon-svg {
    width: 20px;
    height: 20px;
    color: #fbbf24;
  }

  .admin-beta__generate-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }
  .admin-beta__generate-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-beta__generate-actions {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .admin-beta__generate-input {
    width: 5rem;
    padding: 0.5rem 0.75rem;
    background-color: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    color: var(--sidebar-text);
    font-size: 0.875rem;
  }

  .admin-beta__generate-input:focus {
    outline: none;
    border-color: rgba(245, 158, 11, 0.5);
    box-shadow: 0 0 0 2px rgba(245, 158, 11, 0.25);
  }

  .admin-beta__generate-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: linear-gradient(to right, #d97706, #ea580c);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-beta__generate-btn:hover:not(:disabled) {
    opacity: 0.9;
  }
  .admin-beta__generate-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-beta__generate-btn-icon {
    width: 16px;
    height: 16px;
  }
  .admin-beta__generate-btn-icon--spin {
    animation: spin 1s linear infinite;
  }

  .admin-beta__copy-all-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-beta__copy-all-btn:hover {
    background-color: rgba(63, 63, 70, 1);
    color: white;
  }

  .admin-beta__copy-all-icon {
    width: 16px;
    height: 16px;
  }

  .admin-beta__error {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 1rem;
    background-color: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 10px;
  }

  .admin-beta__error-icon {
    width: 16px;
    height: 16px;
    color: #f87171;
  }
  .admin-beta__error-text {
    font-size: 0.875rem;
    color: #fca5a5;
    margin: 0;
  }

  .admin-beta__loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 3rem;
  }

  .admin-beta__loading-icon {
    width: 32px;
    height: 32px;
    color: #fbbf24;
    animation: spin 1s linear infinite;
    margin-bottom: 1rem;
  }

  .admin-beta__loading-text {
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-beta__table-wrapper {
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    overflow: hidden;
  }

  .admin-beta__table-scroll {
    overflow-x: auto;
  }

  .admin-beta__table {
    width: 100%;
    border-collapse: collapse;
  }

  .admin-beta__thead {
    background-color: rgba(24, 24, 27, 0.8);
  }

  .admin-beta__th {
    padding: 0.875rem 1.25rem;
    text-align: left;
    font-size: 0.6875rem;
    font-weight: 600;
    color: var(--sidebar-text-muted);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .admin-beta__tbody {
    border-top: 1px solid var(--sidebar-border);
  }

  .admin-beta__row {
    transition: background-color 150ms ease;
  }
  .admin-beta__row:hover {
    background-color: rgba(39, 39, 42, 0.3);
  }
  .admin-beta__row:not(:last-child) {
    border-bottom: 1px solid rgba(39, 39, 42, 0.5);
  }

  .admin-beta__td {
    padding: 1rem 1.25rem;
    white-space: nowrap;
  }

  .admin-beta__code {
    font-size: 0.875rem;
    background-color: var(--sidebar-hover);
    padding: 0.375rem 0.625rem;
    border-radius: 8px;
    font-family: monospace;
    color: #fcd34d;
    letter-spacing: 0.05em;
  }

  .admin-beta__status {
    display: inline-flex;
    align-items: center;
    padding: 0.25rem 0.625rem;
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 500;
  }

  .admin-beta__status--available {
    background-color: rgba(34, 197, 94, 0.2);
    color: #86efac;
    border: 1px solid rgba(34, 197, 94, 0.3);
  }

  .admin-beta__status--used {
    background-color: rgba(245, 158, 11, 0.2);
    color: #fcd34d;
    border: 1px solid rgba(245, 158, 11, 0.3);
  }

  .admin-beta__status-icon {
    width: 12px;
    height: 12px;
    margin-right: 0.375rem;
  }

  .admin-beta__user {
    font-size: 0.875rem;
    color: var(--sidebar-text);
  }

  .admin-beta__wallet {
    font-size: 0.75rem;
    background-color: var(--sidebar-hover);
    padding: 0.375rem 0.625rem;
    border-radius: 8px;
    font-family: monospace;
    color: var(--sidebar-text);
  }

  .admin-beta__no-user {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
  }

  .admin-beta__date {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
  }

  .admin-beta__copy-btn {
    display: inline-flex;
    align-items: center;
    padding: 0.375rem 0.75rem;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-beta__copy-btn:hover {
    background-color: rgba(63, 63, 70, 1);
    color: white;
  }

  .admin-beta__copy-icon {
    width: 12px;
    height: 12px;
    margin-right: 0.375rem;
  }
  .admin-beta__copy-icon--success {
    color: #34d399;
  }

  .admin-beta__used-at {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .admin-beta__empty {
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 3rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
    text-align: center;
  }

  .admin-beta__empty-icon {
    width: 56px;
    height: 56px;
    border-radius: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(249, 115, 22, 0.2) 100%);
    border: 1px solid rgba(245, 158, 11, 0.3);
    margin-bottom: 1rem;
  }

  .admin-beta__empty-icon-svg {
    width: 28px;
    height: 28px;
    color: #fbbf24;
  }

  .admin-beta__empty-text {
    color: var(--sidebar-text-muted);
    margin: 0 0 1rem;
  }

  .admin-beta__empty-btn {
    padding: 0.5rem 1rem;
    background: linear-gradient(to right, #d97706, #ea580c);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
  }

  .admin-beta__empty-btn:hover:not(:disabled) {
    opacity: 0.9;
  }
  .admin-beta__empty-btn:disabled {
    opacity: 0.5;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
