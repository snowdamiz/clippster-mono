<template>
  <div class="submission-verification">
    <div class="submission-verification__header">
      <div>
        <h4 class="submission-verification__title">Verification Evidence</h4>
        <p class="submission-verification__subtitle">
          Metrics from PostForMe snapshots. Review warnings before verifying or paying.
        </p>
      </div>
      <button
        type="button"
        class="submission-verification__sync"
        :disabled="syncing"
        @click="$emit('sync')"
      >
        {{ syncing ? 'Syncing...' : 'Sync metrics' }}
      </button>
    </div>

    <div class="submission-verification__meta">
      <span>Feed match: {{ submission.feed_match_status || 'unknown' }}</span>
      <span v-if="submission.metrics_last_synced_at">
        Last synced: {{ formatRelativeTime(submission.metrics_last_synced_at) }}
      </span>
    </div>

    <div v-if="submission.verification_warnings?.length" class="submission-verification__warnings">
      <div
        v-for="warning in submission.verification_warnings"
        :key="warning"
        class="submission-verification__warning"
      >
        {{ warningLabel(warning) }}
      </div>
    </div>

    <div v-if="analytics?.trends" class="submission-verification__trends">
      <div class="submission-verification__metric">
        <span>Views</span>
        <strong>{{ analytics.trends.view_count ?? submission.view_count ?? 0 }}</strong>
      </div>
      <div class="submission-verification__metric">
        <span>Likes</span>
        <strong>{{ analytics.trends.like_count ?? submission.like_count ?? 0 }}</strong>
      </div>
      <div class="submission-verification__metric">
        <span>Comments</span>
        <strong>{{ analytics.trends.comment_count ?? submission.comment_count ?? 0 }}</strong>
      </div>
      <div class="submission-verification__metric">
        <span>Engagement rate</span>
        <strong>{{ formatRate(analytics.trends.engagement_rate) }}</strong>
      </div>
    </div>

    <div v-if="analytics?.snapshots?.length" class="submission-verification__history">
      <h5>Recent snapshots</h5>
      <div
        v-for="snapshot in analytics.snapshots.slice(0, 5)"
        :key="snapshot.id"
        class="submission-verification__snapshot"
      >
        <span>{{ formatRelativeTime(snapshot.inserted_at) }}</span>
        <span>{{ snapshot.view_count ?? 0 }} views</span>
        <span>{{ snapshot.like_count ?? 0 }} likes</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import {
    VERIFICATION_WARNING_LABELS,
    type CampaignSubmission,
    type CampaignSubmissionAnalytics,
  } from '@/services/campaignApi';

  defineProps<{
    submission: CampaignSubmission;
    analytics?: CampaignSubmissionAnalytics | null;
    syncing?: boolean;
  }>();

  defineEmits<{
    sync: [];
  }>();

  function warningLabel(code: string) {
    return VERIFICATION_WARNING_LABELS[code] || code;
  }

  function formatRate(rate: unknown) {
    if (typeof rate !== 'number') return '—';
    return `${(rate * 100).toFixed(2)}%`;
  }

  function formatRelativeTime(dateStr: string) {
    const date = new Date(dateStr);
    const diffMs = Date.now() - date.getTime();
    const diffHours = Math.floor(diffMs / 3600000);
    if (diffHours < 1) return 'just now';
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  }
</script>

<style scoped>
  .submission-verification {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
    padding: 0.875rem;
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
    background: rgba(255, 255, 255, 0.02);
  }

  .submission-verification__header {
    display: flex;
    justify-content: space-between;
    gap: 0.75rem;
    align-items: flex-start;
  }

  .submission-verification__title {
    margin: 0;
    font-size: 0.875rem;
    color: var(--sidebar-text);
  }

  .submission-verification__subtitle {
    margin: 0.25rem 0 0;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .submission-verification__sync {
    border: 1px solid var(--sidebar-border);
    background: transparent;
    color: var(--sidebar-text);
    border-radius: 6px;
    padding: 0.375rem 0.625rem;
    font-size: 0.75rem;
    cursor: pointer;
  }

  .submission-verification__meta {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .submission-verification__warnings {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .submission-verification__warning {
    padding: 0.5rem 0.625rem;
    border-radius: 6px;
    background: rgba(251, 191, 36, 0.12);
    color: #fcd34d;
    font-size: 0.75rem;
  }

  .submission-verification__trends {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 0.5rem;
  }

  .submission-verification__metric {
    display: flex;
    flex-direction: column;
    gap: 0.125rem;
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
  }

  .submission-verification__metric strong {
    color: var(--sidebar-text);
    font-size: 0.875rem;
  }

  .submission-verification__history h5 {
    margin: 0 0 0.375rem;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .submission-verification__snapshot {
    display: flex;
    gap: 0.75rem;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }
</style>
