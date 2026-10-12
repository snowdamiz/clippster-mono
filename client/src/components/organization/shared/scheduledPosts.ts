/**
 * Shared pieces for the scheduled-post lists (personal and organization):
 * status filter options, status badge tones, date formatting and the
 * cancel / retry actions.
 */
import { ref } from 'vue';
import type { BadgeVariants } from '@/components/ui/badge';
import type { SegmentedOption } from '@/components/ui/segmented-control';
import { useToast } from '@/composables/useToast';
import { cancelScheduledPost, retryScheduledPost, type ScheduledPost } from '@/services/schedulingApi';

export const SCHEDULED_POST_STATUS_OPTIONS: SegmentedOption<string>[] = [
  { value: 'all', label: 'All' },
  { value: 'scheduled', label: 'Scheduled' },
  { value: 'publishing', label: 'Publishing' },
  { value: 'published', label: 'Published' },
  { value: 'failed', label: 'Failed' },
  { value: 'canceled', label: 'Canceled' },
];

export function scheduledPostStatusVariant(status: string): BadgeVariants['variant'] {
  switch (status) {
    case 'scheduled':
      return 'brand';
    case 'publishing':
      return 'warning';
    case 'published':
      return 'success';
    case 'failed':
      return 'danger';
    default:
      return 'neutral';
  }
}

export function formatScheduledAt(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/** Cancel / retry confirmation state and actions; `reload` refreshes the list afterwards. */
export function useScheduledPostActions(reload: () => Promise<void>) {
  const { showToast } = useToast();

  const cancelingPost = ref<ScheduledPost | null>(null);
  const retryingPost = ref<ScheduledPost | null>(null);
  const saving = ref(false);

  function confirmCancel(post: ScheduledPost) {
    cancelingPost.value = post;
  }

  function confirmRetry(post: ScheduledPost) {
    retryingPost.value = post;
  }

  async function doCancel() {
    if (!cancelingPost.value) return;

    saving.value = true;
    try {
      const response = await cancelScheduledPost(cancelingPost.value.id);

      if (response.success) {
        showToast('Post canceled', 'success');
        cancelingPost.value = null;
        await reload();
      } else {
        showToast(response.error || 'Failed to cancel post', 'error');
      }
    } catch (err) {
      console.error('Failed to cancel post:', err);
      showToast('Failed to cancel post', 'error');
    } finally {
      saving.value = false;
    }
  }

  async function doRetry() {
    if (!retryingPost.value) return;

    saving.value = true;
    try {
      const response = await retryScheduledPost(retryingPost.value.id);

      if (response.success) {
        showToast('Post queued for retry', 'success');
        retryingPost.value = null;
        await reload();
      } else {
        showToast(response.error || 'Failed to retry post', 'error');
      }
    } catch (err) {
      console.error('Failed to retry post:', err);
      showToast('Failed to retry post', 'error');
    } finally {
      saving.value = false;
    }
  }

  return { cancelingPost, retryingPost, saving, confirmCancel, confirmRetry, doCancel, doRetry };
}
